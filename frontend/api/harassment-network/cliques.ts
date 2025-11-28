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
  end: (body?: unknown) => ApiResponse;
  setHeader: (name: string, value: string) => void;
};

const BACKEND_URL = process.env.BACKEND_URL;

const normalizeHeader = (value?: string | string[]) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

// Helper function to make HTTP/HTTPS requests to the backend
function makeRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Log incoming request for debugging
  console.log("[api/harassment-network/cliques] Request received:", {
    method: req.method,
    url: req.url,
  });

  if (!BACKEND_URL) {
    console.error("[api/harassment-network/cliques] BACKEND_URL is not configured");
    res.status(500).json({ ok: false, error: "BACKEND_URL is not configured." });
    return;
  }

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({
      ok: false,
      error: `Method ${req.method} not allowed. Supported methods: GET, OPTIONS`,
    });
    return;
  }

  // Extract query parameters from URL
  let queryParams = "";
  if (req.url) {
    try {
      const urlObj = new URL(req.url, "http://localhost");
      queryParams = urlObj.search;
    } catch (error) {
      console.warn("[api/harassment-network/cliques] Failed to parse URL:", error);
    }
  }

  // Forward request to backend
  const targetUrl = new URL(`/harassment-network/cliques${queryParams}`, BACKEND_URL).toString();

  try {
    const response = await makeRequest(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(response.body);
    return;
  } catch (error) {
    console.error("[api/harassment-network/cliques] Backend request failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      error: "Failed to connect to backend server.",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
    });
    return;
  }
}

