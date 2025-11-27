import oracledb from "oracledb";
import { withConnection } from "../config/db.js";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
function normalizeLimit(limit = DEFAULT_LIMIT) {
  const num = Number(limit);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.trunc(num), MAX_LIMIT));
}
export async function searchGraphByKeyword(keyword, options = {}) {
  const limit = normalizeLimit(options.limit);
  const sql = `
    SELECT 
      g.SOURCE_USER AS USER_A_DID,
      g.TARGET_USER AS USER_B_DID,
      t.AUTHOR_HANDLE AS USER_A_HANDLE,
      t.POST_TEXT,
      t.POST_ID
    FROM DIWEN.GRAPH_EDGES g
    JOIN DIWEN.BLUSKY_TEST t ON g.POST_ID = t.POST_ID
    WHERE 
      DBMS_LOB.INSTR(t.POST_TEXT, :keyword, 1, 1) > 0
      AND g.SOURCE_USER <> g.TARGET_USER
    FETCH FIRST :limit ROWS ONLY
  `;
  const rows = await withConnection(async (conn) => {
    const result = await conn.execute(
      sql,
      { keyword, limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  });
  return rows;
}
export async function findCliqueTriples(options = {}) {
  const limit = normalizeLimit(options.limit);
  const sql = `
    SELECT
      g.SOURCE_USER AS USER_A_DID,
      g.TARGET_USER AS USER_B_DID,
      t.AUTHOR_HANDLE AS USER_A_HANDLE,
      t.POST_TEXT,
      t.POST_ID
    FROM DIWEN.GRAPH_EDGES g
    JOIN DIWEN.BLUSKY_TEST t ON g.POST_ID = t.POST_ID
    WHERE g.SOURCE_USER <> g.TARGET_USER
    FETCH FIRST :limit ROWS ONLY
  `;
  const rows = await withConnection(async (conn) => {
    const result = await conn.execute(
      sql,
      { limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows || [];
  });
  return rows;
}
export async function getCliqueGraph(options = {}) {
  let connections = [];
  try {
    if (options.keyword && options.keyword.trim().length > 0) {
        connections = await searchGraphByKeyword(options.keyword, options);
    } else {
        connections = await findCliqueTriples(options);
    }
  } catch (err) {
    console.error("SQL Execution Error:", err); 
    throw err; 
  }
  return {
    ok: true,
    connections: connections,
    limit: normalizeLimit(options.limit)
  };
}