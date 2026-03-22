# POC Gap Analysis — Codebase vs. Design Requirements

| | |
|---|---|
| **Repository** | `hqvu1/apim-dev-custom` (branch: `main`) |
| **Date** | July 2025 |
| **Sources** | Codebase audit, `DESIGN_DOCUMENT.md`, `STORY_MAPPING_GAP_ANALYSIS.md`, `GAP_FROM_DESIGN_DOC_WITH_SPEC.md` |
| **Scope** | React SPA (`src/`) + .NET 10 BFF (`bff-dotnet/BffApi/`) + test coverage + infrastructure |

---

## Executive Summary

The POC has advanced **significantly** beyond what the earlier `STORY_MAPPING_GAP_ANALYSIS.md` documented. Most "🔲 Not Started" items from that document are now implemented as working pages with real BFF API calls. However, they are **POC-quality implementations** — mock/in-memory data, no downstream integrations, limited validation, and no persistence. The primary gaps fall into four categories:

| Category | Gap Count | Severity |
|---|---|---|
| **BFF → Downstream Integrations** (real services) | 6 | 🔴 Critical |
| **Data Persistence & State** | 4 | 🔴 Critical |
| **Production Auth Hardening** | 5 | 🟠 High |
| **Feature Completeness** (UI depth) | 8 | 🟡 Medium |
| **Operational Readiness** | 6 | 🟡 Medium |
| **Test Coverage Gaps** | 4 | 🟢 Low-Medium |

---

## 1. BFF → Downstream Integration Gaps (🔴 Critical)

These are the most critical gaps. The BFF endpoints exist and return data, but they use **mock/in-memory data** instead of calling real downstream services.

### 1.1 Support Endpoints → ServiceNow / ASK

| Item | Current State | Required State |
|---|---|---|
| `SupportEndpoints.cs` | Static `MockFaqs` array, in-memory `TicketStore` list | Real ServiceNow/ASK API integration |
| FAQ data | 5 hardcoded strings | CMS-driven or ServiceNow KB articles |
| Ticket persistence | `List<SupportTicket>` — lost on restart | ServiceNow incident CRUD via REST API |
| Ticket filtering by user | Returns ALL tickets (comment: "production: filter by user identity") | Filter by authenticated user's identity |

**Missing implementation:**
- `ITicketService` interface and `ServiceNowTicketService` implementation
- ServiceNow REST API client with authentication (OAuth or API key)
- Ticket status mapping (ServiceNow states ↔ portal states)
- Error handling and retry for ticket operations

### 1.2 Registration Endpoints → Global Admin Provisioning

| Item | Current State | Required State |
|---|---|---|
| `RegistrationEndpoints.cs` | In-memory `RegistrationStore` list, `_regCounter` | Real approval queue (database or Global Admin API) |
| `POST /registration` | Stores in-memory, returns immediately | Submit to approval workflow (Logic Apps or Global Admin queue) |
| `GET /registration/status` | Returns last in-memory registration | Query actual approval status from workflow engine |
| Approval → role assignment | Not implemented | On approval: call Global Admin API to assign role → trigger APIM subscription provisioning |

**Missing implementation:**
- Registration persistence (database table or queue)
- Approval workflow integration (Logic Apps / Global Admin API)
- Registration-to-role-assignment lifecycle
- Admin notification when new registrations arrive
- Rejection/denial flow with reason

### 1.3 Admin Endpoints → Real Data Sources

| Item | Current State | Required State |
|---|---|---|
| `AdminEndpoints.cs` | `MockRegistrations` static list, mock metrics | Database/API-backed registration queue |
| `POST /admin/registrations/{id}/approve` | Mutates in-memory list | Calls Global Admin to provision user → assigns APIM subscription |
| `GET /admin/metrics` | Mock `AdminMetric[]` with hardcoded values | Real-time metrics from APIM / Application Insights |
| User management | Not implemented | List/search/deactivate users via Global Admin API |

### 1.4 News Endpoints → AEM CMS

| Item | Current State | Required State |
|---|---|---|
| `NewsEndpoints` in `MiscEndpoints.cs` | Static `NewsItem[]` hardcoded | AEM Content API integration |
| Content authoring | Not possible | AEM authoring workflow → BFF `AemContentService` |
| Content caching | None | Cache with configurable TTL, fallback on AEM unavailability |
| Localized content | Not implemented | AEM locale-specific content delivery |

