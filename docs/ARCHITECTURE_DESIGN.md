# Komatsu API Marketplace Portal — Architecture Design

> **Project:** KNA Project #802 — Komatsu API Marketplace (Phase 1 MVP)
> **Repository:** `KNA-CustomApps-Org/kx-apim-dev-custom-frontend`
> **Branch:** `UpdateWithNewClientApp`
> **Stack:** React 18 · TypeScript · Vite 5 · MUI 5 · MSAL · ASP.NET Core 10 BFF · Nginx · Azure Container Apps · Bicep
> **Last Updated:** 2026-03-07

---

## 1. System Context

```
┌───────────────────────────────────────────────────────────────────────┐
│                         End Users (Browser)                          │
│  Dealers, Vendors, Internal Dev, Testers, Admins                     │
│  ─ Desktop / Tablet / Mobile (Responsive MUI)                       │
└────────────────────────────┬──────────────────────────────────────────┘
                             │ HTTPS (custom DNS: apimarketplace.komatsu.com)
                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Azure Container Apps (ACA)                        │
│  ┌──────────────────────────────────────────────────────┐            │
│  │  Nginx (port 8080)                                   │            │
│  │  ├─ /           → SPA static assets (Vite build)     │            │
│  │  ├─ /api/*      → proxy → BFF (localhost:3001)       │            │
│  │  ├─ /health     → 200 OK                             │            │
│  │  ├─ Gzip compression enabled                         │            │
│  │  ├─ Static assets cached 1y (immutable)              │            │
│  │  └─ SPA fallback: try_files → /index.html            │            │
│  └──────────────────────────────────────────────────────┘            │
│  ┌──────────────────────────────────────────────────────┐            │
│  │  BFF – ASP.NET Core 10 (port 3001)                   │            │
│  │  ├─ dotnet /app/bff/BffApi.dll (supervisord-managed) │            │
│  │  ├─ App Registration (ClientSecretCredential) → token│            │
│  │  ├─ ARM token → SAS token (Data API auth)            │            │
│  │  ├─ APIM Data API proxy (apis, products, operations) │            │
│  │  ├─ JWT Bearer auth + RBAC policy enforcement        │            │
│  │  └─ Mock mode for local dev                          │            │
│  └──────────────────────────────────────────────────────┘            │
│  supervisord orchestrates nginx + BFF                                │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌────────────────┐ ┌──────────────────────┐
│  Microsoft       │ │  Azure APIM    │ │  AEM Content         │
│  Entra ID        │ │  (Management)  │ │  Authoring           │
│  (Global Admin)  │ │                │ │  (Dynamic Content)   │
│                  │ │  Gateway:      │ │                      │
│  External CIAM   │ │  ├ Warranty    │ │  News & Announce-    │
│  + Workforce     │ │  ├ Parts       │ │  ments, API docs,    │
│  tenant support  │ │  └ Equipment   │ │  use cases           │
│                  │ │                │ │                      │
│  OAuth 2.0 +     │ │  ARM API for   │ │  KPS SSO for         │
│  RBAC roles      │ │  discovery     │ │  login redirect      │
└─────────────────┘ └────────────────┘ └──────────────────────┘
```

---

## 2. Frontend Architecture

| Concern | Implementation | Appspec Mapping |
|---|---|---|
| **Framework** | React 18.3 + TypeScript 5.5 + Vite 5.4 | Modern dev methods ✅ |
| **UI Library** | MUI 5.15 (Material UI) + MUI Icons 5.15 | Responsive, WCAG-compliant ✅ |
| **Routing** | `react-router-dom` v6.26, nested layouts, lazy-loaded routes | SPA with shell ✅ |
| **Auth** | `@azure/msal-react` 2.0 + `@azure/msal-browser` 3.20 | OAuth 2.0 / Entra ID ✅ |
| **i18n** | `i18next` 23.12 + `react-i18next` 14.1 | Multi-language support ✅ |
| **Component Library** | `@komatsu-nagm/component-library` — shared theme, Header, AppShell (compiled from source via Vite alias) | On-Brand UI ✅ |
| **Theming** | Re-exported from component library (`theme.ts` re-exports `theme`, `colors`, `typography`) | Corporate consistency ✅ |
| **Testing** | Vitest 1.6 + Testing Library (react + jest-dom + user-event) + jsdom 23 | 70% coverage target ✅ |
| **State** | React Context (`AuthProvider`, `ToastProvider`) + local component state | Lightweight, no Redux overhead |
| **Code-Splitting** | `React.lazy()` + `<Suspense>` on all route-level pages | Fast initial load ✅ |
| **Config** | Centralized `src/config.ts` — runtime (`window.__RUNTIME_CONFIG__`) → build-time (`VITE_*`) → fallback | Container-friendly ✅ |
| **Error Handling** | `ErrorBoundary` class component wrapping entire app; structured logging for App Insights | Production-ready ✅ |

### 2.1 Application Bootstrap (`main.tsx`)

```
IIFE async boot sequence:
  1. Check appConfig.useMockAuth
     ├─ true  → tenantId = appConfig.entra.externalTenantId || "mock-tenant"
     └─ false → tenantId = initiateLogin()
                ├─ reads tenantId from localStorage / URL params
                └─ if null → redirects to KPS login, renders "Redirecting..."
  2. getMsalConfig(tenantId) → per-tenant MSAL Configuration
  3. new PublicClientApplication(msalConfig) → pca.initialize()
  4. pca.handleRedirectPromise() → set active account if returned
  5. Render provider stack:
     <MsalProvider instance={pca}>
       <AuthProvider>
         <ToastProvider>
           <ThemeProvider theme={theme}>
             <CssBaseline />
             <App />
```

