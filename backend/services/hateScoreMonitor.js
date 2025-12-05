// /services/hateScoreMonitor.js
import oracledb from "oracledb";
import { fetchLatestHateScores } from "../models/commentModel.js";
import { withConnection } from "../config/db.js";
import { getUserPreferenceModel } from "../models/userPreferenceModel.js";
import { insertNotification } from "../models/notificationModel.js";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_LIMIT = 100;
const DEFAULT_TABLE = "BLUSKY_TEST";
const HATE_SCORE_ALERT_THRESHOLD = 20;
const HATE_SCORE_ALERT_TYPE = "HATE_SCORE_ALERT";
const HATE_SCORE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

let monitorTimer = null;
let isPolling = false;
const listeners = new Set();

let activeOptions = {
  intervalMs: DEFAULT_INTERVAL_MS,
  limit: DEFAULT_LIMIT,
  tableName: DEFAULT_TABLE,
};

let latestSnapshot = {
  value: null,
  updatedAt: null,
  sampleSize: 0,
  tableName: DEFAULT_TABLE,
};

async function fetchAllUserIds() {
  return withConnection(async (conn) => {
    const { rows } = await conn.execute(
      "SELECT ID FROM USERS",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (rows || [])
      .map((row) => row.ID || row.id || row.Id)
      .filter(Boolean)
      .map((id) => String(id));
  });
}

async function maybeSendHateScoreAlert(snapshot) {
  if (!snapshot || snapshot.value === null) {
    return;
  }

  const userIds = await fetchAllUserIds();
  if (userIds.length === 0) {
    return;
  }

  const targets = [];

  for (const userId of userIds) {
    let preferences = null;
    try {
      preferences = await getUserPreferenceModel(userId);
    } catch (err) {
      console.error(`[hateScoreMonitor] failed to load preferences for user ${userId}:`, err);
    }

    const alertsEnabled = preferences?.threatIndexAlertsEnabled ?? false;
    if (!alertsEnabled) {
      continue;
    }

    const threshold = resolveUserThreshold(preferences?.threatIndexThresholds);
    if (snapshot.value < threshold) {
      continue;
    }

    const inCooldown = await isWithinHateScoreCooldown(userId);
    if (inCooldown) {
      continue;
    }

    targets.push({ userId, threshold });
  }

  if (targets.length === 0) {
    return;
  }

  for (const target of targets) {
    try {
      await insertNotification({
        userId: target.userId,
        type: HATE_SCORE_ALERT_TYPE,
        message: `Latest average hate score is ${snapshot.value} (threshold ${target.threshold})`,
        readStatus: 0,
      });
    } catch (err) {
      console.error(
        `[hateScoreMonitor] failed to create notification for user ${target.userId}:`,
        err,
      );
    }
  }
}

function sanitizeOptions(input = {}) {
  const merged = { ...activeOptions, ...input };
  merged.intervalMs = Number(merged.intervalMs) || DEFAULT_INTERVAL_MS;
  if (merged.intervalMs < 1000) {
    merged.intervalMs = 1000;
  }
  merged.limit = Math.max(1, Math.min(Number(merged.limit) || DEFAULT_LIMIT, 500));
  merged.tableName =
    merged.tableName && typeof merged.tableName === "string"
      ? merged.tableName.trim().toUpperCase()
      : DEFAULT_TABLE;
  return merged;
}

function notifyListeners(snapshot) {
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (err) {
      console.error("[hateScoreMonitor] listener error:", err);
    }
  }
}

function extractNumericScores(rows) {
  return rows
    .map((row) => {
      const value = row?.HATE_SCORE ?? row?.hate_score ?? row?.hateScore ?? null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    })
    .filter((num) => num !== null);
}

