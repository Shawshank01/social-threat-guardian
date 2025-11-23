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
                const favoritesMatch = url.match(/^\/api\/favorites(?:\/([^/?]+))?/);
                const postId = favoritesMatch?.[1];

                if (method === "GET") {
                  proxyReq.path = "/bookmark";
                } else if (method === "POST") {
                  proxyReq.path = "/bookmark/add";
                } else if (method === "DELETE" && postId) {
                  proxyReq.path = "/bookmark/remove";
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
