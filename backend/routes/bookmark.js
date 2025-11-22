// /routes/bookmark.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getBookmarks,
  addBookmarks,
  deleteBookmarks
} from "../models/bookmarkModel.js";
import { fetchPostsByIds } from "../models/commentModel.js";

const router = express.Router();

router.post("/add", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const postId = req.body?.post_id || req.body?.postId;

  if (!postId) {
    return res.status(400).json({ ok: false, error: "post_id is required" });
  }

  try {
    const bookmark = await addBookmarks(userId, postId);
    if (!bookmark) {
      return res.status(500).json({ ok: false, error: "Failed to create bookmark" });
    }
    return res.status(201).json({ ok: true, bookmark });
  } catch (error) {
    if (error?.errorNum === 1) {
      return res.status(409).json({ ok: false, error: "Bookmark already exists for this post" });
    }
    console.error("[POST /bookmark] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.delete("/remove", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const postId = req.body?.post_id || req.body?.postId;

  if (!postId) {
    return res.status(400).json({ ok: false, error: "post_id is required" });
  }

  try {
    const removed = await deleteBookmarks(userId, postId);
    if (!removed) {
      return res.status(404).json({ ok: false, error: "Bookmark not found" });
    }
    return res.json({ ok: true, removed });
  } catch (error) {
    console.error("[DELETE /bookmark/remove] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user?.id;

  try {
    const bookmarks = await getBookmarks(userId);
    return res.json({
      ok: true,
      count: bookmarks.length,
      bookmarks,
    });
  } catch (error) {
    console.error("[GET /bookmark] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.get("/content", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const tableName = sanitizeTableName(req.query.source);

  if (!tableName) {
    return res.status(400).json({ ok: false, error: "Invalid source table" });
  }

  try {
    const bookmarks = await getBookmarks(userId);
    const postIds = bookmarks
      .map((bm) => bm.PROCESSED_ID)
      .filter((id) => typeof id === "string" && id.trim().length > 0);

    if (postIds.length === 0) {
      return res.json({ ok: true, count: 0, posts: [] });
    }

    const rows = await fetchPostsByIds(postIds, { tableName });
    const rowMap = new Map(rows.map((row) => [row.POST_ID, row]));

    const posts = [];
    for (const bm of bookmarks) {
      const row = rowMap.get(bm.PROCESSED_ID);
      if (!row) continue;
      posts.push({
        postId: row.POST_ID,
        postUrl: row.POST_URL || null,
        postText: row.POST_TEXT || null,
        postTimestamp: row.POST_TIMESTAMP || null,
        savedAt: bm.SAVED_AT ?? bm.CREATED_AT ?? null,
        bookmarkId: bm.BOOKMARK_ID,
      });
    }

    return res.json({
      ok: true,
      count: posts.length,
      posts,
      source: tableName,
    });
  } catch (error) {
    console.error("[GET /bookmark/content] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

function sanitizeTableName(value) {
  if (value === undefined || value === null) return "BLUSKY_TEST";
  const upper = String(value).trim().toUpperCase();
  if (!upper) return "BLUSKY_TEST";
  if (!/^[A-Z0-9_]+$/.test(upper)) return null;
  return upper;
}

export default router;
