# SPA Best Practices Applied

> **Project:** KNA Project #802 — Komatsu API Marketplace (Phase 1 MVP)
> **Date:** March 2026
> **Source Documents:** `ARCHITECTURE_DESIGN.md`, `BFF_EVOLUTION_ANALYSIS.md`, `BFF_MIGRATION_DECISION.md`

---

## 1. Centralized Configuration (`src/config.ts`)

### Problem
Configuration was scattered across components using `import.meta.env.VITE_*` directly and duplicated `window.__RUNTIME_CONFIG__` access patterns.

### Best Practice
A single `appConfig` object resolves values in priority order: **runtime config → build-time env → default**. This ensures ops teams can override settings in production via `public/runtime-config.js` without a redeploy.

```typescript
export const appConfig = {
  apiBase: resolve("PORTAL_API_BASE", "VITE_PORTAL_API_BASE", "/api"),
  publicHomePage: resolve("PUBLIC_HOME_PAGE", "VITE_PUBLIC_HOME_PAGE", "false") === "true",
  useMockAuth: resolve("USE_MOCK_AUTH", "VITE_USE_MOCK_AUTH", "false") === "true",
  entra: { clientId, externalTenantId, workforceTenantId, ciamHost, portalApiScope },
} as const;
```

### Route Constants
A `ROUTES` constant object eliminates hardcoded path strings across `App.tsx`, `RoleGate.tsx`, and `navigate()` calls:

```typescript
export const ROUTES = {
  HOME: "/",
  API_CATALOG: "/apis",
  API_DETAILS: "/apis/:apiId",
  // ...
} as const;
```

A `buildPath()` helper generates concrete paths from parameterised routes:

```typescript
buildPath(ROUTES.API_DETAILS, { apiId: "warranty-api" }); // → "/apis/warranty-api"
```

### Files Changed
- **Created:** `src/config.ts`
- **Updated:** `src/App.tsx`, `src/main.tsx`, `src/auth/msalConfig.ts`, `src/components/PrivateRoute.tsx`, `src/components/RoleGate.tsx`

> **Note:** `SideNav.tsx` has been removed. Navigation is now handled by the `@komatsu-nagm/component-library` Header component.

---

## 2. RBAC Permission Model (`src/auth/permissions.ts`, `src/auth/usePermissions.ts`)

### Problem
The SPA had `RoleGate` for route-level gating but no fine-grained permission model. The architecture documents define a 4-permission model (Read, TryIt, Subscribe, Manage) enforced by the BFF, but the frontend had no equivalent for conditional UI rendering.

### Best Practice
Mirror the BFF's `rbac-policies.json` permission model on the client side for **UX gating** (hide/show buttons, disable actions). The BFF remains the **security boundary** — the frontend model is for user experience only.

```typescript
export enum Permission {
  Read = "read",
  TryIt = "tryit",
  Subscribe = "subscribe",
  Manage = "manage",
}
```

### Permission Checks
Three utility functions provide flexible permission evaluation:

| Function | Purpose |
|---|---|
| `hasPermission(roles, permission, apiId?)` | Check if any role grants a specific permission |
| `isAdmin(roles)` | Shortcut for Admin/GlobalAdmin check |
| `getEffectivePermissions(roles, apiId?)` | List all permissions for a user on an API |

### React Hook
`usePermissions(apiId?)` provides reactive permission checks inside components:

```tsx
const { canTryIt, canSubscribe, isAdmin } = usePermissions("warranty-api");

// Conditionally render UI elements
{canTryIt && <Button>Open Try-It Console</Button>}
{canSubscribe && <Button>Request Access</Button>}
{isAdmin && <Button>Manage API</Button>}
```

### Default Policy Map
Matches the BFF's `rbac-policies.json`:

| Role | APIs | Permissions |
|---|---|---|
| Admin / GlobalAdmin | `*` | read, tryit, subscribe, manage |
| Developer | warranty, punchout, equipment | read, tryit, subscribe |
| Tester | warranty, punchout, equipment | read, tryit |
| Viewer | `*` | read |

### Test Coverage
15 unit tests in `src/auth/permissions.test.ts` covering all roles, permission combinations, and edge cases.

### Files Changed
- **Created:** `src/auth/permissions.ts`, `src/auth/usePermissions.ts`, `src/auth/permissions.test.ts`

---

## 3. API Client Hardening (`src/api/client.ts`)

### Problem
The original `request()` function had no retry logic, no request cancellation, and returned errors as plain strings — making it difficult for callers to distinguish between auth failures, network issues, and server errors.

### Best Practices Applied

#### 3a. Structured Error Types
```typescript
export type ApiError = {
  message: string;
  status?: number;
  code?: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "NETWORK" | "ABORTED" | "SERVER";
};
```

Callers can now branch on `error.code` for targeted UX responses (redirect to login on UNAUTHORIZED, show degraded mode on NETWORK, etc.).