### 2.2 Route Map → Appspec Feature Coverage

```
Route                     Component           Lazy  Appspec Feature
───────────────────────────────────────────────────────────────────────
/                         Home                ✓     Landing page, stats, featured APIs, quick actions
/apis                     ApiCatalog          ✓     API browsing by category, search, plan filter
/apis/:apiId              ApiDetails          ✓     Use cases, cost plan, dev docs, operations table
/apis/:apiId/try          ApiTryIt            ✓     Swagger/Redoc "Try It" sandbox console
/register                 Register            ✓     Unregistered user request form → Global Admin
/profile/onboarding       Onboarding          ✓     Quick-start onboarding after registration
/my/integrations          MyIntegrations      ✓     Per-user subscription / integration management
/support                  Support             ✓     FAQs, ticket creation, ticket history (tabs)
/news                     News                ✓     News & Announcements (API changes, deprecations)
/admin                    Admin (RoleGate)    ✓     Admin panel (RBAC: Admin, GlobalAdmin only)
/access-denied            AccessDenied        ✓     Unauthorized landing
/sso-logout               SsoLogoutHandler    ✓     Federated logout (MSAL + BFF + KPS)
*                         NotFound            ✓     404 page
```

### 2.3 Component Hierarchy

```
<React.StrictMode>
  <MsalProvider instance={pca}>
    <AuthProvider>              ← account, roles[], isAuthenticated, getAccessToken()
      <ToastProvider>           ← Global notification system (useToast hook)
        <ThemeProvider>         ← Komatsu brand theme
          <CssBaseline />
          <ErrorBoundary>       ← Global error boundary with structured logging
            <BrowserRouter>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  ─ /sso-logout → SsoLogoutHandler
                  ─ PublicLayout   (conditional: appConfig.publicHomePage)
                  │  └ Header (isPublic) + Home + Footer
                  ─ PrivateRoute   ← MSAL auth gate (useMsalLogin hook)
                     └ AppShell    ← Header (from component library) + Footer + Outlet
                        ├ Home           → HeroSection, StatCard[], FeatureCard[], QuickActionCard[]
                        ├ ApiCatalog     → ApiCard[] with search/category/plan filters
                        ├ ApiDetails     → SectionCard, MethodBadge, operations table, plans
                        ├ ApiTryIt       → embedded Swagger/Redoc console
                        ├ Register       → dynamic field form from /registration/config
                        ├ Onboarding     → stepper from /onboarding/status
                        ├ MyIntegrations → subscription cards
                        ├ Support        → tabbed: FAQs | Create Ticket | My Tickets
                        ├ News           → news cards with tags
                        └ RoleGate(Admin, GlobalAdmin) → Admin (metrics + registrations)
                  ─ /access-denied → AccessDenied
                  ─ * → NotFound
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  </MsalProvider>
</React.StrictMode>
```

### 2.4 Centralized Configuration (`src/config.ts`)

The `appConfig` singleton resolves values through a three-tier cascade:

| Tier | Source | Use Case |
|---|---|---|
| 1 — Runtime | `window.__RUNTIME_CONFIG__` (injected by `docker-entrypoint.sh`) | Container/ACA deployments |
| 2 — Build-time | `import.meta.env.VITE_*` (Vite env substitution) | Static builds, CI/CD |
| 3 — Fallback | Hardcoded defaults | Local development |

**Exported values:**
- `appConfig.appName` — `"Komatsu API Marketplace"`
- `appConfig.apiBase` — BFF base URL (default `/api`)
- `appConfig.publicHomePage` — boolean, enables unauthenticated landing page
- `appConfig.useMockAuth` — boolean, bypasses MSAL in dev
- `appConfig.defaultLocale` — default `"en"`
- `appConfig.entra` — `{ clientId, externalTenantId, workforceTenantId, ciamHost, portalApiScope }`
- `ROUTES` — 12 named route constants with `buildPath()` helper for parameterized navigation

---

## 3. Authentication & Authorization Architecture

