// /services/graphService.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

const DEFAULT_TABLE = "DIWEN.HARASSMENT_NETWORK";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function normalizeLimit(limit = DEFAULT_LIMIT) {
  const num = Number(limit);
  if (!Number.isFinite(num) || num <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(Math.trunc(num), MAX_LIMIT));
}

function sanitizeTableName(input = DEFAULT_TABLE) {
  const value = String(input ?? "").trim().toUpperCase();
  if (!value) {
    return DEFAULT_TABLE;
  }
  if (!/^[A-Z0-9_.]+$/.test(value)) {
    throw new Error("Invalid table name");
  }
  return value;
}

function rowsToGraph(rows = []) {
  const nodeMap = new Map();
  const links = [];

  for (const row of rows) {
    const a = row?.USER_A ?? row?.user_a ?? null;
    const b = row?.USER_B ?? row?.user_b ?? null;
    const c = row?.USER_C ?? row?.user_c ?? null;

    const ids = [a, b, c]
      .map((value) => (value === undefined || value === null ? null : String(value).trim()))
      .filter((value) => !!value);

    for (const id of ids) {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id });
      }
    }

    if (ids.length === 3) {
      const [idA, idB, idC] = ids;
      links.push({ source: idA, target: idB });
      links.push({ source: idB, target: idC });
      links.push({ source: idC, target: idA });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

export async function findCliqueTriples(options = {}) {
  const limit = normalizeLimit(options.limit);
  const tableName = sanitizeTableName(options.tableName);

  const sql = `
    SELECT
      USER_A,
      USER_B,
      USER_C
    FROM
      GRAPH_TABLE (
        ${tableName}
        MATCH (a) -[e1]-> (b),
              (b) -[e2]-> (c),
              (c) -[e3]-> (a)
        COLUMNS (
          a.USER_DID AS USER_A,
          b.USER_DID AS USER_B,
          c.USER_DID AS USER_C
        )
      )
    FETCH FIRST :limit ROWS ONLY
  `;

  const rows = await withConnection(async (conn) => {
    const result = await conn.execute(
      sql,
      { limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result?.rows ?? [];
  });

  return rows;
}

export async function getCliqueGraph(options = {}) {
  const triples = await findCliqueTriples(options);
  const graph = rowsToGraph(triples);
  return {
    ...graph,
    cliques: triples,
    limit: normalizeLimit(options.limit),
    tableName: sanitizeTableName(options.tableName),
  };
}

export { rowsToGraph };
