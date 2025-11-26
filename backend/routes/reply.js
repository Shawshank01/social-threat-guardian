// /routes/reply.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createReply } from "../models/replyModel.js";

const router = express.Router();

function sanitizePostId(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  return trimmed;
}

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
