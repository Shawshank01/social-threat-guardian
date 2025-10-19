// server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config({ override: true });
import path from "path";
import { fileURLToPath } from "url";
import dbTestRouter from "./routes/dbtest.js";
import { initOraclePool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import userRouter from "./routes/user.js";
import { ensureUsersTable } from "./models/userModel.js";
import indexRouter from "./routes/index.js";
import pushRouter from "./routes/push.js";
import authRouter from "./routes/auth.js";


// env
dotenv.config();

// handle dir name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware
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
app.use(errorHandler);
app.use("/auth", authRouter);

// start server
await initOraclePool();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});