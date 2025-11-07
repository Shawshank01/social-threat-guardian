// /routes/user.js
import express from "express";
import {
  createUserModel,
  getUserByIdModel,
  listUsersModel,
  deleteUserModel,
  updateUserEmailModel,
} from "../models/userModel.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * POST /users
 * Body: { email, name }
 * Create a new user
 */
router.post("/", async (req, res) => {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: "email is required" });

  try {
    const user = await createUserModel({ email, name });
    return res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error("[POST /users] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /users/:id
 * Get user details by ID
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await getUserByIdModel(id);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("[GET /users/:id] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /users
 * Optional query params: ?limit=50&offset=0
 * List users with pagination
 */
router.get("/", async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;

  try {
    const users = await listUsersModel(limit, offset);
    return res.json({ ok: true, count: users.length, users });
  } catch (err) {
    console.error("[GET /users] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * DELETE /users/:id
 * Delete a user by ID
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const affected = await deleteUserModel(id);
    if (affected === 0) return res.status(404).json({ ok: false, error: "User not found" });
    return res.json({ ok: true, deleted: id });
  } catch (err) {
    console.error("[DELETE /users/:id] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * PUT /users/email
 * Protected: Require jwt token in head
 * Body: { email }  (front-end handles format validation)
 */
router.put("/email", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.body?.user_id;
    const { email } = req.body || {};

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required" });
    }

    const updated = await updateUserEmailModel(userId, email);
    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({
      ok: true,
      user: updated,
    });
  } catch (err) {
    if (err?.code === "EMAIL_IN_USE") {
      return res.status(409).json({ ok: false, error: "email already in use" });
    }

    console.error("[PUT /users/email] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
