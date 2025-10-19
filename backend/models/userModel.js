// /models/userModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

/**
 * Ensure USERS table, columns, constraints, and indexes exist.
 * - Creates table if not exists
 * - Adds PASSWORD_HASH / STATUS / LAST_LOGIN_AT if missing
 * - Adds unique constraint on EMAIL if missing
 * - Adds index on LOWER(EMAIL) if missing
 */
export async function ensureUsersTable() {
  await withConnection(async (conn) => {
    // 1) Create table if not exists
    const createTablePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE USERS (
            ID            VARCHAR2(36)        PRIMARY KEY,
            EMAIL         VARCHAR2(255)       NOT NULL,
            NAME          VARCHAR2(100),
            PASSWORD_HASH VARCHAR2(72)        NOT NULL,
            STATUS        VARCHAR2(20)        DEFAULT ''ACTIVE'',
            CREATED_AT    TIMESTAMP           DEFAULT SYSTIMESTAMP,
            LAST_LOGIN_AT TIMESTAMP
          )
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN -- ORA-00955: name already used by an existing object
            RAISE;
          END IF;
      END;`;
    await conn.execute(createTablePLSQL, {}, { autoCommit: true });

    // 2) Add columns if missing (each guarded)
    const addColumnsPLSQL = `
      BEGIN
        -- PASSWORD_HASH
        BEGIN
          EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (PASSWORD_HASH VARCHAR2(72) NOT NULL)';
        EXCEPTION WHEN OTHERS THEN
          IF SQLCODE NOT IN (-1430, -22859, -01442) THEN -- ORA-01430/ORA-22859/ORA-01442
            RAISE;
          END IF;
        END;

        -- STATUS
        BEGIN
          EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (STATUS VARCHAR2(20) DEFAULT ''ACTIVE'')';
        EXCEPTION WHEN OTHERS THEN
          IF SQLCODE NOT IN (-1430, -01442) THEN
            RAISE;
          END IF;
        END;

        -- LAST_LOGIN_AT
        BEGIN
          EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (LAST_LOGIN_AT TIMESTAMP)';
        EXCEPTION WHEN OTHERS THEN
          IF SQLCODE NOT IN (-1430, -01442) THEN
            RAISE;
          END IF;
        END;
      END;`;
    await conn.execute(addColumnsPLSQL, {}, { autoCommit: true });

    // 3) Unique constraint on EMAIL
    const addUniquePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD CONSTRAINT UQ_USERS_EMAIL UNIQUE (EMAIL)';
      EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -2260 THEN -- ORA-02260: table can have only one primary key / OR constraint exists
          NULL; -- if exists, ignore (could also be ORA-02261/ORA-02443 depending on state)
        END IF;
      END;`;
    await conn.execute(addUniquePLSQL, {}, { autoCommit: true });

    // 4) Index on LOWER(EMAIL)
    const addIndexPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_USERS_EMAIL_L ON USERS (LOWER(EMAIL))';
      EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -1408 THEN -- ORA-01408: such column list already indexed
          NULL; -- if some other error occurs, ignore here kindly
        END IF;
      END;`;
    await conn.execute(addIndexPLSQL, {}, { autoCommit: true });
  });
}

/** Utility: generate id */
function genId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Create a user (email is normalized to lowercase).
 * payload: { email (required), name?, passwordHash (required), id? }
 * Returns: { id, email, name }
 */
export async function createUserModel(payload) {
  const id = payload.id || genId();
  const email = String(payload.email || "").trim().toLowerCase();
  const name = payload.name || null;
  const passwordHash = payload.passwordHash;
  if (!email || !passwordHash) {
    throw new Error("email and passwordHash are required");
  }

  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO USERS (ID, EMAIL, NAME, PASSWORD_HASH)
       VALUES (:id, :email, :name, :passwordHash)`,
      { id, email, name, passwordHash },
      { autoCommit: true }
    );
  });

  return { id, email, name };
}

/**
 * Find user by email (case-insensitive). Returns full row including PASSWORD_HASH.
 * Returns: { ID, EMAIL, NAME, PASSWORD_HASH, STATUS, CREATED_AT, LAST_LOGIN_AT } | null
 */
export async function findByEmailModel(email) {
  const norm = String(email || "").trim().toLowerCase();
  return withConnection(async (conn) => {
    const r = await conn.execute(
      `SELECT ID, EMAIL, NAME, PASSWORD_HASH, STATUS, CREATED_AT, LAST_LOGIN_AT
         FROM USERS
        WHERE LOWER(EMAIL) = :email`,
      { email: norm },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return r.rows?.[0] || null;
  });
}

/** Update last login timestamp */
export async function updateLastLoginModel(id) {
  await withConnection(async (conn) => {
    await conn.execute(
      `UPDATE USERS SET LAST_LOGIN_AT = SYSTIMESTAMP WHERE ID = :id`,
      { id },
      { autoCommit: true }
    );
  });
}

/** Get user by ID (safe object) */
export async function getUserByIdModel(id) {
  return withConnection(async (conn) => {
    const r = await conn.execute(
      `SELECT ID, EMAIL, NAME, STATUS, CREATED_AT, LAST_LOGIN_AT
         FROM USERS
        WHERE ID = :id`,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return r.rows?.[0] || null;
  });
}

/** List users with pagination (safe objects) */
export async function listUsersModel(limit = 50, offset = 0) {
  limit = Math.min(Number(limit || 50), 200);
  offset = Math.max(Number(offset || 0), 0);

  return withConnection(async (conn) => {
    const r = await conn.execute(
      `
      SELECT * FROM (
        SELECT ID, EMAIL, NAME, STATUS, CREATED_AT, LAST_LOGIN_AT,
               ROW_NUMBER() OVER (ORDER BY CREATED_AT DESC) rn
          FROM USERS
      )
      WHERE rn BETWEEN :start AND :end
      `,
      { start: offset + 1, end: offset + limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return r.rows || [];
  });
}

/** Delete user by ID */
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