import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";

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

// Helper function to make HTTP/HTTPS requests that accept self-signed certificates
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
      // Accept self-signed certificates (WARNING: not secure, but needed for "teamwork")
      ...(isHttps ? { rejectUnauthorized: false } : {}),
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

  try {
    const response = await makeRequest(targetUrl.toString(), {
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
  } catch (error) {
    console.error("[api/comments/latest] Backend request failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a certificate validation error
    if (errorMessage.includes("certificate") || errorMessage.includes("SSL") || errorMessage.includes("TLS")) {
      res.status(500).json({
        ok: false,
        error: "SSL certificate validation failed. The backend is using a self-signed certificate which is not accepted in production. Please use a valid certificate (Let's Encrypt) or a reverse proxy (Cloudflare).",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    } else {
      res.status(500).json({
        ok: false,
        error: "Failed to connect to backend server.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  }
}
