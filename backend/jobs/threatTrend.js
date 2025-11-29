// Periodic aggregation for HATE_THREAT_TREND using setInterval.
// Import and call startThreatTrendJobs() from your server bootstrap after Oracle pool init.
import { aggregateThreatTrend } from "../services/threatTrendService.js";

const DEFAULT_JOBS = {
  minute: {
    enabled: true,
    intervalMs: 60_000, // run every minute
    lookbackMs: 60 * 60 * 1000, // cover past 60 minutes
  },
  hour: {
    enabled: false, // enable if you want hourly aggregation
    intervalMs: 15 * 60 * 1000, // every 15 minutes to keep hours fresh
    lookbackMs: 72 * 60 * 60 * 1000, // cover past 72 hours
  },
  day: {
    enabled: false, // enable if you want daily aggregation
    intervalMs: 60 * 60 * 1000, // every hour to keep days fresh
    lookbackMs: 35 * 24 * 60 * 60 * 1000, // cover past 35 days
  },
};

const timers = new Map();
const locks = new Set();

function buildRunner(aggLevel, config) {
  const { lookbackMs } = config;

  return async () => {
    if (locks.has(aggLevel)) return;
    locks.add(aggLevel);
    const now = new Date();
    const start = new Date(now.getTime() - lookbackMs);
    try {
      const res = await aggregateThreatTrend({
        aggLevel,
        start,
        end: now,
      });
      console.log(
        `[threatTrendJob] agg=${aggLevel} rowsAffected=${res.rowsAffected} window=${res.start}..${res.end}`,
      );
    } catch (err) {
      console.error(`[threatTrendJob] agg=${aggLevel} failed:`, err);
    } finally {
      locks.delete(aggLevel);
    }
  };
}

export function startThreatTrendJobs(customConfig = {}) {
  const config = { ...DEFAULT_JOBS, ...customConfig };

  for (const [aggLevel, jobCfg] of Object.entries(config)) {
    if (!jobCfg || jobCfg.enabled === false) continue;
    const intervalMs = Number(jobCfg.intervalMs) || DEFAULT_JOBS[aggLevel]?.intervalMs;
    const lookbackMs = Number(jobCfg.lookbackMs) || DEFAULT_JOBS[aggLevel]?.lookbackMs;
    if (!intervalMs || intervalMs < 1000 || !lookbackMs) {
      console.warn(`[threatTrendJob] skip ${aggLevel}: invalid interval/lookback config`);
      continue;
    }

    // Run immediately, then schedule.
    const runner = buildRunner(aggLevel, { intervalMs, lookbackMs });
    runner().catch((err) => console.error(`[threatTrendJob] initial ${aggLevel} run failed:`, err));

    const timer = setInterval(runner, intervalMs);
    timers.set(aggLevel, timer);
    console.log(
      `[threatTrendJob] started agg=${aggLevel} intervalMs=${intervalMs} lookbackMs=${lookbackMs}`,
    );
  }
}

export function stopThreatTrendJobs() {
  for (const [aggLevel, timer] of timers.entries()) {
    clearInterval(timer);
    console.log(`[threatTrendJob] stopped agg=${aggLevel}`);
  }
  timers.clear();
  locks.clear();
}
