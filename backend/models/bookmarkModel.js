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
            UPDATED_AT  TIMESTAMP(6)        DEFAULT SYSTIMESTAMP NOT NULL
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

export async function getBookmarks(userId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT BOOKMARK_ID,
              USER_ID,
              POST_ID    AS PROCESSED_ID,
              CREATED_AT AS SAVED_AT,
              UPDATED_AT
       FROM BOOKMARKS
       WHERE USER_ID = :userId
    ORDER BY CREATED_AT DESC`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  });
}

export async function addBookmarks(userId, postId) {
  return withConnection(async (conn) => {
    const insertResult = await conn.execute(
      `INSERT INTO BOOKMARKS (
         BOOKMARK_ID,
         USER_ID,
         POST_ID,
         CREATED_AT,
         UPDATED_AT
       )
       VALUES (
         RAWTOHEX(SYS_GUID()),
         :userId,
         :postId,
         SYSTIMESTAMP,
         SYSTIMESTAMP
       )
       RETURNING BOOKMARK_ID INTO :bookmarkId`,
      {
        userId,
        postId,
        bookmarkId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 255 },
      },
      { autoCommit: true }
    );

    const bookmarkId =
      insertResult.outBinds?.bookmarkId?.[0] ?? insertResult.outBinds?.bookmarkId;

    if (!bookmarkId) {
      throw new Error("Failed to create bookmark");
    }

    const rowResult = await conn.execute(
      `SELECT BOOKMARK_ID,
              USER_ID,
              POST_ID    AS PROCESSED_ID,
              CREATED_AT AS SAVED_AT,
              UPDATED_AT
         FROM BOOKMARKS
        WHERE BOOKMARK_ID = :bookmarkId`,
      { bookmarkId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return rowResult.rows?.[0] || null;
  });
}

export async function deleteBookmarks(userId, processedId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `DELETE FROM BOOKMARKS
        WHERE USER_ID = :userId
          AND POST_ID = :processedId`,
      { userId, processedId },
      { autoCommit: true }
    );
    return result.rowsAffected || 0;
  });
}
