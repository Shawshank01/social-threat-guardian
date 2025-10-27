// /middleware/cors.js

const allowedOrigins = (process.env.CORS_ALLOW_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsMiddleware(req, res, next) {
  const requestOrigin = req.get("Origin");
  const allowAll = allowedOrigins.includes("*");

  if (allowAll) {
    res.header("Access-Control-Allow-Origin", requestOrigin || "*");
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  } else if (!requestOrigin && allowedOrigins.length === 1) {
    res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
  }

  if (requestOrigin) {
    res.header("Vary", "Origin");
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}