#### 3b. Retry with Exponential Backoff
Mirrors the Polly retry policies on the BFF side (see `BFF_MIGRATION_DECISION.md`):

- **Retryable status codes:** 429, 500, 502, 503, 504
- **Max retries:** 2
- **Backoff:** 500ms × 2^attempt (500ms, 1s)
- **Non-retryable:** 401, 403, 404 (return immediately)

#### 3c. AbortController Support
All `usePortalApi` methods accept an optional `AbortSignal`:

```typescript
const { get } = usePortalApi();

useEffect(() => {
  const controller = new AbortController();
  get<ApiSummary[]>("/apis", controller.signal).then(/* ... */);
  return () => controller.abort(); // Cancel on unmount
}, [get]);
```

This prevents React state updates after component unmount and avoids memory leaks.

#### 3d. Cognitive Complexity Reduction
The `request()` function was refactored into smaller helpers (`mapStatusToError`, `parseResponseBody`, `singleAttempt`, `classifyCatchError`) to stay within the project's lint threshold of 15.

### Files Changed
- **Updated:** `src/api/client.ts`

---

## 4. Custom Hooks Layer (`src/hooks/`)

### Problem
Every page component (ApiCatalog, ApiDetails, News, Home) duplicated the same pattern: `useState` + `useEffect` + `fetch` + `cancelled` flag + `setLoading` + error handling. This violates DRY and makes it easy to forget cleanup.

### Best Practice
Extract common data-fetching patterns into reusable hooks in `src/hooks/`.

#### `useApiData<T>(path)`
Generic fetch-on-mount hook with automatic AbortController cleanup:

```tsx
const { data, loading, error, refetch } = useApiData<ApiSummary[]>("/apis");
```

Features:
- Automatic AbortController lifecycle (cancels on unmount or path change)
- Loading, error, and data state management
- `refetch()` for manual re-fetching after mutations
- `skip` option for conditional loading

#### `useBffHealth(intervalMs?)`
Periodic BFF health check for degraded-mode banners:

```tsx
const bffStatus = useBffHealth(60_000); // check every 60s
{bffStatus === "unhealthy" && <Alert>BFF is unavailable. Using cached data.</Alert>}
```

### Files Changed
- **Created:** `src/hooks/useApiData.ts`, `src/hooks/useBffHealth.ts`, `src/hooks/index.ts`

---

## 5. Route-Level Code Splitting (`src/App.tsx`)

### Problem
All page components were eagerly imported, meaning the entire application code was bundled into a single chunk. Users downloading the SPA for `/` would also download code for `/admin`, `/apis/:apiId/try`, etc.

### Best Practice
Use `React.lazy()` with `Suspense` for route-level code splitting:

```tsx
const ApiCatalog = lazy(() => import("./pages/ApiCatalog"));
const ApiDetails = lazy(() => import("./pages/ApiDetails"));
const Admin = lazy(() => import("./pages/Admin"));
// ...

<Suspense fallback={<LoadingScreen message="Loading page..." />}>
  <Routes>
    <Route path={ROUTES.API_CATALOG} element={<ApiCatalog />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**Impact:** Each page becomes a separate JS chunk, loaded on demand. Initial load size decreases significantly, especially for users who only visit the home page or API catalog.

### Files Changed
- **Updated:** `src/App.tsx`

---

## 6. Enhanced ErrorBoundary (`src/components/ErrorBoundary.tsx`)

### Problem
The original ErrorBoundary caught errors silently — no logging, no structured data for Application Insights, no dev-mode diagnostics.

### Best Practices Applied

#### 6a. Structured Logging for Application Insights
```typescript
componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
  console.error("[ErrorBoundary] Uncaught error in component tree", {
    name: error.name,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
  });
}
```

When Application Insights is connected, these structured logs are automatically captured as custom events with full component stack traces.

#### 6b. Dev-Mode Error Display
In development builds (`import.meta.env.DEV`), the error message is shown inline to speed up debugging.

#### 6c. Configurable Fallback UI
The ErrorBoundary now accepts an optional `fallback` prop for per-section custom error UI:

```tsx
<ErrorBoundary fallback={<Alert severity="error">Chart failed to load.</Alert>}>
  <ExpensiveChart />
</ErrorBoundary>
```

### Files Changed
- **Updated:** `src/components/ErrorBoundary.tsx`

---

## 7. i18n Translation Extraction (`src/i18n/`)

### Problem
Translations were inline in `src/i18n.ts` as JavaScript objects. This made it impossible to send to translators, validate completeness, or manage via external tooling.

### Best Practice
Move translations to dedicated JSON files per locale:

```
src/i18n/
├── en.json    ← English (complete)
└── es.json    ← Spanish (complete)
```

Each file contains namespaced translation keys for all pages:

```json
{
  "appName": "Komatsu API Marketplace",
  "nav": { "home": "Home", "apis": "API Catalog", ... },
  "catalog": { "title": "API Catalog", "searchPlaceholder": "Search...", ... },
  "apiDetails": { "overview": "Overview", "operations": "Operations", ... },
  "auth": { "signingIn": "Signing you in...", ... },
  "common": { "loading": "Loading...", "error": "An error occurred", ... }
}
```

Updated `src/i18n.ts` to import from JSON:
```typescript
import en from "./i18n/en.json";
import es from "./i18n/es.json";

