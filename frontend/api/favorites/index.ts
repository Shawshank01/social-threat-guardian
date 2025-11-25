import type { IncomingMessage, ServerResponse } from "http";

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
  end: (chunk?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

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

  // Proxy to backend bookmark endpoints
  if (req.method === "GET") {
    // GET /bookmark, list all bookmarks
    const targetUrl = new URL("/bookmark", BACKEND_URL).toString();
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(normalizeHeader(req.headers.authorization) ? { Authorization: normalizeHeader(req.headers.authorization)! } : {}),
      },
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(text);
    return;
  }

  if (req.method === "POST") {
    // POST /bookmark/add, add a bookmark, only send post_id, backend will handle the rest
    const targetUrl = new URL("/bookmark/add", BACKEND_URL).toString();
    const body = req.body as {
      post_id?: string;
      postId?: string;
      processedId?: string;
      [key: string]: unknown;
    };
    
    // Only send post_id to backend, backend will fetch post data from database
    const backendBody = {
      post_id: body.post_id || body.postId || body.processedId,
    };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(normalizeHeader(req.headers.authorization) ? { Authorization: normalizeHeader(req.headers.authorization)! } : {}),
      },
      body: JSON.stringify(backendBody),
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
