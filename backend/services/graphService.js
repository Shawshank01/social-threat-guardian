import oracledb from "oracledb";
import { withConnection } from "../config/db.js";
import jLouvainLib from "jlouvain";

const jLouvain = jLouvainLib.jLouvain || jLouvainLib;

const CONFIG = {
  DEFAULT_LIMIT: 500,
  MAX_LIMIT: 1000,
  MIN_LIMIT: 1
};

const normalizeLimit = (limit) => {
  const num = Number(limit);
  if (!Number.isFinite(num)) return CONFIG.DEFAULT_LIMIT;
  return Math.max(CONFIG.MIN_LIMIT, Math.min(Math.trunc(num), CONFIG.MAX_LIMIT));
};

const FETCH_OPTS = {
  outFormat: oracledb.OUT_FORMAT_OBJECT,
  fetchInfo: {
    USER_A: { type: oracledb.STRING },
    USER_B: { type: oracledb.STRING },
    HANDLE_A: { type: oracledb.STRING },
    POST_TEXT: { type: oracledb.STRING },
    POST_ID: { type: oracledb.STRING },
    HATE_SCORE: { type: oracledb.STRING },
  },
};

export async function searchGraphByKeyword(keyword, options = {}) {
  const limit = normalizeLimit(options.limit);
  const sql = `
    SELECT 
      g.SOURCE_USER AS USER_A,
      g.TARGET_USER AS USER_B,
      t.AUTHOR_HANDLE AS HANDLE_A,
      t.POST_TEXT,
      t.POST_ID,
      t.HATE_SCORE
    FROM DIWEN.GRAPH_EDGES g
    JOIN DIWEN.BLUSKY_TEST t ON g.POST_ID = t.POST_ID
    WHERE 
      DBMS_LOB.INSTR(t.POST_TEXT, :keyword, 1, 1) > 0
      AND g.SOURCE_USER <> g.TARGET_USER
    FETCH FIRST :limit ROWS ONLY
  `;
  return await withConnection(async (conn) => {
    const result = await conn.execute(sql, { keyword, limit }, FETCH_OPTS);
    return result.rows || [];
  });
}

export async function findCliqueTriples(options = {}) {
  const limit = normalizeLimit(options.limit);
  const sql = `
    SELECT
      g.SOURCE_USER AS USER_A,
      g.TARGET_USER AS USER_B,
      t.AUTHOR_HANDLE AS HANDLE_A,
      t.POST_TEXT,
      t.POST_ID,
      t.HATE_SCORE
    FROM DIWEN.GRAPH_EDGES g
    JOIN DIWEN.BLUSKY_TEST t ON g.POST_ID = t.POST_ID
    WHERE g.SOURCE_USER <> g.TARGET_USER
    FETCH FIRST :limit ROWS ONLY
  `;
  return await withConnection(async (conn) => {
    const result = await conn.execute(sql, { limit }, FETCH_OPTS);
    return result.rows || [];
  });
}

function calculateCommunities(connections) {
  const nodes = new Set();
  const edges = [];
  connections.forEach(conn => {
    if (!conn.USER_A || !conn.USER_B) return;
    nodes.add(conn.USER_A);
    nodes.add(conn.USER_B);
    const weight = parseFloat(conn.HATE_SCORE) || 1.0;
    edges.push({
      source: conn.USER_A,
      target: conn.USER_B,
      weight
    });
  });
  if (nodes.size === 0 || edges.length === 0) return {};
  const communityAlg = jLouvain().nodes(Array.from(nodes)).edges(edges);
  return communityAlg(); 
}

export async function getCliqueGraph(options = {}) {
  try {
    const connections = (options.keyword && options.keyword.trim().length > 0)
      ? await searchGraphByKeyword(options.keyword, options)
      : await findCliqueTriples(options);
    const communities = calculateCommunities(connections);
    return {
      ok: true,
      connections,
      communities,
      limit: normalizeLimit(options.limit)
    };
  } catch (err) {
    console.error("Graph Service Error:", err); 
    throw new Error("Failed to fetch graph data"); 
  }
}