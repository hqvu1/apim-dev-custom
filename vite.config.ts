import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  /**
   * In local dev the SPA calls /api/... which Vite proxies to the BFF server.
   * Set VITE_BFF_URL in your .env file:
   *
   *   VITE_BFF_URL=http://localhost:3001
   *
   * The proxy strips the /api prefix so the target URL path stays clean.
   * The BFF (or APIM policy) is responsible for authentication.
   */
  const bffTarget = env.VITE_BFF_URL || "http://localhost:3001";

  return {
    plugins: [react()],
    // Enable source maps for debugging
    build: {
      sourcemap: true,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: bffTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          secure: bffTarget.startsWith("https"),
        },
      },
    },
  };
});