### 1.5 Global Admin Role Provider → Production Integration

| Item | Current State | Required State |
|---|---|---|
| `GlobalAdminRoleProvider.cs` | Implementation exists with `IMemoryCache` | Verified against real Global Admin API |
| API key configuration | Empty string in `appsettings.json` | Configured with real `Ocp-Apim-Subscription-Key` |
| Error handling | Basic try/catch | Retry policy, circuit breaker, fallback behavior |
| Role mapping | Hardcoded role names | Validated against actual Global Admin role schema |

### 1.6 APIM Subscription Provisioning (Deferred)

| Item | Current State | Required State |
|---|---|---|
| `ApimAuthorizationService` | Referenced in docs, not found in codebase | Implement `EnsureSubscriptionForRoleAsync()` |
| Trigger point | Documented as `/api/auth/me` | Create `/api/auth/me` endpoint that provisions on first visit |
| APIM identity | `ServicePrincipal` config in appsettings (empty) | System-assigned Managed Identity on Container App |

---

## 2. Data Persistence & State Gaps (🔴 Critical)

### 2.1 No Database Layer

The entire BFF operates **statelessly** with in-memory data structures:

| Endpoint | Storage Mechanism | Problem |
|---|---|---|
| Support tickets | `static List<SupportTicket>` | Lost on app restart |
| Registrations | `static List<RegistrationRequest>` | Lost on app restart |
| Admin registrations | `static List<RegistrationRequest>` (separate copy) | Not shared with Registration endpoint |
| Mock APIs | `static ApiContract[]` | Not extensible |
| Ticket counter | `static int _ticketCounter` | Resets on restart, not thread-safe across instances |
| Registration counter | `static int _regCounter` | Same issue |

**What's needed:** Either a database (SQL/Cosmos DB) or integration with external systems that own the data (ServiceNow, Global Admin). For MVP, at minimum a lightweight persistence layer (SQLite + EF Core, or Azure Table Storage).

### 2.2 Dual Mock Data Sources in SPA

The SPA has **two parallel API client patterns** that will cause confusion:

| Client | File | Purpose | Status |
|---|---|---|---|
| `usePortalApi()` | `src/api/client.ts` | BFF proxy client (`/api/*`) | ✅ Primary — used by most pages |
| `useMapiClient()` | `src/api/mapiClient.ts` | Direct ARM Management API calls | ⚠️ Bypasses BFF entirely |
| `useApimClient()` | `src/api/apimClient.ts` | Wrapper around `useMapiClient` | ⚠️ Used by `ApiTryIt.tsx` |
| `useApiService()` | `src/api/apiService.ts` | Another wrapper around `useMapiClient` | ⚠️ Ported from APIM reference portal |

**Problem:** `ApiTryIt.tsx` uses `useApimClient()` which calls ARM directly from the browser, bypassing the BFF. This violates the security architecture (no APIM keys in browser). The `mapiClient.ts` and `apimClient.ts` should be removed or refactored to go through the BFF.

### 2.3 Mock Data Fallback in SPA

`ApiCatalog.tsx` falls back to `apiCatalog` from `mockData.ts` when the BFF call fails. This is fine for development, but there's no clear toggle or feature flag to disable this in production, risking stale/fake data leaking to users.

---

## 3. Production Auth Hardening Gaps (🟠 High)

### 3.1 SPA Auth Configuration

| Item | Current Code | Required | File |
|---|---|---|---|
| Token cache location | Needs verification | `sessionStorage` (not `localStorage`) | `src/auth/msalConfig.ts` |
| Login scopes | Needs verification | `api://<bff-app-id>/Portal.Access` | `src/auth/msalConfig.ts` |
| Bearer token injection | `usePortalApi()` in `client.ts` calls `getAccessToken()` | ✅ Appears wired | `src/api/client.ts` |
| Role names in `RoleGate` | `["Admin", "GlobalAdmin"]` | Should include `Distributor`, `Vendor`, `Customer` | `src/App.tsx` |

### 3.2 BFF Auth Configuration

