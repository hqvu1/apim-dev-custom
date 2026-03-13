# API Marketplace — Story Mapping Gap Analysis

## Current SPA vs. Design Requirements

| | |
|---|---|
| **SPA Repository** | ` |
| **Date** | March 2026 |
| **Source** | API Marketplace Story Mapping (Microsoft Whiteboard) + DESIGN_DOCUMENT.md |

---

## Summary

The `mykomasu-dapim-frontend` repo provides a solid **foundation layer** — build tooling, auth, app shell, landing page, and test infrastructure. However, **all five user journey verticals** (Discover → Understand → Integrate → Manage → Support) still need their feature implementations. The gap is primarily in feature pages and BFF service integration, not in infrastructure.

| Area | Status | Coverage |
|------|--------|----------|
| **Build & Tooling** | ✅ Complete | Vite 7, TypeScript, pnpm, ESLint, Prettier, Vitest, Playwright |
| **Auth & Security** | ✅ SPA Complete / ⚠️ BFF Pending | MSAL.js multi-tenant login ✅, PrivateRoute ✅, RoleGate ✅, Bearer token to BFF ⚠️, BFF JWT validation 🔲, Global Admin role lookup 🔲, BFF→APIM authz 🔲 |
| **App Shell** | ✅ Complete | Header (component lib), footer, layout, skip-link, routing |
| **Landing Page** | ✅ Complete | 7 sub-components (Hero, Categories, Features, Resources, Stats, APIs, CTA) |
| **Component Library** | ✅ Integrated | @komatsu-nagm/component-library (Header, Button, PageCard, etc.) |
| **Test Infrastructure** | ✅ Complete | 49 tests passing, MSW mock server, coverage config |
| **Discover (Catalog)** | 🔲 Not Started | No catalog page, search, or filter components |
| **Understand (Docs)** | 🔲 Not Started | No API detail page, doc viewer, or use case pages |
| **Integrate (Try-It)** | 🔲 Not Started | Empty `widgets/tryit/` directory |
| **Manage (Dashboard)** | 🔲 Not Started | No dashboard, credential, or user management pages |
| **Support** | 🔲 Not Started | No ticket, knowledge base, or contact pages |
| **Admin** | 🔲 Not Started | No admin panel |
| **i18n** | 🔲 Not Started | No react-i18next setup |
| **BFF Service Layer** | 🔲 Not Started | Empty `services/` directory, apiClient exists but no BFF calls |

---

## Detailed Gap Analysis by User Journey

### 1. DISCOVER — API Catalog & Search

#### Story Map Requirements (MVP — Violet)
- [D-1] Browse APIs by category
- [D-2] Search APIs with filters (region, system, data type)
- [D-3] API listing with brief descriptions

#### What Exists Today
| Item | Status | Notes |
|------|--------|-------|
| `/catalog` route | 🔲 Missing | Router only has `/`, `/health`, `/access-denied` |
| Catalog page component | 🔲 Missing | No `features/catalog/` directory |
| API category grid | 🔲 Missing | Landing page has static categories in `data.ts` but no real catalog |
| Search bar + filters | 🔲 Missing | |
| API card component | 🔲 Missing | Can use `PageCard` from component library |
| BFF integration (`/api/apis`) | 🔲 Missing | `services/` is empty |
| TanStack Query hooks | 🔲 Missing | QueryClient configured but no query hooks defined |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Create `/catalog` route and page shell | S | MVP |
| Build `ApiCategoryGrid` using `PageCardList` | M | MVP |
| Build `ApiSearchBar` + `ApiFilterPanel` | M | MVP |
| Create `services/catalogApi.ts` → BFF `/api/apis` | S | MVP |
| Create `useApiCatalog` / `useApiSearch` TanStack Query hooks | S | MVP |
| Wire category links from landing page `data.ts` to real catalog routes | S | MVP |

---

### 2. UNDERSTAND — API Documentation & Detail

#### Story Map Requirements (MVP — Violet)
- [U-1] Detailed API documentation (endpoints, parameters, responses)
- [U-2] API use cases and examples
- [U-3] Value proposition messaging
- [U-4] Pricing / cost plan display

#### What Exists Today
| Item | Status | Notes |
|------|--------|-------|
| `/catalog/:category/:apiSlug` route | 🔲 Missing | |
| API detail page | 🔲 Missing | |
| Doc viewer (Swagger/Redoc embed) | 🔲 Missing | |
| Use cases display | 🔲 Missing | |
| Pricing section | 🔲 Missing | |
| Landing page value messaging | ✅ Partial | `HeroSection` + `FeaturesSection` have static value props |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Create `/catalog/:category/:apiSlug` route with tabs (overview, docs, try-it, changelog) | M | MVP |
| Build `ApiDetailView` page component | L | MVP |
| Integrate Swagger UI or Redoc for API doc rendering | M | MVP |
| Build use case / examples section | M | MVP |
| Build pricing display component | S | MVP |
| Create `services/apiDetailApi.ts` → BFF `/api/apis/{id}` | S | MVP |

---

### 3. INTEGRATE — Subscribe, Credentials & Try-It

#### Story Map Requirements (MVP — Violet)
- [I-1] Select and subscribe to APIs
- [I-2] Auto-generated client credentials
- [I-3] Sandbox environment for testing
- [I-4] Integration guides (Postman, Swagger)
- [I-5] Rate limit and quota visibility
- [I-6] SLA display

#### What Exists Today
| Item | Status | Notes |
|------|--------|-------|
| `/subscribe/:apiSlug` route | 🔲 Missing | |
| Subscription flow component | 🔲 Missing | |
| Try-It console | 🔲 Missing | `widgets/tryit/` exists but is empty |
| Credential display | 🔲 Missing | |
| Quota / rate limit display | 🔲 Missing | |
| BFF subscription endpoints | 🔲 Missing | BFF has `/api/subscriptions/*` endpoints ready |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Build `SubscribeFlow` multi-step component | L | MVP |
| Build `CredentialCard` (show/copy Client ID + Secret) | M | MVP |
| Build Try-It console in `widgets/tryit/` (Swagger UI embed or custom) | L | MVP |
| Build `QuotaDisplay` component (rate limits, usage bars) | M | MVP |
| Build SLA display section | S | MVP |
| Create `services/subscriptionApi.ts` → BFF `/api/subscriptions/*` | S | MVP |
| Create `services/tryitApi.ts` → BFF proxy for sandbox calls | M | MVP |

---

### 4. MANAGE — Dashboard, Credentials & Users

#### Story Map Requirements (MVP — Violet)
- [M-1] View Client ID and secret associated to API
- [M-2] Add, delete, edit, update user profiles

#### What Exists Today
| Item | Status | Notes |
|------|--------|-------|
| `/dashboard` route | 🔲 Missing | |
| Dashboard layout | 🔲 Missing | |
| Active subscriptions list | 🔲 Missing | |
| Credential management (rotate/revoke) | 🔲 Missing | |
| User profile page | 🔲 Missing | |
| Role/permission assignment UI | 🔲 Missing | `RoleGate` exists for access control but no admin UI |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Create `/dashboard` route with sub-routes (credentials, subscriptions, usage) | M | MVP |
| Build `DashboardLayout` with `ContextSummaryBar` from component library | M | MVP |
| Build `ActiveSubscriptions` list using `ApplicationCard` | M | MVP |
| Build credential management UI (view, rotate, revoke) | L | MVP |
| Build user profile page (`/profile`) | M | MVP |
| Create `services/dashboardApi.ts` → BFF `/api/users/*`, `/api/subscriptions/*` | S | MVP |

---

### 5. SUPPORT — Tickets, KB & Contact

#### Story Map Requirements (MVP — Violet)
- [S-1] Submit support tickets
- [S-2] Ticket tracking with response status
- [S-3] Knowledge base with search
- [S-4] Email/phone contact options

#### What Exists Today
| Item | Status | Notes |
|------|--------|-------|
| `/support` route | 🔲 Missing | |
| Ticket submission form | 🔲 Missing | |
| Ticket list / detail view | 🔲 Missing | |
| Knowledge base page | 🔲 Missing | |
| Contact page | 🔲 Missing | Footer has placeholder links |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Create `/support` route with sub-routes (tickets, kb, contact) | M | MVP |
| Build `TicketForm` component | M | MVP |
| Build `TicketList` + `TicketDetail` components | M | MVP |
| Build `KnowledgeBase` search page using `PageCardList` | M | MVP |
| Build `ContactOptions` page | S | MVP |
| Create `services/supportApi.ts` → BFF (ServiceNow/ASK integration) | M | MVP |

---

### 6. ADMIN — Portal Administration

#### What Exists Today
| Item | Status | Notes |
|------|--------|-------|
| `/admin` route | 🔲 Missing | |
| `RoleGate` component | ✅ Exists | Can wrap admin routes with `roles={['Admin']}` |
| Content management | 🔲 Missing | |
| User management | 🔲 Missing | |
| API onboarding | 🔲 Missing | |
| Analytics | 🔲 Missing | |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Create `/admin` route wrapped with `RoleGate` | S | MVP |
| Build `ContentManager` (AEM CMS bridge) | L | MVP |
| Build `UserManager` (list, approve, assign roles) | L | MVP |
| Build `ApiOnboardingManager` | L | Post-MVP |
| Build analytics dashboard | L | Post-MVP |

---

### 7. CROSS-CUTTING — Infrastructure & Shared

#### Story Map Requirements (Must Have)
- [X-1] Unified SSO authentication (Global Admin — workforce + CIAM tenants)
- [X-2] Enterprise-grade security (JWT validation, no APIM keys in browser)
- [X-3] Mobile-friendly responsive UI
- [X-4] Role-based dashboards (Distributor vs Vendor vs Customer)
- [X-5] Localization support
- [X-6] No anonymous access

#### Auth & Authorization Flow Detail

The actual flow is **access_token forwarding**: SPA authenticates via MSAL.js → acquires `access_token` scoped to `api://<bff-app-id>/Portal.Access` → sends as `Authorization: Bearer <access_token>` to BFF → BFF validates access_token (`aud` = BFF App ID, `scp` = `Portal.Access`, issuer = Workforce or CIAM) → extracts user RID (`oid`/`sub`) → queries Global Admin for role (Distributor, Vendor, or Customer) with IMemoryCache caching (10 min TTL) → BFF maps role to APIM product access using Managed Identity (custom least-privilege APIM role).

> **Security note**: The SPA uses `sessionStorage` (not `localStorage`) for MSAL token cache to limit XSS exposure. APIM subscription provisioning is deferred to `/api/auth/me` or first dashboard visit — NOT in the auth hot path.

| Item | Status | Notes |
|------|--------|-------|
| SPA → MSAL.js login (workforce + CIAM) | ✅ Complete | `msalConfig.ts` supports multi-tenant with `TENANT_DETAILS` map |
| SPA acquires `access_token` for BFF scope | ⚠️ Needs update | `loginRequest.scopes` currently defaults to `User.Read`; must change to `api://<bff-app-id>/Portal.Access` |
| SPA token cache in `sessionStorage` | ⚠️ Needs update | `msalConfig.ts` currently uses `cacheLocation: 'localStorage'`; change to `'sessionStorage'` |
| SPA passes `Authorization: Bearer <access_token>` to BFF | ⚠️ Partial | `apiClient.ts` exists with `credentials: 'include'` but needs `Authorization: Bearer` header injection using `getAccessToken()` |
| BFF validates access_token (dual auth: Workforce + CIAM) | 🔲 BFF-side | Dual `AddJwtBearer` schemes + `AddPolicyScheme` auto-selector; validates `aud` + `scp` + issuer |
| BFF extracts user RID from token | 🔲 BFF-side | Extract `oid` or `sub` claim from validated access_token |
| BFF queries Global Admin for role (with caching) | 🔲 BFF-side | `GlobalAdminRoleService` — GET `/users/{rid}/roles`; results cached in `IMemoryCache` (10 min TTL) |
| BFF maps role → APIM subscriptions (deferred) | 🔲 BFF-side | `ApimAuthorizationService.EnsureSubscriptionForRoleAsync()` — called on `/api/auth/me`, NOT in `OnTokenValidated` |
| BFF identity: Managed Identity + custom APIM role | 🔲 BFF-side | System-assigned MI on Container App; custom role with subscription CRUD + product read only (no Contributor) |
| Register BFF as API in Entra ID (expose scope) | 🔲 Entra ID | Create App Registration, expose `Portal.Access` scope, configure known client apps |
| SPA `RoleGate` for UI enforcement | ✅ Complete | `RoleGate` component + `useAuth` — needs role names updated to Distributor/Vendor/Customer |

#### What Exists Today (Other Cross-Cutting)
| Item | Status | Notes |
|------|--------|-------|
| Auth guard (no anonymous) | ✅ Complete | `PrivateRoute` wraps all routes |
| Mobile-responsive UI | ✅ Partial | Landing page responsive; feature pages TBD |
| i18n (localization) | 🔲 Missing | No `react-i18next` installed or configured |
| Error boundary | 🔲 Missing | |
| Loading states | ✅ Partial | `LoadingScreen` for auth; need page-level loading |

#### What Needs to Be Built
| Task | Effort | Priority |
|------|--------|----------|
| Update `apiClient.ts` to inject `Authorization: Bearer <access_token>` header (use `getAccessToken()`) | S | MVP |
| Update `msalConfig.ts`: change `cacheLocation` from `'localStorage'` to `'sessionStorage'` | XS | MVP |
| Update `msalConfig.ts` / `loginRequest.scopes` to request `api://<bff-app-id>/Portal.Access` | S | MVP |
| Register BFF as API in Entra ID — expose `Portal.Access` scope + known client apps | S | MVP (Sprint 0) |
| Update `RoleGate` / `useAuth` role names from generic to Distributor/Vendor/Customer | S | MVP |
| Install and configure `react-i18next` with `en.json` + `es.json` | M | Important |
| Create `ErrorBoundary` component | S | MVP |
| Create BFF service modules in `services/` | M | MVP |
| Add page-level loading/skeleton states | S | MVP |

---

## Gap Summary Matrix

| Story Map Column | MVP Requirements | Implemented | Gap | Effort to Close |
|-----------------|------------------|-------------|-----|-----------------|
| **Foundation** | Build, auth shell (SPA) | 7/8 | 1 (Bearer header + scope + sessionStorage) | ~1.5 days |
| **Auth Flow (BFF)** | JWT validation, Global Admin role lookup, APIM authz | 0/5 | 5 (incl. Entra ID API registration) | ~2.5 weeks |
| **Discover** | 3 stories | 0/3 | 3 | ~2 weeks |
| **Understand** | 4 stories | 0/4 | 4 | ~2 weeks |
| **Integrate** | 6 stories | 0/6 | 6 | ~3 weeks |
| **Manage** | 2 stories | 0/2 | 2 | ~2 weeks |
| **Support** | 4 stories | 0/4 | 4 | ~2 weeks |
| **Cross-Cutting** | 6 requirements | 2/6 | 4 | ~1.5 weeks |
| **Admin** | 3 core features | 0/3 | 3 | ~3 weeks |
| **TOTAL** | **37** | **9** | **28** | **~17 weeks** |

---

## Recommended Build Order

Based on dependencies, BFF endpoint readiness, and user journey flow:

### Sprint 0: Auth Flow Completion (Must be first — everything depends on it)
0. **Entra ID**: Register BFF as API — expose `api://<bff-app-id>/Portal.Access` scope, add SPA as known client app
1. SPA: Update `msalConfig.ts` — change `cacheLocation` to `'sessionStorage'`, set `loginRequest.scopes` to BFF API scope
2. SPA: Update `apiClient.ts` to inject `Authorization: Bearer <access_token>` header
3. BFF: Dual JWT Bearer validation (Workforce + CIAM issuers, `aud` = BFF App ID, `scp` = `Portal.Access`)
4. BFF: `GlobalAdminRoleService` — query Global Admin with user RID for role + IMemoryCache caching (10 min TTL)
5. BFF: `ApimAuthorizationService` — deferred subscription provisioning on `/api/auth/me` (NOT in `OnTokenValidated`)
6. BFF: Managed Identity + custom APIM role (subscription CRUD + product read only)
7. SPA: Update `RoleGate` / `useAuth` role names to Distributor/Vendor/Customer

### Sprint 1–2: Discover + Understand (Foundation for everything else)
5. BFF service layer setup (`services/` modules with Bearer token injection)
6. Catalog page (`/catalog`) → Browse by category → Search with filters
7. API detail page (`/catalog/:category/:apiSlug`) → Docs, use cases, pricing

### Sprint 3–4: Integrate (Highest user value)
8. Subscription flow (`/subscribe/:apiSlug`) — Distributor/Vendor roles only
9. Try-It console (`widgets/tryit/`) — Distributor/Vendor roles only
10. Credential display + quota visibility

### Sprint 5–6: Manage + Support
11. Dashboard (`/dashboard`) → Subscriptions, credentials, usage (role-based views)
12. User profile (`/profile`)
13. Support hub (`/support`) → Tickets, KB, contact

### Sprint 7–8: Admin + Cross-Cutting
14. Admin panel (`/admin`) → Content, users (wrapped with `RoleGate roles={['Admin']}`)
15. i18n setup (English + Spanish)
16. Error boundary, loading skeletons, responsive polish

### Post-MVP
- Tagging system, favorites, recommendations
- Auto-generated client libraries
- Webhooks / event-driven integrations
- API comparison tool
- AI support assistant
- Community forum
- Video tutorials

---

## Existing Assets That Accelerate Development

| Asset | Location | Reuse Opportunity |
|-------|----------|-------------------|
| `@komatsu-nagm/component-library` | `PageCard`, `ApplicationCard`, `ContextGroup`, `Button` | Catalog cards, dashboard cards, all CTAs |
| `ApiClient` | `src/lib/apiClient.ts` | Extend with Bearer token for all BFF calls |
| `RoleGate` | `src/widgets/auth/RoleGate.tsx` | Wrap admin routes immediately |
| `useAuth` + `AuthProvider` | `src/widgets/auth/` | Already provides `roles`, `account`, `getAccessToken` |
| `QueryClient` | `src/app/main.tsx` | Already configured — just add query hooks per feature |
| `Zustand store` | `src/lib/store.ts` | Extend for UI state (filters, selected API, etc.) |
| Landing page data model | `src/routes/sections/home/types.ts` | Reuse `ApiCategory`, `PopularApi` types for real catalog |
| MSW test server | `src/tests/testServer.ts` | Add BFF endpoint mocks for all feature tests |
| Static landing content | `src/routes/sections/home/data.ts` | 6 API categories + 6 popular APIs ready to link to real catalog |
