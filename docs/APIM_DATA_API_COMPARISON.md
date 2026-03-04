# APIM Data API Communication Comparison

> **Official Portal:** `api-management-developer-portal` (self-hosted)
> **Custom Portal:** `kx-apim-dev-custom` (Vite + React SPA + Express BFF)

This document compares how the official Azure APIM Developer Portal runtime communicates with the APIM backend versus what the custom Komatsu portal currently implements, and recommends what to add.

---

## 1. Architecture Comparison

### Official Portal (Runtime)

```
Browser (Paperbits SPA)
  └─ DataApiClient (apiClient.ts)
       ├─ Base URL: auto-discovered from config.runtime.json → developerPortalUrl + "/developer"
       ├─ Auth: SharedAccessSignature (SAS) token stored in sessionStorage
       ├─ API Version: "2022-04-01-preview" appended to every request
       ├─ Retry: RequestRetryStrategy (3 retries, retry-after header awareness, 429/500 handling)
       ├─ Caching: TtlCache (1-second dedup for GET/HEAD), LruCache (schemas), IndexedDB (API lists)
       ├─ Token Refresh: AccessTokenRefresher polls /identity every 60s, renews SAS 5 min before expiry
       └─ Portal Header: "x-ms-apim-client" sent on every request for telemetry
```

The browser talks **directly** to the APIM Data API. The SAS token is obtained via SSO redirect or via the `/identity` endpoint after Basic/AAD login.

### Custom Portal (BFF Proxy)

```
Browser (React SPA)
  └─ usePortalApi() → fetch("/api/...")
       └─ Nginx reverse proxy → BFF (Express, port 3001)
            ├─ DefaultAzureCredential → ARM bearer token
            ├─ ARM POST /users/1/token → SAS token
            ├─ SAS token → APIM Data API calls
            ├─ transformDataApiToSummary() / transformDataApiToDetails()
            └─ Response → JSON to browser
```

The browser **never** talks directly to the APIM Data API. The BFF holds all credentials server-side.

---

## 2. Data API Endpoints — Official vs Custom

### Full Endpoint Map from Official Portal Services

