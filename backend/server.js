// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import dbTestRouter from "./routes/dbtest.js";
import { initOraclePool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import userRouter from "./routes/user.js";
import { ensureUsersTable } from "./models/userModel.js";
import indexRouter from "./routes/index.js";
import pushRouter from "./routes/push.js";
import authRouter from "./routes/auth.js";

dotenv.config({ override: true });


// handle dir name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins.length > 0
        ? allowedOrigins
        : ["https://social-threat-guardian-g1ys99v08-shawshank01s-projects-e5edc463.vercel.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//oracle connection
await initOraclePool();
await ensureUsersTable();

// routes
app.use("/", indexRouter);
app.use("/push", pushRouter);
app.use("/db", dbTestRouter);
app.use("/users", userRouter);
app.use("/auth", authRouter);
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use(errorHandler);


// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on http://0.0.0.0:${PORT}`);
});