| Item | Current Code | Required |
|---|---|---|
| `EntraId:TenantId` | Empty in `appsettings.json` | Configured for workforce tenant |
| `EntraId:ClientId` | Empty in `appsettings.json` | BFF's Entra app registration client ID |
| `EntraId:ValidIssuers` | Empty array | Both workforce and CIAM issuers |
| Dev fallback in production | `OnMessageReceived` creates synthetic identity when no auth header | Must be disabled in production |
| `ServicePrincipal` credentials | All empty | Configured or replaced with Managed Identity |

### 3.3 Development-Mode Auth Bypass

The `Program.cs` has **multiple development fallback paths** that auto-authenticate requests without tokens:

1. **Mock mode** (lines ~75-100): `SignatureValidator` accepts any token, `OnMessageReceived` creates mock Admin principal
2. **Non-mock dev** (lines ~195-210): `OnMessageReceived` creates synthetic dev identity when no auth header

These are appropriate for local dev but must be **verified to be unreachable in production**. The guard is `builder.Environment.IsDevelopment()` — this is safe if `ASPNETCORE_ENVIRONMENT` is correctly set in deployment.

### 3.4 Missing `/api/auth/me` Endpoint

The design documents reference a `/api/auth/me` endpoint that:
- Returns the current user's profile, roles, and subscription status
- Triggers deferred APIM subscription provisioning
- Serves as the "session initialization" call

This endpoint does not exist. `UserEndpoints` in `MiscEndpoints.cs` has a `/api/users/me` endpoint, but it only returns token claims — it does not provision subscriptions or query Global Admin.

### 3.5 RBAC Policy Gaps

| Policy | Defined | Used By | Status |
|---|---|---|---|
| `ApiRead` | ✅ | APIs, Products, Tags, Stats | Working |
| `ApiSubscribe` | ✅ | Subscription create/update/delete | Working |
| `ApiManage` | ✅ | Admin endpoints | Working |
| `ApiTryIt` | Referenced in `Program.cs` comments | Not used by any endpoint | ⚠️ Unused |
| Per-API RBAC | `rbac-policies.json` supports it | Wired in `ApisEndpoints.cs` | ✅ Working |

---

## 4. Feature Completeness Gaps (🟡 Medium)

These features have UI pages but are **shallow implementations** lacking depth for production.

### 4.1 API Catalog (`ApiCatalog.tsx`)

| Feature | Status | Gap |
|---|---|---|
| List APIs from BFF | ✅ Working | — |
| Search by text | ✅ Working | Client-side only; no server-side search |
| Filter by category | ✅ Working | Categories derived from data; not from taxonomy |
| Filter by plan | ✅ UI exists | Not connected to BFF product data |
| Pagination | 🔲 Missing | No pagination UI; BFF supports `$top/$skip` |
| Tag-based filtering | 🔲 Missing | BFF has `/api/tags` endpoint; SPA doesn't use it |

### 4.2 API Details (`ApiDetails.tsx`)

| Feature | Status | Gap |
|---|---|---|
| API metadata display | ✅ Working | — |
| Operations list with method badges | ✅ Working | — |
| Subscribe button | ✅ UI exists | Navigates to BFF; no subscription flow UX |
| Pricing / SLA section | 🔲 Missing | No pricing data model or display |
| Changelog | 🔲 Missing | No changelog endpoint or UI |
| Related APIs / recommendations | 🔲 Missing | — |

### 4.3 Try-It Console (`ApiTryIt.tsx`)

| Feature | Status | Gap |
|---|---|---|
| Swagger UI embed | ✅ Working | — |
| Spec loading | ⚠️ Uses `useApimClient` | **Bypasses BFF** — calls ARM directly |
| Token injection | 🔲 Missing | Swagger UI doesn't inject user's token for sandbox calls |
| Sandbox environment | 🔲 Missing | No isolated sandbox; calls real APIs |

### 4.4 My Integrations (`MyIntegrations.tsx`)

| Feature | Status | Gap |
|---|---|---|
| List subscriptions | ✅ Working | Basic card display |
| Credential display (Client ID / Secret) | 🔲 Missing | No credential reveal UI |
| Key rotation | 🔲 Missing | BFF has `POST /subscriptions/{id}/secrets`; UI doesn't call it |
| Usage statistics | 🔲 Missing | No usage/quota data |
| Cancel subscription | 🔲 Missing | No cancel button or confirmation flow |