i18n.use(initReactI18next).init({
  lng: appConfig.defaultLocale,
  resources: { en: { translation: en }, es: { translation: es } },
});
```

### Files Changed
- **Created:** `src/i18n/en.json`, `src/i18n/es.json`
- **Updated:** `src/i18n.ts`

> **Note:** `SideNav.tsx` (which previously used `t()` for nav labels) has been removed. Navigation is now in the component library.

---

## 8. Heterogeneous Backend Support (`src/api/types.ts`)

### Problem
The `ApiSummary` type assumed all APIs come from APIM. The architecture documents describe a Backend Router pattern where APIs can be sourced from APIM Data API or external backends (SAP, etc.).

### Best Practice
Add an `ApiSource` discriminator to `ApiSummary`:

```typescript
export type ApiSource = "apim" | "external";

export type ApiSummary = {
  // ... existing fields
  source?: ApiSource;
};
```

The `mapApimApiToSummary` mapper defaults to `source: "apim"`. External APIs from the BFF's `api-registry.json` will have `source: "external"`.

The `ApiCard` component now shows a source badge for external APIs:

```tsx
{api.source === "external" && (
  <Chip label="External" size="small" variant="outlined" color="info" />
)}
```

### Files Changed
- **Updated:** `src/api/types.ts`, `src/components/ApiCard.tsx`

---

## 9. Component Improvements

### Header (`src/components/Header.tsx`)
- Now wraps the `Header` and `UserProfile` components from `@komatsu-nagm/component-library`
- Accepts optional `isPublic` prop — hides user avatar and sign-out menu in public layout mode
- `companyName` and `appTitle` props are passed through to the library Header

### RoleGate (`src/components/RoleGate.tsx`)
- Uses `ROUTES.ACCESS_DENIED` instead of hardcoded `"/access-denied"`
- JSDoc linking to BFF_MIGRATION_DECISION.md for RBAC context

### SideNav — REMOVED
- `SideNav.tsx` and `SideNav.test.tsx` have been deleted
- Navigation is now provided by the `@komatsu-nagm/component-library` Header component
- The `AppShell` component no longer includes a side drawer

### PrivateRoute (`src/components/PrivateRoute.tsx`)
- Uses `appConfig.useMockAuth` instead of inline `import.meta.env` check

### msalConfig (`src/auth/msalConfig.ts`)
- Uses `appConfig.entra.*` for all Entra ID configuration
- Uses `globalThis` instead of `window` per lint rules

---

## Summary of New Files

| File | Purpose |
|---|---|
| `src/config.ts` | Centralized runtime + build-time config, route constants |
| `src/auth/permissions.ts` | RBAC permission types, policy map, check helpers |
| `src/auth/usePermissions.ts` | React hook for permission checks |
| `src/auth/permissions.test.ts` | 15 unit tests for permission logic |
| `src/hooks/useApiData.ts` | Generic data-fetching hook with AbortController |
| `src/hooks/useBffHealth.ts` | BFF health check hook |
| `src/hooks/index.ts` | Barrel export for hooks |
| `src/i18n/en.json` | English translations (complete) |
| `src/i18n/es.json` | Spanish translations (complete) |

## Summary of Modified Files

| File | Changes |
|---|---|
| `src/App.tsx` | React.lazy code splitting, ROUTES constants, Suspense wrapper |
| `src/api/client.ts` | Retry with backoff, AbortController, structured ApiError |
| `src/api/types.ts` | ApiSource type, source field on ApiSummary |
| `src/auth/msalConfig.ts` | Uses centralized appConfig.entra |
| `src/components/ApiCard.tsx` | External API source badge |
| `src/components/ErrorBoundary.tsx` | Structured logging, fallback prop, dev-mode error display |
| `src/components/Header.tsx` | Wraps library Header + UserProfile components, optional isPublic prop |
| `src/components/PrivateRoute.tsx` | Uses appConfig.useMockAuth |
| `src/components/RoleGate.tsx` | Uses ROUTES constants, JSDoc |
| `src/i18n.ts` | Imports from JSON files, uses appConfig.defaultLocale |
| `src/main.tsx` | Uses centralized appConfig, ThemeProvider from component library |
| `src/theme.ts` | Re-exports theme/colors/typography from @komatsu-nagm/component-library |

> **Note:** `src/components/SideNav.tsx` has been removed. Navigation is handled by the shared component library.

---

*Best practices document for KNA Project #802 — Komatsu API Marketplace Portal.*
