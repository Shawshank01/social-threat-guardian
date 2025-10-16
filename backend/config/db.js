// /config/db.js
import oracledb from "oracledb";
import dotenv from "dotenv";
dotenv.config();

// ---- Validate required environment variables ----
const required = ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECT_STRING", "TNS_ADMIN"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[Oracle] Missing env: ${k}`);
  }
}

// Do NOT call initOracleClient(); we're using the thin driver + TNS_ADMIN
// initOracleClient() is only for thick mode, which is not needed here

let pool;

/** Create a connection pool (call once at application startup) */
export async function initOraclePool() {
  if (pool) return pool;

  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING, // must match alias in tnsnames.ora
    poolMin: Number(process.env.DB_POOL_MIN || 0),
    poolMax: Number(process.env.DB_POOL_MAX || 4),
    poolIncrement: Number(process.env.DB_POOL_INC || 1),
    queueTimeout: Number(process.env.DB_QUEUE_TIMEOUT || 60000),
    sessionCallback: undefined,
  });

  console.log("[Oracle] Pool created");

  // Simple health check
  await withConnection(async (conn) => {
    const r = await conn.execute("select 1 as ok from dual");
    console.log("[Oracle] Health check:", r.rows?.[0]?.[0] === 1 ? "OK" : "UNKNOWN");
  });

  // Graceful shutdown
  const close = async () => {
    if (!pool) return;
    console.log("\n[Oracle] Closing pool...");
    try {
      await pool.close(10); // 10s drain time
      console.log("[Oracle] Pool closed");
    } catch (e) {
      console.error("[Oracle] Close pool error:", e);
    } finally {
      pool = undefined;
      process.exit(0);
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  return pool;
}

/** Get the current connection pool instance */
export function getPool() {
  if (!pool) throw new Error("[Oracle] Pool not initialized. Call initOraclePool() first.");
  return pool;
}

/** Helper: run a callback with a borrowed connection and automatically release it */
export async function withConnection(fn) {
  const p = getPool();
  const conn = await p.getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

/** Close the pool manually (useful for tests or scripts) */
export async function closeOraclePool() {
  if (!pool) return;
  await pool.close(10);
  pool = undefined;
  console.log("[Oracle] Pool closed (manual)");
}