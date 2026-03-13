# API Marketplace Story Mapping → Full-Stack Gap Analysis

> **Source:** Whiteboard export — "API Marketplace Story Mapping" (Henry Granadosramos)
> **Generated:** Auto-mapped against `bff-dotnet` (BFF) + `src/` (SPA) codebases
> **Personas:** Dealer Distributor · Komatsu Customer · Vendor
> **Branch:** `UpdateWithNewClientApp`

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Layer fully implements the story |
| ⚠️ Partial | Code exists but incomplete for the story |
| 🔲 Gap | No implementation — work required |
| — | Not applicable for this layer |

---

## SPA Inventory (pages & components found)

| Page / Component | Route | SPA File | Purpose |
|---|---|---|---|
| Home | `/` | `src/pages/home/index.tsx` | Hero, stats, highlights, quick actions |
| API Catalog | `/apis` | `src/pages/ApiCatalog.tsx` | Search, filter by category/plan, ApiCard grid |
| API Details | `/apis/:apiId` | `src/pages/ApiDetails.tsx` | Operations table, plans, subscribe button, "Open Try-It" link |
| API Try-It | `/apis/:apiId/try` | `src/pages/ApiTryIt.tsx` | Request builder, operation list, response viewer |
| My Integrations | `/my/integrations` | `src/pages/MyIntegrations.tsx` | Subscription list, quota display, "Manage" button |
| Support | `/support` | `src/pages/Support.tsx` | FAQs tab, Create Ticket tab, My Tickets tab |
| News | `/news` | `src/pages/News.tsx` | News feed from BFF `/news` |
| Admin | `/admin` | `src/pages/Admin.tsx` | Pending registrations, metrics, approve/reject |
| Register | `/register` | `src/pages/Register.tsx` | Dynamic registration form, Logic Apps submission |
| Onboarding | `/onboarding` | `src/pages/Onboarding.tsx` | Stepper: Submitted → Under Review → Approved → Access Enabled |
| Access Denied | `/access-denied` | `src/pages/AccessDenied.tsx` | Role gate error page |
| RoleGate | (component) | `src/components/RoleGate.tsx` | UX-level RBAC gate (`roles` prop) |
| SideNav | (component) | `src/components/SideNav.tsx` | Role-filtered nav: Home, APIs, Integrations, Support, News, Admin |
| i18n | — | `src/i18n/en.json`, `es.json` | English + Spanish translations |
| Auth / RBAC | — | `src/auth/permissions.ts`, `useAuth.ts` | `Permission` enum, `AppRole` type, client-side policy map |
| API Client | — | `src/api/client.ts` | `usePortalApi` (raw), `useApimCatalog` (typed), retry with backoff |

---

## 1 — DISCOVER (Browse & Search the API Catalog)

| # | Story | Priority | BFF | SPA | BFF Endpoint | SPA File | Gap Notes |
|---|-------|----------|-----|-----|-------------|----------|-----------|
| D1 | Browse APIs by category | Must Have | ✅ | ✅ | `GET /api/apis?filter=` | `ApiCatalog.tsx` — category dropdown, client-side filter | **Done.** SPA computes categories from data; could use server-side `$filter` for perf |
| D2 | Search APIs with filters (region, system, data type) | Must Have | ✅ | ⚠️ | `GET /api/apis?filter=&top=&skip=` | `ApiCatalog.tsx` — search + category + plan | SPA has name/description/path search + category + plan. **Missing:** region, system, data type filters |
| D3 | API listing with brief descriptions | Must Have | ✅ | ✅ | `GET /api/apis` → `ApiContract.Description` | `ApiCatalog.tsx` → `ApiCard.tsx` | **Done.** Card shows name, description, status, category |
| D4 | Tagging system for APIs | Must Have | ✅ | ⚠️ | `GET /api/tags`, `GET /api/apisByTags` | `ApiCatalog.tsx` | BFF has tags endpoints. **SPA does not use `/tags` yet** — filters by category/plan only, no tag chips |
| D5 | Featured APIs / curated collections | Must Have | ✅ | ✅ | `GET /api/apis/highlights` | `home/index.tsx` — fetches `/apis/highlights` | **Done.** Homepage shows top 3 API highlights |
| D6 | Save/favorite APIs for quick access | Nice to Have | 🔲 | 🔲 | — | — | Needs user-preferences store + `POST /api/users/me/favorites` + SPA favorites list |
| D7 | Personalized recommendations | Nice to Have | 🔲 | 🔲 | — | — | Requires analytics/ML pipeline; out of MVP |
| D8 | Trending APIs dashboard | Nice to Have | ⚠️ | ⚠️ | `GET /api/stats` | `home/index.tsx` — `StatCard` | Stats has counts but no trending/time-series. SPA shows flat stat cards |
| D9 | API comparison tool | Nice to Have | 🔲 | 🔲 | — | — | Multi-API detail fetch + SPA diff UI |
| D10 | Target Advertising / Social Media | Nice to Have | — | 🔲 | — | — | Marketing concern; purely external |

