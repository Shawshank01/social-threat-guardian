import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "http";

type ApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
    "content-type"?: string | string[];
  };
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;
const SEARCH_PATH = "/comments/search";
const METHOD_NOT_ALLOWED = "Method Not Allowed";

const normalizeHeader = (value?: string | string[]) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const serializeBody = (body: unknown) => {
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof Buffer) {
    return body.toString();
  }
  if (body === undefined || body === null) {
    return "{}";
  }
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
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send(METHOD_NOT_ALLOWED);
    return;
  }

  const targetUrl = new URL(SEARCH_PATH, BACKEND_URL).toString();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": normalizeHeader(req.headers["content-type"]) ?? "application/json",
  };

  const authHeader = normalizeHeader(req.headers.authorization);
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const payload = serializeBody(req.body);

  const backendResponse = await fetch(targetUrl, {
    method: "POST",
    headers,
    body: payload,
  });

  const responseText = await backendResponse.text();
  const contentType = backendResponse.headers.get("content-type");
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  res.status(backendResponse.status).send(responseText);
}