### 4.5 Support (`Support.tsx`)

| Feature | Status | Gap |
|---|---|---|
| FAQ list | ✅ Working | Mock data only |
| Create ticket form | ✅ Working | Basic form; no field validation |
| Ticket list | ✅ Working | Shows all tickets; no user filtering |
| Ticket detail view | 🔲 Missing | No drill-down to individual ticket |
| Ticket status updates | 🔲 Missing | No real-time status from ServiceNow |
| Knowledge base search | 🔲 Missing | FAQs are flat list; no search |

### 4.6 Admin (`Admin.tsx`)

| Feature | Status | Gap |
|---|---|---|
| Pending registrations list | ✅ Working | Mock data |
| Approve / reject buttons | ✅ Working | Mock — no downstream effect |
| Metrics dashboard | ✅ Working | Mock values |
| User management (list/search/deactivate) | 🔲 Missing | — |
| Content management (AEM CMS bridge) | 🔲 Missing | — |
| API onboarding management | 🔲 Missing | — |

### 4.7 Registration (`Register.tsx`)

| Feature | Status | Gap |
|---|---|---|
| Dynamic form fields from BFF | ✅ Working | — |
| Form submission | ✅ Working | No client-side validation |
| Form state management | 🔲 Missing | No form state; TextField values not captured |
| Success/error feedback | 🔲 Missing | `post()` called but result not handled |
| File upload (business docs) | 🔲 Missing | — |

### 4.8 Onboarding (`Onboarding.tsx`)

| Feature | Status | Needs verification |
|---|---|---|
| Onboarding steps/wizard | Needs review | File exists but not examined in detail |
| Status check from BFF | Needs review | Route exists at `/profile/onboarding` |

---

## 5. Operational Readiness Gaps (🟡 Medium)

### 5.1 Infrastructure & Deployment

| Item | Status | Gap |
|---|---|---|
| `Dockerfile` for BFF | 🔲 Missing | No container definition |
| `docker-compose.yml` | 🔲 Missing | No local multi-service orchestration |
| Azure deployment (Bicep/Terraform) | `azure/` directory exists | Needs verification of contents |
| CI/CD pipeline | `.github/workflows/` exists | Needs verification of contents |
| Environment configuration | `appsettings.json` with empty values | No `appsettings.Production.json` or Key Vault references |
| Health checks | ✅ `/health` endpoint exists | Liveness only; no readiness (DB, APIM, Global Admin) |

### 5.2 Logging & Monitoring

| Item | Status | Gap |
|---|---|---|
| Structured logging | ✅ `RequestLoggingMiddleware` exists | — |
| Application Insights | 🔲 Missing | No `AddApplicationInsightsTelemetry()` |
| Distributed tracing | 🔲 Missing | No OpenTelemetry or correlation headers |
| Error tracking | 🔲 Missing | No Sentry, App Insights exceptions, or error aggregation |

### 5.3 Security Headers

| Item | Status | Gap |
|---|---|---|
| Security headers middleware | Referenced in `Program.cs` | Needs verification of CSP, HSTS, X-Frame-Options |
| CORS | ✅ Configured for Nginx proxy | — |
| Rate limiting | 🔲 Missing | No `System.Threading.RateLimiting` middleware |

### 5.4 Documentation Gaps

| Document | Status |
|---|---|
| `DESIGN_DOCUMENT.md` | ✅ Exists |
| Operational runbook | 🔲 Missing |
| SOC 2 controls mapping | 🔲 Missing |
| GDPR data flow diagram | 🔲 Missing |
| Per-API onboarding docs | 🔲 Missing |
| AMS team knowledge transfer | 🔲 Missing |

---

## 6. Test Coverage Gaps (🟢 Low-Medium)

### 6.1 SPA Tests

