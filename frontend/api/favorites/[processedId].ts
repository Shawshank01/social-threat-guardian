import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";

type ApiRequest = IncomingMessage & {
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
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

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  // Extract processedId from the dynamic route segment [processedId]
  // In Vercel serverless functions, req.url contains the pathname (e.g., /api/favorites/post-123)
  // Extract the last path segment which is the processedId
  let processedId = "";
  if (req.url) {
    try {
      const url = req.url.startsWith("http") 
        ? new URL(req.url) 
        : new URL(req.url, "http://localhost");
      const pathParts = url.pathname.split("/").filter(Boolean);
      // Get the last segment and decode it (handles URL-encoded AT URIs)
      const rawId = pathParts[pathParts.length - 1] || "";
      processedId = decodeURIComponent(rawId);
    } catch {
      // Fallback: try to extract from the URL string directly using regex
      const match = req.url.match(/\/([^/?]+)(?:\?|$)/);
      if (match && match[1]) {
        try {
          processedId = decodeURIComponent(match[1]);
        } catch {
          processedId = match[1];
        }
      }
    }
  }
  
  if (!processedId) {
    res.status(400).json({ ok: false, error: "Missing post_id in URL" });
    return;
  }

  // Normalise method to uppercase for comparison
  const method = req.method?.toUpperCase() || "";

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authHeader = normalizeHeader(req.headers.authorization);
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  if (method === "GET") {
    // GET single bookmark by processedId is not supported by the backend API
    // Use GET /bookmark to list all bookmarks, or GET /bookmark/content to get bookmark content
    res.status(501).json({
      ok: false,
      error: "GET single bookmark is not supported. Use GET /api/favorites to list all bookmarks.",
    });
    return;
  }

  if (method === "DELETE") {
    // DELETE /bookmark/remove, remove a bookmark
    const targetUrl = new URL("/bookmark/remove", BACKEND_URL).toString();
    
    try {
      const response = await makeRequest(targetUrl, {
        method: "DELETE",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: serializeBody({ post_id: processedId }),
      });

      const contentType = response.headers["content-type"];
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.status(response.status).send(response.body);
      return;
    } catch (error) {
      console.error("[api/favorites/[processedId]] Backend request failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        ok: false,
        error: "Failed to connect to backend server.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
      return;
    }
  }

  // Method not allowed
  res.status(405).json({ 
    ok: false, 
    error: `Method ${method} not allowed. Supported methods: DELETE, OPTIONS` 
  });
}