| Data API Path | Official Service | Method | Custom BFF Has? | Notes |
|---|---|---|---|---|
| **APIs** | | | | |
| `/apis?$top=N&$skip=N&tags[]=...&$filter=...` | `ApiService.getApis()` | GET | ✅ `/apis` | Missing: OData `$filter`, `$top/$skip` pagination passthrough, `tags[]` filter |
| `/apis/{apiId}` | `ApiService.getApi()` | GET | ✅ `/apis/:apiId` | |
| `/apis/{apiId}/operations?$top=N&$skip=N` | `ApiService.getOperations()` | GET | ⚠️ Embedded | Fetched inside `/apis/:apiId` detail, not a standalone endpoint |
| `/apis/{apiId}/operations/{opId}` | `ApiService.getOperation()` | GET | ❌ Missing | Individual operation detail with request/response schemas |
| `/apisByTags?$top=N&$skip=N&$filter=...` | `ApiService.getApisByTags()` | GET | ❌ Missing | Tag-grouped API listing (the "group by category" view) |
| `/apis/{apiId}/schemas?$expand=document` | `ApiService.getSchemas()` | GET | ❌ Missing | OpenAPI/Swagger/GraphQL schema documents |
| `/apis/{apiId}/products` | `ApiService.getAllApiProducts()` | GET | ⚠️ Partial | Fetched inside detail endpoint, not standalone with pagination |
| `/apis/{apiId}/revisions` | `ApiService.getApiRevisions()` | GET | ❌ Missing | API revision history |
| `/apis/{apiId}/changelog` | `ApiService.getApiChangeLog()` | GET | ❌ Missing | API change log entries |
| `/apis/{apiId}/hostnames` | `ApiService.getApiHostnames()` | GET | ❌ Missing | Gateway hostnames for the API |
| `/apis/{apiId}/authServers/oauth2` | `OAuthService.getOauthServers()` | GET | ❌ Missing | OAuth servers configured for an API |
| `/apis/{apiId}/authServers/openidconnect` | `OAuthService.getOpenIdAuthServers()` | GET | ❌ Missing | OpenID Connect servers for an API |
| `/apis/{apiId}/operations/{opId}/tags` | `ApiService.getOperationTags()` | GET | ❌ Missing | Tags on individual operations |
| **Products** | | | | |
| `/products?$top=N&$skip=N` | `ProductService.getProducts()` | GET | ✅ `/products` | Missing: pagination params passthrough |
| `/products/{productId}` | `ProductService.getProduct()` | GET | ❌ Missing | Individual product detail |
| `/products/{productId}/apis` | `ApiService.getProductApis()` | GET | ❌ Missing | APIs within a product |
| **Subscriptions** | | | | |
| `{userId}/subscriptions?$top=N&$skip=N&$filter=...` | `ProductService.getSubscriptions()` | GET | ✅ `/subscriptions` | Missing: user-scoped prefix, OData filters |
| `{userId}/subscriptions/{subId}` | `ProductService.getSubscription()` | GET | ❌ Missing | Individual subscription detail |
| `{userId}/subscriptions` | `ProductService.createSubscription()` | POST | ❌ Missing | Create new subscription |
| `/subscriptions/{subId}` (state=cancelled) | `ProductService.cancelSubscription()` | PATCH | ❌ Missing | Cancel subscription |
| `/subscriptions/{subId}` (name=newName) | `ProductService.renameSubscription()` | PATCH | ❌ Missing | Rename subscription |
| `/subscriptions/{subId}/listSecrets` | `ProductService.getSubscriptionSecrets()` | POST | ❌ Missing | Retrieve primary/secondary keys |
| `/subscriptions/{subId}/regeneratePrimaryKey` | `ProductService.regeneratePrimaryKey()` | POST | ❌ Missing | Rotate primary key |
| `/subscriptions/{subId}/regenerateSecondaryKey` | `ProductService.regenerateSecondaryKey()` | POST | ❌ Missing | Rotate secondary key |
| **Users / Identity** | | | | |
| `/identity` | `UsersService.authenticate()` | GET | ❌ Missing | Authenticate and get SAS token via credentials header |
| `/identity` | `UsersService.getCurrentUserId()` | GET | ❌ Missing | Get current user identity |
| `users/{userId}` | `UsersService.getCurrentUser()` | GET | ❌ Missing | Get user profile |
| `users/{userId}` | `UsersService.updateUser()` | PATCH | ❌ Missing | Update user first/last name |
| `/users` | `UsersService.createSignupRequest()` | POST | ❌ Missing | Create signup request |
| `/users` | `UsersService.createUserWithOAuth()` | POST | ❌ Missing | Create user via OAuth id_token |
| `users/{userId}/identities/Basic/{identity}` | `UsersService.activateUser()` | PUT | ❌ Missing | Activate user account |
| `/confirmations/password` | `UsersService.createResetPasswordRequest()` | POST | ❌ Missing | Initiate password reset email |
| **Tags** | | | | |
| `/tags?scope=...&$filter=...` | `TagService.getTags()` | GET | ❌ Missing | List tags (for filter UI) |
| **Analytics / Reports** | | | | |
| `{userId}/reports/ByTime?$filter=...` | `AnalyticsService.getReportsByTime()` | GET | ❌ Missing | Time-series usage metrics |
| `{userId}/reports/ByRegion?$filter=...` | `AnalyticsService.getReportsByGeo()` | GET | ❌ Missing | Geographic usage breakdown |
| `{userId}/reports/ByProduct?$filter=...` | `AnalyticsService.getReportsByProduct()` | GET | ❌ Missing | Per-product usage metrics |
| `{userId}/reports/BySubscription?$filter=...` | `AnalyticsService.getReportsBySubscription()` | GET | ❌ Missing | Per-subscription metrics |
| `{userId}/reports/ByEndpoint?$filter=...` | `AnalyticsService.getReportsByApi()` | GET | ❌ Missing | Per-API endpoint metrics |
| `{userId}/reports/ByOperation?$filter=...` | `AnalyticsService.getReportsByOperation()` | GET | ❌ Missing | Per-operation metrics |
| **Backend Service** (portal URL, not Data API) | | | | |
| `/captcha-available` | `BackendService.getCaptchaSettings()` | GET | ❌ Missing | CAPTCHA for signup |
| `/captcha` | `BackendService.getCaptchaParams()` | GET | ❌ Missing | |
| `/captcha-challenge` | `BackendService.getCaptchaChallenge()` | GET | ❌ Missing | |
| `/signup` | `BackendService.sendSignupRequest()` | POST | ❌ Missing | |
| `/reset-password` | `BackendService.sendResetRequest()` | POST | ❌ Missing | |
| `/change-password` | `BackendService.sendChangePassword()` | POST | ❌ Missing | |
| `/authorizationServers/{id}` | `BackendService.getAuthorizationServer()` | GET | ❌ Missing | For test console OAuth |
| `/openidConnectProviders/{id}` | `BackendService.getOpenIdConnectProvider()` | GET | ❌ Missing | |
| `/signin-oauth/code/{name}` | `OAuthService.authenticateCode()` | POST | ❌ Missing | Test console: auth code flow |
| `/signin-oauth/credentials/{name}` | `OAuthService.authenticateClientCredentials()` | POST | ❌ Missing | Test console: client credentials flow |
| `/signin-oauth/password/{name}` | `OAuthService.authenticatePassword()` | POST | ❌ Missing | Test console: password flow |
| **Delegation** | | | | |
| `/delegation/settings` | `DelegationService.getDelegationSettings()` | GET | ❌ Missing | Check if delegation is enabled |
| `/delegation/urls/signin` | `DelegationService.getDelegatedSigninUrl()` | POST | ❌ Missing | |
| `/delegation/urls/signup` | `DelegationService.getDelegatedSignupUrl()` | POST | ❌ Missing | |
| `/delegation/urls/users/{id}/{action}` | `DelegationService.getUserDelegationUrl()` | POST | ❌ Missing | |

