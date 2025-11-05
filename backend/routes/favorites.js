// /routes/favorites.js
import express from "express";
import {
  deleteFavoriteForUser,
  getFavoriteByUserAndProcessedId,
  listFavoritesByUser,
  upsertFavoriteForUser,
} from "../models/favoriteModel.js";

const router = express.Router();

const mapFavoriteRow = (row) => ({
  userId: row.USER_ID,
  processedId: row.PROCESSED_ID,
  platform: row.PLATFORM ?? null,
  sourceTable: row.SOURCE_TABLE ?? null,
  keyword: row.KEYWORD ?? null,
  postText: row.POST_TEXT ?? null,
  predIntent: row.PRED_INTENT ?? null,
  timeAgo: row.TIME_AGO ?? null,
  collectedAt: row.COLLECTED_AT ?? null,
  savedAt: row.SAVED_AT ?? null,
});

router.get("/", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({ ok: false, error: "userId is required" });
  }

  try {
    const favorites = await listFavoritesByUser(userId);
    return res.json({
      ok: true,
      count: favorites.length,
      favorites: favorites.map(mapFavoriteRow),
    });
  } catch (error) {
    console.error("[GET /favorites] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.get("/:processedId", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  const processedId = req.params.processedId?.trim();

  if (!userId) {
    return res.status(400).json({ ok: false, error: "userId is required" });
  }
  if (!processedId) {
    return res.status(400).json({ ok: false, error: "processedId is required" });
  }

  try {
    const favorite = await getFavoriteByUserAndProcessedId(userId, processedId);
    if (!favorite) {
      return res.status(404).json({ ok: false, error: "Favorite not found" });
    }
    return res.json({ ok: true, favorite: mapFavoriteRow(favorite) });
  } catch (error) {
    console.error("[GET /favorites/:processedId] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post("/", async (req, res) => {
  const { userId, processedId, platform, sourceTable, keyword, postText, predIntent, timeAgo, collectedAt } =
    req.body || {};

  if (!userId || !processedId) {
    return res.status(400).json({ ok: false, error: "userId and processedId are required" });
  }

  try {
    await upsertFavoriteForUser(userId, {
      processedId,
      platform,
      sourceTable,
      keyword,
      postText,
      predIntent,
      timeAgo,
      collectedAt,
    });

    const favorite = await getFavoriteByUserAndProcessedId(userId, processedId);

    return res.status(201).json({ ok: true, favorite: favorite ? mapFavoriteRow(favorite) : null });
  } catch (error) {
    console.error("[POST /favorites] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.delete("/:processedId", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  const processedId = req.params.processedId?.trim();

  if (!userId) {
    return res.status(400).json({ ok: false, error: "userId is required" });
  }
  if (!processedId) {
    return res.status(400).json({ ok: false, error: "processedId is required" });
  }

  try {
    const removed = await deleteFavoriteForUser(userId, processedId);
    if (removed === 0) {
      return res.status(404).json({ ok: false, error: "Favorite not found" });
    }
    return res.json({ ok: true, removed: processedId });
  } catch (error) {
    console.error("[DELETE /favorites/:processedId] error:", error);
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

export default router;
