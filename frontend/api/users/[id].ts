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
    end: (chunk?: unknown) => ApiResponse;
    setHeader: (name: string, value: string) => void;
};

const BACKEND_URL = process.env.BACKEND_URL;

const normalizeHeader = (value?: string | string[]) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
};

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
    console.log("[api/users/[id]] Request received:", {
        method: req.method,
        url: req.url,
        hasAuth: !!req.headers.authorization,
    });

    if (!BACKEND_URL) {
        console.error("[api/users/[id]] BACKEND_URL is not configured");
        res.status(500).json({ ok: false, error: "BACKEND_URL is not configured." });
        return;
    }

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status(204).end();
        return;
    }

    let userId = "";
    if (req.url) {
        try {
            let urlObj: URL;
            if (req.url.startsWith("http://") || req.url.startsWith("https://")) {
                urlObj = new URL(req.url);
            } else {
                urlObj = new URL(req.url, "http://localhost");
            }

            const pathParts = urlObj.pathname.split("/").filter(Boolean);
            const rawId = pathParts[pathParts.length - 1] || "";

            if (rawId) {
                try {
                    userId = decodeURIComponent(rawId);
                } catch (decodeError) {
                    console.warn("[api/users/[id]] Failed to decode userId:", decodeError);
                    userId = rawId;
                }
            }
        } catch (urlError) {
            console.warn("[api/users/[id]] URL parsing failed, using regex fallback:", urlError);
            const match = req.url.match(/\/api\/users\/([^?]+)/);
            if (match && match[1]) {
                try {
                    userId = decodeURIComponent(match[1]);
                } catch (decodeError) {
                    userId = match[1];
                }
            } else {
                const lastSlashMatch = req.url.match(/\/([^/?]+)(?:\?|$)/);
                if (lastSlashMatch && lastSlashMatch[1]) {
                    try {
                        userId = decodeURIComponent(lastSlashMatch[1]);
                    } catch {
                        userId = lastSlashMatch[1];
                    }
                }
            }
        }
    }

    if (!userId) {
        console.error("[api/users/[id]] Failed to extract userId from URL:", req.url);
        res.status(400).json({
            ok: false,
            error: "Missing user ID in URL",
        });
        return;
    }

    console.log("[api/users/[id]] Extracted userId:", userId);

    const method = req.method?.toUpperCase() || "";

    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    const authHeader = normalizeHeader(req.headers.authorization);
    if (authHeader) {
        headers.Authorization = authHeader;
    }

    if (method === "GET") {
        const targetUrl = new URL(`/users/${encodeURIComponent(userId)}`, BACKEND_URL).toString();
        console.log("[api/users/[id]] Making GET request to backend:", targetUrl);

        try {
            const response = await makeRequest(targetUrl, {
                method: "GET",
                headers,
            });

            console.log("[api/users/[id]] Backend response:", {
                status: response.status,
                bodyLength: response.body?.length || 0,
                hasBody: !!response.body,
            });

            const contentType = response.headers["content-type"];
            if (contentType) {
                res.setHeader("Content-Type", contentType);
            }
            res.status(response.status).send(response.body);
            return;
        } catch (error) {
            console.error("[api/users/[id]] Backend request failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.status(500).json({
                ok: false,
                error: "Failed to connect to backend server.",
                details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
            });
            return;
        }
    }

    if (method === "PATCH") {
        const targetUrl = new URL(`/users/${encodeURIComponent(userId)}`, BACKEND_URL).toString();

        try {
            const response = await makeRequest(targetUrl, {
                method: "PATCH",
                headers: {
                    ...headers,
                    "Content-Type": normalizeHeader(req.headers["content-type"]) ?? "application/json",
                },
                body: serializeBody(req.body),
            });

            const contentType = response.headers["content-type"];
            if (contentType) {
                res.setHeader("Content-Type", contentType);
            }
            res.status(response.status).send(response.body);
            return;
        } catch (error) {
            console.error("[api/users/[id]] Backend request failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.status(500).json({
                ok: false,
                error: "Failed to connect to backend server.",
                details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
            });
            return;
        }
    }

    res.status(405).json({
        ok: false,
        error: `Method ${method} not allowed. Supported methods: GET, PATCH, OPTIONS`,
    });
}
