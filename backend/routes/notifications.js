// /routes/notifications.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  listNotificationsForUser,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../models/notificationModel.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset, unreadOnly } = req.query;
    const notifications = await listNotificationsForUser(req.user.id, {
      limit,
      offset,
      unreadOnly: unreadOnly === "true" || unreadOnly === true,
    });
    res.json({ ok: true, data: notifications });
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", async (req, res, next) => {
  try {
    const count = await countUnreadNotifications(req.user.id);
    res.json({ ok: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await markNotificationRead(id, req.user.id);
    res.json({ ok: true, data: { updated } });
  } catch (err) {
    next(err);
  }
});

router.post("/read-all", async (req, res, next) => {
  try {
    const updatedCount = await markAllNotificationsRead(req.user.id);
    res.json({ ok: true, data: { updatedCount } });
  } catch (err) {
    next(err);
  }
});

export default router;