| Area | Test Files Found | Coverage |
|---|---|---|
| Pages (unit) | `*.test.tsx` for all pages | ✅ Good — each page has a test file |
| Components (unit) | `*.test.tsx` for all components | ✅ Good |
| API client | `client.test.ts`, `client.apimCatalog.test.ts` | ✅ Exists |
| Types | `types.test.ts` | ✅ Exists |
| Hooks | `useApiData.test.ts`, `useBffHealth.test.ts` | ✅ Exists |
| Auth | `AuthProvider.test.tsx`, `getAccessToken.test.ts` | ✅ Exists |
| i18n | `i18n.test.ts` | ✅ Exists |
| E2E / integration | 🔲 Missing | No Playwright tests found |

### 6.2 BFF Tests

| Area | Test Files Found | Coverage |
|---|---|---|
| API endpoints | `ApisEndpointsTests.cs`, `SubscriptionsEndpointsTests.cs`, `MiscEndpointsTests.cs` | ✅ Core endpoints covered |
| Authorization | `ApiAccessHandlerTests.cs`, `RbacPolicyProviderTests.cs` | ✅ RBAC covered |
| Middleware | `MiddlewareTests.cs` | ✅ Exists |
| Portal endpoints | `PortalEndpointsTests.cs` | ✅ Exists |
| Services (unit) | 🔲 Missing | No `ArmApiServiceTests`, `DataApiServiceTests`, `GlobalAdminRoleProviderTests` |
| Integration tests | `BffWebApplicationFactory.cs` exists | ⚠️ Partial — factory exists but needs verification |
| Support/Registration/Admin endpoints | 🔲 Missing | No test files for these endpoint groups |

---

## 7. Architecture Concerns

### 7.1 Dual API Client Anti-Pattern (SPA)

```
src/api/
├── client.ts          ← BFF proxy client (PRIMARY — correct pattern)
├── mapiClient.ts      ← Direct ARM API calls (BYPASSES BFF — security risk)
├── apimClient.ts      ← Wrapper around mapiClient (BYPASSES BFF)
├── apiService.ts      ← Wrapper around mapiClient (BYPASSES BFF)
├── productService.ts  ← Unknown dependency
├── userService.ts     ← Unknown dependency
└── services.ts        ← Unknown dependency
```

**Risk:** Three of the six API modules bypass the BFF and call Azure ARM directly from the browser. This:
- Exposes APIM management credentials to the client
- Breaks the BFF security boundary
- Creates two sources of truth for API data

**Recommendation:** Remove `mapiClient.ts`, `apimClient.ts`, `apiService.ts` and route all API calls through `client.ts` → BFF.

### 7.2 Mock Mode Bleed

`MockApiService` is registered when `UseMockMode=true` in Development. However, the SPA also has its own mock fallback (`mockData.ts` import in `ApiCatalog.tsx`). There are effectively **three layers of mocking**:

1. BFF `MockApiService` (when `UseMockMode=true`)
2. BFF endpoint-level mocks (in-memory lists in `SupportEndpoints`, `AdminEndpoints`, `RegistrationEndpoints`)
3. SPA fallback to `mockData.ts` on BFF error

This makes it difficult to know which layer is providing data during development.

### 7.3 Admin and Registration Data Isolation

`AdminEndpoints.cs` has its own `MockRegistrations` static list that is **separate** from `RegistrationEndpoints.cs`'s `RegistrationStore`. A registration submitted via the Register page will not appear in the Admin panel, and vice versa. This is a data isolation bug even in POC mode.

---

## 8. Priority Remediation Roadmap

### Phase 1: Foundation Fixes (1–2 weeks)

| # | Task | Severity |
|---|---|---|
| 1 | Remove `mapiClient.ts` / `apimClient.ts` / `apiService.ts`; route `ApiTryIt.tsx` through BFF `/api/apis/{id}/openapi` | 🔴 Critical |
| 2 | Fix Admin ↔ Registration data isolation (shared store or database) | 🔴 Critical |
| 3 | Configure real `EntraId` settings in `appsettings.json` (or Key Vault) | 🟠 High |
| 4 | Verify SPA `msalConfig.ts` uses `sessionStorage` and BFF API scope | 🟠 High |
| 5 | Add `/api/auth/me` endpoint for session initialization + subscription provisioning | 🟠 High |

### Phase 2: Downstream Integrations (4–6 weeks)