---

## 3. Cross-Cutting Concerns — Official vs Custom

| Concern | Official Portal | Custom BFF | Gap |
|---|---|---|---|
| **Retry strategy** | `RequestRetryStrategy`: 3 retries, `retry-after` / `retry-after-ms` header parsing, 429/500 retry | None | ❌ No retry on transient failures |
| **Request caching** | `TtlCache` (1s dedup for GET), `LruCache` (schema), `IndexedDB` (API lists) | Token caching only (5-min buffer) | ❌ No response caching |
| **Pagination** | Full `$top/$skip` + `nextLink` traversal via `getAll()` | Single-page fetch only | ❌ No pagination support |
| **OData filtering** | `$filter`, tag arrays, pattern search passed to Data API | Client-side filtering in React | ⚠️ Filtering works but doesn't scale |
| **Token refresh** | `AccessTokenRefresher` polls `/identity` every 60s, renews SAS 5 min before expiry | BFF caches SAS with 5-min buffer, regenerates on next request | ✅ Comparable (different mechanism) |
| **Portal header** | `x-ms-apim-client` on every request (telemetry + portal type tracking) | Not sent | ❌ Missing telemetry header |
| **User-scoped queries** | `IsUserResource` header + `/users/{id}/` prefix auto-added | Admin-scoped SAS (intentional); RBAC via Entra ID roles in BFF middleware | ✅ By design — Global Admin owns identity & roles; BFF enforces access |
| **Error mapping** | `MapiError` with typed codes (Unauthorized, NotFound, TooManyRequests, etc.) | Basic HTTP status check | ⚠️ Less granular error handling |
| **GraphQL support** | Full `GraphqlService` with schema introspection | None | ❌ Missing (relevant if GraphQL APIs are onboarded) |

---

## 4. Recommended Additions to Custom BFF (Priority Order)

### P0 — Required for Phase 1 MVP

These are needed for the 3 onboarded APIs (Warranty, Parts Punchout, Equipment) to function properly.

#### 4.1 Subscription Lifecycle (ProductService parity)

```
BFF Routes to add:
  POST   /subscriptions                → create subscription
  GET    /subscriptions/:subId         → get subscription detail
  PATCH  /subscriptions/:subId         → cancel or rename
  POST   /subscriptions/:subId/secrets → list primary/secondary keys
```

**Why:** The appspec requires developers to subscribe to APIs. Without this, the "Sign-Up" flow on API detail pages and "My Integrations" page are non-functional against live APIM.

#### 4.2 Server-Side Pagination

```
Pass $top, $skip, and nextLink through to the Data API for:
  GET /apis
  GET /products
  GET /subscriptions
```

**Why:** With 3 APIs now it works, but the portal must scale as more APIs are onboarded. The official portal always paginates.

#### 4.3 Tags Endpoint

```
BFF Route to add:
  GET /tags?scope=...&$filter=...
```

**Why:** The API Catalog filter-by-category currently derives categories from loaded data. The official portal uses dedicated tag queries to populate filter dropdowns, which scales and avoids loading all APIs upfront.

#### 4.4 Portal Telemetry Header

Add `x-ms-apim-client: self-hosted-portal|{host}|{eventName}` to every Data API request from the BFF.

**Why:** APIM uses this header for portal usage analytics. Without it, the portal's traffic won't appear in APIM's built-in analytics dashboards.

#### 4.5 Retry Strategy

