// /middleware/requireAuth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Authorization token is required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.sub || decoded?.id;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Invalid token payload" });
    }

    req.user = {
      id: userId,
      email: decoded?.email,
      name: decoded?.name,
    };

    if (!req.body || typeof req.body !== "object") {
      req.body = {};
    }

    req.body.user_id = userId;

    next();
  } catch (err) {
    console.error("[requireAuth] error verifying token:", err);
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