---

## 2 — UNDERSTAND (View Documentation & Use Cases)

| # | Story | Priority | BFF | SPA | BFF Endpoint | SPA File | Gap Notes |
|---|-------|----------|-----|-----|-------------|----------|-----------|
| U1 | View API documentation | Must Have | ✅ | ✅ | `GET /api/apis/{apiId}/operations`, `…/operations/{opId}` | `ApiDetails.tsx` — operations table with method badges, URL, description | **Done.** Full operation detail rendered |
| U2 | View API use cases or examples | Must Have | ⚠️ | ⚠️ | `GET /api/apis/{apiId}` → `description` | `ApiDetails.tsx` — overview section | Only renders `description` field. **No dedicated use-case content model** |
| U3 | View API use case | Must Have | ⚠️ | ⚠️ | Same as U2 | Same as U2 | Duplicate of U2 in whiteboard |
| U4 | Value message / Pricing | Important | 🔲 | ⚠️ | — | `ApiDetails.tsx` — "Available Plans" section | SPA renders plans (name, quota, notes) from products. **BFF has no pricing/SLA fields** |
| U5 | Interactive API console (try it) | Should Have | ✅ | ✅ | `GET /api/apis/{apiId}/openapi` | `ApiTryIt.tsx` — request builder, operation list, response pane | **Done.** Both BFF (OpenAPI export + `ApiTryIt` RBAC) and SPA (Try-It page) exist. SPA could use actual OpenAPI spec for dynamic forms |
| U6 | SDKs or code snippets | Could Have | 🔲 | 🔲 | — | — | Requires AutoRest/Kiota integration |
| U7 | Version history and changelog | Should Have | ✅ | 🔲 | `GET /api/apis/{apiId}/releases` | — | **BFF done; SPA missing.** No changelog UI in `ApiDetails.tsx` |
| U8 | Video tutorials | Could Have (Later) | — | 🔲 | — | — | Static content / CMS; no implementation anywhere |

---

## 3 — INTEGRATE (Subscribe & Connect)

| # | Story | Priority | BFF | SPA | BFF Endpoint | SPA File | Gap Notes |
|---|-------|----------|-----|-----|-------------|----------|-----------|
| I1 | Select and subscribe to APIs | Must Have | ✅ | ✅ | `POST /api/subscriptions` | `ApiDetails.tsx` — "Request access" button → `post('/apis/{apiId}/subscription')` | **Done.** `useApimCatalog.createSubscription` exists too |
| I2 | Generate client credentials | Must Have | ✅ | ⚠️ | `POST /api/subscriptions/{subId}/secrets` | `MyIntegrations.tsx` — shows quota but **no "View Keys" button** | BFF exposes secrets endpoint. **SPA doesn't call it** |
| I3 | Auto-generated client credentials | Must Have | ✅ | ✅ | `POST /api/subscriptions` auto-provisions | — | Keys created on subscription creation via BFF |
| I4 | View Client ID and secret | Must Have | ✅ | 🔲 | `GET /api/subscriptions/{subId}`, `POST …/secrets` | `MyIntegrations.tsx` | **SPA has no key reveal UI.** BFF endpoints exist |
| I5 | Sandbox environment for testing | Important | ⚠️ | ✅ | `GET /api/apis/{apiId}/openapi` + `ApiTryIt` | `ApiTryIt.tsx` | SPA has Try-It console; BFF exports spec. **True isolated sandbox needs APIM gateway config** |
| I6 | Integration guides (Postman, Swagger) | Important | ⚠️ | ⚠️ | `GET /api/apis/{apiId}/openapi?format=swagger-link` | `ApiDetails.tsx` — "Export OpenAPI spec" link | OpenAPI export works. **No dedicated integration guide content** |
| I7 | Rate limit and quota visibility | Must Have | ⚠️ | ⚠️ | `GET /api/products/{productId}` | `MyIntegrations.tsx` — shows "Quota: {item.quota}" | SPA shows quota text. **BFF `ProductContract` lacks `rateLimit`/`quotaLimit` fields** |
| I8 | SLA | Important | 🔲 | 🔲 | — | — | No SLA model anywhere |
| I9 | Auto-generated client libraries | Could Have | 🔲 | 🔲 | — | — | Requires code-gen pipeline |
| I10 | Webhooks / event-driven integration | Could Have | 🔲 | 🔲 | — | — | APIM supports Event Grid; no endpoints |
| I11 | API dependency graph | Could Have | 🔲 | 🔲 | — | — | Needs relationship metadata |
| I12 | Unsubscribe to API | Must Have | ✅ | ✅ | `DELETE /api/subscriptions/{subId}` | `useApimCatalog.cancelSubscription` | **Done.** |

