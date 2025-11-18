import type { IncomingMessage, ServerResponse } from "http";

type ApiRequest = IncomingMessage & {
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
  };
  url?: string;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
  end: (chunk?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

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
    res.setHeader("Access-Control-Allow-Methods", "GET,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  // Extract processedId from URL (e.g., /api/favorites/post-123?userId=...)
  // The URL might be relative or absolute, handle both cases
  let processedId = "";
  if (req.url) {
    try {
      const url = req.url.startsWith("http") 
        ? new URL(req.url) 
        : new URL(req.url, "http://localhost");
      const pathParts = url.pathname.split("/").filter(Boolean);
      processedId = pathParts[pathParts.length - 1] || "";
    } catch {
      // Fallback: try to extract from the URL string directly
      const match = req.url.match(/\/([^/?]+)(?:\?|$)/);
      processedId = match ? match[1] : "";
    }
  }
  
  if (!processedId) {
    res.status(400).json({ ok: false, error: "Missing post_id in URL" });
    return;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authHeader = normalizeHeader(req.headers.authorization);
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  if (req.method === "GET") {
    // GET /bookmark. list all bookmarks, then filter client-side
    const targetUrl = new URL("/bookmark", BACKEND_URL).toString();
    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(text);
    return;
  }

  if (req.method === "DELETE") {
    // DELETE /bookmark/remove, remove a bookmark
    const targetUrl = new URL("/bookmark/remove", BACKEND_URL).toString();
    const response = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ post_id: processedId }),
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(text);
    return;
  }

  res.status(405).send("Method Not Allowed");
}