function resolveUserThreshold(threatIndexThresholds) {
  if (threatIndexThresholds === null || threatIndexThresholds === undefined) {
    return HATE_SCORE_ALERT_THRESHOLD;
  }

  const first =
    Array.isArray(threatIndexThresholds) && threatIndexThresholds.length > 0
      ? threatIndexThresholds[0]
      : threatIndexThresholds;

  let numericSource = first;

  if (numericSource && typeof numericSource === "object") {
    // Prefer explicit value fields if present.
    const explicit =
      numericSource.threshold ??
      numericSource.THRESHOLD ??
      numericSource.value ??
      numericSource.VALUE;

    if (explicit !== undefined) {
      numericSource = explicit;
    } else {
      // Fall back to the first numeric value inside the object (e.g., { BLUSKY_TEST: 10 }).
      const firstNumericValue = Object.values(numericSource).find((val) => {
        const num = Number(val);
        return Number.isFinite(num);
      });
      numericSource = firstNumericValue ?? numericSource;
    }
  }

  const parsed = Number(numericSource);
  return Number.isFinite(parsed) ? parsed : HATE_SCORE_ALERT_THRESHOLD;
}

async function isWithinHateScoreCooldown(userId) {
  const normalizedUserId = String(userId ?? "").trim();
  if (!normalizedUserId) {
    return false;
  }

  return withConnection(async (conn) => {
    const { rows } = await conn.execute(
      `
        SELECT CREATED_AT
          FROM NOTIFICATIONS
         WHERE TYPE = :type
           AND USER_ID = :userId
      ORDER BY CREATED_AT DESC
      FETCH FIRST 1 ROWS ONLY
      `,
      { type: HATE_SCORE_ALERT_TYPE, userId: normalizedUserId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const createdAt = rows?.[0]?.CREATED_AT ?? rows?.[0]?.created_at ?? null;
    const lastCreated =
      createdAt instanceof Date ? createdAt : createdAt ? new Date(createdAt) : null;

    if (!lastCreated || Number.isNaN(lastCreated.getTime())) {
      return false;
    }

    const elapsedMs = Date.now() - lastCreated.getTime();
    return elapsedMs < HATE_SCORE_ALERT_COOLDOWN_MS;
  });
}

async function pollOnce() {
  if (isPolling) {
    return latestSnapshot;
  }

  isPolling = true;
  try {
    const rows = await fetchLatestHateScores(activeOptions.limit, {
      tableName: activeOptions.tableName,
    });
    const scores = extractNumericScores(rows || []);
    const sampleSize = scores.length;
    const average =
      sampleSize > 0 ? scores.reduce((sum, value) => sum + value, 0) / sampleSize : null;
    const scaledAverage = average === null ? null : Number((average * 100).toFixed(1));

    const snapshot = {
      value: scaledAverage,
      updatedAt: new Date().toISOString(),
      sampleSize,
      tableName: activeOptions.tableName,
    };

    latestSnapshot = snapshot;
    notifyListeners(snapshot);
    maybeSendHateScoreAlert(snapshot).catch((err) => {
      console.error("[hateScoreMonitor] failed to create hate-score alert:", err);
    });
    return snapshot;
  } catch (err) {
    console.error("[hateScoreMonitor] poll error:", err);
    return latestSnapshot;
  } finally {
    isPolling = false;
  }
}

export function startHateScoreMonitor(options = {}) {
  activeOptions = sanitizeOptions(options);

  if (monitorTimer) {
    return latestSnapshot;
  }

  // Fire immediately, then schedule subsequent polls.
  pollOnce().catch((err) => {
    console.error("[hateScoreMonitor] initial poll failed:", err);
  });

  monitorTimer = setInterval(() => {
    pollOnce().catch((err) => {
      console.error("[hateScoreMonitor] scheduled poll failed:", err);
    });
  }, activeOptions.intervalMs);

  return latestSnapshot;
}

export function stopHateScoreMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

export function getLatestHateScoreSnapshot() {
  return { ...latestSnapshot };
}

export function onHateScoreUpdate(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("listener must be a function");
  }
  listeners.add(listener);
  if (latestSnapshot.updatedAt) {
    listener({ ...latestSnapshot });
  }
  return () => listeners.delete(listener);
}

export async function refreshHateScoreNow() {
  return pollOnce();
}
