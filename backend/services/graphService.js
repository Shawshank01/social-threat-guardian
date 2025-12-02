import oracledb from "oracledb";
import { withConnection } from "../config/db.js";
import jLouvainLib from "jlouvain"; 

 const jLouvain = jLouvainLib.jLouvain || jLouvainLib;
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
 const rows = await withConnection(async (conn) => {
 const result = await conn.execute(
 sql,
 { keyword, limit },
 {
 outFormat: oracledb.OUT_FORMAT_OBJECT,
 fetchInfo: {
 USER_A: { type: oracledb.STRING },
 USER_B: { type: oracledb.STRING },
 HANDLE_A: { type: oracledb.STRING },
 POST_TEXT: { type: oracledb.STRING },
 POST_ID: { type: oracledb.STRING },
 HATE_SCORE: { type: oracledb.STRING },
 },
 }
 );
 return result.rows || [];
 });
 return rows;
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
 const rows = await withConnection(async (conn) => {
 const result = await conn.execute(
 sql,
 { limit },
 {
 outFormat: oracledb.OUT_FORMAT_OBJECT,
 fetchInfo: {
 USER_A: { type: oracledb.STRING },
 USER_B: { type: oracledb.STRING },
 HANDLE_A: { type: oracledb.STRING },
 POST_TEXT: { type: oracledb.STRING },
 POST_ID: { type: oracledb.STRING },
 HATE_SCORE: { type: oracledb.STRING },
 },
 },
 );
 return result.rows || [];
 });
 return rows;
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
 weight: weight 
 });
 });
 if (nodes.size === 0 || edges.length === 0) {
 return {};
 }
 const community = jLouvain()
 .nodes(Array.from(nodes))
 .edges(edges);
 return community(); 
}
 export async function getCliqueGraph(options = {}) {
 let connections = [];
 try {
 if (options.keyword && options.keyword.trim().length > 0) {
 connections = await searchGraphByKeyword(options.keyword, options);
 } else {
 connections = await findCliqueTriples(options);
 }
 const communityMap = calculateCommunities(connections);
 return {
 ok: true,
 connections: connections,
 communities: communityMap,
 limit: normalizeLimit(options.limit)
 };
 } catch (err) {
 console.error("Execution Error:", err); 
 throw err; 
 }
}