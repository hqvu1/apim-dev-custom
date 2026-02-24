import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  /**
   * In local dev the SPA calls /api/... which Vite proxies to the APIM
   * data-plane (or a local BFF).  Set VITE_PORTAL_API_BASE in your .env file:
   *
   *   VITE_PORTAL_API_BASE=https://<your-instance>.azure-api.net
   *
   * The proxy strips the /api prefix so the target URL path stays clean.
   * The BFF (or APIM policy) is responsible for injecting Ocp-Apim-Subscription-Key.
   */
  const apimTarget = env.VITE_PORTAL_API_BASE ?? "http://localhost:3001";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apimTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          secure: apimTarget.startsWith("https"),
        },
      },
    },
  };
});