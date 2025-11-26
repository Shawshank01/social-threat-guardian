// /models/replyModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

function generateId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a reply for a specific post.
 * @param {object} params
 * @param {string} params.postId
 * @param {string} params.userId
 * @param {string|null} params.authorName
 * @param {string} params.replyText
 */
export async function createReply({ postId, userId, authorName, replyText }) {
  const trimmedPostId = String(postId || "").trim();
  const trimmedUserId = String(userId || "").trim();
  const trimmedReply = String(replyText || "").trim();

  if (!trimmedPostId) throw new Error("postId is required");
  if (!trimmedUserId) throw new Error("userId is required");
  if (!trimmedReply) throw new Error("replyText is required");
  if (trimmedPostId.length > 200) throw new Error("postId is too long");

  const id = generateId();
  const name = authorName ? String(authorName).trim() : null;

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO USER_POST_REPLIES (ID, POST_ID, USER_ID, AUTHOR_NAME, REPLY_TEXT, CREATED_AT)
       VALUES (:id, :postId, :userId, :authorName, :replyText, SYSTIMESTAMP)
      RETURNING ID, POST_ID, USER_ID, AUTHOR_NAME, REPLY_TEXT, CREATED_AT INTO
        :outId, :outPostId, :outUserId, :outAuthorName, :outReplyText, :outCreatedAt`,
      {
        id,
        postId: trimmedPostId,
        userId: trimmedUserId,
        authorName: name,
        replyText: trimmedReply,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outPostId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outUserId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outAuthorName: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
        outReplyText: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
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
      replyText: extract(outBinds.outReplyText),
      createdAt: createdAtValue instanceof Date ? createdAtValue.toISOString() : createdAtValue,
    };
  });
}
