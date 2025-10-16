// /controllers/pushController.js
import { getVapidPublicKey, sendToSubscription } from "../push/webpush.js";

// In-memory subscription store (replace with DB in production)
const subscriptions = new Map(); // key: endpoint, value: full subscription object

/** GET /push/vapidPublicKey */
export function getPublicKey(req, res) {
  return res.json({ key: getVapidPublicKey() });
}

/** POST /push/subscribe  Body: subscription object */
export function subscribe(req, res) {
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ ok: false, error: "Invalid subscription" });
  }
  subscriptions.set(sub.endpoint, sub);
  return res.status(201).json({ ok: true });
}

/** POST /push/unsubscribe  Body: { endpoint } */
export function unsubscribe(req, res) {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const removed = subscriptions.delete(endpoint);
  return res.json({ ok: true, removed });
}

/** POST /push/send  Body: { endpoint, title, body, data } */
export async function sendToOne(req, res) {
  const { endpoint, title, body, data } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  const sub = subscriptions.get(endpoint);
  if (!sub) return res.status(404).json({ ok: false, error: "Subscription not found" });

  try {
    await sendToSubscription(sub, { title: title || "Notification", body: body || "", data });
    return res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      subscriptions.delete(endpoint);
    }
    console.error("[pushController.sendToOne] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

/** POST /push/broadcast  Body: { title, body, data } */
export async function broadcast(req, res) {
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

  return res.json({ ok: true, count: results.length, results });
}