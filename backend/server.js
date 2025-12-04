// server.js
import express from "express";
import dotenv from "dotenv";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
import replyRouter from "./routes/reply.js";
import { startHateScoreMonitor } from "./services/hateScoreMonitor.js";
import { initWebSocketServer } from "./websocket/index.js";
import harassmentNetworkRouter from "./routes/harassmentNetwork.js";
import notificationsRouter from "./routes/notifications.js";
import threatTrendRouter from "./routes/threatTrend.js";
import { startThreatTrendJobs } from "./jobs/threatTrend.js";
import { ensureNotificationsTable as ensureNotificationsTableModel } from "./models/notificationModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const app = express();

app.use(corsMiddleware);
app.use(express.json());

try {
  await initOraclePool();
  await ensureUsersTable();
  await ensureUserPreferencesTable();
  await ensureFavoritesTable();
  await ensureCommentsTable();
  await ensureNotificationsTableModel();
  // Start periodic aggregation into HATE_THREAT_TREND after pool is ready
  startThreatTrendJobs();
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
app.use("/reply", replyRouter);
app.use("/harassment-network", harassmentNetworkRouter);
app.use("/notifications", notificationsRouter);
app.use("/", threatTrendRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const keyPath = process.env.SSL_KEY_PATH;
const certPath = process.env.SSL_CERT_PATH;
const caPath = process.env.SSL_CA_PATH;
const hasTLSFiles =
  keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath);

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

let serverProtocol = "http";
let server = null;

if (hasTLSFiles) {
  try {
    const tlsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    if (caPath && fs.existsSync(caPath)) {
      tlsOptions.ca = fs.readFileSync(caPath);
    }
    server = https.createServer(tlsOptions, app);
    serverProtocol = "https";
  } catch (err) {
    console.error("[Startup] Failed to load TLS certs:", err);
    process.exit(1);
  }
} else {
  console.warn(
    "[Startup] TLS files missing/unreadable, falling back to HTTP. Checked:",
    { keyPath, certPath }
  );
  server = http.createServer(app);
}

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running at ${serverProtocol}://${HOST}:${PORT}`);
});

initWebSocketServer(server, { path: "/ws" });
startHateScoreMonitor();
