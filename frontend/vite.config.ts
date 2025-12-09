import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "fs";
import { join } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const backendTarget = env.BACKEND_URL;

  if (!backendTarget) {
    throw new Error(
      "BACKEND_URL not configured in .env.development.local. " +
      "This is required for the Vite proxy to forward HTTP/HTTPS requests to the backend."
    );
  }

  if (!env.VITE_BACKEND_URL) {
    console.warn(
      "[Vite] VITE_BACKEND_URL not set in .env.development.local. " +
      "WebSocket connections and direct API calls may fail. " +
      "Set VITE_BACKEND_URL to the same value as BACKEND_URL."
    );
  }

  const rewritePath = (path: string) => {
    if (path.startsWith("/api/favorites")) {
      return path;
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

  // Generate build version at config time
  const buildVersion = Date.now().toString();

  return {
    plugins: [
      react(),
      // Plugin to generate version file on build
      {
        name: 'generate-version',
        writeBundle() {
          const publicDir = join(process.cwd(), 'dist');
          writeFileSync(join(publicDir, 'version.txt'), buildVersion, 'utf-8');
        },
      },
    ],
    define: {
      // Inject build version at build time
      'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion),
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: true,
          rewrite: rewritePath,
          configure: (proxy, _options) => {
            proxy.on("proxyReq", (proxyReq, req, _res) => {
              const url = req.url || "";

              if (url.startsWith("/api/favorites")) {
                const method = req.method || "GET";

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
                  try {
                    const urlObj = new URL(url, "http://localhost");
                    const postId = urlObj.searchParams.get("post_id");

                    if (postId) {
                      proxyReq.path = "/bookmark/remove";

                      // Set the request body with post_id (backend expects this in the body)
                      const body = JSON.stringify({ post_id: postId });
                      proxyReq.setHeader("Content-Type", "application/json");
                      proxyReq.setHeader("Content-Length", Buffer.byteLength(body));

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
