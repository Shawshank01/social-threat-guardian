// /models/favoriteModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

export async function ensureFavoritesTable() {
  await withConnection(async (conn) => {
    const createTablePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE BOOKMARKS (
            BOOKMARK_ID VARCHAR2(255 BYTE) DEFAULT RAWTOHEX(SYS_GUID()) PRIMARY KEY,
            USER_ID     VARCHAR2(255 BYTE) NOT NULL,
            POST_ID     VARCHAR2(255 BYTE) NOT NULL,
            CREATED_AT  TIMESTAMP(6)        DEFAULT SYSTIMESTAMP NOT NULL,
            UPDATED_AT  TIMESTAMP(6)        DEFAULT SYSTIMESTAMP NOT NULL,
            IS_DELETED  NUMBER(1, 0)        DEFAULT 0 NOT NULL
          )
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;`;

    await conn.execute(createTablePLSQL, {}, { autoCommit: true });

    const createUniqueIndexPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE UNIQUE INDEX IX_BOOKMARKS_USER_POST
            ON BOOKMARKS (USER_ID, POST_ID)
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE NOT IN (-955, -1408) THEN
            NULL;
          END IF;
      END;`;

    await conn.execute(createUniqueIndexPLSQL, {}, { autoCommit: true });

    const createUserIndexPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE INDEX IX_BOOKMARKS_USER
            ON BOOKMARKS (USER_ID)
        ';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            NULL;
          END IF;
      END;`;

    await conn.execute(createUserIndexPLSQL, {}, { autoCommit: true });

    const ensureUpdatedAtColumnPLSQL = `
      DECLARE
        v_count INTEGER;
      BEGIN
        SELECT COUNT(*)
          INTO v_count
          FROM USER_TAB_COLS
         WHERE TABLE_NAME = 'BOOKMARKS'
           AND COLUMN_NAME = 'UPDATED_AT';

        IF v_count = 0 THEN
          EXECUTE IMMEDIATE '
            ALTER TABLE BOOKMARKS
              ADD (UPDATED_AT TIMESTAMP(6) DEFAULT SYSTIMESTAMP NOT NULL)
          ';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -1430 THEN
            RAISE;
          END IF;
      END;`;

    await conn.execute(ensureUpdatedAtColumnPLSQL, {}, { autoCommit: true });
  });
}

export async function listFavoritesByUser(userId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT BOOKMARK_ID,
              USER_ID,
              POST_ID    AS PROCESSED_ID,
              CREATED_AT AS SAVED_AT,
              UPDATED_AT
         FROM BOOKMARKS
        WHERE USER_ID = :userId
          AND NVL(IS_DELETED, 0) = 0
     ORDER BY CREATED_AT DESC`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  });
}

export async function getFavoriteByUserAndProcessedId(userId, processedId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT BOOKMARK_ID,
              USER_ID,
              POST_ID    AS PROCESSED_ID,
              CREATED_AT AS SAVED_AT,
              UPDATED_AT
         FROM BOOKMARKS
        WHERE USER_ID = :userId
          AND POST_ID = :processedId
          AND NVL(IS_DELETED, 0) = 0`,
      { userId, processedId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows?.[0] || null;
  });
}

export async function upsertFavoriteForUser(userId, favorite) {
  const processedId = String(favorite.processedId ?? favorite.postId ?? "").trim();
  if (!processedId) {
    throw new Error("processedId is required");
  }

  await withConnection(async (conn) => {
    await conn.execute(
      `
      MERGE INTO BOOKMARKS target
      USING (SELECT :userId AS USER_ID, :processedId AS POST_ID FROM dual) incoming
         ON (target.USER_ID = incoming.USER_ID AND target.POST_ID = incoming.POST_ID)
       WHEN MATCHED THEN
        UPDATE SET IS_DELETED = 0,
                   UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN
        INSERT (BOOKMARK_ID, USER_ID, POST_ID, CREATED_AT, UPDATED_AT, IS_DELETED)
        VALUES (RAWTOHEX(SYS_GUID()), :userId, :processedId, SYSTIMESTAMP, SYSTIMESTAMP, 0)
      `,
      { userId, processedId },
      { autoCommit: true }
    );
  });
}

export async function deleteFavoriteForUser(userId, processedId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `UPDATE BOOKMARKS
          SET IS_DELETED = 1,
              UPDATED_AT = SYSTIMESTAMP
        WHERE USER_ID = :userId
          AND POST_ID = :processedId
          AND NVL(IS_DELETED, 0) = 0`,
      { userId, processedId },
      { autoCommit: true }
    );
    return result.rowsAffected || 0;
  });
}
