import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";

type ApiRequest = IncomingMessage & {
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
    "content-type"?: string | string[];
  };
  body?: unknown;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
  end: (chunk?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

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

const normalizeHeader = (value?: string | string[]) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const serializeBody = (body: unknown) => {
  if (typeof body === "string") return body;
  if (body instanceof Buffer) return body.toString();
  if (body === undefined || body === null) return "{}";
  try {
    return JSON.stringify(body);
  } catch {
    return "{}";
  }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!BACKEND_URL) {
    res.status(500).json({ ok: false, error: "BACKEND_URL is not configured." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  const targetUrl = new URL("/user-preferences", BACKEND_URL).toString();

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authHeader = normalizeHeader(req.headers.authorization);
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  try {
    if (req.method === "GET") {
      const response = await makeRequest(targetUrl, {
        method: "GET",
        headers,
      });

      const contentType = response.headers["content-type"];
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.status(response.status).send(response.body);
      return;
    }

    if (req.method === "POST") {
      const response = await makeRequest(targetUrl, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": normalizeHeader(req.headers["content-type"]) ?? "application/json",
        },
        body: serializeBody(req.body),
      });

      const contentType = response.headers["content-type"];
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.status(response.status).send(response.body);
      return;
    }
  } catch (error) {
    console.error("[api/user-preferences] Backend request failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

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
    return;
  }

  res.status(405).send("Method Not Allowed");
}
