import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const DEFAULT_BACKEND = "http://localhost:3000";
  const backendTarget = env.BACKEND_URL ?? DEFAULT_BACKEND;

  const rewritePath = (path: string) => {
    // Don't rewrite /api/favorites here, let configure handle it
    if (path.startsWith("/api/favorites")) {
      return path; // Keep original path for configure function to handle
    }
    if (path.startsWith("/api/auth/") || path === "/api/auth") {
      return path.replace(/^\/api\/auth/, "/auth");
    }
    if (path.startsWith("/api/login")) {
      return path.replace(/^\/api\/login/, "/auth/login");
    }
    if (path.startsWith("/api/register")) {
      return path.replace(/^\/api\/register/, "/auth/register");
    }
    if (path.startsWith("/api/comments")) {
      return path.replace(/^\/api\/comments/, "/comments");
    }
    if (path.startsWith("/api/harassment-network")) {
      return path.replace(/^\/api\/harassment-network/, "/harassment-network");
    }
    return path.replace(/^\/api/, "");
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: true, // Valid Let's Encrypt certificate
          rewrite: rewritePath,
          configure: (proxy, _options) => {
            proxy.on("proxyReq", (proxyReq, req, _res) => {
              const url = req.url || "";

              if (url.startsWith("/api/favorites")) {
                const method = req.method || "GET";

                // Handle /api/favorites/content?source=...
                if (url.startsWith("/api/favorites/content")) {
                  try {
                    const urlObj = new URL(url, "http://localhost");
                    const source = urlObj.searchParams.get("source") || "BLUSKY_TEST";
                    proxyReq.path = `/bookmark/content?source=${encodeURIComponent(source)}`;
                  } catch (error) {
                    console.warn("[vite proxy] Failed to parse favorites/content request URL:", error);
                    proxyReq.path = "/bookmark/content?source=BLUSKY_TEST";
                  }
                } else if (method === "GET") {
                  proxyReq.path = "/bookmark";
                } else if (method === "POST") {
                  proxyReq.path = "/bookmark/add";
                } else if (method === "DELETE") {
                  // For DELETE, extract post_id from query parameter
                  try {
                    const urlObj = new URL(url, "http://localhost");
                    const postId = urlObj.searchParams.get("post_id");
                    
                    if (postId) {
                      proxyReq.path = "/bookmark/remove";
                      
                      // Set the request body with post_id (backend expects this in the body)
                      const body = JSON.stringify({ post_id: postId });
                      proxyReq.setHeader("Content-Type", "application/json");
                      proxyReq.setHeader("Content-Length", Buffer.byteLength(body));
                      
                      // Write the body to the proxied request
                      proxyReq.write(body);
                    }
                  } catch (error) {
                    console.warn("[vite proxy] Failed to parse DELETE request URL:", error);
                  }
                }
              }
            });
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