---

## 4 — MANAGE (Credentials, Users, Support)

| # | Story | Priority | BFF | SPA | BFF Endpoint | SPA File | Gap Notes |
|---|-------|----------|-----|-----|-------------|----------|-----------|
| M1 | Manage credentials (rotate keys) | Must Have | ✅ | 🔲 | `POST …/regeneratePrimaryKey`, `…/regenerateSecondaryKey` | `MyIntegrations.tsx` — "Manage" button exists but **no key rotation UI** | **BFF done; SPA missing rotate/revoke actions** |
| M2 | Assign roles and permissions | Must Have | ⚠️ | ⚠️ | RBAC via `rbac-policies.json` + `ApiAccessHandler` | `RoleGate.tsx`, `permissions.ts` | Policy-based RBAC exists. **No admin UI to manage assignments at runtime** |
| M3 | Add/edit/update user profiles | Important | 🔲 | 🔲 | `GET /api/users/me` (read-only) | — | Read from MSAL token only; **no profile CRUD** |
| M4 | Self-serve support / Request assistance | Important | 🔲 | ✅ | — | `Support.tsx` — FAQs tab, Create Ticket, My Tickets | **SPA UI built; BFF missing.** SPA calls `GET /support/faqs`, `POST /support/tickets`, `GET /support/my-tickets` — none exist in BFF |
| M5 | Submit support tickets | Important | 🔲 | ✅ | — | `Support.tsx` — "Submit ticket" form with Category, API, Impact, Description | **SPA UI built; BFF endpoint `POST /support/tickets` missing** |
| M6 | Support ticket tracking | Important | 🔲 | ✅ | — | `Support.tsx` — "My Tickets" tab rendering id/subject/status | **SPA UI built; BFF endpoint `GET /support/my-tickets` missing** |
| M7 | Knowledge base / search | Should Have | 🔲 | ⚠️ | — | `Support.tsx` — FAQs tab (calls `GET /support/faqs`) | SPA has FAQ display. **BFF endpoint missing; SPA gets empty result** |
| M8 | Email/phone contact options | Should Have | — | 🔲 | — | — | No static contact info in SPA footer/support page |
| M9 | Audit logs for API usage | Should Have | 🔲 | 🔲 | — | — | APIM has analytics; no proxy endpoint |
| M10 | Alerts for unusual activity | Should Have | 🔲 | 🔲 | — | — | Azure Monitor integration needed |
| M11 | Schedule technical demos | Could Have | 🔲 | 🔲 | — | — | External scheduling integration |
| M12 | Support SLAs and escalation | Could Have | 🔲 | 🔲 | — | — | ITSM integration |
| M13 | Update subscriptions (rename/cancel) | Must Have | ✅ | ⚠️ | `PATCH /api/subscriptions/{subId}` | `MyIntegrations.tsx` — "Manage" button | BFF supports PATCH. **SPA "Manage" button has no action wired** |

---

