// /models/commentModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

export async function fetchLatestComments(limit = 4, filters = {}) {
  const capped = Math.max(1, Math.min(Number(limit) || 4, 50));
  const predIntent =
    filters.predIntent !== undefined && filters.predIntent !== null
      ? String(filters.predIntent).trim()
      : "NEUTRAL";

  return withConnection(async (conn) => {
    const binds = { limit: capped };
    const whereClause = predIntent ? "WHERE PRED_INTENT = :predIntent" : "";
    if (predIntent) {
      binds.predIntent = predIntent;
    }

    const result = await conn.execute(
      `
        SELECT POST_TEXT, PRED_INTENT, POST_TIMESTAMP
          FROM (
            SELECT POST_TEXT, PRED_INTENT, POST_TIMESTAMP
              FROM BLUSKY
             ${whereClause}
             ORDER BY POST_TIMESTAMP DESC NULLS LAST
          )
         WHERE ROWNUM <= :limit
      `,
      binds,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          POST_TEXT: { type: oracledb.STRING },
          PRED_INTENT: { type: oracledb.STRING },
        },
      }
    );

    return result.rows || [];
  });
}
