// /routes/bookmark.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getFavoriteByUserAndProcessedId, upsertFavoriteForUser } from "../models/bookmarkModel.js";

const router = express.Router();

router.post("/add", requireAuth, async (req, res) => {
  const postIdRaw = req.body?.post_id ?? req.body?.postId ?? req.body?.processedId;
  const postId = typeof postIdRaw === "string" ? postIdRaw.trim() : "";
  const userId = req.user?.id;

  if (!postId) {
    return res.status(400).json({ ok: false, error: "post_id is required" });
  }

  try {
    await upsertFavoriteForUser(userId, { processedId: postId });
    const bookmark = await getFavoriteByUserAndProcessedId(userId, postId);

    return res.status(201).json({
      ok: true,
      message: "Bookmark saved",
      bookmark: bookmark || null,
    });
  } catch (error) {
    console.error("[POST /bookmark/add] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

export default router;
