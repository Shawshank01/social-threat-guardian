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
  url?: string;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

function makeRequest(url: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
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

    req.end();
  });
}

const normalizeHeader = (value?: string | string[]) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
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

  const token = normalizeHeader(req.headers.authorization)?.replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  // Parse the path from URL - handle both /api/notifications and /api/notifications/*
  const url = req.url || "";
  let subPath = "";
  
  const exactMatch = url.match(/^\/api\/notifications\/?$/);
  const pathMatch = url.match(/^\/api\/notifications\/(.+)$/);
  
  if (exactMatch) {
    subPath = "";
  } else if (pathMatch) {
    subPath = pathMatch[1];
  } else {
    res.status(404).json({ ok: false, error: "Not found" });
    return;
  }

  try {
    let targetPath = "/notifications";
    let method = req.method || "GET";

    // Route based on sub-path
    if (subPath === "unread-count") {
      targetPath = "/notifications/unread-count";
      method = "GET";
    } else if (subPath === "read-all") {
      targetPath = "/notifications/read-all";
      method = "POST";
    } else if (subPath.match(/^[^/]+\/read$/)) {
      const id = subPath.replace(/\/read$/, "");
      targetPath = `/notifications/${id}/read`;
      method = "POST";
    } else if (subPath === "" || !subPath) {
      targetPath = "/notifications";
      method = "GET";
    } else {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }

    // Build query params for GET /notifications
    if (method === "GET" && targetPath === "/notifications") {
      const { limit, offset, unreadOnly } = req.query || {};
      const params = new URLSearchParams();
      if (limit) params.append("limit", String(limit));
      if (offset) params.append("offset", String(offset));
      if (unreadOnly === "true") params.append("unreadOnly", "true");
      if (params.toString()) {
        targetPath += `?${params.toString()}`;
      }
    }

    const targetUrl = new URL(targetPath, BACKEND_URL).toString();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const response = await makeRequest(targetUrl, {
      method,
      headers,
    });

    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.status(response.status).send(response.body);
  } catch (error) {
    console.error("[api/notifications] Backend request failed:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to connect to backend server.",
    });
  }
}

