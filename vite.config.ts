import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Resolve @komatsu-nagm/component-library from source so Vite compiles it
// with our React 18 + MUI 5 instead of using the pre-built dist (which
// inlined React 19's JSX runtime).  When the library is published to a
// registry and consumed as a proper npm package with matching React/MUI
// versions, this alias can be removed.
//
// In Docker builds the library source is copied into the build context at
// ./component-library/src/index.ts — set COMPONENT_LIB_SRC to override.
const componentLibSrc = process.env.COMPONENT_LIB_SRC
  ? path.resolve(__dirname, process.env.COMPONENT_LIB_SRC)
  : path.resolve(__dirname, "../react-template/src/index.ts");

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
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "@mui/material",
        "@mui/icons-material",
        "@emotion/react",
        "@emotion/styled",
      ],
      alias: {
        "@komatsu-nagm/component-library": componentLibSrc,
        "@": path.resolve(__dirname, "./src"),
      },
    },
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
          // .NET BFF routes already include /api prefix — no rewrite needed
          secure: bffTarget.startsWith("https"),
        },
      },
    },
  };
});