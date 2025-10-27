import type { IncomingMessage, ServerResponse } from "http";

type ApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  headers: IncomingMessage["headers"] & {
    authorization?: string | string[];
    "content-type"?: string | string[];
  };
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

const AUTH_PATH = "/auth/login";

const METHOD_NOT_ALLOWED = "Method Not Allowed";

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

  const targetUrl = new URL(AUTH_PATH, BACKEND_URL).toString();

  const body =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});

  const headers: Record<string, string> = {
    "Content-Type":
      (Array.isArray(req.headers["content-type"])
        ? req.headers["content-type"][0]
        : req.headers["content-type"]) ?? "application/json",
  };

  if (req.headers.authorization) {
    const authHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    headers.Authorization = authHeader ?? "";
  }

  const backendResponse = await fetch(targetUrl, {
    method: "POST",
    headers,
    body,
  });

  const responseText = await backendResponse.text();
  const contentType = backendResponse.headers.get("content-type");
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  res.status(backendResponse.status).send(responseText);
}
