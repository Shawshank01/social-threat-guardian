// /routes/index.js
import express from "express";

const router = express.Router();

// test API
router.get("/", (req, res) => {
  res.send("✅ Express started");
});

//test health
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

export default router;