## 5 — HOLISTIC / CROSS-CUTTING

| # | Story | Priority | BFF | SPA | Notes |
|---|-------|----------|-----|-----|-------|
| H1 | Unified SSO authentication | Must Have | ✅ | ✅ | BFF: JWT Bearer + Entra ID + CIAM multi-tenant. SPA: MSAL `AuthProvider` + `useAuth` + `PrivateRoute` |
| H2 | Enterprise-grade security | Must Have | ✅ | ✅ | BFF: OAuth2, RBAC pipeline, security headers, request logging. SPA: `RoleGate`, `permissions.ts`, token-based `usePortalApi` |
| H3 | Mobile-friendly responsive UI | Must Have | — | ✅ | MUI responsive Grid, `xs`/`md` breakpoints used throughout all pages |

---

## 6 — MoSCoW PRIORITIZATION (Non-MVP)

| # | Story | MoSCoW | BFF | SPA | Notes |
|---|-------|--------|-----|-----|-------|
| N1 | Role-based dashboards (Dealer/Internal/Vendor) | Should Have | ⚠️ | ⚠️ | RBAC roles exist. SPA `SideNav` filters by role, `Admin` page gated. **No persona-specific dashboard layouts** |
| N2 | Localization support | Should Have | 🟨 | ✅ | **SPA done:** `i18n/en.json` + `i18n/es.json`, `useTranslation()` in components. **BFF missing:** No `Accept-Language` or localized API content |
| N3 | User activity heatmaps | Could Have | 🔲 | 🔲 | Analytics pipeline needed |
| N4 | Video tutorials | Could Have (Later) | — | 🔲 | CMS/static content |
| N5 | Community-contributed use cases | Could Have (Later) | 🔲 | 🔲 | UGC model + moderation |
| N6 | API performance metrics (uptime, latency) | Could Have (Later) | 🔲 | 🔲 | Azure Monitor / APIM Analytics proxy |
| N7 | Live chat or community forum | Could Have (Later) | 🔲 | 🔲 | External integration |
| N8 | AI assistant for common issues | Could Have (Later) | 🔲 | 🔲 | Azure OpenAI integration |

---

## Summary Scorecard

### BFF (bff-dotnet)

| Category | ✅ Done | ⚠️ Partial | 🔲 Gap | — N/A | Total |
|----------|--------|-----------|--------|-------|-------|
| **Discover** | 5 | 1 | 3 | 1 | 10 |
| **Understand** | 3 | 2 | 2 | 1 | 8 |
| **Integrate** | 5 | 3 | 4 | 0 | 12 |
| **Manage** | 2 | 1 | 8 | 2 | 13 |
| **Holistic** | 2 | 0 | 0 | 1 | 3 |
| **Non-MVP** | 0 | 1 | 5 | 2 | 8 |
| **TOTAL** | **17** | **8** | **22** | **7** | **54** |

### SPA (src/)

| Category | ✅ Done | ⚠️ Partial | 🔲 Gap | — N/A | Total |
|----------|--------|-----------|--------|-------|-------|
| **Discover** | 3 | 2 | 4 | 1 | 10 |
| **Understand** | 2 | 3 | 2 | 1 | 8 |
| **Integrate** | 3 | 3 | 4 | 2 | 12 |
| **Manage** | 3 | 2 | 6 | 2 | 13 |
| **Holistic** | 2 | 0 | 0 | 1 | 3 |
| **Non-MVP** | 1 | 2 | 5 | 0 | 8 |
| **TOTAL** | **14** | **12** | **21** | **7** | **54** |

### Full-Stack Alignment

| Alignment | Count | Stories |
|-----------|-------|---------|
| ✅ Both layers done | **10** | D1, D3, D5, U1, U5, I1, I3, I12, H1, H2 |
| ⚠️ BFF done, SPA partial/missing | **7** | D4, U7, I2, I4, M1, M13, I7 |
| ⚠️ SPA done, BFF missing | **3** | M4, M5, M6 |
| 🔲 Both layers missing | **17** | D6, D7, D9, U4, U6, I8–I11, M3, M9–M12, N3–N8 |
| ⚠️ Both partial | **7** | D2, D8, U2, U3, I5, I6, M2 |

