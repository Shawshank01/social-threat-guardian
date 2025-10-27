// /routes/auth.js
import express from "express";
import { register, login } from "../controllers/authController.js";

const router = express.Router();

// register API
router.post("/register", register);
router.post("/login", login);


export default router;