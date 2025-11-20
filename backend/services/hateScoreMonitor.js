// /services/hateScoreMonitor.js
import { fetchLatestHateScores } from "../models/commentModel.js";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_LIMIT = 100;
const DEFAULT_TABLE = "BLUSKY_TEST";

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
