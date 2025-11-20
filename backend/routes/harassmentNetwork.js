// /routes/harassmentNetwork.js
import express from "express";
import { getCliqueGraph } from "../services/graphService.js";

const router = express.Router();

function parseLimit(value) {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseTable(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

router.get("/cliques", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const tableName = parseTable(req.query.table || req.query.source);

    const data = await getCliqueGraph({ limit, tableName });

    return res.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error("[GET /harassment-network/cliques] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to fetch harassment network cliques",
    });
  }
});

export default router;