```
                     ┌─────────────────────────────┐
                     │  KPS SSO                     │
                     │  (login-uat.komatsu.com/spa) │
                     └──────┬──────────────────────┘
                            │ ① redirect with tenantId
┌──────────┐                ▼                ┌───────────────────────────┐
│ Browser  │──── ② MSAL redirect ──────────▶│  Microsoft Entra ID       │
│ (SPA)    │◁──── ③ id_token + access_token │  External CIAM tenant     │
│          │                                │  OR Workforce tenant       │
└──────┬───┘                                │  (Global Admin framework)  │
       │                                    └───────────────────────────┘
       │ MSAL lifecycle:
       │  1. initiateLogin() reads tenantId from localStorage / URL params / KPS
       │  2. getMsalConfig(tenantId) → per-tenant authority + CIAM host
       │  3. useMsalLogin() hook auto-triggers loginRedirect if no active account
       │  4. AuthProvider.getAccessToken() → acquireTokenSilent → bearer header
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Frontend Authorization Layer                          │
│                                                      │
│  ┌─ AuthProvider (context) ────────────────────────┐ │
│  │  account: AccountInfo | null                    │ │
│  │  roles[]: from idTokenClaims.roles + .groups    │ │
│  │  isAuthenticated: boolean                       │ │
│  │  getAccessToken(): Promise<string | null>       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Permissions (auth/permissions.ts) ─────────────┐ │
│  │  Permission enum: Read, TryIt, Subscribe, Manage│ │
│  │  AppRole: Admin, GlobalAdmin, Developer,        │ │
│  │           Tester, Viewer                        │ │
│  │  Default policies per role per API              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ usePermissions() hook ─────────────────────────┐ │
│  │  canRead, canTryIt, canSubscribe, canManage     │ │
│  │  isAdmin, has(permission, apiId?)               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Route Guards ──────────────────────────────────┐ │
│  │  PrivateRoute → auth gate for all app routes    │ │
│  │  RoleGate → role-based route guard (Admin, etc.)│ │

│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 3.1 Logout Architecture

Multi-mode logout via `useLogout()` hook. Mode from `VITE_LOGOUT_MODE`:

| Mode | Behavior |
|---|---|
| `client-only` | Clear client state + broadcast cross-tab logout |
| `msal-only` | Client cleanup + MSAL `logoutRedirect` |
| `full` | Client + BFF logout (`POST /api/user/logout`) + third-party SLO (AEM iframe) + MSAL |
| `msal-plus-bff` | Client + BFF logout + MSAL (production default) |

**Cross-tab synchronization:** `BroadcastChannel("mn-auth")` + `localStorage("mn-logout")` event.
**SSO Logout Handler:** `/sso-logout` route clears MSAL account, broadcasts, cleans storage, redirects to `/?signedOut=1`.

### 3.2 Key Design Decisions

- **Dual-tenant support**: `msalConfig.ts` maps `externalTenantId` (CIAM via `ciamHost`) and `workforceTenantId` (via `login.microsoftonline.com`) to separate authority URLs.
- **Token claims**: Roles extracted from `idTokenClaims.roles` and `idTokenClaims.groups` (`AuthProvider.tsx`), deduplicated via `Set`.
- **Configurable login scopes**: `VITE_LOGIN_SCOPES` (comma-separated), default `["User.Read"]`, plus `portalApiScope` from config.
- **Login dedup**: `sessionStorage("mn_login_attempted")` prevents infinite redirect loops.
- **No anonymous access**: `PrivateRoute` enforces MSAL authentication; `useMsalLogin()` auto-triggers redirect.
- **Credential security**: Tokens in `localStorage` (MSAL default), HTTPS enforced, CSP headers in `nginx.conf`.

---

## 4. Backend-for-Frontend (BFF) Architecture

The project has **one active BFF** and a legacy reference implementation:

| | Node.js / Express (`bff/`) | ASP.NET Core 10 (`bff-dotnet/`) |
|---|---|---|
| **Status** | Legacy (reference only — not used in Docker/ACA) | **Active runtime** in Docker & ACA |
| **Lines** | ~885 (server.js) | ~379 (Program.cs) + Endpoints/ + Services/ + Authorization/ |
| **Auth** | Passthrough (no JWT validation) | JWT Bearer + multi-tenant JWKS validation |
| **RBAC** | Not implemented | Full: 4 policies, hot-reloadable `rbac-policies.json` |
| **Resilience** | Basic retry | `IHttpClientFactory` + `AddStandardResilienceHandler` (3 retries, circuit breaker) |
| **Caching** | Token cache (5-min buffer) | `IMemoryCache` (1-min TTL) + token cache |
| **Mock mode** | `USE_MOCK_MODE` env var | `IsDevelopment()` → `MockApiService` |
| **API docs** | None | OpenAPI + Scalar (dev only) |

### 4.1 Node.js BFF (`bff/server.js`) — LEGACY

> **⚠️ Deprecated:** The Node.js BFF is no longer used in Docker or ACA deployments.
> It is retained in the repo as a reference implementation only.
> The Dockerfile, supervisord, and Bicep templates now run the .NET BFF exclusively.

```
Express + helmet + cors + node-fetch + @azure/identity

Configuration:
  Port 3001, ARM API via APIM_ARM_BASE_URL
  USE_MOCK_MODE toggle
  Optional App Registration (Service Principal) credentials
  ITokenProvider (ClientSecretCredential) → ARM bearer → SAS token chain

Mock Mode Endpoints:
  /news, /stats, /apis, /apis/highlights, /apis/:apiId
  /apis/:apiId/subscription, /support/faqs, /support/my-tickets
  /users/me/subscriptions

Real Mode Endpoints:
  GET /stats         → parallel ARM calls (apis/products/subscriptions/users)
  GET /apis          → list all APIs via ARM, transform to ApiSummary[]
  GET /apis/highlights → top 3 APIs
  GET /apis/:apiId   → single API + operations + products in parallel
  GET /apis/:apiId/openapi → ARM export with format support
  *                  → catch-all proxy to ARM with auth

