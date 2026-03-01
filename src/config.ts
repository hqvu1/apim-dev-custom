/**
 * Centralized application configuration.
 *
 * Merges runtime config (injected via public/runtime-config.js in production)
 * with build-time env vars (VITE_*). Runtime values always win, so ops can
 * override without a redeploy.
 *
 * @see docs/ARCHITECTURE_DESIGN.md §2 — Frontend Architecture
 */

// ---------------------------------------------------------------------------
// Runtime config (injected by docker-entrypoint.sh into window.__RUNTIME_CONFIG__)
// ---------------------------------------------------------------------------

type RuntimeConfig = Record<string, string | undefined>;

const getRuntimeConfig = (): RuntimeConfig => {
  if (globalThis.window !== undefined && (globalThis as unknown as Record<string, unknown>).__RUNTIME_CONFIG__) {
    return (globalThis as unknown as Record<string, unknown>).__RUNTIME_CONFIG__ as RuntimeConfig;
  }
  return {};
};

const runtime = getRuntimeConfig();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a value: runtime → build-time → default. */
const resolve = (runtimeKey: string, envKey: string, fallback: string): string =>
  runtime[runtimeKey] ?? import.meta.env[envKey] ?? fallback;

// ---------------------------------------------------------------------------
// Exported config singleton
// ---------------------------------------------------------------------------

export const appConfig = {
  /** Display name used in <Header>, document title, etc. */
  appName: "Komatsu API Marketplace",

  /** Base URL of the BFF (proxied by Nginx in production, Vite in dev). */
  apiBase: resolve("PORTAL_API_BASE", "VITE_PORTAL_API_BASE", "/api"),

  /** Whether the home page is publicly accessible (no auth). */
  publicHomePage:
    resolve("PUBLIC_HOME_PAGE", "VITE_PUBLIC_HOME_PAGE", "false") === "true",

  /** Enable mock auth for local development without Entra ID. */
  useMockAuth:
    resolve("USE_MOCK_AUTH", "VITE_USE_MOCK_AUTH", "false") === "true",

  /** Default locale for i18n. */
  defaultLocale: resolve("DEFAULT_LOCALE", "VITE_DEFAULT_LOCALE", "en"),

  /** Entra ID config */
  entra: {
    clientId: resolve("ENTRA_CLIENT_ID", "VITE_ENTRA_CLIENT_ID", ""),
    externalTenantId: resolve("EXTERNAL_TENANT_ID", "VITE_EXTERNAL_TENANT_ID", ""),
    workforceTenantId: resolve("WORKFORCE_TENANT_ID", "VITE_WORKFORCE_TENANT_ID", ""),
    ciamHost: resolve("CIAM_HOST", "VITE_CIAM_HOST", "kltdexternaliddev.ciamlogin.com"),
    portalApiScope: resolve("PORTAL_API_SCOPE", "VITE_PORTAL_API_SCOPE", "User.Read"),
  },
} as const;

// ---------------------------------------------------------------------------
// Route paths — single source of truth for <NavLink>, navigate(), etc.
// ---------------------------------------------------------------------------

export const ROUTES = {
  HOME: "/",
  API_CATALOG: "/apis",
  API_DETAILS: "/apis/:apiId",
  API_TRY_IT: "/apis/:apiId/try",
  REGISTER: "/register",
  ONBOARDING: "/profile/onboarding",
  MY_INTEGRATIONS: "/my/integrations",
  SUPPORT: "/support",
  NEWS: "/news",
  ADMIN: "/admin",
  ACCESS_DENIED: "/access-denied",
  SSO_LOGOUT: "/sso-logout",
} as const;

/** Build a concrete path from a parameterised route. */
export function buildPath(
  route: string,
  params: Record<string, string> = {}
): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    route
  );
}
