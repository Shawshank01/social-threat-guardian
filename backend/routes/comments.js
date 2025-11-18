// /routes/comments.js
import express from "express";
// import Fuse from "fuse.js";
import { fetchLatestComments } from "../models/commentModel.js";
import { createCommentForPost, listCommentsForPost } from "../models/commentNoteModel.js";

const router = express.Router();

// Extend this map when onboard new datasets to control the friendly label that appears in responses.
const PLATFORM_LABELS = {
  BLUSKY_TEST: "Blusky",
};

function sanitizeTableName(value) {
  if (value === undefined || value === null) return "BLUSKY_TEST";
  const upper = String(value).trim().toUpperCase();
  if (!upper) return "BLUSKY_TEST";
  if (!/^[A-Z0-9_]+$/.test(upper)) return null;
  return upper;
}

function resolvePlatformLabel(tableName) {
  return PLATFORM_LABELS[tableName] || tableName;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(diffMs / day);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function mapCommentRow(row, platformLabel) {
  return {
    post_id: row.POST_ID,
    postText: row.POST_TEXT,
    predIntent: row.PRED_INTENT,
    predIntensity: row.PRED_INTENSITY,
    platform: platformLabel,
    hateScore: row.HATE_SCORE,
    postUrl: row.POST_URL || null,
    timeAgo: formatTimeAgo(row.POST_TIMESTAMP),
    collectedAt: row.POST_TIMESTAMP ?? null,
  };
}

router.get("/latest", async (req, res) => {
  const limit = Number(req.query.limit) || 4;

  try {
    const predIntent =
      req.query.predIntent !== undefined ? String(req.query.predIntent).trim() : undefined;
    const tableName = sanitizeTableName(req.query.source);

    if (!tableName) {
      return res.status(400).json({ ok: false, error: "Invalid source table" });
    }

    const rows = await fetchLatestComments(limit, { predIntent, tableName });
    const platformLabel = resolvePlatformLabel(tableName);

    const comments = rows.map((row) => mapCommentRow(row, platformLabel));

    return res.json({ ok: true, count: comments.length, comments, platform: platformLabel });
  } catch (err) {
    console.error("[GET /comments/latest] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/search", async (req, res) => {
  const { keywords, limit = 4, predIntent, source } = req.body || {};
  const parsedLimit = Number(limit) || 4;

  const keywordList = Array.isArray(keywords)
    ? keywords
        .map((kw) => (kw === undefined || kw === null ? "" : String(kw).trim()))
        .filter((kw) => kw.length > 0)
    : [];

  if (keywordList.length === 0) {
    return res.status(400).json({ ok: false, error: "keywords array is required" });
  }

  // Limit to prevent excessive round-trips
  const cappedKeywords = keywordList.slice(0, 10);

  const tableName = sanitizeTableName(source);

  if (!tableName) {
    return res.status(400).json({ ok: false, error: "Invalid source table" });
  }

  const platformLabel = resolvePlatformLabel(tableName);

  try {
    // const fuzzySearchSampleSize = Math.min(50, Math.max(parsedLimit * 3, parsedLimit));
    // const candidateRows = await fetchLatestComments(fuzzySearchSampleSize, {
    //   predIntent,
    //   tableName,
    // });

    // const fuse = new Fuse(candidateRows, {
    //   keys: ["POST_TEXT"],
    //   includeScore: true,
    //   threshold: 0.35,
    //   ignoreLocation: true,
    //   minMatchCharLength: 1,
    // });

    // const results = cappedKeywords.map((keyword) => {
    //   const matches = fuse.search(keyword).slice(0, parsedLimit);
    //   const comments = matches.map(({ item }) => mapCommentRow(item, platformLabel));
    //   return {
    //     keyword,
    //     count: comments.length,
    //     comments,
    //   };
    // });

    const results = [];
    for (const keyword of cappedKeywords) {
      const rows = await fetchLatestComments(parsedLimit, {
        predIntent,
        tableName,
        keyword,
      });

      const comments = rows.map((row) => mapCommentRow(row, platformLabel));
      results.push({
        keyword,
        count: comments.length,
        comments,
      });
    }

    return res.json({
      ok: true,
      results,
      platform: platformLabel,
      keywordCount: results.length,
    });
  } catch (err) {
    console.error("[POST /comments/search] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get("/:processedId/notes", async (req, res) => {
  const processedId = sanitizeProcessedId(req.params.processedId);
  if (!processedId) {
    return res.status(400).json({ ok: false, error: "Invalid post identifier" });
  }

  try {
    const comments = await listCommentsForPost(processedId);
    return res.json({ ok: true, count: comments.length, comments });
  } catch (err) {
    console.error("[GET /comments/:processedId/notes] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/:processedId/notes", async (req, res) => {
  const processedId = sanitizeProcessedId(req.params.processedId);
  if (!processedId) {
    return res.status(400).json({ ok: false, error: "Invalid post identifier" });
  }

  const { userId, author, commentText } = req.body || {};
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ ok: false, error: "userId is required" });
  }
  if (!commentText || typeof commentText !== "string" || !commentText.trim()) {
    return res.status(400).json({ ok: false, error: "commentText is required" });
  }

  try {
    const comment = await createCommentForPost({
      postId: processedId,
      userId: userId.trim(),
      authorName: typeof author === "string" ? author.trim() : null,
      commentText,
    });

    return res.status(201).json({ ok: true, comment });
  } catch (err) {
    console.error("[POST /comments/:processedId/notes] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
function sanitizeProcessedId(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  return trimmed;
}
