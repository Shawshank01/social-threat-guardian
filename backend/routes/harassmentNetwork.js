import express from "express";
import { getCliqueGraph } from "../services/graphService.js";

const router = express.Router();

function parseLimit(value) {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

router.get("/cliques", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);

    const keyword = req.query.q;

    const data = await getCliqueGraph({ keyword, limit });

    return res.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error("[GET /harassment-network/cliques] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to fetch graph",
    });
  }
});

export default router;