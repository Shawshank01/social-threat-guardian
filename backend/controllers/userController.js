// /controllers/userController.js
import { withConnection } from "../config/db.js";

/**
 * Example users table (adjust to your schema):
 *   USERS (
 *     ID          VARCHAR2(36) PRIMARY KEY,
 *     EMAIL       VARCHAR2(255) UNIQUE NOT NULL,
 *     NAME        VARCHAR2(100),
 *     CREATED_AT  TIMESTAMP DEFAULT SYSTIMESTAMP
 *   )
 *
 * You can create it in Oracle like:
 *   CREATE TABLE USERS (
 *     ID VARCHAR2(36) PRIMARY KEY,
 *     EMAIL VARCHAR2(255) UNIQUE NOT NULL,
 *     NAME VARCHAR2(100),
 *     CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
 *   );
 */

function genId() {
  // simple UUID-ish id; replace with DB-generated ID if desired
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

/** POST /users  Body: { email, name } */
export async function createUser(req, res) {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: "email is required" });

  const id = genId();
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO USERS (ID, EMAIL, NAME) VALUES (:id, :email, :name)`,
        { id, email, name },
        { autoCommit: true }
      );
    });
    return res.status(201).json({ ok: true, user: { id, email, name } });
  } catch (err) {
    console.error("[userController.createUser] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

/** GET /users/:id */
export async function getUserById(req, res) {
  const { id } = req.params;
  try {
    const row = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT ID, EMAIL, NAME, CREATED_AT FROM USERS WHERE ID = :id`,
        { id },
        { outFormat: 4002 } // oracledb.OUT_FORMAT_OBJECT
      );
      return r.rows?.[0];
    });
    if (!row) return res.status(404).json({ ok: false, error: "User not found" });
    return res.json({ ok: true, user: row });
  } catch (err) {
    console.error("[userController.getUserById] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

/** GET /users  (optional: ?limit=50&offset=0) */
export async function listUsers(req, res) {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `
        SELECT * FROM (
          SELECT u.*, ROW_NUMBER() OVER (ORDER BY CREATED_AT DESC) rn
          FROM USERS u
        )
        WHERE rn BETWEEN :start AND :end
        `,
        { start: offset + 1, end: offset + limit },
        { outFormat: 4002 } // oracledb.OUT_FORMAT_OBJECT
      );
      return r.rows || [];
    });
    return res.json({ ok: true, count: rows.length, users: rows });
  } catch (err) {
    console.error("[userController.listUsers] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

/** DELETE /users/:id */
export async function deleteUser(req, res) {
  const { id } = req.params;
  try {
    const result = await withConnection(async (conn) => {
      const r = await conn.execute(
        `DELETE FROM USERS WHERE ID = :id`,
        { id },
        { autoCommit: true }
      );
      return r.rowsAffected || 0;
    });
    if (result === 0) return res.status(404).json({ ok: false, error: "User not found" });
    return res.json({ ok: true, deleted: id });
  } catch (err) {
    console.error("[userController.deleteUser] error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}