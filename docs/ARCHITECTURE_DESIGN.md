# Komatsu API Marketplace Portal — Architecture Design

> **Project:** KNA Project #802 — Komatsu API Marketplace (Phase 1 MVP)
> **Repository:** `KNA-CustomApps-Org/kx-apim-dev-custom-frontend`
> **Branch:** `UpdateWithNewClientApp`
> **Stack:** React 18 · TypeScript · Vite 5 · MUI 5 · MSAL · Express BFF · Nginx · Azure Container Apps · Bicep

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
│  │  └─ /health     → 200 OK                             │            │
│  └──────────────────────────────────────────────────────┘            │
│  ┌──────────────────────────────────────────────────────┐            │
│  │  BFF – Node/Express (port 3001)                      │            │
│  │  ├─ Azure Managed Identity → ARM token               │            │
│  │  ├─ ARM token → SAS token (Data API auth)            │            │
│  │  ├─ APIM Data API proxy (apis, products, operations) │            │
│  │  └─ Mock mode for local dev                          │            │
│  └──────────────────────────────────────────────────────┘            │
│  supervisord orchestrates nginx + node                               │
│  User-Assigned Managed Identity attached                             │
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
│  OAuth 2.0 +     │ │  ARM API for   │ └──────────────────────┘
│  RBAC roles      │ │  discovery     │
└─────────────────┘ └────────────────┘
```

---

## 2. Frontend Architecture (Existing SPA)

| Concern | Implementation | Appspec Mapping |
|---|---|---|
| **Framework** | React 18 + TypeScript + Vite 5 | Modern dev methods ✅ |
| **UI Library** | MUI 5 (Material UI) | Responsive, WCAG-compliant ✅ |
| **Routing** | `react-router-dom` v6, nested layouts | SPA with shell ✅ |
| **Auth** | `@azure/msal-react` + `@azure/msal-browser` | OAuth 2.0 / Entra ID ✅ |
| **i18n** | `i18next` + `react-i18next` | Multi-language support ✅ |
| **Theming** | Komatsu brand colors (`theme.ts`: Gloria Blue, Ice Blue, Cool Grey palette) | On-Brand UI ✅ |
| **Testing** | Vitest + Testing Library + jsdom | 70% coverage target ✅ |
| **State** | React Context (`AuthProvider`, `ToastProvider`) + local component state | Lightweight, no Redux overhead |

### 2.1 Route Map → Appspec Feature Coverage

```
Route                     Component           Appspec Feature
──────────────────────────────────────────────────────────────────
/                         Home                Landing page, branded value prop, feature cards
/apis                     ApiCatalog          API browsing by category, search, plan filter
/apis/:apiId              ApiDetails          Use cases, cost plan, dev docs, operations table
/apis/:apiId/try          ApiTryIt            Swagger/Redoc "Try It" sandbox console
/register                 Register            Unregistered user request form → Global Admin
/profile/onboarding       Onboarding          Quick-start onboarding after registration
/my/integrations          MyIntegrations      Per-user subscription / integration management
/support                  Support             ServiceNow / ASK integration link
/news                     News                News & Announcements (API changes, deprecations)
/admin                    Admin (RoleGate)    Admin panel (RBAC: Admin, GlobalAdmin only)
/access-denied            AccessDenied        Unauthorized landing
/sso-logout               SsoLogoutHandler    Federated logout (MSAL + optional BFF + KPS)
```

### 2.2 Component Hierarchy

```
<MsalProvider>
  <AuthProvider>              ← Extracts account, roles, getAccessToken
    <ToastProvider>           ← Global notification system
      <ThemeProvider>         ← Komatsu brand theme
        <App>
          <BrowserRouter>
            <Routes>
              ─ PublicLayout   (conditional: VITE_PUBLIC_HOME_PAGE)
              │  └ Home
              ─ PrivateRoute   ← MSAL auth gate
                 └ AppShell    ← Header + responsive SideNav + Footer + <Outlet>
                    ├ Home
                    ├ ApiCatalog → ApiCard[]
                    ├ ApiDetails → SectionCard, MethodBadge, operations table
                    ├ ApiTryIt   → embedded Swagger/Redoc console
                    ├ Register
                    ├ Onboarding
                    ├ MyIntegrations
                    ├ Support
                    ├ News
                    └ RoleGate(Admin) → Admin
            </Routes>
          </BrowserRouter>
        </App>
      </ThemeProvider>
    </ToastProvider>
  </AuthProvider>
