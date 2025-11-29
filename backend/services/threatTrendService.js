import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

const DEFAULT_SOURCE_TABLE = "BLUSKY_TEST";
const DEFAULT_TARGET_TABLE = "HATE_THREAT_TREND";

const AGG_LEVEL_CONFIG = {
  minute: { dbValue: "MINUTE", trunc: "MI", defaultLookbackMs: 60 * 60 * 1000 }, // 1 hour
  hour: { dbValue: "HOUR", trunc: "HH24", defaultLookbackMs: 48 * 60 * 60 * 1000 }, // 48 hours
  day: { dbValue: "DAY", trunc: "DD", defaultLookbackMs: 30 * 24 * 60 * 60 * 1000 }, // 30 days
};

function normalizeTableName(name, fallback) {
  const value = name !== undefined && name !== null ? String(name).trim() : fallback;
  const upper = value ? value.toUpperCase() : "";
  if (!upper || !/^[A-Z0-9_.]+$/.test(upper)) {
    throw new Error("Invalid table name");
  }
  return upper;
}

function normalizeAggLevel(input) {
  const key = (input || "minute").toString().trim().toLowerCase();
  const config = AGG_LEVEL_CONFIG[key];
  if (!config) {
    throw new Error("Unsupported aggLevel; use minute | hour | day");
  }
  return { key, ...config };
}

function normalizeDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label} time`);
  }
  return date;
}

function resolveRange(config, start, end) {
  const endDate = end ? normalizeDate(end, "end") : new Date();
  const startDate = start
    ? normalizeDate(start, "start")
    : new Date(endDate.getTime() - config.defaultLookbackMs);

  if (startDate > endDate) {
    throw new Error("start must be before end");
  }

  return { startDate, endDate };
}

/** Run an aggregate MERGE into HATE_THREAT_TREND for the requested window */
export async function aggregateThreatTrend(options = {}) {
  const { aggLevel = "minute", start, end, sourceTable, targetTable } = options;

  const agg = normalizeAggLevel(aggLevel);
  const { startDate, endDate } = resolveRange(agg, start, end);
  const source = normalizeTableName(sourceTable, DEFAULT_SOURCE_TABLE);
  const target = normalizeTableName(targetTable, DEFAULT_TARGET_TABLE);

  const truncExpr = `TRUNC(POST_TIMESTAMP, '${agg.trunc}')`;
  const sql = `
    MERGE INTO ${target} t
    USING (
      SELECT '${agg.dbValue}' AS agg_level,
             ${truncExpr} AS time_bucket,
             AVG(HATE_SCORE) AS avg_hate_score,
             COUNT(*) AS msg_count
        FROM ${source}
       WHERE POST_TIMESTAMP BETWEEN :start_ts AND :end_ts
       GROUP BY ${truncExpr}
    ) s
       ON (t.AGG_LEVEL = s.agg_level AND t.TIME_BUCKET = s.time_bucket)
     WHEN MATCHED THEN
       UPDATE SET t.AVG_HATE_SCORE = s.avg_hate_score,
                  t.MSG_COUNT      = s.msg_count,
                  t.CREATED_AT     = SYSTIMESTAMP
     WHEN NOT MATCHED THEN
       INSERT (AGG_LEVEL, TIME_BUCKET, AVG_HATE_SCORE, MSG_COUNT)
       VALUES (s.agg_level, s.time_bucket, s.avg_hate_score, s.msg_count)
  `;

  const binds = {
    start_ts: startDate,
    end_ts: endDate,
  };

  const result = await withConnection(async (conn) => {
    const r = await conn.execute(sql, binds, { autoCommit: true });
    return r;
  });

  return {
    ok: true,
    rowsAffected: result?.rowsAffected ?? 0,
    aggLevel: agg.dbValue,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    sourceTable: source,
    targetTable: target,
  };
}

/** Query HATE_THREAT_TREND and return a JSON-friendly payload */
export async function fetchThreatTrend(options = {}) {
  const { aggLevel = "minute", start, end, targetTable } = options;
  const agg = normalizeAggLevel(aggLevel);
  const { startDate, endDate } = resolveRange(agg, start, end);
  const target = normalizeTableName(targetTable, DEFAULT_TARGET_TABLE);

  const sql = `
    SELECT TIME_BUCKET, AVG_HATE_SCORE, MSG_COUNT
      FROM ${target}
     WHERE AGG_LEVEL = :aggLevel
       AND TIME_BUCKET BETWEEN :start_ts AND :end_ts
     ORDER BY TIME_BUCKET
  `;

  const rows = await withConnection(async (conn) => {
    const result = await conn.execute(
      sql,
      { aggLevel: agg.dbValue, start_ts: startDate, end_ts: endDate },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          TIME_BUCKET: { type: oracledb.DATE },
          AVG_HATE_SCORE: { type: oracledb.NUMBER },
          MSG_COUNT: { type: oracledb.NUMBER },
        },
      }
    );
    return result.rows || [];
  });

  return rows.map((row) => {
    const bucket = row.TIME_BUCKET instanceof Date ? row.TIME_BUCKET : new Date(row.TIME_BUCKET);
    return {
      time: Number.isNaN(bucket.getTime()) ? null : bucket.toISOString(),
      avgHateScore: row.AVG_HATE_SCORE !== null ? Number(row.AVG_HATE_SCORE) : null,
      count: row.MSG_COUNT !== null ? Number(row.MSG_COUNT) : null,
    };
  });
}
