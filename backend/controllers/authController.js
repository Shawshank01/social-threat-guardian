// /controllers/authController.js
import bcrypt from "bcryptjs";
import {
  createUserModel,
  findByEmailModel,
  updateLastLoginModel,
} from "../models/userModel.js";
import jwt from "jsonwebtoken";
/**
 * POST /auth/register
 * Body: { email, password, name? }
 * 1) check pwd and email
 * 2) check email duplicate
 * 3) hash password
 * 4) return information
 */
export async function register(req, res) {
  try {
    const { email, password, name } = req.body || {};
    const normEmail = String(email || "").trim().toLowerCase();

    // check pwd and email
    if (!normEmail || !password) {
      return res.status(400).json({ ok: false, error: "email and password are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return res.status(400).json({ ok: false, error: "invalid email format" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ ok: false, error: "password must be at least 8 characters" });
    }

    // check email duplicate
    const existing = await findByEmailModel(normEmail);
    if (existing) {
      return res.status(409).json({ ok: false, error: "email already registered" });
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // write hash password into oracle database
    const user = await createUserModel({ email: normEmail, name, passwordHash });

    // return user information
    return res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error("[authController.register] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}


export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const normEmail = String(email || "").trim().toLowerCase();

    if (!normEmail || !password) {
      return res.status(400).json({ ok: false, error: "email and password are required" });
    }

    const user = await findByEmailModel(normEmail);
    // check calidation 
    if (!user) {
      return res.status(401).json({ ok: false, error: "invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "invalid email or password" });
    }

    // generate JWT token
    const payload = { sub: user.ID, email: user.EMAIL };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    });

    // update last login time
    await updateLastLoginModel(user.ID);

    return res.json({
      ok: true,
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      user: { id: user.ID, email: user.EMAIL, name: user.NAME },
    });
  } catch (err) {
    console.error("[authController.login] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}