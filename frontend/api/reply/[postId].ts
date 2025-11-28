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

    // Normalise method early for all checks
    // Vercel may pass method in different ways, so check multiple sources
    const rawMethod = req.method || 
                      (req as any).httpMethod || 
                      (req.headers as any)?.["x-http-method"] || 
                      "";
    const method = rawMethod.toUpperCase().trim();

    // Comprehensive logging for debugging
    console.log("[api/reply/[postId]] Method detection:", {
        reqMethod: req.method,
        httpMethod: (req as any).httpMethod,
        xHttpMethod: (req.headers as any)?.["x-http-method"],
        rawMethod,
        normalizedMethod: method,
        url: req.url,
    });

    // Handle OPTIONS preflight
    if (method === "OPTIONS" || req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status(204).end();
        return;
    }

    if (method !== "GET" && method !== "DELETE") {
        res.status(405).json({ ok: false, error: "Method not allowed. Only GET and DELETE are supported." });
        return;
    }

    // Extract replyId from the dynamic route segment [postId] (note: for DELETE, this is actually the reply ID, not post ID)
    let replyId = "";
    if (req.url) {
        try {
            let urlObj: URL;
            if (req.url.startsWith("http://") || req.url.startsWith("https://")) {
                urlObj = new URL(req.url);
            } else {
                urlObj = new URL(req.url, "http://localhost");
            }

            const pathParts = urlObj.pathname.split("/").filter(Boolean);
            // Path structure: /api/reply/{postId}
            const rawId = pathParts[pathParts.length - 1] || "";

            if (rawId) {
                try {
                    replyId = decodeURIComponent(rawId);
                } catch (decodeError) {
                    console.warn("[api/reply/[postId]] Failed to decode replyId:", decodeError);
                    replyId = rawId;
                }
            }
        } catch (urlError) {
            console.warn("[api/reply/[postId]] URL parsing failed, using regex fallback:", urlError);
            const match = req.url.match(/\/api\/reply\/([^?]+)/);
            if (match && match[1]) {
                try {
                    replyId = decodeURIComponent(match[1]);
                } catch (decodeError) {
                    replyId = match[1];
                }
            } else {
                // Last resort: try to get the last segment after any slash
                const lastSlashMatch = req.url.match(/\/([^/?]+)(?:\?|$)/);
                if (lastSlashMatch && lastSlashMatch[1]) {
                    try {
                        replyId = decodeURIComponent(lastSlashMatch[1]);
                    } catch {
                        replyId = lastSlashMatch[1];
                    }
                }
            }
        }
    }

    if (!replyId) {
        console.error("[api/reply/[postId]] Failed to extract replyId from URL:", req.url);
        res.status(400).json({
            ok: false,
            error: "Missing reply ID in URL",
        });
        return;
    }

    console.log(`[api/reply/[postId]] ${method} request for replyId:`, replyId);

    // GET /reply/:postId to get replies for a post
    // DELETE /reply/:id to delete a reply by reply ID
    const targetUrl = new URL(`/reply/${encodeURIComponent(replyId)}`, BACKEND_URL).toString();

    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    const authHeader = normalizeHeader(req.headers.authorization);
    if (authHeader) {
        headers.Authorization = authHeader;
    }

    try {
        const response = await makeRequest(targetUrl, {
            method: method,
            headers,
            // DELETE requests should not have a body, the ID is in the URL
            body: method === "GET" ? undefined : (method === "DELETE" ? undefined : serializeBody(req.body)),
        });

        // Parse response body to check for success
        let responsePayload: { ok?: boolean; error?: string; removed?: number } | null = null;
        try {
            responsePayload = JSON.parse(response.body);
        } catch {
            // If parsing fails, just forward the response as-is
        }

        console.log(`[api/reply/[postId]] Backend ${method} response:`, {
            status: response.status,
            ok: responsePayload?.ok,
            error: responsePayload?.error,
            removed: responsePayload?.removed,
            bodyPreview: response.body.substring(0, 200), // Log first 200 chars
        });

        // For DELETE requests, if the backend returns ok: true or removed > 0, treat as success
        // even if status code is 400 (backend might have a bug)
        if (method === "DELETE" && responsePayload && (responsePayload.ok === true || (responsePayload.removed && responsePayload.removed > 0))) {
            console.log(`[api/reply/[postId]] DELETE succeeded despite status ${response.status}, treating as 200`);
            const contentType = response.headers["content-type"];
            if (contentType) {
                res.setHeader("Content-Type", contentType);
            }
            // Return 200 with the success response
            res.status(200).send(response.body);
            return;
        }

        const contentType = response.headers["content-type"];
        if (contentType) {
            res.setHeader("Content-Type", contentType);
        }
        res.status(response.status).send(response.body);
    } catch (error) {
        console.error(`[api/reply/[postId]] Backend ${method} request failed:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({
            ok: false,
            error: "Failed to connect to backend server.",
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        });
    }
}
