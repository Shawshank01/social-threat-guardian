// /routes/userPreferences.js
import express from "express";
import { upsertUserPreferenceModel } from "../models/userPreferenceModel.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { userId, user_id, keywords, keyword, languages, language } = req.body || {};

    const resolvedUserId = String(userId || user_id || "").trim();
    if (!resolvedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const keywordsInput = keywords !== undefined ? keywords : keyword;
    const languagesInput = languages !== undefined ? languages : language;

    const preferences = await upsertUserPreferenceModel({
      userId: resolvedUserId,
      keywords: keywordsInput,
      languages: languagesInput,
    });

    return res.json({
      ok: true,
      message: "User preferences saved",
      preferences,
    });
  } catch (err) {
    console.error("[POST /user-preferences] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