| # | Task | Severity |
|---|---|---|
| 6 | Implement `ServiceNowTicketService` for Support endpoints | 🔴 Critical |
| 7 | Implement registration persistence + approval workflow | 🔴 Critical |
| 8 | Connect Global Admin role provider with real API credentials | 🔴 Critical |
| 9 | Implement `ApimAuthorizationService.EnsureSubscriptionForRoleAsync()` | 🔴 Critical |
| 10 | Implement AEM content service for News + dynamic content | 🟠 High |

### Phase 3: Feature Depth (3–4 weeks)

| # | Task | Severity |
|---|---|---|
| 11 | Add pagination to API Catalog (server-side `$top/$skip`) | 🟡 Medium |
| 12 | Build credential management UI in My Integrations (reveal, rotate, revoke) | 🟡 Medium |
| 13 | Add form validation and state management to Register page | 🟡 Medium |
| 14 | Add ticket detail view and status tracking to Support | 🟡 Medium |
| 15 | Build user management section in Admin panel | 🟡 Medium |

### Phase 4: Operational Readiness (2–3 weeks)

| # | Task | Severity |
|---|---|---|
| 16 | Add Dockerfile for BFF + docker-compose for local development | 🟡 Medium |
| 17 | Add Application Insights telemetry to BFF | 🟡 Medium |
| 18 | Add rate limiting middleware | 🟡 Medium |
| 19 | Write BFF service-layer unit tests (ArmApiService, DataApiService, GlobalAdminRoleProvider) | 🟢 Low |
| 20 | Write endpoint tests for Support, Registration, Admin endpoints | 🟢 Low |
| 21 | Create operational runbook | 🟡 Medium |

---

## Appendix: File Inventory

### SPA Pages (all have corresponding `.test.tsx` files)

| Page | Route | BFF Integration | i18n |
|---|---|---|---|
| `Home` | `/` | `GET /apis/highlights`, `GET /stats` | ✅ |
| `ApiCatalog` | `/apis` | `GET /apis` | ✅ |
| `ApiDetails` | `/apis/:apiId` | `GET /apis/{id}`, `GET /apis/{id}/operations` | ✅ |
| `ApiTryIt` | `/apis/:apiId/try` | ⚠️ Direct ARM via `apimClient` | ✅ |
| `Register` | `/register` | `GET /registration/config`, `POST /registration` | ✅ |
| `Onboarding` | `/profile/onboarding` | `GET /registration/status` | ✅ |
| `MyIntegrations` | `/my/integrations` | `GET /users/me/subscriptions` | ✅ |
| `Support` | `/support` | `GET /support/faqs`, `POST /support/tickets`, `GET /support/my-tickets` | ✅ |
| `News` | `/news` | `GET /news` | ✅ |
| `Admin` | `/admin` | `GET /admin/registrations`, `POST /admin/.../approve\|reject`, `GET /admin/metrics` | ✅ |

### BFF Endpoints

| Route Group | File | Auth Policy | Downstream |
|---|---|---|---|
| `/api/apis/*` | `ApisEndpoints.cs` | `ApiRead` | ARM/Data API via `IArmApiService` |
| `/api/products/*` | `ProductsEndpoints.cs` | `ApiRead` | ARM/Data API |
| `/api/subscriptions/*` | `SubscriptionsEndpoints.cs` | `ApiRead` / `ApiSubscribe` | ARM/Data API |
| `/api/tags/*` | `MiscEndpoints.cs` | `ApiRead` | ARM/Data API |
| `/api/stats` | `MiscEndpoints.cs` | `ApiRead` | ARM/Data API |
| `/api/news` | `MiscEndpoints.cs` | `ApiRead` | **Mock only** |
| `/api/users/me` | `MiscEndpoints.cs` | `RequireAuthorization` | JWT claims only |
| `/api/support/*` | `SupportEndpoints.cs` | `RequireAuthorization` | **Mock only** |
| `/api/registration/*` | `RegistrationEndpoints.cs` | `RequireAuthorization` | **Mock only** |
| `/api/admin/*` | `AdminEndpoints.cs` | `ApiManage` | **Mock only** |
| `/health` | `MiscEndpoints.cs` | Anonymous | Liveness only |

---

*Generated from full codebase audit of `apim-dev-custom` repository — July 2025.*
