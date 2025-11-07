import type { IncomingMessage, ServerResponse } from "http";

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

  if (req.method === "GET") {
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

  if (req.method === "POST") {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": normalizeHeader(req.headers["content-type"]) ?? "application/json",
      },
      body: serializeBody(req.body),
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
