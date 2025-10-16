// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dbTestRouter from "./routes/dbtest.js";
import { initOraclePool } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import userRouter from "./routes/user.js";

// env
dotenv.config();

// handle dir name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// routes
import indexRouter from "./routes/index.js";
import pushRouter from "./routes/push.js";

app.use("/", indexRouter);
app.use("/push", pushRouter);
app.use("/db", dbTestRouter);
app.use("/users", userRouter);
app.use(errorHandler);


// start server
await initOraclePool();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});