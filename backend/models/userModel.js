

// /models/userModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

/**
 * Ensure USERS table exists.
 * Uses PL/SQL block to ignore ORA-00955 (name already used by an existing object).
 */
export async function ensureUsersTable() {
  await withConnection(async (conn) => {
    const plsql = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE USERS (
            ID         VARCHAR2(36) PRIMARY KEY,
            EMAIL      VARCHAR2(255) UNIQUE NOT NULL,
            NAME       VARCHAR2(100),
            CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
          )
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN -- ORA-00955: name is already used by an existing object
            RAISE;
          END IF;
      END;`;
    await conn.execute(plsql, {}, { autoCommit: true });
  });
}

/**
 * Create a user.
 * @param {{id?: string, email: string, name?: string}} payload
 * @returns {Promise<{id:string,email:string,name:string}>}
 */
export async function createUserModel(payload) {
  const id =
    payload.id ||
    (globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2));

  const { email, name } = payload;

  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO USERS (ID, EMAIL, NAME) VALUES (:id, :email, :name)`,
      { id, email, name },
      { autoCommit: true }
    );
  });

  return { id, email, name };
}

/**
 * Get user by ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getUserByIdModel(id) {
  return withConnection(async (conn) => {
    const r = await conn.execute(
      `SELECT ID, EMAIL, NAME, CREATED_AT
         FROM USERS
        WHERE ID = :id`,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return r.rows?.[0] || null;
  });
}

/**
 * List users with pagination.
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<object[]>}
 */
export async function listUsersModel(limit = 50, offset = 0) {
  limit = Math.min(Number(limit || 50), 200);
  offset = Math.max(Number(offset || 0), 0);

  return withConnection(async (conn) => {
    const r = await conn.execute(
      `
      SELECT * FROM (
        SELECT u.*, ROW_NUMBER() OVER (ORDER BY CREATED_AT DESC) rn
          FROM USERS u
      )
      WHERE rn BETWEEN :start AND :end
      `,
      { start: offset + 1, end: offset + limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return r.rows || [];
  });
}

/**
 * Delete a user by ID.
 * @param {string} id
 * @returns {Promise<number>} rows affected
 */
export async function deleteUserModel(id) {
  return withConnection(async (conn) => {
    const r = await conn.execute(
      `DELETE FROM USERS WHERE ID = :id`,
      { id },
      { autoCommit: true }
    );
    return r.rowsAffected || 0;
  });
}