ARM Transformers: transformArmApiToSummary(), transformArmApiToDetails()
```

### 4.2 ASP.NET Core 10 BFF (`bff-dotnet/`)

```
┌──────────────────────────────────────────────────────────────┐
│  BFF (ASP.NET Core 10 Minimal API, port 3001)                │
│                                                              │
│  ┌─ Authentication ────────────────────────────────────┐     │
│  │  JWT Bearer — multi-tenant validation               │     │
│  │  IssuerSigningKeyResolver aggregates JWKS from      │     │
│  │  workforce + CIAM OIDC discovery endpoints          │     │
│  │  Dev fallback: auto-authenticates without tokens    │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Authorization (RBAC) ──────────────────────────────┐     │
│  │  4 policies: ApiRead, ApiTryIt, ApiSubscribe,       │     │
│  │              ApiManage                              │     │
│  │  ApiAccessRequirement + ApiAccessHandler            │     │
│  │  Configurable via rbac-policies.json (hot-reload)   │     │
│  │  Admin/GlobalAdmin: full access to all APIs         │     │
│  │  Developer: read + tryit + subscribe (assigned APIs)│     │
│  │  Tester: read + tryit (assigned APIs)               │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ APIM Auth Chain ──────────────────────────────────┐      │
│  │  App Registration (ClientSecretCredential)        │     │
│  │  ├ ITokenProvider → AppRegistrationTokenProvider   │     │
│  │  ├ Thread-safe token cache (SemaphoreSlim)         │     │
│  │  └ Azure CLI token (local dev: `az login` fallback) │     │
│  │  Token → ARM → Admin SAS Token → Data API calls     │     │
│  │  (Cached with 5-min buffer before expiry)           │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Service Layer ─────────────────────────────────────┐     │
│  │  ITokenProvider → AppRegistrationTokenProvider   │     │
│  │  IArmApiService interface                           │     │
│  │  ├ MockApiService (IsDevelopment)                   │     │
│  │  ├ ArmApiService (production ARM management API)    │     │
│  │  └ DataApiService (APIM Data API runtime mode)      │     │
│  │  api-registry.json defines source per API:          │     │
│  │  ├ APIM APIs → Data API + SAS                       │     │
│  │  └ External APIs → per-adapter routing              │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Endpoint Groups (Endpoints/*.cs) ──────────────────┐     │
│  │  MapApisEndpoints()          → catalog + detail     │     │
│  │  MapTagsEndpoints()          → filter tags          │     │
│  │  MapProductsEndpoints()      → APIM products        │     │
│  │  MapSubscriptionsEndpoints() → user subscriptions   │     │
│  │  MapStatsEndpoints()         → portal statistics    │     │
│  │  MapNewsEndpoints()          → announcements        │     │
│  │  MapUserEndpoints()          → user profile/logout  │     │
│  │  MapHealthEndpoints()        → liveness check       │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Resilience (Microsoft.Extensions.Http.Resilience) ─┐     │
│  │  3 retries, exponential backoff with jitter          │     │
│  │  Circuit breaker: 60s break / 5 throughput           │     │
│  │  90s total request timeout                           │     │
│  │  PortalTelemetryHandler (x-ms-apim-client header)   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Cross-Cutting ─────────────────────────────────────┐     │
│  │  IMemoryCache (1-min TTL response dedup)            │     │
│  │  Structured logging → Application Insights          │     │
│  │  CORS: AllowAny in dev; Nginx handles prod          │     │
│  │  OpenAPI + Scalar docs (dev only)                   │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Why BFF, Not Direct SPA → APIM

- SAS tokens and ARM tokens cannot be safely held in the browser
- Service principal credentials stay server-side (SOC 2 / GDPR compliant)
- Single proxy point for APIM Data API, eliminating CORS issues
- Allows server-side data transformation and caching
- **RBAC enforcement** — the BFF is the security boundary that validates tokens and checks role-to-API permissions before proxying requests
- **Heterogeneous backends** — the BFF routes to APIM Data API or external APIs transparently

---

## 5. API Client Architecture (`src/api/`)

### 5.1 Data Contracts (`types.ts`)

Two-layer type system:

**APIM contract types** (raw ARM/data-plane shapes):
- `ApimApiContract`, `ApimPageContract<T>`, `ApimOperationContract`, `ApimProductContract`, `ApimSubscriptionContract`

**Internal domain types** (UI-optimized):
- `ApiSource = "apim" | "external"`
- `ApiSummary` — id, name, description, status (`Sandbox | Production | Deprecated`), owner, tags, category, plan (`Free | Paid | Internal`), path, protocols, apiVersion, type, subscriptionRequired, source
- `ApiDetails = ApiSummary & { overview, documentationUrl, openApiUrl?, plans[], operations[], contact?, license?, termsOfServiceUrl? }`
- `ApiOperation`, `ApiProduct`, `ApiSubscription`

**Mapper functions**: `mapApimApiToSummary()`, `mapApimOperationToApiOperation()`, `mapApimProductToApiProduct()` — transform raw APIM contracts to internal types with derived status/plan/category logic.

### 5.2 Client Hooks (`client.ts`)

```
┌─ usePortalApi() ─────────────────────────────────────────┐
│  Low-level authenticated CRUD:                           │
│  get<T>(path), post<T>(path, body),                      │
│  patch<T>(path, body), delete<T>(path)                   │
│  Bearer token from useAuth().getAccessToken()            │
│  Retry: max 2, 500ms base, exponential backoff           │
│  Retryable: 429, 500, 502, 503, 504                     │
│  Returns: ApiResult<T> = { data, error }                 │
└──────────────────────────────────────────────────────────┘

┌─ useApimCatalog() ───────────────────────────────────────┐
│  High-level typed operations:                            │
│  listApis(opts?)        — OData $top/$skip, tag filter   │
│  getApi(apiId)          — API + operations + products    │
│  listProducts(opts?)    — product catalog                │
│  listSubscriptions()    — user subscriptions             │
│  createSubscription(productId, displayName)              │
│  cancelSubscription(subscriptionId)                      │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow — API Catalog Browse

```
User → /apis
  │
  ├─ SPA: ApiCatalog.tsx → usePortalApi().get("/apis")
  │   └─ client.ts: fetch("/api/apis", { Authorization: Bearer <msal-token> })
  │       └─ API_BASE = appConfig.apiBase (default "/api")
  │
  ├─ Vite Dev: proxy /api → http://localhost:3001 (changeOrigin)
  │  — OR —
  │  Nginx Prod: /api/* → proxy → localhost:3001 (strips /api prefix)
  │
  ├─ BFF: GET /apis
  │   ├─ ITokenProvider (ClientSecretCredential) → ARM bearer token (cached)
  │   ├─ ARM → SAS token (cached, 5-min buffer)
  │   ├─ APIM Data API "/apis" call
  │   ├─ Transform to ApiSummary[]
  │   └─ Response (with Array.isArray guard on client)
  │
  └─ SPA: renders ApiCard grid with search/filter/category
```

---

## 6. Infrastructure Architecture (Azure)

```
┌─────────────────────────────────────────────────────────────────┐
│  Azure Resource Group: kac_apimarketplace_eus_{env}_rg          │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐            │
│  │  Azure Container App: komatsu-apim-portal-{env} │            │
│  │  ├ Container Image (ACR) — multi-stage build     │            │
│  │  ├ Stage 1: node:20-alpine (npm + vite build) │            │
│  │  ├ Stage 2: dotnet/sdk:10.0-preview (publish) │            │
│  │  ├ Runtime: nginx:alpine + ASP.NET Core 10    │            │
│  │  ├ supervisord: nginx + dotnet BFF co-process │            │
│  │  │  └ docker-entrypoint.sh: runtime config inject│            │
│  │  ├ App Registration (Service Principal)              │            │
│  │  ├ Service Principal env vars (ARM/Data API auth)│            │
│  │  ├ Env vars injected from Bicep parameters      │            │
│  │  ├ Ingress: external, port 8080                 │            │
│  │  └ Health check: /health → 200                  │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Container App Env    │  │  Azure Container     │            │
│  │ + Log Analytics      │  │  Registry (ACR)      │            │
│  │ + App Insights       │  │                      │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │  Azure APIM instance │                                       │
│  │  ├ Warranty API       │                                      │
│  │  ├ Parts Punchout API │                                      │
│  │  └ Equipment Mgmt API │                                      │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘

Environments: dev | staging (quality) | prod
IaC: azure/container-app.bicep + parameters.{env}.json
Deployment: azure/deploy.ps1 / deploy.sh
```

### 6.1 Bicep Provisions

- Container App Environment
- Container App (with identity, ingress, env vars)
- Log Analytics Workspace
- Application Insights
- Azure Container Registry
- App Registration (Service Principal) RBAC assignment

### 6.2 Nginx Configuration

| Directive | Purpose |
|---|---|
| Listen `:8080` | Container App ingress port |
| `/api/` proxy | Forward to `localhost:3001`, strip `/api` prefix |
| SPA fallback | `try_files $uri $uri/ /index.html` (no-cache) |
| `/health` | Returns `200 "healthy"` |
| Static assets | 1 year cache, `immutable` directive |
| Gzip | Enabled for text/css/js/json/svg |
| Security headers | CSP (Entra ID, azure-api.net, fonts.googleapis.com), X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy |

### 6.3 Environment Variables

| Variable | Dev Default | Prod Default | Purpose |
|---|---|---|---|
| `VITE_USE_MOCK_AUTH` | `true` | `false` | Bypass MSAL for local dev |
| `VITE_PUBLIC_HOME_PAGE` | `true` | `true` | Unauthenticated landing page |
| `VITE_PORTAL_API_BASE` | `/api` | `/api` | BFF base URL |
| `VITE_PORTAL_API_SCOPE` | `api://komatsu-apim-portal/.default` | same | MSAL token scope |
| `VITE_LOGOUT_MODE` | `msal-only` | `msal-plus-bff` | Logout behavior |
| `VITE_DEFAULT_LOCALE` | `en` | (unset) | Default i18n locale |
| `VITE_ENTRA_CLIENT_ID` | (set) | (set) | Entra app registration |
| `VITE_EXTERNAL_TENANT_ID` | (set) | (set) | CIAM tenant |
| `VITE_WORKFORCE_TENANT_ID` | (set) | (set) | Internal tenant |
| `VITE_KPS_URL` | `https://login-uat.komatsu.com/spa` | (prod URL) | KPS SSO redirect |
| `VITE_BFF_URL` | `http://localhost:3001` | (N/A, Nginx) | Vite dev proxy target |

---

## 7. Appspec Feature → Code Mapping (Phase 1 Coverage)

| Appspec Requirement | Status | Implementation Location |
|---|---|---|
| Branded landing page + value proposition | ✅ Built | `src/pages/home/` (HeroSection, FeatureCard, QuickActionCard, StatCard) |
| Responsive (desktop, tablet, mobile) | ✅ Built | MUI Grid + `useMediaQuery` in `AppShell.tsx` (260px drawer) |
| Footer (support, privacy, terms links) | ✅ Built | `src/components/Footer.tsx` |
| Multi-language support | ✅ Built | `src/i18n.ts` (en, ja scaffolded); Header language switcher |
| No anonymous access | ✅ Built | `PrivateRoute.tsx` + `useMsalLogin()` auto-redirect |
| OAuth 2.0 / Entra ID (Global Admin) | ✅ Built | MSAL config with dual-tenant support + KPS SSO |
| RBAC (Admin, Developer, Tester, Viewer) | ✅ Built | `permissions.ts` + `usePermissions()` + `RoleGate` + BFF RBAC |
| API Catalog with categories + search | ✅ Built | `ApiCatalog.tsx` with category/plan filters, text search |
| API detail page (use cases, docs, plan) | ✅ Built | `ApiDetails.tsx` with SectionCard, operations table, plans |
| Swagger/Redoc "Try It" console | ✅ Built | `ApiTryIt.tsx` |
| 3 APIs (Warranty, Parts, Equipment) | ✅ Built | BFF mock data + APIM ARM integration |
| News & Announcements | ✅ Built | `News.tsx` with tag display + BFF `/news` endpoint |
| Registration (unregistered user form) | ✅ Built | `Register.tsx` with dynamic field config from API |
| Onboarding quick-start | ✅ Built | `Onboarding.tsx` with stepper from API status |
| Support (FAQs + tickets) | ✅ Built | `Support.tsx` with 3-tab layout (FAQs, Create, History) |
| Admin panel (role-gated) | ✅ Built | `Admin.tsx` with metrics + pending registrations, behind `RoleGate` |
| Federated logout + cross-tab sync | ✅ Built | `useLogout()` (4 modes) + `SsoLogoutHandler` + `BroadcastChannel` |
| Komatsu brand theme (WCAG) | ✅ Built | `theme.ts` with Gloria Blue palette |
| Code-splitting / lazy load | ✅ Built | `React.lazy()` on all 13 route-level pages |
| Error boundary | ✅ Built | `ErrorBoundary.tsx` with structured App Insights logging |
| Centralized config | ✅ Built | `src/config.ts` (runtime → build-time → fallback) |
| Frontend permissions system | ✅ Built | `permissions.ts` + `usePermissions()` hook |
| API client with retry/resilience | ✅ Built | `client.ts` (2 retries, exponential backoff, typed errors) |
| IaC (Bicep) | ✅ Built | `azure/container-app.bicep` + 3 parameter files |
| Docker containerization | ✅ Built | Multi-stage `Dockerfile` (node:20-alpine → nginx:alpine + supervisord) |
| Dev/Quality/Prod environments | ✅ Built | `.env.development`, `.env.production`, Bicep params per env |
| BFF RBAC authorization | ✅ Built | `bff-dotnet/` — JWT + 4 RBAC policies + hot-reload config |
| BFF resilience pipeline | ✅ Built | `bff-dotnet/` — `AddStandardResilienceHandler` (retry, circuit, timeout) |
| Unit tests | 🔧 In progress | Vitest + Testing Library; test files alongside components/pages |
| AEM content integration | 🔲 Pending | Dynamic content API needed; placeholder in News/API pages |
| ServiceNow/ASK ticket integration | 🔲 Pending | Support page exists; deep integration TBD |
| Welcome e-mail on registration | 🔲 Pending | Backend trigger needed (outside SPA scope) |

---

## 8. Security Architecture (SOC 2, GDPR, WCAG)

```
Layer                  Control
─────────────────────────────────────────────────────────────
Transport              HTTPS-only (Container App ingress, custom DNS TLS)
Browser CSP            nginx.conf Content-Security-Policy header
                       (self + login.microsoftonline.com + azure-api.net + fonts)
Auth Tokens            MSAL tokens in localStorage; bearer-only on /api calls
                       Login dedup via sessionStorage("mn_login_attempted")
Server Credentials     App Registration (ClientSecretCredential via ITokenProvider)
                       Client secret stored as Container App secret in Bicep
SAS Tokens             Generated server-side (BFF); never exposed to browser
Server Auth            JWT Bearer validation (ASP.NET Core BFF)
                       Multi-tenant JWKS aggregation
RBAC (Server)          4 authorization policies: ApiRead, ApiTryIt, ApiSubscribe, ApiManage
                       Hot-reloadable rbac-policies.json
RBAC (Client)          permissions.ts → usePermissions() → RoleGate filtering
Nginx Headers          X-Frame-Options, X-Content-Type-Options, X-XSS-Protection,
                       Referrer-Policy (no-referrer-when-downgrade)
Cross-tab Security     BroadcastChannel("mn-auth") logout propagation
                       Tab ID tracking (sessionStorage "mn-tabid")
Error Isolation        ErrorBoundary prevents full-app crash; structured logging
PII Encryption         Entra ID handles identity; no PII stored locally
Resilience             Client: 2 retries, 500ms exponential backoff
                       BFF: 3 retries, jitter, circuit breaker (60s/5), 90s timeout
SAST / Secret Scan     ADO pipeline required (per appspec exit criteria)
```

---

## 9. Gaps & Recommendations for Phase 1 Completion

| Gap | Recommendation | Priority |
|---|---|---|
| **AEM Integration** | Add a content service layer in BFF that fetches from AEM Content API; render in News page and API detail "Use Cases" tab | High |
| **ServiceNow / ASK** | Embed a ticket creation form in `Support.tsx` that POSTs to ServiceNow REST API via BFF proxy | High |
| **Welcome Email** | Trigger from Global Admin onboarding workflow (external dependency); add a webhook endpoint in BFF if self-managed | Medium |
| ~~**BFF Migration Completion**~~ | ✅ **Complete** (March 2026) — Dockerfile, supervisord, Bicep, and docker-compose updated to run .NET BFF exclusively | ~~High~~ |
| **Sandbox isolation** | API providers must supply sandbox endpoints; `ApiTryIt.tsx` should target sandbox URLs from API metadata | Medium (dependency) |
| **i18n translations** | `i18n.ts` has en/es locale files; content strings need extraction and external translation files per locale | Medium |
| **Test coverage to 70%** | Test files exist alongside components; expand coverage for all pages and BFF routes | High |
| **ADO CI/CD pipeline** | Create `.azure-pipelines/workflows/` with build → test → Docker → ACR → ACA deployment stages | High |
| **Threat Risk Assessment** | Document CSP, CORS, Managed Identity, RBAC, token caching strategy for EARB review | High |

---

## 10. Folder Structure (Current)

```
kx-apim-dev-custom/
├── .github/
│   └── copilot-instructions.md     ← AI assistant context
├── .vscode/
│   ├── launch.json                 ← Debug configurations
│   └── tasks.json                  ← Build / dev / test tasks
├── azure/                          ← IaC: Bicep + deploy scripts ✅
│   ├── container-app.bicep
│   ├── parameters.{dev,staging,prod}.json
│   ├── deploy.ps1 / deploy.sh
│   ├── create-managed-identity.ps1
│   └── assign-identity-to-aca.ps1
├── bff/                            ← Node.js Express BFF (LEGACY — reference only)
│   ├── server.js                   ← 885-line Express server
│   ├── package.json
│   └── README.md
├── bff-dotnet/                     ← ASP.NET Core 10 BFF (ACTIVE runtime) ✅
│   ├── Program.cs                  ← 379-line Minimal API host
│   ├── BffApi.csproj
│   ├── Endpoints/                  ← Route group handlers (4 files)
│   ├── Services/                   ← ArmApiService + DataApiService + MockApiService + AppRegistrationTokenProvider
│   ├── Authorization/              ← RBAC policies + handlers (4 files)
│   ├── Middleware/                  ← Custom middleware (2 files)
│   ├── Models/                     ← Shared DTOs
│   ├── api-registry.json           ← API source routing config
│   ├── rbac-policies.json          ← Hot-reloadable RBAC config
│   └── appsettings.{json,Development.json}
├── data/                           ← Test data payloads
├── docs/                           ← Architecture + integration guides ✅
│   ├── ARCHITECTURE_DESIGN.md      ← This document
│   ├── BFF_IMPLEMENTATION.md
│   ├── CUSTOM_APIM_INTEGRATION_GUIDE.md
│   ├── AZURE_DEPLOYMENT_GUIDE.md
│   ├── DEBUG_SETUP_GUIDE.md
│   └── ... (12 additional guides)
├── public/
│   └── runtime-config.js           ← Runtime config injection point
├── src/
│   ├── api/
│   │   ├── client.ts               ← usePortalApi() + useApimCatalog() hooks (417 lines) ✅
│   │   ├── types.ts                ← APIM contracts + domain types + mappers (~175 lines) ✅
│   │   ├── contracts.ts            ← Additional contract types
│   │   ├── mockData.ts             ← Offline fallback data ✅
│   │   ├── apimClient.ts           ← APIM-specific client
│   │   ├── mapiClient.ts           ← Management API client
│   │   ├── apiService.ts           ← Service layer
│   │   ├── productService.ts       ← Product operations
│   │   ├── userService.ts          ← User operations
│   │   └── services.ts             ← Service aggregation
│   ├── auth/
│   │   ├── AuthProvider.tsx         ← account, roles, getAccessToken context ✅
│   │   ├── msalConfig.ts           ← Per-tenant MSAL Configuration factory ✅
│   │   ├── permissions.ts          ← Permission enum, AppRole, default policies ✅
│   │   ├── usePermissions.ts       ← canRead/canTryIt/canSubscribe/canManage hook ✅
│   │   ├── useAuth.ts              ← useContext(AuthContext) wrapper ✅
│   │   └── *.test.ts               ← Test files for all auth modules
│   ├── components/
│   │   ├── AppShell.tsx             ← Layout shell (Header from component library + Footer) ✅
│   │   ├── Header.tsx               ← Wraps library Header + UserProfile ✅
│   │   ├── Footer.tsx               ← Support/privacy/terms links ✅
│   │   ├── PrivateRoute.tsx         ← MSAL auth gate ✅
│   │   ├── RoleGate.tsx             ← Role-based route guard ✅
│   │   ├── PublicLayout.tsx         ← Simplified layout for public pages ✅
│   │   ├── ErrorBoundary.tsx        ← Global error boundary ✅
│   │   ├── LoadingScreen.tsx        ← Spinner + message ✅
│   │   ├── ApiCard.tsx, PageHeader.tsx, SectionCard.tsx, StatCard.tsx
│   │   ├── ToastProvider.tsx        ← Global toast notifications ✅
│   │   ├── useToast.ts             ← Toast hook
│   │   └── *.test.tsx              ← Test files for all components
│   ├── pages/
│   │   ├── home/
│   │   │   ├── index.tsx            ← Home page (338 lines, stats/news/highlights) ✅
│   │   │   ├── HeroSection.tsx      ← Landing hero
│   │   │   ├── FeatureCard.tsx      ← Platform feature showcase
│   │   │   ├── QuickActionCard.tsx  ← Action buttons
│   │   │   ├── constants.tsx        ← PLATFORM_FEATURES config
│   │   │   ├── types.ts            ← Home page types
│   │   │   └── *.test.tsx          ← Test files
│   │   ├── ApiCatalog.tsx           ← Search + category/plan filters ✅
│   │   ├── ApiDetails.tsx           ← Full API detail view ✅
│   │   ├── ApiTryIt.tsx             ← Swagger/Redoc sandbox ✅
│   │   ├── Register.tsx             ← Dynamic registration form ✅
│   │   ├── Onboarding.tsx           ← Stepper wizard ✅
│   │   ├── MyIntegrations.tsx       ← Subscription management ✅
│   │   ├── Support.tsx              ← 3-tab support center ✅
│   │   ├── News.tsx                 ← News articles with tags ✅
│   │   ├── Admin.tsx                ← Metrics + registration approvals ✅
│   │   ├── AccessDenied.tsx         ← 403 page ✅
│   │   ├── NotFound.tsx             ← 404 page ✅
│   │   └── *.test.tsx              ← Test files
│   ├── utils/loginUtils/
│   │   ├── initiateLogin.ts         ← Tenant detection + KPS redirect ✅
│   │   ├── SsoLogoutHandler.tsx     ← Federated logout handler ✅
│   │   ├── useLogout.ts            ← Multi-mode logout hook (261 lines) ✅
│   │   ├── getAccessToken.ts       ← Silent token acquisition helper ✅
│   │   ├── customHooks/
│   │   │   └── useMsalLogin.ts     ← Auto-trigger login redirect ✅
│   │   └── *.test.ts               ← Test files
│   ├── test/
│   │   └── setup.ts                ← Vitest setup (Testing Library matchers)
│   ├── config.ts                   ← Centralized config (runtime → build → fallback) ✅
│   ├── App.tsx                     ← Route tree with lazy loading ✅
│   ├── main.tsx                    ← MSAL bootstrap + provider stack ✅
│   ├─ theme.ts                    ← Re-exports theme/colors/typography from @komatsu-nagm/component-library ✅
│   ├── i18n.ts                     ← i18next setup (en, ja) ✅
│   └── styles.css                  ← Global styles
├── .env.development                ← Dev env vars (mock auth enabled)
├── .env.production                 ← Prod env vars
├── .env.example                    ← Template for all variables
├── Dockerfile                      ← Multi-stage: node:20-alpine → dotnet/sdk:10.0 → nginx:alpine ✅
├── docker-compose.yml              ← Local container orchestration ✅
├── docker-entrypoint.sh            ← Runtime config injection ✅
├── nginx.conf                      ← Reverse proxy + security headers ✅
├── supervisord.conf                ← Process manager (nginx + BFF) ✅
├── package.json                    ← Frontend deps + scripts ✅
├── tsconfig.json                   ← TypeScript config
├── vite.config.ts                  ← Vite + dev proxy config ✅
└── vitest.config.ts                ← Test runner config ✅
```

---

## 11. Technology Decisions Summary

| Decision | Rationale |
|---|---|
| **Vite 5.4 over CRA/webpack** | Sub-second HMR, native ESM, fast production builds |
| **React 18.3 + TypeScript 5.5** | Latest stable React with concurrent features; strict type safety |
| **MUI 5.15 over custom CSS** | WCAG compliance built-in, responsive grid, Komatsu theme override |
| **react-router-dom v6 + lazy()** | Nested layouts, code-splitting, small initial bundle |
| **MSAL React 2.0 over raw OAuth** | First-party Microsoft library for Entra ID; handles full token lifecycle |
| **ASP.NET Core 10 BFF** | .NET BFF is the **active runtime** in Docker & ACA; provides RBAC, typed DI, resilience pipeline, JWT validation. The legacy Express BFF (`bff/`) is retained for reference only. See `docs/BFF_IMPLEMENTATION.md`. |
| **Centralized config.ts** | Runtime → build-time → fallback cascade enables single Docker image across environments |
| **App Registration (ClientSecretCredential) for BFF auth** | Consistent service principal identity for all ARM/Data API calls; `ITokenProvider` abstraction with thread-safe token cache; secrets managed via Container App secrets in Bicep |
| **`@komatsu-nagm/component-library`** | Shared UI components (Header, AppShell, theme) compiled from source via Vite alias to resolve React 18/19 version mismatch |
| **Bicep over Terraform** | Komatsu preferred IaC (per appspec); native Azure Resource Manager |
| **Container Apps over App Service** | Built-in scaling, revision management, lower cost for containerized workloads |
| **Vitest 1.6 over Jest** | Native Vite integration, faster execution, same config ecosystem |
| **BroadcastChannel for cross-tab logout** | Native Web API; no external dependencies; immediate propagation |

---

## 12. Development Workflow

### 12.1 Local Development

```bash
# Frontend (port 5173, proxies /api → localhost:3001)
npm install
npm run dev

# .NET BFF (port 3001, mock mode via Development environment)
cd bff-dotnet && dotnet run

# Legacy Node.js BFF (port 3001, mock mode) — reference only
# cd bff && npm install && npm run dev

# Tests
npm test                    # Vitest watch mode
npm run test:coverage       # Coverage report
```

### 12.2 VS Code Tasks (`.vscode/tasks.json`)

| Task | Description |
|---|---|
| `Install Frontend Dependencies` | `npm install` |
| `Install BFF Dependencies (.NET)` | `dotnet restore` |
| `Install All Dependencies` | Both frontend + .NET |
| `Start Frontend Dev Server` | `npm run dev` (background) |
| `Start BFF Server (Node.js)` | `npm run dev` in `bff/` (background) |
| `Build BFF (.NET)` | `dotnet build` (build group) |
| `Run Tests` | `npm test` |
| `Run Tests with Coverage` | `npm run test:coverage` |
| `Stop Frontend Dev Server` | Kill process on port 5173 |

### 12.3 Docker Build

> **Note:** The Docker build requires the `@komatsu-nagm/component-library` source (`react-template` repo) to be available. The `deploy-to-azure.ps1` script automatically copies it into `./component-library/` before building.

```bash
# Copy component library source (if not using deploy-to-azure.ps1)
cp -r ../react-template ./component-library

# Build
docker build -t komatsu-apim-portal .

# Run (docker-entrypoint.sh injects runtime config)
docker run -p 8080:8080 \
  -e VITE_ENTRA_CLIENT_ID=... \
  -e VITE_EXTERNAL_TENANT_ID=... \
  -e Apim__ServicePrincipal__TenantId=... \
  -e Apim__ServicePrincipal__ClientId=... \
  -e Apim__ServicePrincipal__ClientSecret=... \
  komatsu-apim-portal
```

---

*Document reflects codebase as of 2026-03-06 on branch `UpdateWithNewClientApp`, analyzed against `local_docs/appspec.txt` requirements.*
