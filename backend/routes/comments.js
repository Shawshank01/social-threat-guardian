// /routes/comments.js
import express from "express";
import { fetchLatestComments } from "../models/commentModel.js";

const router = express.Router();

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

router.get("/latest", async (req, res) => {
  const limit = Number(req.query.limit) || 4;
  const predIntent = req.query.predIntent ? String(req.query.predIntent) : null;

  try {
    const rows = await fetchLatestComments(limit, { predIntent });
    const comments = rows.map((row) => ({
      postText: row.POST_TEXT,
      predIntent: row.PRED_INTENT,
      timeAgo: formatTimeAgo(row.POST_TIMESTAMP),
    }));

    return res.json({ ok: true, count: comments.length, comments });
  } catch (err) {
    console.error("[GET /comments/latest] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
