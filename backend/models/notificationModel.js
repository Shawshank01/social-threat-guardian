// /models/notificationModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

const TABLE_NAME = "NOTIFICATIONS";
const DEFAULT_LIMIT = 20;

function generateId() {
  const source =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 34)}`;
  return source.replace(/-/g, "").slice(0, 32).toUpperCase();
}

function normalizeUserId(userId) {
  const trimmed = String(userId ?? "").trim();
  if (!trimmed) {
    throw new Error("userId is required");
  }
  return trimmed;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.NOTIFICATION_ID,
    userId: row.USER_ID,
    type: row.TYPE,
    message: row.MESSAGE,
    createdAt:
      row.CREATED_AT instanceof Date ? row.CREATED_AT.toISOString() : row.CREATED_AT ?? null,
    readStatus: Number(row.READ_STATUS) === 1,
  };
}

export async function ensureNotificationsTable() {
  await withConnection(async (conn) => {
    const ddl = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE ${TABLE_NAME} (
            NOTIFICATION_ID   VARCHAR2(32 BYTE)   NOT NULL,
            USER_ID           NUMBER              NOT NULL,
            TYPE              VARCHAR2(50),
            MESSAGE           VARCHAR2(1000),
            CREATED_AT        TIMESTAMP(6),
            READ_STATUS       NUMBER(1,0),
            CONSTRAINT PK_NOTIFICATIONS PRIMARY KEY (NOTIFICATION_ID),
            CONSTRAINT FK_NOTIFICATIONS_USER FOREIGN KEY (USER_ID)
              REFERENCES USERS(ID)
          )
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;`;
    await conn.execute(ddl, {}, { autoCommit: true });
  });
}

export async function insertNotification({
  userId,
  type = "SYSTEM",
  message = null,
  readStatus = 0,
} = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const id = generateId();
  const trimmedType = type ? String(type).trim().slice(0, 50) : null;
  const trimmedMessage = message ? String(message).trim().slice(0, 1000) : null;
  const numericStatus = Number(readStatus) === 1 ? 1 : 0;

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO ${TABLE_NAME}
         (NOTIFICATION_ID, USER_ID, TYPE, MESSAGE, CREATED_AT, READ_STATUS)
       VALUES (:id, :userId, :type, :message, SYSTIMESTAMP, :readStatus)
      RETURNING CREATED_AT INTO :createdAt`,
      {
        id,
        userId: normalizedUserId,
        type: trimmedType,
        message: trimmedMessage,
        readStatus: numericStatus,
        createdAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
      },
      { autoCommit: true },
    );

    const rawCreated = result.outBinds?.createdAt;
    const createdAtValue = Array.isArray(rawCreated) ? rawCreated[0] : rawCreated;
    const createdAt =
      createdAtValue instanceof Date ? createdAtValue.toISOString() : new Date().toISOString();

    return {
      id,
      userId: normalizedUserId,
      type: trimmedType,
      message: trimmedMessage,
      readStatus: Boolean(numericStatus),
      createdAt,
    };
  });
}

export async function insertNotificationsForUsers(userIds = [], payload = {}) {
  const results = [];
  for (const id of new Set(userIds.map((value) => normalizeUserId(value)))) {
    const created = await insertNotification({ ...payload, userId: id });
    results.push(created);
  }
  return results;
}

export async function listNotificationsForUser(userId, options = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_LIMIT, 100));
  const offset = Math.max(0, Number(options.offset) || 0);
  const unreadOnly = Boolean(options.unreadOnly);

  return withConnection(async (conn) => {
    const { rows } = await conn.execute(
      `SELECT NOTIFICATION_ID,
              USER_ID,
              TYPE,
              MESSAGE,
              CREATED_AT,
              READ_STATUS
         FROM ${TABLE_NAME}
        WHERE USER_ID = :userId
          ${unreadOnly ? "AND READ_STATUS = 0" : ""}
     ORDER BY CREATED_AT DESC
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { userId: normalizedUserId, offset, limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return (rows || []).map(mapRow);
  });
}

export async function countUnreadNotifications(userId) {
  const normalizedUserId = normalizeUserId(userId);
  return withConnection(async (conn) => {
    const { rows } = await conn.execute(
      `SELECT COUNT(*) AS CNT
         FROM ${TABLE_NAME}
        WHERE USER_ID = :userId
          AND READ_STATUS = 0`,
      { userId: normalizedUserId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const countValue = rows?.[0]?.CNT ?? rows?.[0]?.cnt ?? 0;
    return Number(countValue) || 0;
  });
}

export async function markNotificationRead(notificationId, userId) {
  const trimmedId = String(notificationId ?? "").trim();
  if (!trimmedId) {
    throw new Error("notificationId is required");
  }
  const normalizedUserId = normalizeUserId(userId);

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `UPDATE ${TABLE_NAME}
          SET READ_STATUS = 1
        WHERE NOTIFICATION_ID = :id
          AND USER_ID = :userId`,
      { id: trimmedId, userId: normalizedUserId },
      { autoCommit: true },
    );
    return result.rowsAffected > 0;
  });
}

export async function markAllNotificationsRead(userId) {
  const normalizedUserId = normalizeUserId(userId);
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `UPDATE ${TABLE_NAME}
          SET READ_STATUS = 1
        WHERE USER_ID = :userId
          AND READ_STATUS = 0`,
      { userId: normalizedUserId },
      { autoCommit: true },
    );
    return result.rowsAffected || 0;
  });
}