### Overall Coverage: **33 of 54** stories have at least some implementation (61%)

---

## 🔴 Critical Misalignment: SPA calls BFF endpoints that don't exist

These SPA pages call API paths with **no corresponding BFF endpoint**:

| SPA File | Calls | BFF Status | Action Needed |
|----------|-------|------------|---------------|
| `Support.tsx` | `GET /support/faqs` | 🔲 Missing | Add `GET /api/support/faqs` endpoint |
| `Support.tsx` | `POST /support/tickets` | 🔲 Missing | Add `POST /api/support/tickets` endpoint |
| `Support.tsx` | `GET /support/my-tickets` | 🔲 Missing | Add `GET /api/support/my-tickets` endpoint |
| `Admin.tsx` | `GET /admin/registrations?status=pending` | 🔲 Missing | Add `GET /api/admin/registrations` endpoint |
| `Admin.tsx` | `POST /admin/registrations/{id}/approve` | 🔲 Missing | Add `POST /api/admin/registrations/{id}/approve` |
| `Admin.tsx` | `POST /admin/registrations/{id}/reject` | 🔲 Missing | Add `POST /api/admin/registrations/{id}/reject` |
| `Admin.tsx` | `GET /admin/metrics` | 🔲 Missing | Add `GET /api/admin/metrics` endpoint |
| `Register.tsx` | `GET /registration/config` | 🔲 Missing | Add `GET /api/registration/config` |
| `Register.tsx` | `POST /registration` | 🔲 Missing | Add `POST /api/registration` |
| `Onboarding.tsx` | `GET /registration/status` | 🔲 Missing | Add `GET /api/registration/status` |
| `MyIntegrations.tsx` | `GET /users/me/subscriptions` | 🔲 Missing | SPA calls `/users/me/subscriptions`, BFF has `/subscriptions` — route mismatch |
| `ApiDetails.tsx` | `GET /apis/{apiId}/subscription` | 🔲 Missing | SPA checks subscription status per API; BFF has no per-API subscription check |
| `ApiTryIt.tsx` | `GET /apis/{apiId}/try-config` | 🔲 Missing | SPA loads try-it config; BFF has no such endpoint |

---

## Recommended Next Steps

### 🔴 P0 — Fix SPA↔BFF misalignment (SPA is broken without these)

1. **Support endpoints** — `GET /api/support/faqs`, `POST /api/support/tickets`, `GET /api/support/my-tickets`
2. **Registration endpoints** — `GET /api/registration/config`, `POST /api/registration`, `GET /api/registration/status`
3. **Admin endpoints** — `GET /api/admin/registrations`, `POST .../approve`, `POST .../reject`, `GET /api/admin/metrics`
4. **Route alignment** — Map SPA's `/users/me/subscriptions` to BFF `/subscriptions` (or add alias)
5. **Per-API subscription check** — `GET /api/apis/{apiId}/subscription` for status check on ApiDetails page

### 🟡 P1 — Wire existing BFF endpoints into SPA

6. **Key reveal UI** — Call `POST /subscriptions/{subId}/secrets` from MyIntegrations page
7. **Key rotation UI** — Call `regeneratePrimaryKey`/`regenerateSecondaryKey` from MyIntegrations
8. **Changelog tab** — Call `GET /apis/{apiId}/releases` in ApiDetails page
9. **Tag filter chips** — Call `GET /tags` in ApiCatalog for filter UI
10. **Subscription rename** — Wire "Manage" button to `PATCH /subscriptions/{subId}`

### 🟢 P2 — New features (both layers)

11. **Rate limit / quota fields** — Extend `ProductContract` + display in SPA
12. **SLA / Pricing metadata** — Add to `ProductContract` or `ApiRegistryMetadata`
13. **Use case content** — Extend `ApiRegistryMetadata.UseCases`
14. **Region/system/data-type filters** — Extend catalog search filters

### 🔵 Future Phases

15. **Favorites** — `POST/GET /api/users/me/favorites` + SPA favorites list
16. **AI Assistant** — `POST /api/assistant/chat` (Azure OpenAI)
17. **Client library generation** — `POST /api/apis/{apiId}/sdk` (AutoRest/Kiota)
18. **API dependency graph** — Custom relationship metadata + SPA visualization
