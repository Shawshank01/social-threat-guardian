// /routes/push.js
import express from "express";
import { getVapidPublicKey, sendToSubscription } from "../push/webpush.js";

const router = express.Router();

// In-memory subscription store (replace with DB in production)
const subscriptions = new Map(); // key: endpoint, value: full subscription object

/**
 * GET /push/vapidPublicKey
 * Returns the public VAPID key for the browser to subscribe
 */
router.get("/vapidPublicKey", (req, res) => {
  res.json({ key: getVapidPublicKey() });
});

/**
 * POST /push/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, ... }
 */
router.post("/subscribe", (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ ok: false, error: "Invalid subscription" });
  }
  subscriptions.set(sub.endpoint, sub);
  return res.status(201).json({ ok: true });
});

/**
 * POST /push/unsubscribe
 * Body: { endpoint }
 */
router.post("/unsubscribe", (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const removed = subscriptions.delete(endpoint);
  res.json({ ok: true, removed });
});

/**
 * POST /push/send
 * Send a push to a single subscription
 * Body: { endpoint, title, body, data }
 */
router.post("/send", async (req, res) => {
  const { endpoint, title, body, data } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  const sub = subscriptions.get(endpoint);
  if (!sub) return res.status(404).json({ ok: false, error: "Subscription not found" });

  try {
    await sendToSubscription(sub, { title: title || "Notification", body: body || "", data });
    return res.json({ ok: true });
  } catch (err) {
    // Clean up gone subscriptions
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      subscriptions.delete(endpoint);
    }
    console.error("[/push/send] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * POST /push/broadcast
 * Send a push to all stored subscriptions
 * Body: { title, body, data }
 */
router.post("/broadcast", async (req, res) => {
  const { title, body, data } = req.body || {};

  const results = [];
  for (const [, sub] of subscriptions) {
    try {
      await sendToSubscription(sub, { title: title || "Broadcast", body: body || "", data });
      results.push({ endpoint: sub.endpoint, ok: true });
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        subscriptions.delete(sub.endpoint);
      }
      results.push({ endpoint: sub.endpoint, ok: false, error: err.message || String(err) });
    }
  }
  res.json({ ok: true, count: results.length, results });
});

export default router;