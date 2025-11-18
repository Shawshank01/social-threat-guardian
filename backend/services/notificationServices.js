// /services/notificationServices.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

const TABLE_NAME = "USER_NOTIFICATIONS";
const DEFAULT_LIMIT = 20;

function generateId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUserId(userId) {
  const trimmed = String(userId ?? "").trim();
  if (!trimmed) {
    throw new Error("userId is required");
  }
  return trimmed;
}

function serializePayload(payload) {
  if (payload === undefined || payload === null) return null;
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

function parseClob(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    try {
      return value.toString();
    } catch {
      return null;
    }
  }
  return String(value);
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    userId: row.USER_ID,
    type: row.TYPE,
    title: row.TITLE,
    message: parseClob(row.MESSAGE),
    payload: (() => {
      const raw = parseClob(row.PAYLOAD);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    })(),
    createdAt:
      row.CREATED_AT instanceof Date ? row.CREATED_AT.toISOString() : row.CREATED_AT ?? null,
    readAt: row.READ_AT instanceof Date ? row.READ_AT.toISOString() : row.READ_AT ?? null,
  };
}

export async function ensureNotificationsTable() {
  await withConnection(async (conn) => {
    const createTablePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE ${TABLE_NAME} (
            ID         VARCHAR2(64)   PRIMARY KEY,
            USER_ID    VARCHAR2(64)   NOT NULL,
            TYPE       VARCHAR2(64),
            TITLE      VARCHAR2(200),
            MESSAGE    CLOB,
            PAYLOAD    CLOB,
            CREATED_AT TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
            READ_AT    TIMESTAMP      NULL
          )
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;`;

    await conn.execute(createTablePLSQL, {}, { autoCommit: true });

    const createIndexPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE INDEX IX_${TABLE_NAME}_USER_ID
            ON ${TABLE_NAME} (USER_ID, READ_AT)
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -1408 THEN
            NULL;
          END IF;
      END;`;

    await conn.execute(createIndexPLSQL, {}, { autoCommit: true });
  });
}

export async function createNotification({
  userId,
  type = "SYSTEM",
  title = null,
  message = null,
  payload = null,
} = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const id = generateId();
  const trimmedType = type ? String(type).trim().toUpperCase().slice(0, 64) : "SYSTEM";
  const trimmedTitle = title ? String(title).trim() : null;
  const trimmedMessage = message ? String(message).trim() : null;
  const serializedPayload = serializePayload(payload);

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO ${TABLE_NAME} (ID, USER_ID, TYPE, TITLE, MESSAGE, PAYLOAD, CREATED_AT)
       VALUES (:id, :userId, :type, :title, :message, :payload, SYSTIMESTAMP)
      RETURNING ID, USER_ID, TYPE, TITLE, MESSAGE, PAYLOAD, CREATED_AT, READ_AT
           INTO :outId, :outUserId, :outType, :outTitle, :outMessage, :outPayload, :outCreatedAt, :outReadAt`,
      {
        id,
        userId: normalizedUserId,
        type: trimmedType,
        title: trimmedTitle,
        message: trimmedMessage,
        payload: serializedPayload,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outUserId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outType: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outTitle: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outMessage: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outPayload: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outCreatedAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
        outReadAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
      },
      { autoCommit: true },
    );

    const out = result.outBinds || {};
    const unwrap = (value) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

    return {
      id: unwrap(out.outId),
      userId: unwrap(out.outUserId),
      type: unwrap(out.outType),
      title: unwrap(out.outTitle),
      message: unwrap(out.outMessage),
      payload: (() => {
        const raw = unwrap(out.outPayload);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      })(),
      createdAt: (() => {
        const created = unwrap(out.outCreatedAt);
        return created instanceof Date ? created.toISOString() : created;
      })(),
      readAt: (() => {
        const read = unwrap(out.outReadAt);
        return read instanceof Date ? read.toISOString() : read;
      })(),
    };
  });
}

export async function createNotificationsForUsers(userIds = [], payload = {}) {
  const results = [];
  for (const id of new Set(userIds.map((value) => normalizeUserId(value)))) {
    const created = await createNotification({ ...payload, userId: id });
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
      `SELECT ID,
              USER_ID,
              TYPE,
              TITLE,
              MESSAGE,
              PAYLOAD,
              CREATED_AT,
              READ_AT
         FROM ${TABLE_NAME}
        WHERE USER_ID = :userId
          ${unreadOnly ? "AND READ_AT IS NULL" : ""}
     ORDER BY CREATED_AT DESC
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { userId: normalizedUserId, offset, limit },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          MESSAGE: { type: oracledb.STRING },
          PAYLOAD: { type: oracledb.STRING },
        },
      },
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
          AND READ_AT IS NULL`,
      { userId: normalizedUserId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const countValue = rows?.[0]?.CNT ?? rows?.[0]?.cnt ?? 0;
    return Number(countValue) || 0;
  });
}

export async function markNotificationRead(notificationId, userId) {
  const normalizedUserId = normalizeUserId(userId);
  const trimmedId = String(notificationId ?? "").trim();
  if (!trimmedId) throw new Error("notificationId is required");

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `UPDATE ${TABLE_NAME}
          SET READ_AT = COALESCE(READ_AT, SYSTIMESTAMP)
        WHERE ID = :id
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
          SET READ_AT = COALESCE(READ_AT, SYSTIMESTAMP)
        WHERE USER_ID = :userId
          AND READ_AT IS NULL`,
      { userId: normalizedUserId },
      { autoCommit: true },
    );
    return result.rowsAffected || 0;
  });
}
