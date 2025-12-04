// /models/userPreferenceModel.js
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";

function genId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export async function ensureUserPreferencesTable() {
  await withConnection(async (conn) => {
    const createTablePLSQL = `
      BEGIN
        EXECUTE IMMEDIATE q'[
          CREATE TABLE USER_PREFERENCES (
            ID                           VARCHAR2(36) PRIMARY KEY,
            USER_ID                      VARCHAR2(36) NOT NULL,
            KEYWORDS                     CLOB CHECK (KEYWORDS IS JSON),
            LANGUAGES                    CLOB CHECK (LANGUAGES IS JSON),
            PLATFORM                     CLOB CHECK (PLATFORM IS JSON),
            THREAT_INDEX_ALERTS_ENABLED  NUMBER(1) DEFAULT 0,
            THREAT_INDEX_THRESHOLDS      CLOB CHECK (THREAT_INDEX_THRESHOLDS IS JSON),
            CREATED_AT                   TIMESTAMP DEFAULT SYSTIMESTAMP,
            UPDATED_AT                   TIMESTAMP
          )
        ]';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;`;
    await conn.execute(createTablePLSQL, {}, { autoCommit: true });

    const addUpdatedDefaultPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE USER_PREFERENCES MODIFY (UPDATED_AT DEFAULT SYSTIMESTAMP)';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -1430 THEN
            NULL;
          END IF;
      END;`;
    await conn.execute(addUpdatedDefaultPLSQL, {}, { autoCommit: true });

    const addThreatIndexAlertsEnabledPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE USER_PREFERENCES ADD (THREAT_INDEX_ALERTS_ENABLED NUMBER(1) DEFAULT 0)';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -1430 THEN
            NULL;
          END IF;
      END;`;
    await conn.execute(addThreatIndexAlertsEnabledPLSQL, {}, { autoCommit: true });

    const addThreatIndexThresholdsPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE q'[
          ALTER TABLE USER_PREFERENCES ADD (
            THREAT_INDEX_THRESHOLDS CLOB CHECK (THREAT_INDEX_THRESHOLDS IS JSON)
          )
        ]';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -1430 THEN
            NULL;
          END IF;
      END;`;
    await conn.execute(addThreatIndexThresholdsPLSQL, {}, { autoCommit: true });

    const addFkPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE q'[
          ALTER TABLE USER_PREFERENCES
            ADD CONSTRAINT FK_USER_PREF_USER
            FOREIGN KEY (USER_ID)
            REFERENCES USERS (ID)
            ON DELETE CASCADE
        ]';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE NOT IN (-2261, -2443) THEN
            NULL;
          END IF;
      END;`;
    await conn.execute(addFkPLSQL, {}, { autoCommit: true });

    const addIndexPLSQL = `
      BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_USER_PREF_USER ON USER_PREFERENCES (USER_ID)';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -1408 THEN
            NULL;
          END IF;
      END;`;
    await conn.execute(addIndexPLSQL, {}, { autoCommit: true });
  });
}

