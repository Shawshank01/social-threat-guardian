import type { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http from "http";

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
    setHeader: (name: string, value: string) => void;
};

const BACKEND_URL = process.env.BACKEND_URL;

const normalizeHeader = (value?: string | string[]) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
};

// Helper function to make HTTP/HTTPS requests to the backend
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

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status(204).end();
        return;
    }

    if (req.method !== "GET") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    // Extract query parameters from URL
    const url = req.url ? new URL(req.url, "http://localhost") : new URL("http://localhost");
    const source = url.searchParams.get("source") || "BLUSKY_TEST";

    // GET /bookmark/content with source query parameter
    const targetUrl = new URL("/bookmark/content", BACKEND_URL);
    targetUrl.searchParams.set("source", source);

    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    const authHeader = normalizeHeader(req.headers.authorization);
    if (authHeader) {
        headers.Authorization = authHeader;
    }

    try {
        const response = await makeRequest(targetUrl.toString(), {
            method: "GET",
            headers,
        });

        const contentType = response.headers["content-type"];
        if (contentType) {
            res.setHeader("Content-Type", contentType);
        }
        res.status(response.status).send(response.body);
    } catch (error) {
        console.error("[api/favorites/content] Backend request failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({
            ok: false,
            error: "Failed to connect to backend server.",
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        });
    }
}

