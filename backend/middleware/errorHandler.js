// /middleware/errorHandler.js

export function errorHandler(err, req, res, next) {
  console.error("[ErrorHandler]", err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    ok: false,
    error: message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
}