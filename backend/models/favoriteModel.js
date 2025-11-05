// /models/favoriteModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

export async function ensureFavoritesTable() {
  await withConnection(async (conn) => {
    const createTablePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE USER_FAVORITES (
            USER_ID        VARCHAR2(64)   NOT NULL,
            PROCESSED_ID   VARCHAR2(128)  NOT NULL,
            PLATFORM       VARCHAR2(64),
            SOURCE_TABLE   VARCHAR2(128),
            KEYWORD        VARCHAR2(256),
            POST_TEXT      CLOB,
            PRED_INTENT    VARCHAR2(64),
            TIME_AGO       VARCHAR2(64),
            COLLECTED_AT   TIMESTAMP,
            SAVED_AT       TIMESTAMP      DEFAULT SYSTIMESTAMP,
            CONSTRAINT PK_USER_FAVORITES PRIMARY KEY (USER_ID, PROCESSED_ID)
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
          CREATE INDEX IX_USER_FAVORITES_PROCESSED
            ON USER_FAVORITES (PROCESSED_ID)
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

export async function listFavoritesByUser(userId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT USER_ID,
              PROCESSED_ID,
              PLATFORM,
              SOURCE_TABLE,
              KEYWORD,
              POST_TEXT,
              PRED_INTENT,
              TIME_AGO,
              COLLECTED_AT,
              SAVED_AT
         FROM USER_FAVORITES
        WHERE USER_ID = :userId
     ORDER BY SAVED_AT DESC`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  });
}

export async function getFavoriteByUserAndProcessedId(userId, processedId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT USER_ID,
              PROCESSED_ID,
              PLATFORM,
              SOURCE_TABLE,
              KEYWORD,
              POST_TEXT,
              PRED_INTENT,
              TIME_AGO,
              COLLECTED_AT,
              SAVED_AT
         FROM USER_FAVORITES
        WHERE USER_ID = :userId
          AND PROCESSED_ID = :processedId`,
      { userId, processedId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows?.[0] || null;
  });
}

export async function upsertFavoriteForUser(userId, favorite) {
  const processedId = String(favorite.processedId || "").trim();
  if (!processedId) {
    throw new Error("processedId is required");
  }

  await withConnection(async (conn) => {
    await conn.execute(
      `
      MERGE INTO USER_FAVORITES target
      USING (SELECT :userId AS USER_ID, :processedId AS PROCESSED_ID FROM dual) incoming
         ON (target.USER_ID = incoming.USER_ID AND target.PROCESSED_ID = incoming.PROCESSED_ID)
       WHEN MATCHED THEN
        UPDATE SET PLATFORM     = :platform,
                   SOURCE_TABLE = :sourceTable,
                   KEYWORD      = :keyword,
                   POST_TEXT    = :postText,
                   PRED_INTENT  = :predIntent,
                   TIME_AGO     = :timeAgo,
                   COLLECTED_AT = :collectedAt,
                   SAVED_AT     = SYSTIMESTAMP
       WHEN NOT MATCHED THEN
        INSERT (USER_ID, PROCESSED_ID, PLATFORM, SOURCE_TABLE, KEYWORD, POST_TEXT, PRED_INTENT, TIME_AGO, COLLECTED_AT, SAVED_AT)
        VALUES (:userId, :processedId, :platform, :sourceTable, :keyword, :postText, :predIntent, :timeAgo, :collectedAt, SYSTIMESTAMP)
      `,
      {
        userId,
        processedId,
        platform: favorite.platform ?? null,
        sourceTable: favorite.sourceTable ?? null,
        keyword: favorite.keyword ?? null,
        postText: favorite.postText ?? null,
        predIntent: favorite.predIntent ?? null,
        timeAgo: favorite.timeAgo ?? null,
        collectedAt: favorite.collectedAt ? new Date(favorite.collectedAt) : null,
      },
      { autoCommit: true }
    );
  });
}

export async function deleteFavoriteForUser(userId, processedId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `DELETE FROM USER_FAVORITES
        WHERE USER_ID = :userId
          AND PROCESSED_ID = :processedId`,
      { userId, processedId },
      { autoCommit: true }
    );
    return result.rowsAffected || 0;
  });
}
