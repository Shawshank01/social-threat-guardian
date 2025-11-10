// server.js
import express from "express";
import dotenv from "dotenv";
import dbTestRouter from "./routes/dbtest.js";
import { initOraclePool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { corsMiddleware } from "./middleware/cors.js";
import userRouter from "./routes/user.js";
import { ensureUsersTable } from "./models/userModel.js";
import { ensureUserPreferencesTable } from "./models/userPreferenceModel.js";
import { ensureFavoritesTable } from "./models/bookmarkModel.js";
import { ensureCommentsTable } from "./models/commentNoteModel.js";
import indexRouter from "./routes/index.js";
import pushRouter from "./routes/push.js";
import authRouter from "./routes/auth.js";
import commentsRouter from "./routes/comments.js";
import userPreferencesRouter from "./routes/userPreferences.js";
import favoritesRouter from "./routes/bookmark.js";

dotenv.config({ override: true });

const app = express();

app.use(corsMiddleware);
app.use(express.json());

try {
  await initOraclePool();
  await ensureUsersTable();
  await ensureUserPreferencesTable();
  await ensureFavoritesTable();
  await ensureCommentsTable();
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
app.use("/comments", commentsRouter);
app.use("/user-preferences", userPreferencesRouter);
app.use("/bookmark", favoritesRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
