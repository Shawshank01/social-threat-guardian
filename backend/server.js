// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dbTestRouter from "./routes/dbtest.js";
import { initOraclePool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { corsMiddleware } from "./middleware/cors.js";
import userRouter from "./routes/user.js";
import { ensureUsersTable } from "./models/userModel.js";
import indexRouter from "./routes/index.js";
import pushRouter from "./routes/push.js";
import authRouter from "./routes/auth.js";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(corsMiddleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

try {
  await initOraclePool();
  await ensureUsersTable();
} catch (err) {
  console.error("[Startup] Failed to initialize Oracle pool:", err);
  process.exit(1);
}

app.use("/", indexRouter);
app.use("/push", pushRouter);
app.use("/db", dbTestRouter);
app.use("/users", userRouter);
app.use("/auth", authRouter);
app.use("/api", authRouter); // Mirror /auth endpoints for frontend expectations

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
