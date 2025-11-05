// /models/commentNoteModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

function generateId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureCommentsTable() {
  await withConnection(async (conn) => {
    const createTablePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE USER_POST_COMMENTS (
            ID            VARCHAR2(64)   PRIMARY KEY,
            POST_ID       VARCHAR2(200)  NOT NULL,
            USER_ID       VARCHAR2(64)   NOT NULL,
            AUTHOR_NAME   VARCHAR2(120),
            COMMENT_TEXT  CLOB           NOT NULL,
            CREATED_AT    TIMESTAMP      DEFAULT SYSTIMESTAMP
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
          CREATE INDEX IX_USER_POST_COMMENTS_POST
            ON USER_POST_COMMENTS (POST_ID)
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

export async function listCommentsForPost(postId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT ID,
              POST_ID,
              USER_ID,
              AUTHOR_NAME,
              COMMENT_TEXT,
              CREATED_AT
         FROM USER_POST_COMMENTS
        WHERE POST_ID = :postId
     ORDER BY CREATED_AT ASC`,
      { postId },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          COMMENT_TEXT: { type: oracledb.STRING },
        },
      },
    );

    const rows = result.rows || [];
    return rows.map((row) => ({
      id: row.ID,
      postId: row.POST_ID,
      userId: row.USER_ID,
      authorName: row.AUTHOR_NAME,
      commentText: row.COMMENT_TEXT,
      createdAt: row.CREATED_AT instanceof Date ? row.CREATED_AT.toISOString() : row.CREATED_AT,
    }));
  });
}

export async function createCommentForPost({ postId, userId, authorName, commentText }) {
  const trimmedPostId = String(postId || "").trim();
  const trimmedUserId = String(userId || "").trim();
  const trimmedComment = String(commentText || "").trim();

  if (!trimmedPostId) throw new Error("postId is required");
  if (!trimmedUserId) throw new Error("userId is required");
  if (!trimmedComment) throw new Error("commentText is required");

  const id = generateId();
  const name = authorName ? String(authorName).trim() : null;

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO USER_POST_COMMENTS (ID, POST_ID, USER_ID, AUTHOR_NAME, COMMENT_TEXT, CREATED_AT)
       VALUES (:id, :postId, :userId, :authorName, :commentText, SYSTIMESTAMP)
      RETURNING ID, POST_ID, USER_ID, AUTHOR_NAME, COMMENT_TEXT, CREATED_AT INTO :outId, :outPostId, :outUserId, :outAuthorName, :outCommentText, :outCreatedAt`,
      {
        id,
        postId: trimmedPostId,
        userId: trimmedUserId,
        authorName: name,
        commentText: trimmedComment,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outPostId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outUserId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outAuthorName: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outCommentText: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outCreatedAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
      },
      { autoCommit: true },
    );

    const outBinds = result.outBinds || {};
    const extract = (value) => (Array.isArray(value) ? value[0] ?? null : value ?? null);
    const createdAtValue = extract(outBinds.outCreatedAt);
    return {
      id: extract(outBinds.outId),
      postId: extract(outBinds.outPostId),
      userId: extract(outBinds.outUserId),
      authorName: extract(outBinds.outAuthorName),
      commentText: extract(outBinds.outCommentText),
      createdAt:
        createdAtValue instanceof Date ? createdAtValue.toISOString() : createdAtValue,
    };
  });
}
