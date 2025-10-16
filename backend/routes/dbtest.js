// /routes/dbtest.js
import express from "express";
import { withConnection } from "../config/db.js";

const router = express.Router();

/**
 * GET /db/ping
 * Simple connectivity check: returns DB time and DB name
 */
router.get("/ping", async (req, res) => {
  try {
    const result = await withConnection(async (conn) => {
      const r = await conn.execute(
        `select 
           sysdate as "DB_TIME",
           sys_context('userenv', 'db_name') as "DB_NAME",
           user as "DB_USER"
         from dual`
      );
      return r.rows?.[0] ?? [];
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("[/db/ping] error:", err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /db/whoami
 * Returns current database user
 */
router.get("/whoami", async (req, res) => {
  try {
    const result = await withConnection(async (conn) => {
      const r = await conn.execute(`select user as "DB_USER" from dual`);
      return r.rows?.[0]?.[0] ?? null;
    });
    res.json({ ok: true, user: result });
  } catch (err) {
    console.error("[/db/whoami] error:", err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;