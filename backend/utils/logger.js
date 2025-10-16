// /utils/logger.js

/**
 * Format the current timestamp as a readable string
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Base logger function
 */
function log(level, ...args) {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  console.log(prefix, ...args);
}

/**
 * Info level log
 */
export function info(...args) {
  log("info", ...args);
}

/**
 * Warning level log
 */
export function warn(...args) {
  log("warn", ...args);
}

/**
 * Error level log
 */
export function error(...args) {
  log("error", ...args);
}

/**
 * Debug level log
 */
export function debug(...args) {
  if (process.env.DEBUG === "true") {
    log("debug", ...args);
  }
}