```javascript
// Add to BFF: retry wrapper for fetchFromDataApi()
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const status = error.status || 0;
      if (status === 429) {
        const retryAfter = parseRetryAfterHeader(error) || 500;
        await sleep(retryAfter);
      } else if (status >= 500) {
        await sleep(500);
      } else {
        throw error; // Don't retry 4xx (except 429)
      }
    }
  }
}
```

**Why:** The APIM Data API returns 429 under load. Without retry, the portal will show intermittent failures.

### P1 — Required for Full Feature Parity

#### 4.6 User Identity & Profile

```
BFF Routes to add:
  GET    /users/me              → return Entra ID claims (name, email, roles) from validated MSAL token
  GET    /users/me/profile      → enrich with APIM data if needed (subscriptions count, etc.)
```

**Why:** User identity and profile data comes from Global Admin (Entra ID), not from APIM's user store. The BFF decodes the MSAL token and returns the caller's claims. APIM user provisioning is not required — the admin SAS token is used for all Data API calls, and the BFF's role middleware gates write operations.

#### 4.7 API Schema / OpenAPI Spec

```
BFF Routes to add:
  GET /apis/:apiId/schemas         → list schemas (OpenAPI, Swagger, GraphQL)
  GET /apis/:apiId/schemas/:type   → get specific schema document
```

**Why:** The "Try It" console (`ApiTryIt.tsx`) needs the actual OpenAPI spec to render Swagger UI. Currently the `/apis/:apiId/openapi` endpoint exists but the schema retrieval needs to mirror the official `getSchemas()` approach which supports `$expand=document`.

#### 4.8 API Revision History & Changelog

```
BFF Routes to add:
  GET /apis/:apiId/revisions   → list API revisions
  GET /apis/:apiId/changelog   → list change log entries
```

**Why:** The appspec requires "API changes or deprecations" in the News section and per-API changelog. The official portal has full revision + changelog support.

#### 4.9 OAuth Server Discovery (for Test Console)

```
BFF Routes to add:
  GET /apis/:apiId/auth-servers/oauth2          → OAuth2 servers for API
  GET /apis/:apiId/auth-servers/openidconnect   → OpenID servers for API
  GET /authorization-servers/:id                → server details
```

**Why:** The "Try It" console needs to know which OAuth servers are configured for an API to authenticate test requests. The official portal's `OAuthService` handles implicit, auth-code, client-credentials, and password grant flows.

#### 4.10 Response Caching in BFF

```javascript
// Simple TTL cache for GET requests
const responseCache = new Map();
const CACHE_TTL = 60_000; // 1 minute

function getCached(key) {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  responseCache.delete(key);
  return null;
}
```

**Why:** The official portal caches with TtlCache + LruCache + IndexedDB. A lightweight BFF-side cache reduces Data API calls and improves response times.

### P2 — Future Phase (Analytics, Delegation)

#### 4.11 Analytics / Reports

```
BFF Routes to add:
  GET /reports/by-time?start=...&end=...&interval=...
  GET /reports/by-geo?start=...&end=...
  GET /reports/by-product?start=...&end=...
  GET /reports/by-subscription?start=...&end=...
  GET /reports/by-api?start=...&end=...
  GET /reports/by-operation?start=...&end=...
```

**Why:** The appspec lists "Usage Analytics Dashboard" as a future phase deliverable, but the Data API endpoints exist now. Adding these BFF routes enables the Power BI integration later without a separate data pipeline.

#### 4.12 Delegation Service

```
BFF Routes to add:
  GET  /delegation/settings
  POST /delegation/urls/signin
  POST /delegation/urls/signup
```

**Why:** If Komatsu enables APIM delegation (external user management), the portal needs these endpoints. Currently the portal uses Entra ID directly, but delegation may be required for Global Admin integration.

---

## 5. Access Control: Admin-Scoped Data API + Application-Level RBAC (Design Decision)

### Official Portal Approach
- User authenticates → gets a **user-scoped SAS token** (e.g., `uid=user123&...`)
- Requests to `/users/user123/subscriptions` return **only that user's** subscriptions
- The `IsUserResource` header signals the Data API to enforce user-level access control
- RBAC is **delegated to APIM** — the Data API itself filters results per user

### Custom Portal Approach (Chosen)
- BFF uses Managed Identity → ARM token → generates SAS for **admin user "1"** (`/users/1/token`)
- The BFF has **full read/write access** to all APIM data via the admin SAS token
- **RBAC is enforced application-side** using roles returned by Global Admin (Entra ID)
- The frontend `AuthProvider` extracts `roles` from `idTokenClaims` (Admin, Developer, Tester)
- `RoleGate` and `PrivateRoute` components enforce route-level access in the SPA
- The BFF filters responses based on the caller's Entra ID identity and role

