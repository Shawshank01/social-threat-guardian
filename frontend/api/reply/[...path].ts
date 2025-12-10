import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";

type ApiRequest = IncomingMessage & {
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
    "content-type"?: string | string[];
  };
  url?: string;
  body?: unknown;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
  end: (chunk?: unknown) => ApiResponse;
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

const serializeBody = (body: unknown): string => {
  if (!body) return "{}";
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
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  const method = (req.method || "").toUpperCase().trim();
  const url = req.url || "";

  let subPath = "";
  let queryParams: URLSearchParams;

  // Prefer Vercel catch-all param if present (req.query.path)
  const pathFromQuery = Array.isArray((req as unknown as { query?: Record<string, unknown> }).query?.path)
    ? ((req as unknown as { query: Record<string, string[]> }).query.path).join("/")
    : undefined;

  try {
    let urlObj: URL;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urlObj = new URL(url);
    } else {
      urlObj = new URL(url, "http://localhost");
    }

    const pathname = urlObj.pathname;
    const exactMatch = pathname.match(/^\/api\/reply\/?$/);
    const pathMatch = pathname.match(/^\/api\/reply\/(.+)$/);

    if (pathFromQuery && !exactMatch) {
      subPath = pathFromQuery;
    } else if (exactMatch) {
      subPath = "";
    } else if (pathMatch) {
      subPath = pathMatch[1];
    }

    queryParams = urlObj.searchParams;
  } catch {
    const exactMatch = url.match(/^\/api\/reply\/?$/);
    const pathMatch = url.match(/^\/api\/reply\/(.+)$/);

    if (pathFromQuery && !exactMatch) {
      subPath = pathFromQuery;
    } else if (exactMatch) {
      subPath = "";
    } else if (pathMatch) {
      subPath = pathMatch[1];
    }

    try {
      const fallbackUrl = new URL(url, "http://localhost");
      queryParams = fallbackUrl.searchParams;
    } catch {
      const queryMatch = url.match(/\?(.+)$/);
      const search = queryMatch ? `?${queryMatch[1]}` : "";
      queryParams = new URLSearchParams(search);
    }
  }

  const subPathNormalized = subPath.replace(/\/+$/, "").split("?")[0];

  try {
    let targetPath = "";
    let backendMethod = method;

    if (subPathNormalized === "add") {
      if (method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }
      targetPath = "/reply/add";
      backendMethod = "POST";
    } else if (subPathNormalized) {
      // Decode once (paths arrive URL-encoded), then re-encode exactly once for the backend route.
      const decodedId = (() => {
        try {
          return decodeURIComponent(subPathNormalized);
        } catch {
          return subPathNormalized;
        }
      })();
      targetPath = `/reply/${encodeURIComponent(decodedId)}`;
      if (method === "DELETE") {
        backendMethod = "DELETE";
      } else if (method === "GET") {
        backendMethod = "GET";
      } else {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }
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
      body: (backendMethod === "POST" || backendMethod === "DELETE") ? serializeBody(req.body) : undefined,
    });

    if (backendMethod === "DELETE") {
      try {
        const responsePayload = JSON.parse(response.body);
        if (responsePayload && (responsePayload.ok === true || (responsePayload.removed && responsePayload.removed > 0))) {
          const contentType = response.headers["content-type"];
          if (contentType) {
            res.setHeader("Content-Type", contentType);
          }
          res.status(200).send(response.body);
          return;
        }
      } catch {
      }
    }

    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(response.body);
  } catch (error) {
    console.error("[api/reply] Backend request failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      error: "Failed to connect to backend server.",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
    });
  }
}
