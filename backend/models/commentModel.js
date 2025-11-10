// /models/commentModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

export async function fetchLatestComments(limit = 4, filters = {}) {
  const capped = Math.max(1, Math.min(Number(limit) || 4, 50));

  let predIntent = filters.predIntent;
  if (predIntent === undefined || predIntent === null) {
    predIntent = "HARMFUL";
  } else {
    predIntent = String(predIntent).trim();
    if (!predIntent) {
      predIntent = "HARMFUL";
    }
  }
  predIntent = predIntent ? predIntent.toUpperCase() : null;

  const tableName =
    filters.tableName !== undefined && filters.tableName !== null
      ? String(filters.tableName).trim().toUpperCase()
      : "BLUSKY_TEST";

  if (!tableName || !/^[A-Z0-9_]+$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  let keyword = filters.keyword;
  if (keyword !== undefined && keyword !== null) {
    keyword = String(keyword).trim();
    if (!keyword) {
      keyword = null;
    } else {
      keyword = keyword.toUpperCase();
    }
  } else {
    keyword = null;
  }

  return withConnection(async (conn) => {
    const binds = { limit: capped };
    const whereClauses = [];

    if (predIntent) {
      binds.predIntent = predIntent;
      whereClauses.push("PRED_INTENT = :predIntent");
    }

    if (keyword) {
      binds.keyword = keyword;
      whereClauses.push("INSTR(UPPER(POST_TEXT), :keyword) > 0");
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    
    const sql = `
      SELECT POST_ID, POST_TEXT, PRED_INTENT, PRED_INTENSITY, POST_TIMESTAMP, POST_URL, HATE_SCORE
        FROM (
          SELECT POST_ID, POST_TEXT, PRED_INTENT, PRED_INTENSITY, POST_TIMESTAMP, POST_URL, HATE_SCORE
            FROM ${tableName}
           ${whereSql}
           ORDER BY POST_TIMESTAMP DESC NULLS LAST
        )
       WHERE ROWNUM <= :limit
    `;

    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        POST_ID: { type: oracledb.STRING },
        POST_TEXT: { type: oracledb.STRING },
        PRED_INTENT: { type: oracledb.STRING },
        PRED_INTENSITY: {type: oracledb.STRING},
        POST_URL: { type: oracledb.STRING },
        HATE_SCORE: {type: oracledb.STRING}
      },
    });

    return result.rows || [];
  });
}

export async function fetchLatestHateScores(limit = 100, options = {}) {
  const capped = Math.max(1, Math.min(Number(limit) || 100, 500));
  const tableName =
    options.tableName !== undefined && options.tableName !== null
      ? String(options.tableName).trim().toUpperCase()
      : "BLUSKY_TEST";

  if (!tableName || !/^[A-Z0-9_]+$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  return withConnection(async (conn) => {
    const sql = `
      SELECT HATE_SCORE, POST_TIMESTAMP
        FROM (
          SELECT HATE_SCORE, POST_TIMESTAMP
            FROM ${tableName}
           WHERE HATE_SCORE IS NOT NULL
           ORDER BY POST_TIMESTAMP DESC NULLS LAST
        )
       WHERE ROWNUM <= :limit
    `;

    const result = await conn.execute(
      sql,
      { limit: capped },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    return result.rows || [];
  });
}
