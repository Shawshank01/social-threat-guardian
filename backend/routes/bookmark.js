// /routes/bookmark.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getBookmarks,
  addBookmarks,
  deleteBookmarks
} from "../models/bookmarkModel.js";

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

export default router;
