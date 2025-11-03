import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const DEFAULT_BACKEND = "http://localhost:3000";
  const backendTarget = env.BACKEND_URL ?? DEFAULT_BACKEND;

  const rewritePath = (path: string) => {
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
          rewrite: rewritePath,
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
