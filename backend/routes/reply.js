// /routes/reply.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createReply, listRepliesForPost, deleteReplyById } from "../models/replyModel.js";

const router = express.Router();

function sanitizePostId(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  return trimmed;
}

function sanitizeId(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  return trimmed;
}

router.get("/:postId", async (req, res) => {
  const postId = sanitizePostId(req.params.postId);
  if (!postId) {
    return res.status(400).json({ ok: false, error: "Invalid post identifier" });
  }

  try {
    const replies = await listRepliesForPost(postId);
    return res.json({ ok: true, count: replies.length, replies });
  } catch (err) {
    console.error("[GET /reply/:postId] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const replyId = sanitizeId(
    req.params.id ?? req.params.replyId ?? req.body?.id ?? req.body?.reply_id ?? req.body?.replyId,
  );
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (!replyId) {
    return res.status(400).json({ ok: false, error: "reply_id is required" });
  }

  try {
    const deleted = await deleteReplyById({ id: replyId, user_id: userId });
    if (deleted === 0) {
      return res.status(404).json({ ok: false, error: "Reply not found or not owned by user" });
    }
    return res.json({ ok: true, removed: deleted });
  } catch (err) {
    console.error("[DELETE /reply/:replyId] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/add", requireAuth, async (req, res) => {
  const postId = sanitizePostId(req.body?.post_id ?? req.body?.postId);
  const replyText = typeof req.body?.reply_text === "string" ? req.body.reply_text : req.body?.replyText;
  const userId = req.user?.id;
  const userName =
    (typeof req.user?.name === "string" && req.user.name.trim()) ||
    (typeof req.body?.user_name === "string" && req.body.user_name.trim()) ||
    (typeof req.body?.author_name === "string" && req.body.author_name.trim()) ||
    null;

  if (!userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (!postId) {
    return res.status(400).json({ ok: false, error: "post_id is required" });
  }
  if (!replyText || typeof replyText !== "string" || !replyText.trim()) {
    return res.status(400).json({ ok: false, error: "reply_text is required" });
  }

  try {
    const reply = await createReply({
      postId,
      userId,
      authorName: userName,
      replyText,
    });

    return res.status(201).json({ ok: true, reply });
  } catch (err) {
    console.error("[POST /reply/add] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
