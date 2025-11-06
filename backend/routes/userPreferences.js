// /routes/userPreferences.js
import express from "express";
import {
  getUserPreferenceModel,
  upsertUserPreferenceModel,
} from "../models/userPreferenceModel.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { userId, user_id, id } = req.query || {};
    const resolvedUserId = String(userId || user_id || id || "").trim();

    if (!resolvedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const preferences = await getUserPreferenceModel(resolvedUserId);

    if (!preferences) {
      return res.json({
        ok: true,
        preferences: {
          userId: resolvedUserId,
          keywords: [],
          languages: [],
        },
      });
    }

    return res.json({
      ok: true,
      preferences: {
        userId: preferences.userId,
        keywords: preferences.keywords,
        languages: preferences.languages,
      },
    });
  } catch (err) {
    console.error("[GET /user-preferences] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/get", async (req, res) => {
  try {
    const { userId, user_id, id } = req.body || {};
    const resolvedUserId = String(userId || user_id || id || "").trim();

    if (!resolvedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const preferences = await getUserPreferenceModel(resolvedUserId);

    if (!preferences) {
      return res.json({});
    }

    return res.json({
      ID: preferences.id,
      KEYWORDS: preferences.keywords,
      LANGUAGES: preferences.languages,
    });
  } catch (err) {
    console.error("[POST /user-preferences/get] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { id, userId, user_id, keywords, keyword, languages, language } = req.body || {};

    const resolvedUserId = String(userId || user_id || id || "").trim();
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