</MsalProvider>
```

---

## 3. Authentication & Authorization Architecture

```
┌──────────┐    ① redirect     ┌───────────────────────────┐
│ Browser  │───────────────────▶│  Microsoft Entra ID       │
│ (SPA)    │◁──────────────────│  External CIAM tenant      │
│          │    ② id_token     │  OR Workforce tenant       │
│          │    + access_token │  (Global Admin framework)  │
└──────────┘                   └───────────────────────────┘
     │
     │ MSAL handles:
     │  - initiateLogin() detects tenant from query param or session
     │  - getMsalConfig() builds per-tenant authority URLs
     │  - AuthProvider exposes: account, roles[], getAccessToken()
     │
     ▼
┌──────────────────────────────────────────┐
│ Frontend RBAC (appspec roles)            │
│  ├ Admin / GlobalAdmin → /admin route    │
│  ├ Developer → /apis, /my/integrations   │
│  ├ Tester → /apis/:id/try (sandbox)      │
│  └ Unauthenticated → /register only      │
│                                          │
│  Enforcement:                            │
│   - PrivateRoute (auth gate for all)     │
│   - RoleGate (role-based route guard)    │
│   - SideNav filters links by role        │
└──────────────────────────────────────────┘
```

### Key Design Decisions

- **Dual-tenant support**: `msalConfig.ts` maps `externalTenantId` (CIAM for dealers/vendors) and `workforceTenantId` (internal staff) to separate authority URLs.
- **Token claims**: Roles extracted from `idTokenClaims.roles` and `idTokenClaims.groups` (`AuthProvider.tsx`).
- **No anonymous access**: `PrivateRoute` enforces MSAL authentication before any app shell route.
- **Admin-scoped APIM access**: The BFF uses an admin SAS token for full Data API access. RBAC is enforced at the application level — the BFF validates MSAL tokens, extracts Entra ID roles, and checks a configurable role-to-API permission map before proxying requests. See `docs/BFF_MIGRATION_DECISION.md` for the full RBAC design.
- **Credential security**: Tokens in `localStorage` (MSAL default), HTTPS enforced, CSP headers in `nginx.conf`.

---

## 4. Backend-for-Frontend (BFF) Architecture

> **Platform Decision:** Migrating from Express.js to **ASP.NET Core 8 Minimal API** to support
> application-level RBAC enforcement and heterogeneous API backends (APIM + non-APIM).
> See `docs/BFF_MIGRATION_DECISION.md` for full rationale.

```
┌──────────────────────────────────────────────────────────────┐
│  BFF (ASP.NET Core Minimal API, port 3001)                   │
│                                                              │
│  ┌─ Authentication ────────────────────────────────────┐     │
│  │  JWT Bearer validation (Entra ID JWKS)              │     │
│  │  Validates issuer, audience, expiry on every request│     │
│  │  Extracts roles[] from token claims                 │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Authorization (RBAC) ──────────────────────────────┐     │
│  │  IAuthorizationHandler checks role → API → permission│    │
│  │  Configurable via rbac-policies.json (hot-reload)   │     │
│  │  Permissions: Read, TryIt, Subscribe, Manage        │     │
│  │  Admin/GlobalAdmin: full access to all APIs         │     │
│  │  Developer: read + tryit + subscribe (assigned APIs)│     │
│  │  Tester: read + tryit (assigned APIs)               │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ APIM Auth Chain ──────────────────────────────────┐      │
│  │  DefaultAzureCredential (Managed Identity)          │     │
│  │  ├ User-Assigned Managed Identity (prod)            │     │
│  │  ├ System-Assigned Managed Identity (fallback)      │     │
│  │  └ Azure CLI token (local dev: `az login`)          │     │
│  │  Token → ARM → Admin SAS Token → Data API calls     │     │
│  │  (Cached with 5-min buffer before expiry)           │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Backend Router (API Registry) ─────────────────────┐     │
│  │  api-registry.json defines source per API:          │     │
│  │  ├ APIM APIs → ApimDataApiService (Data API + SAS)  │     │
│  │  └ External APIs → ExternalApiService (per adapter)  │    │
│  │  Both normalize to ApiSummary / ApiDetails contracts │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ API Routes ────────────────────────────────────────┐     │
│  │  GET  /health            → liveness check           │     │
│  │  GET  /apis              → merged catalog (RBAC filtered)│ │
│  │  GET  /apis/{id}         → detail (APIM or external)│     │
│  │  GET  /apis/{id}/schemas → OpenAPI spec             │     │
│  │  GET  /apis/{id}/try     → sandbox (TryIt policy)   │     │
│  │  GET  /tags              → tag list for filters     │     │
│  │  GET  /products          → APIM products            │     │
│  │  GET  /subscriptions     → user subscriptions       │     │
│  │  POST /subscriptions     → create (Subscribe policy)│     │
│  │  GET  /news              → announcements feed       │     │
│  │  GET  /stats             → portal stats             │     │
│  │  */admin/*               → RBAC management (Manage) │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Cross-Cutting ─────────────────────────────────────┐     │
│  │  IHttpClientFactory + Polly (retry 429/500, circuit)│     │
│  │  x-ms-apim-client portal header on all Data API calls│    │
│  │  Structured logging → Application Insights          │     │
│  │  Mock mode via IsDevelopment() environment check     │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Why BFF, Not Direct SPA → APIM

- SAS tokens and ARM tokens cannot be safely held in the browser
- Managed Identity credentials stay server-side (SOC 2 / GDPR compliant)
- Single proxy point for APIM Data API, eliminating CORS issues
- Allows server-side data transformation and caching
- **RBAC enforcement** — the BFF is the security boundary that validates tokens and checks role-to-API permissions before proxying requests
- **Heterogeneous backends** — the BFF routes to APIM Data API or external APIs transparently

---

## 5. Data Flow — API Catalog Browse

```
User → /apis
  │
  ├─ SPA: ApiCatalog.tsx → usePortalApi().get("/apis")
  │   └─ client.ts: fetch("/api/apis", { Authorization: Bearer <msal-token> })
  │
  ├─ Nginx: /api/* → proxy → BFF:3001
  │
  ├─ BFF: GET /apis
  │   ├─ getAccessToken() → DefaultAzureCredential → ARM bearer token (cached)
  │   ├─ getDataApiSasToken() → POST ARM .../users/1/token → SAS token (cached)
  │   ├─ fetchFromDataApi("/apis") → APIM Data API
  │   ├─ transformDataApiToSummary() for each API
  │   └─ Response: ApiSummary[]
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
│  │  ├ Container Image (ACR)                        │            │
│  │  │  ├ Nginx (static SPA + reverse proxy)        │            │
│  │  │  └ Node.js BFF (supervisord co-process)      │            │
│  │  ├ User-Assigned Managed Identity               │            │
│  │  ├ Env vars injected from Bicep parameters      │            │
│  │  └ Ingress: external, port 8080                 │            │
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
Deployment: azure/deploy.ps1 / deploy.sh, Docker multi-stage build
```

### Bicep Provisions

- Container App Environment
- Container App (with identity, ingress, env vars)
- Log Analytics Workspace
- Application Insights
- Azure Container Registry
- Managed Identity assignment

---

## 7. Appspec Feature → Code Mapping (Phase 1 Coverage)

| Appspec Requirement | Status | Implementation Location |
|---|---|---|
| Branded landing page + value proposition | ✅ Built | `src/pages/home/` (HeroSection, FeatureCard, QuickActionCard) |
| Responsive (desktop, tablet, mobile) | ✅ Built | MUI Grid + `useMediaQuery` in `AppShell.tsx` |
| Footer (support, privacy, terms links) | ✅ Built | `src/components/Footer.tsx` |
| Multi-language support | ✅ Built | `src/i18n.ts` (en, ja scaffolded) |
| No anonymous access | ✅ Built | `PrivateRoute.tsx` wraps all app routes |
| OAuth 2.0 / Entra ID (Global Admin) | ✅ Built | MSAL config with dual-tenant support |
| RBAC (Admin, Developer, Tester) | ✅ Built | `AuthProvider` extracts roles; `RoleGate` enforces |
| API Catalog with categories + search | ✅ Built | `ApiCatalog.tsx` with dynamic filters |
| API detail page (use cases, docs, plan) | ✅ Built | `ApiDetails.tsx` with SectionCard layout |
| Swagger/Redoc "Try It" console | ✅ Built | `ApiTryIt.tsx` |
| 3 APIs (Warranty, Parts, Equipment) | ✅ Built | BFF mock data + APIM Data API integration |
| News & Announcements | ✅ Built | `News.tsx` + BFF `/news` endpoint |
| Registration (unregistered user form) | ✅ Built | `Register.tsx` |
| Onboarding quick-start | ✅ Built | `Onboarding.tsx` |
| Support (ServiceNow integration) | ✅ Built | `Support.tsx` |
| Admin panel (role-gated) | ✅ Built | `Admin.tsx` behind `RoleGate` |
| Komatsu brand theme (WCAG) | ✅ Built | `theme.ts` with Gloria Blue palette |
| IaC (Bicep) | ✅ Built | `azure/container-app.bicep` + parameter files |
| Docker containerization | ✅ Built | Multi-stage `Dockerfile` (builder → nginx+node runtime) |
| Dev/Quality/Prod environments | ✅ Built | `.env.development`, `.env.production`, Bicep params per env |
| 70% unit test coverage | 🔧 In progress | Vitest + Testing Library; `vitest.config.ts` configured |
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
                       (self + Entra ID + APIM + fonts)
Auth Tokens            MSAL tokens in localStorage; bearer-only on /api calls
Server Credentials     Managed Identity (no secrets in env vars or code)
SAS Tokens             Generated server-side (BFF); never exposed to browser
Helmet                 X-Frame-Options, X-Content-Type-Options, X-XSS headers
PII Encryption         Entra ID handles identity; no PII stored locally
RBAC                   Entra ID groups/roles → frontend RoleGate + backend checks
SAST / Secret Scan     ADO pipeline required (per appspec exit criteria)
```

---

## 9. Gaps & Recommendations for Phase 1 Completion

| Gap | Recommendation | Priority |
|---|---|---|
| **AEM Integration** | Add a content service layer in BFF that fetches from AEM Content API; render in News page and API detail "Use Cases" tab | High |
| **ServiceNow / ASK** | Embed a ticket creation form in `Support.tsx` that POSTs to ServiceNow REST API via BFF proxy | High |
| **Welcome Email** | Trigger from Global Admin onboarding workflow (external dependency); add a webhook endpoint in BFF if self-managed | Medium |
| **Sandbox isolation** | API providers must supply sandbox endpoints; `ApiTryIt.tsx` should target sandbox URLs from API metadata | Medium (dependency) |
| **i18n translations** | `i18n.ts` has en/ja stubs; content strings need extraction and external translation files per locale | Medium |
| **Test coverage to 70%** | Home page tests exist; need coverage for `ApiCatalog`, `ApiDetails`, `Admin`, `Register`, `Support`, `PrivateRoute`, BFF routes | High |
| **ADO CI/CD pipeline** | Create `.azure-pipelines/workflows/` with build → test → Docker → ACR → ACA deployment stages | High |
| **Threat Risk Assessment** | Document CSP, CORS, Managed Identity, RBAC, token caching strategy for EARB review | High |

---

## 10. Folder Structure (Current + Recommended Additions)

```
komatsu-apim-portal/
├── .github/workflows/          ← GitHub Actions (if needed)
├── .azure-pipelines/workflows/ ← ADO pipelines (required by appspec)
├── azure/                      ← IaC: Bicep + deploy scripts ✅
├── bff/                        ← Express BFF server ✅
│   ├── server.js
│   ├── routes/                 ← (recommended) split route handlers
│   ├── services/               ← (recommended) AEM, ServiceNow clients
│   └── __tests__/              ← (recommended) BFF unit tests
├── docs/                       ← Architecture, deployment, integration guides ✅
├── public/                     ← Static assets (logos, icons) ✅
├── src/
│   ├── api/
│   │   ├── client.ts           ← usePortalApi() hook ✅
│   │   ├── types.ts            ← APIM contract + domain types ✅
│   │   ├── mockData.ts         ← Offline fallback ✅
│   │   └── contentClient.ts    ← (recommended) AEM content fetcher
│   ├── auth/                   ← MSAL config, AuthProvider, useAuth ✅
│   ├── components/             ← Shared UI: AppShell, Header, Footer, etc. ✅
│   ├── pages/                  ← Route-level pages ✅
│   │   ├── home/               ← Landing page modules ✅
│   │   └── admin/              ← (recommended) split Admin sub-pages
│   ├── utils/                  ← Login utilities ✅
│   ├── hooks/                  ← (recommended) shared custom hooks
│   ├── i18n/                   ← (recommended) move translations to JSON files
│   ├── test/                   ← Test setup ✅
│   ├── App.tsx                 ✅
│   ├── main.tsx                ✅
│   ├── theme.ts                ✅
│   └── i18n.ts                 ✅
├── Dockerfile                  ← Multi-stage build ✅
├── nginx.conf                  ← Reverse proxy config ✅
├── docker-compose.yml          ✅
├── vite.config.ts              ✅
└── vitest.config.ts            ✅
```

---

## 11. Technology Decisions Summary

| Decision | Rationale |
|---|---|
| **Vite over CRA/webpack** | Sub-second HMR, native ESM, fast production builds |
| **MUI 5 over custom CSS** | WCAG compliance built-in, responsive grid, Komatsu theme override |
| **MSAL React over raw OAuth** | First-party Microsoft library for Entra ID; handles token lifecycle |
| **ASP.NET Core Minimal API BFF over Express.js** | RBAC authorization pipeline, typed DI, IHttpClientFactory + Polly retry, JWT Bearer validation built-in; enterprise .NET alignment for AMS handover. See `docs/BFF_MIGRATION_DECISION.md`. |
| **Express BFF over serverless** | (Original choice, now superseded) Co-located in container for low latency; migrating to ASP.NET Core for RBAC + multi-backend support |
| **Managed Identity over client secrets** | Zero-secret deployment; SOC 2 compliant; auto-rotated |
| **Bicep over Terraform** | Komatsu preferred IaC (per appspec); native Azure Resource Manager |
| **Container Apps over App Service** | Built-in scaling, revision management, lower cost for containerized workloads |
| **Vitest over Jest** | Native Vite integration, faster execution, same config ecosystem |

---

*Document generated from codebase analysis against `local_docs/appspec.txt` requirements.*
