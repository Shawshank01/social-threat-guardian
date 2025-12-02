// /routes/threatTrend.js
import express from "express";
import { fetchThreatTrend } from "../services/threatTrendService.js";

const router = express.Router();

const ALLOWED_LEVELS = new Set(["minute", "hour", "day"]);

function sanitizeAggLevel(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!ALLOWED_LEVELS.has(key)) return null;
  return key;
}

function parseIsoDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

router.get("/threat-index/trend", async (req, res) => {
  const aggLevel = sanitizeAggLevel(req.query.aggLevel || req.query.agg_level || "minute");
  if (!aggLevel) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid aggLevel; use minute | hour | day" });
  }

  const targetTable =
    typeof req.query.target === "string" && req.query.target.trim()
      ? req.query.target.trim()
      : undefined;

  try {
    const data = await fetchThreatTrend({
      aggLevel,
      targetTable,
    });
    return res.json({ ok: true, aggLevel, count: data.length, data });
  } catch (err) {
    const message = err?.message || String(err);
    console.error("[GET /threat-index/trend] error:", err);
    return res.status(500).json({ ok: false, error: message });
  }
});

export default router;
