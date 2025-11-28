// /models/commentModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

function normalizeContainsTerms(keywords = []) {
  return (Array.isArray(keywords) ? keywords : [])
    .map((kw) => (kw === undefined || kw === null ? "" : String(kw)))
    .flatMap((kw) =>
      kw
        .replace(/['"()]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
    )
    .filter((token) => token.length > 0)
    .slice(0, 10); // cap to keep CONTAINS query small
}

function buildContainsQuery(keywords = []) {
  const tokens = normalizeContainsTerms(keywords);
  if (tokens.length === 0) return null;

  const clauses = tokens.map(
    (token) => `("${token}" OR FUZZY(${token}, 80, 5000))`
  );
  return clauses.join(" AND ");
}

export async function fetchPostsByIds(postIds = [], options = {}) {
  const ids = Array.isArray(postIds)
    ? postIds
        .map((id) => (id === undefined || id === null ? "" : String(id).trim()))
        .filter(Boolean)
    : [];

  if (ids.length === 0) return [];

  const tableName =
    options.tableName !== undefined && options.tableName !== null
      ? String(options.tableName).trim().toUpperCase()
      : "BLUSKY_TEST";

  if (!tableName || !/^[A-Z0-9_]+$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  // Deduplicate to keep the bind list small, we will reapply sorting later.
  const uniqueIds = Array.from(new Set(ids));
  const binds = {};
  const placeholders = uniqueIds
    .map((id, idx) => {
      const key = `id${idx}`;
      binds[key] = id;
      return `:${key}`;
    })
    .join(", ");

  return withConnection(async (conn) => {
    const sql = `
      SELECT POST_ID, POST_URL, POST_TEXT, POST_TIMESTAMP
        FROM ${tableName}
       WHERE POST_ID IN (${placeholders})
    `;

    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        POST_ID: { type: oracledb.STRING },
        POST_URL: { type: oracledb.STRING },
        POST_TEXT: { type: oracledb.STRING },
      },
    });

    return result.rows || [];
  });
}

export async function searchCommentsByText(keywords = [], options = {}) {
  const containsQuery = buildContainsQuery(keywords);
  if (!containsQuery) return [];

  const limit = Math.max(1, Number(options.limit) || 10);

  let predIntent = options.predIntent;
  if (predIntent !== undefined && predIntent !== null) {
    predIntent = String(predIntent).trim();
    if (!predIntent) {
      predIntent = null;
    } else {
      predIntent = predIntent.toUpperCase();
    }
  } else {
    predIntent = null;
  }

  const tableName =
    options.tableName !== undefined && options.tableName !== null
      ? String(options.tableName).trim().toUpperCase()
      : "BLUSKY_TEST";

  if (!tableName || !/^[A-Z0-9_]+$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  return withConnection(async (conn) => {
    const binds = {
      limit,
      containsQuery: String(containsQuery),
    };

    const where = ["CONTAINS(POST_TEXT, :containsQuery, 1) > 0"];
    if (predIntent) {
      binds.predIntent = predIntent;
      where.push("PRED_INTENT = :predIntent");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT * FROM (
        SELECT POST_ID,
               POST_TEXT,
               PRED_INTENT,
               PRED_INTENSITY,
               POST_TIMESTAMP,
               POST_URL,
               HATE_SCORE,
               SCORE(1) AS SEARCH_SCORE
          FROM ${tableName}
         ${whereSql}
         ORDER BY SCORE(1) DESC, POST_TIMESTAMP DESC NULLS LAST
      )
     WHERE ROWNUM <= :limit
    `;

    const result = await conn.execute(
      sql,
      binds,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          POST_ID: { type: oracledb.STRING },
          POST_TEXT: { type: oracledb.STRING },
        },
      }
    );

    return result.rows || [];
  });
}

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
    const binds = {};
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
        FROM ${tableName}
       ${whereSql}
       ORDER BY POST_TIMESTAMP DESC NULLS LAST
       FETCH FIRST ${capped} ROWS ONLY
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