export async function upsertUserPreferenceModel({
  userId,
  keywords = [],
  languages = [],
  platform = [],
  threatIndexAlertsEnabled = false,
  threatIndexThresholds = [],
}) {
  if (!userId) throw new Error("userId is required");

  const keywordsArr = Array.isArray(keywords) ? keywords : [keywords];
  const languagesArr = Array.isArray(languages) ? languages : [languages];
  const platformArr = Array.isArray(platform) ? platform : [platform];
  const threatIndexThresholdsValue =
    threatIndexThresholds === undefined || threatIndexThresholds === null
      ? []
      : threatIndexThresholds;

  let thresholdsNormalized = threatIndexThresholdsValue;
  if (typeof threatIndexThresholdsValue === "string") {
    try {
      thresholdsNormalized = JSON.parse(threatIndexThresholdsValue);
    } catch {
      thresholdsNormalized = [threatIndexThresholdsValue];
    }
  }

  const cleanedKeywords = keywordsArr
    .map((val) => String(val || "").trim())
    .filter((val) => val.length > 0);
  const cleanedLanguages = languagesArr
    .map((val) => String(val || "").trim())
    .filter((val) => val.length > 0);
  const cleanedPlatform = platformArr
    .map((val) => String(val || "").trim())
    .filter((val) => val.length > 0);
  const cleanedThreatIndexAlertsEnabled =
    typeof threatIndexAlertsEnabled === "string"
      ? ["true", "1", "yes", "on"].includes(threatIndexAlertsEnabled.toLowerCase())
      : Boolean(threatIndexAlertsEnabled);

  const payload = {
    id: genId(),
    userId,
    keywords: JSON.stringify(cleanedKeywords),
    languages: JSON.stringify(cleanedLanguages),
    platform: JSON.stringify(cleanedPlatform),
    threatIndexAlertsEnabled: cleanedThreatIndexAlertsEnabled ? 1 : 0,
    threatIndexThresholds: JSON.stringify(thresholdsNormalized ?? []),
  };

  return withConnection(async (conn) => {
    await conn.execute(
      `
        MERGE INTO USER_PREFERENCES dst
        USING (SELECT :userId AS USER_ID FROM dual) src
          ON (dst.USER_ID = src.USER_ID)
        WHEN MATCHED THEN
          UPDATE SET
            KEYWORDS = :keywords,
            LANGUAGES = :languages,
            PLATFORM = :platform,
            THREAT_INDEX_ALERTS_ENABLED = :threatIndexAlertsEnabled,
            THREAT_INDEX_THRESHOLDS = :threatIndexThresholds,
            UPDATED_AT = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            ID,
            USER_ID,
            KEYWORDS,
            LANGUAGES,
            PLATFORM,
            THREAT_INDEX_ALERTS_ENABLED,
            THREAT_INDEX_THRESHOLDS,
            CREATED_AT,
            UPDATED_AT
          )
          VALUES (
            :id,
            :userId,
            :keywords,
            :languages,
            :platform,
            :threatIndexAlertsEnabled,
            :threatIndexThresholds,
            SYSTIMESTAMP,
            SYSTIMESTAMP
          )
      `,
      payload,
      { autoCommit: true }
    );

    const result = await conn.execute(
      `
        SELECT ID,
               USER_ID,
               KEYWORDS,
               LANGUAGES,
               PLATFORM,
               THREAT_INDEX_ALERTS_ENABLED,
               THREAT_INDEX_THRESHOLDS,
               CREATED_AT,
               UPDATED_AT
          FROM USER_PREFERENCES
         WHERE USER_ID = :userId
      `,
      { userId },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          KEYWORDS: { type: oracledb.STRING },
          LANGUAGES: { type: oracledb.STRING },
          PLATFORM: { type: oracledb.STRING },
          THREAT_INDEX_THRESHOLDS: { type: oracledb.STRING },
        },
      }
    );

    const row = result.rows?.[0] || null;
    if (!row) return null;

    return {
      id: row.ID,
      userId: row.USER_ID,
      keywords: row.KEYWORDS ? JSON.parse(row.KEYWORDS) : [],
      languages: row.LANGUAGES ? JSON.parse(row.LANGUAGES) : [],
      platform: row.PLATFORM ? JSON.parse(row.PLATFORM) : [],
      threatIndexAlertsEnabled: Boolean(row.THREAT_INDEX_ALERTS_ENABLED),
      threatIndexThresholds: row.THREAT_INDEX_THRESHOLDS
        ? JSON.parse(row.THREAT_INDEX_THRESHOLDS)
        : [],
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    };
  });
}

export async function getUserPreferenceModel(userId) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    throw new Error("userId is required");
  }

  return withConnection(async (conn) => {
    const result = await conn.execute(
      `
        SELECT ID,
               USER_ID,
               KEYWORDS,
               LANGUAGES,
               PLATFORM,
               THREAT_INDEX_ALERTS_ENABLED,
               THREAT_INDEX_THRESHOLDS,
               CREATED_AT,
               UPDATED_AT
          FROM USER_PREFERENCES
         WHERE USER_ID = :userId
      `,
      { userId: resolvedUserId },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          KEYWORDS: { type: oracledb.STRING },
          LANGUAGES: { type: oracledb.STRING },
          PLATFORM: { type: oracledb.STRING },
          THREAT_INDEX_THRESHOLDS: { type: oracledb.STRING },
        },
      }
    );

    const row = result.rows?.[0];
    if (!row) {
      return null;
    }

    return {
      id: row.ID,
      userId: row.USER_ID,
      keywords: row.KEYWORDS ? JSON.parse(row.KEYWORDS) : [],
      languages: row.LANGUAGES ? JSON.parse(row.LANGUAGES) : [],
      platform: row.PLATFORM ? JSON.parse(row.PLATFORM) : [],
      threatIndexAlertsEnabled: Boolean(row.THREAT_INDEX_ALERTS_ENABLED),
      threatIndexThresholds: row.THREAT_INDEX_THRESHOLDS
        ? JSON.parse(row.THREAT_INDEX_THRESHOLDS)
        : [],
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    };
  });
}
