import type { IncomingMessage, ServerResponse } from "http";

type ApiRequest = IncomingMessage & {
  method?: string;
  headers: IncomingMessage["headers"];
  url?: string;
};

type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  send: (body?: unknown) => ApiResponse;
};

const BACKEND_URL = process.env.BACKEND_URL;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!BACKEND_URL) {
    res.status(500).json({ ok: false, error: "BACKEND_URL is not configured." });
    return;
  }

  if (req.method && req.method.toUpperCase() !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const requestUrl = req.url ?? "/comments/latest";
  const parsedUrl = new URL(requestUrl, "http://localhost");
  const search = parsedUrl.search ?? "";
  const targetUrl = new URL(`/comments/latest${search}`, BACKEND_URL);

  const backendResponse = await fetch(targetUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await backendResponse.text();
  const contentType = backendResponse.headers.get("content-type");
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  res.status(backendResponse.status).send(payload);
}