### Why This Approach
1. **Global Admin is the single identity source** — Komatsu already manages all user roles, groups, and permissions through Entra ID via the Global Admin framework. Duplicating user management inside APIM would create a sync burden.
2. **Admin SAS gives full catalog visibility** — All authenticated users should be able to *browse* the full API catalog. Restricting visibility at the APIM layer would hide APIs that users should be able to discover.
3. **Write operations are gated by role** — Subscription creation, key viewing, and admin functions are guarded by checking `roles[]` from the Entra ID token in the BFF middleware before proxying to the Data API.
4. **Simpler operational model** — No need to provision/sync APIM user accounts for every Entra ID user. The BFF acts as a trusted intermediary.

### RBAC Enforcement Points

```
Browser (MSAL token with roles[])
  │
  ├─ Frontend: RoleGate checks roles before rendering routes
  │   ├─ Admin, GlobalAdmin → /admin
  │   ├─ Developer          → /apis, /my/integrations, /apis/:id/try
  │   ├─ Tester             → /apis/:id/try (sandbox only)
  │   └─ All authenticated  → /apis (browse), /news, /support
  │
  └─ BFF Middleware: validates MSAL token, extracts roles
      ├─ GET  /apis, /products, /tags       → allowed for all authenticated users
      ├─ GET  /apis/:id/schemas             → allowed for Developer, Tester, Admin
      ├─ POST /subscriptions                → allowed for Developer, Admin
      ├─ POST /subscriptions/:id/secrets    → allowed for Developer, Admin
      ├─ PATCH /subscriptions/:id           → allowed for Developer, Admin (own subs)
      ├─ GET  /reports/*                    → allowed for Admin only
      └─ Admin CRUD operations              → allowed for Admin, GlobalAdmin only
```

### BFF Middleware Implementation Needed

```javascript
// Add to BFF: role-based authorization middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const roles = req.userRoles || []; // extracted from validated MSAL token
    const hasRole = allowedRoles.some(r => roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Token validation middleware (runs on all /api routes)
function validateMsalToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  // Decode and verify the MSAL token (issuer, audience, expiry)
  // Extract roles from token claims
  // Attach to req.userRoles and req.userId
  next();
}

// Usage:
app.post('/subscriptions', requireRole('Developer', 'Admin'), createSubscriptionHandler);
app.get('/reports/:type', requireRole('Admin', 'GlobalAdmin'), reportsHandler);
```

### Security Considerations
- The admin SAS token **never leaves the BFF** — the browser only holds MSAL tokens
- All write operations require a valid MSAL token with appropriate Entra ID roles
- The BFF should log all write operations (subscription create/cancel, key regeneration) with the caller's Entra ID OID for audit trails
- For subscription ownership: the BFF can tag subscriptions with the creator's Entra OID in the subscription name/metadata, then filter on read

---

## 6. Summary: Minimum BFF Additions for Phase 1

| # | Route / Feature | Effort | Impact |
|---|---|---|---|
| 1 | Retry strategy wrapper | S | Prevents intermittent 429 failures |
| 2 | `x-ms-apim-client` portal header | S | Enables APIM analytics tracking |
| 3 | `$top/$skip` pagination passthrough | S | Scales beyond 3 APIs |
| 4 | `GET /tags` | S | Proper category filter for catalog |
| 5 | `POST /subscriptions` (create) | M | Enables API sign-up flow |
| 6 | `GET/PATCH /subscriptions/:id` | M | Enables My Integrations management |
| 7 | `POST /subscriptions/:id/secrets` | M | Enables key viewing |
| 8 | `GET /apis/:apiId/schemas` | M | Enables Try It console with real specs |
| 9 | `GET /apis/:apiId/revisions` + `changelog` | M | Enables changelog in News/API detail |
| 10 | BFF MSAL token validation + role middleware | M | Enforces RBAC on write operations |
| 11 | Response caching | M | Performance + Data API rate limit protection |
| 12 | `GET /apis/:apiId/auth-servers/*` | M | Test console OAuth integration |

**S** = Small (< 1 day), **M** = Medium (1-2 days), **L** = Large (3-5 days)

---

*Comparison based on analysis of `api-management-developer-portal/src/services/` and `api-management-developer-portal/src/clients/` against `kx-apim-dev-custom/bff/server.js`.*
