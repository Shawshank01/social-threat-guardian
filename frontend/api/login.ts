import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";

type ApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
    "content-type"?: string | string[];
  };
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

// Helper function to make HTTP/HTTPS requests to the backend
function makeRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = client.request(requestOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const headers: Record<string, string> = {};
        Object.keys(res.headers).forEach((key) => {
          const value = res.headers[key];
          if (value) {
            headers[key] = Array.isArray(value) ? value[0] : value;
          }
        });
        resolve({
          status: res.statusCode || 500,
          headers,
          body,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

const AUTH_PATH = "/auth/login";

const METHOD_NOT_ALLOWED = "Method Not Allowed";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!BACKEND_URL) {
    res.status(500).json({ ok: false, error: "BACKEND_URL is not configured." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send(METHOD_NOT_ALLOWED);
    return;
  }

  const targetUrl = new URL(AUTH_PATH, BACKEND_URL).toString();

  const body =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});

  const headers: Record<string, string> = {
    "Content-Type":
      (Array.isArray(req.headers["content-type"])
        ? req.headers["content-type"][0]
        : req.headers["content-type"]) ?? "application/json",
  };

  if (req.headers.authorization) {
    const authHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    headers.Authorization = authHeader ?? "";
  }

  try {
    const response = await makeRequest(targetUrl, {
      method: "POST",
      headers,
      body,
    });

    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.status(response.status).send(response.body);
  } catch (error) {
    console.error("[api/login] Backend request failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a certificate validation error
    if (errorMessage.includes("certificate") || errorMessage.includes("SSL") || errorMessage.includes("TLS")) {
      res.status(500).json({
        ok: false,
        error: "SSL certificate validation failed. The backend is using a self-signed certificate which is not accepted in production. Please use a valid certificate (Let's Encrypt) or a reverse proxy (Cloudflare).",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    } else {
      res.status(500).json({
        ok: false,
        error: "Failed to connect to backend server.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  }
}
