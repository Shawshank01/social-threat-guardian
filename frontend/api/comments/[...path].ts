import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";
import { Buffer } from "node:buffer";

type ApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
    "content-type"?: string | string[];
  };
  url?: string;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
  setHeader: (name: string, value: string) => void;
};

const BACKEND_URL = process.env.BACKEND_URL;

const normalizeHeader = (value?: string | string[]) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

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

  const method = (req.method || "").toUpperCase().trim();
  const url = req.url || "";

  let subPath = "";
  let urlObj: URL;
  let queryParams: URLSearchParams;
  let search = "";

  try {
    // Try to parse as absolute URL first, then fall back to relative
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urlObj = new URL(url);
    } else {
      urlObj = new URL(url, "http://localhost");
    }

    // Extract path from URL object
    const pathname = urlObj.pathname;
    const exactMatch = pathname.match(/^\/api\/comments\/?$/);
    const pathMatch = pathname.match(/^\/api\/comments\/(.+)$/);

    if (exactMatch) {
      subPath = "";
    } else if (pathMatch) {
      subPath = pathMatch[1];
    }

    queryParams = urlObj.searchParams;
    search = urlObj.search || "";
  } catch {
    // Fallback: use regex parsing if URL parsing fails
    const exactMatch = url.match(/^\/api\/comments\/?$/);
    const pathMatch = url.match(/^\/api\/comments\/(.+)$/);

    if (exactMatch) {
      subPath = "";
    } else if (pathMatch) {
      subPath = pathMatch[1];
    }

    // Try to create URL object for query params, but use empty if it fails
    try {
      urlObj = new URL(url, "http://localhost");
      queryParams = urlObj.searchParams;
      search = urlObj.search || "";
    } catch {
      // If URL parsing completely fails, extract query string manually
      const queryMatch = url.match(/\?(.+)$/);
      search = queryMatch ? `?${queryMatch[1]}` : "";
      queryParams = new URLSearchParams(search);
    }
  }

  try {
    let targetPath = "";
    let backendMethod = method;

    // Strip query parameters from subPath for comparison
    const subPathWithoutQuery = subPath.split("?")[0];

    if (subPathWithoutQuery === "latest") {
      // GET /comments/latest
      if (method !== "GET") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }
      targetPath = `/comments/latest${search}`;
      backendMethod = "GET";
    } else if (subPathWithoutQuery === "search") {
      // POST /comments/search
      if (method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }
      targetPath = "/comments/search";
      backendMethod = "POST";
    } else if (subPathWithoutQuery.match(/^[^/]+\/notes$/)) {
      // GET or POST /comments/:processedId/notes
      const processedId = subPathWithoutQuery.replace(/\/notes$/, "");
      targetPath = `/comments/${encodeURIComponent(processedId)}/notes${search}`;
      backendMethod = method;
    } else {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }

    const targetUrl = new URL(targetPath, BACKEND_URL).toString();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const authHeader = normalizeHeader(req.headers.authorization);
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    if (backendMethod === "POST") {
      headers["Content-Type"] = normalizeHeader(req.headers["content-type"]) ?? "application/json";
    }

    const response = await makeRequest(targetUrl, {
      method: backendMethod,
      headers,
      body: backendMethod === "POST" ? serializeBody(req.body) : undefined,
    });

    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(response.body);
  } catch (error) {
    console.error("[api/comments] Backend request failed:", error);
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
  }
}
