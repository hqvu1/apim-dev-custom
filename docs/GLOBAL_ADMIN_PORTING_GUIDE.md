# Global Admin Integration — Findings & Porting Guide

> **Purpose**: Document the analysis of MN backend's Global Admin integration and define a step-by-step process to port it into the DAPIM `bff-dotnet` Minimal API.
>
> **Date**: March 12, 2026
> **Source**: `kx-membernetwork-backend` (MN — .NET 8 Controller API)
> **Target**: `kx-apim-dev-custom/bff-dotnet` (DAPIM — .NET 10 Minimal API)

---

## Table of Contents

1. [Findings: MN Global Admin Architecture](#1-findings-mn-global-admin-architecture)
2. [Current State: DAPIM BFF](#2-current-state-dapim-bff)
3. [Gap Analysis](#3-gap-analysis)
4. [Recommendation: Minimal API (Not Controllers)](#4-recommendation-minimal-api-not-controllers)
5. [Porting Process](#5-porting-process)
6. [Phase Details](#6-phase-details)
7. [File Mapping: MN → DAPIM](#7-file-mapping-mn--dapim)
8. [Configuration Reference](#8-configuration-reference)
9. [Testing Checklist](#9-testing-checklist)
10. [Risk Register](#10-risk-register)
11. [Appendix A: MN Roles Reference](#appendix-a-mn-roles-reference)
12. [Appendix B: MN Permission Claims Sample](#appendix-b-mn-permission-claims-sample)

---

## 1. Findings: MN Global Admin Architecture

### 1.1 Auth Flow Overview

```
User → SPA (React) → MSAL loginRedirect → Entra ID → id_token
  → SPA sends Bearer id_token to BFF
  → BFF: EntraTokenHandler validates JWT (OIDC discovery keys + Redis cache)
  → BFF: UserClaimsTransformer calls Integration Services API
         GET /integ-api/user-details?email={email}
  → Integration Services returns UserInfoResponse (roles, claims, company, etc.)
  → BFF: Adds role claims + feature claims to ClaimsPrincipal
  → BFF: EnforceRolePermissionAttribute validates UserType + Role combo
  → BFF: EnforceClaimPermissionAttribute gates individual endpoints by claim
```

### 1.2 Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **EntraTokenHandler** | `SharedLibrary/Handlers/EntraTokenHandler.cs` | Custom `AuthenticationHandler<T>` — extracts Bearer token, validates via OIDC keys, checks Redis blacklist, creates `ClaimsPrincipal` with email + name claims |
| **TokenService** | `Services/External/TokenService.cs` | Validates JWT signature against OIDC discovery keys; caches OIDC config and validation results in Redis |
| **UserClaimsTransformer** | `SharedLibrary/Transformers/UserClaimsTransformer.cs` | `IClaimsTransformation` — calls Global Admin Integration Services API, adds `UserId`, `UserType`, `CompanyId`, `Role`, `UserSupportedClaims` to identity |
| **UserAccess** | `Services/External/User/UserAccess.cs` | HTTP client that calls `GET /integ-api/user-details?email={email}`, returns `UserInfoResponse` |
| **UserInfoResponse** | `SharedLibrary/Models/ServiceModels/UserInfoResponse.cs` | DTO with `Permissions[]` (ApplicationId, ApplicationName, RoleName, ClaimList), `UserType`, `CompanyId`, `JobTypes[]`, `Industry[]`, `IsWACUser` |
| **EnforceRolePermission** | `SharedLibrary/Attributes/EnforceRolePermissionAttribute.cs` | Controller-level filter — validates UserType-to-Role mapping (Employee→KomatsuUser, Distributor→DealerUser, etc.) |
| **EnforceClaimPermission** | `SharedLibrary/Attributes/EnforceClaimPermissionAttribute.cs` | Method-level filter — checks if user has ANY of the required feature claims (OR logic) |
| **ClaimConstants** | `SharedLibrary/Constants/ClaimConstants.cs` | ~50 feature claims (`VIEW_ADMIN_CONSOLE_PAGE`, `VIEW_WAFFLE_MENU`, etc.) |
| **ServiceExtension** | `BFFAPI/Extensions/ServiceExtension.cs` | DI registration — 20+ HTTP clients with Polly retry, Redis cache, CosmosDB repos |

### 1.3 Token Handling Details

- **Token type**: `id_token` (not access_token — non-standard but works with their custom handler)
- **Validation**: Manual OIDC key validation (NOT `Microsoft.Identity.Web`); caches OIDC config in Redis
- **Blacklist**: On logout, stores `jti` claim in Redis with TTL = token expiry; future requests with same token fail
- **Cache**: Token validation result cached in Redis for (expiry - 2 minutes)
- **Dual tenant**: Workforce (`login.microsoftonline.com`) + CIAM (`ciamlogin.com`) — picks OIDC provider based on `tid` claim

### 1.4 Global Admin API Call Pattern

```
HTTP GET {IntegrationServicesBaseUrl}/integ-api/user-details?email={email}
Headers:
  Authorization: Bearer {ISS-service-token}  (service-to-service auth)
  Content-Type: application/json
  X-Correlation-Id: {correlation-id}

Response → UserInfoResponse:
{
  "userId": 12345,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@komatsu.com",
  "userType": "Distributor",
  "companyId": 42,
  "companyName": "ACME Corp",
  "objectId": "aad-oid-guid",
  "isWACUser": false,
  "permissions": [
    {
      "applicationId": 99,
      "applicationName": "Member Network",
      "roleTypeName": "User",
      "roleId": 5,
      "roleName": "Global_MemberNetwork_Dealer_User",
      "claimList": "VIEW_WAFFLE_MENU,VIEW_SEARCH_DRAWER,VIEW_NOTIFICATION_CTR_DRAWER,..."
    }
  ],
  "jobTypes": [{ "name": "Fleet Manager", "personas": [{ "name": "Heavy Equipment" }] }],
  "industry": [{ "name": "Mining" }]
}
```

### 1.5 Permission Filtering

MN filters permissions by `ApplicationName == "Member Network"`. DAPIM must filter by a new application name (e.g., `"API Marketplace"` or `"DAPIM"`) — this requires a Global Admin configuration entry for the new application.

---

## 2. Current State: DAPIM BFF

### 2.1 What Already Exists

| Feature | Status | File |
|---------|--------|------|
| JWT Bearer authentication | ✅ Done | `Program.cs` — `Microsoft.Identity.Web` JwtBearer |
| Dual-tenant support (CIAM + Workforce) | ✅ Done | `appsettings.Development.json` — `ValidIssuers` |
| Claims enrichment middleware | ✅ Shell | `Middleware/ClaimsEnrichmentMiddleware.cs` — calls `IClaimsEnricher` |
| Claims enricher interface | ✅ Shell | `Authorization/IClaimsEnricher.cs` — fetches roles, derives permissions |
| Role provider interface | ✅ Shell | `Services/GlobalAdminRoleProvider.cs` — `IRoleProvider` |
| Global Admin HTTP client | ✅ Shell | `GlobalAdminRoleProvider` — calls `GET /users/{userId}/roles` |
| Mock role provider | ✅ Done | `Services/GlobalAdminRoleProvider.cs` — returns `["Distributor"]` |
| RBAC policy provider | ✅ Done | `Authorization/RbacPolicyProvider.cs` — loads `rbac-policies.json` |
| RBAC handler | ✅ Done | `Authorization/ApiAccessHandler.cs` — checks roles against policies |
| Authorization audit middleware | ✅ Done | `Middleware/ClaimsEnrichmentMiddleware.cs` — logs auth decisions |
| Security headers middleware | ✅ Done | `Middleware/` — X-Content-Type-Options, X-Frame-Options, etc. |
| 13 Minimal API endpoint groups | ✅ Done | `Endpoints/` — ApisEndpoints, ProductsEndpoints, etc. |

### 2.2 What's Missing (Gaps)

| Gap | Priority | Description |
|-----|----------|-------------|
| **Real Integration Services HTTP client** | P0 | Current `GlobalAdminRoleProvider` calls `GET /users/{userId}/roles` — MN calls `GET /integ-api/user-details?email={email}` which returns richer data including permissions and claims |
| **UserInfoResponse model** | P0 | No model for the Global Admin response structure (permissions, claims, company, etc.) |
| **Permission/claim extraction** | P0 | No logic to filter `Permissions[]` by DAPIM's application name and extract `ClaimList` |
| **Email-based lookup** | P1 | DAPIM currently looks up by `oid` (user object ID); MN looks up by `email` — need to align with Integration Services API contract |
| **Feature claims for DAPIM** | P1 | No claim constants defined for API Marketplace features (e.g., `VIEW_API_CATALOG`, `TRY_API`, `MANAGE_SUBSCRIPTIONS`) |
| **Token blacklisting** | P2 | No Redis; uses `IMemoryCache` only — token blacklist on logout not supported |
| **Distributed caching** | P2 | MN uses Redis for token validation cache, user info cache, and OIDC config cache; DAPIM uses `IMemoryCache` only |
| **User profile endpoint** | P1 | No `/api/users/me` endpoint that returns full user profile with permissions (MN has `GET /api/user/profile`) |

---

## 3. Gap Analysis

### What MN Does That DAPIM Doesn't (Yet)

```
MN Backend                                   DAPIM BFF (Current)
─────────────────────────────────────────────────────────────────
EntraTokenHandler (custom OIDC)          →   Microsoft.Identity.Web JwtBearer ✅
  └─ Redis token blacklist               →   (none — P2)
  └─ Redis validation cache              →   IMemoryCache ✅

UserClaimsTransformer                    →   ClaimsEnrichmentMiddleware ✅ (shell)
  └─ Calls Integration Services API      →   Calls /users/{id}/roles (wrong endpoint)
  └─ Parses UserInfoResponse             →   Returns string[] roles only
  └─ Filters by ApplicationName          →   (none)
  └─ Adds Role + ClaimList claims        →   Adds role claims only

EnforceRolePermission (class filter)     →   ApiAccessHandler + rbac-policies.json ✅
EnforceClaimPermission (method filter)   →   (none — need feature claims for DAPIM)

UserAccess HTTP client + caching         →   GlobalAdminRoleProvider (simplified)
UserInfoResponse model                   →   (none)
ClaimConstants (~50 MN claims)           →   (none — need DAPIM-specific claims)
Redis distributed cache                  →   IMemoryCache (sufficient for MVP)
20+ HTTP clients with Polly              →   HTTP resilience via Microsoft.Extensions.Http.Resilience ✅
```

---

## 4. Recommendation: Minimal API (Not Controllers)

**Decision: Keep Minimal API.** See the full rationale in the previous conversation. Summary:

1. The DAPIM BFF already works as Minimal API with 13 endpoint groups
2. .NET 10 defaults to Minimal API; all new tooling favors it
3. MN uses controllers due to its scale (12 controllers, 4 projects, 80+ files) — DAPIM doesn't need that
4. The Global Admin integration is **middleware + services**, not controller logic — it ports identically to either style
5. The equivalent of `[EnforceClaimPermission]` in Minimal API is `.RequireAuthorization("PolicyName")` on route groups

---

## 5. Porting Process

### Phase Overview

| Phase | Name | Scope | Depends On |
|-------|------|-------|------------|
| **Phase 1** | Models & Contracts | UserInfoResponse, Permissions, PortalClaimConstants | — |
| **Phase 2** | Integration Services Client | Replace `GlobalAdminRoleProvider` with `IntegrationServicesClient` | Phase 1 |
| **Phase 3** | Claims Enrichment | Wire `ClaimsEnrichmentMiddleware` → full claim hydration | Phase 2 |
| **Phase 4** | Feature Authorization | Add DAPIM claim constants + policy-based claim checks | Phase 3 |
| **Phase 5** | User Profile Endpoint | `GET /api/users/me` returns full profile with permissions | Phase 3 |
| **Phase 6** | SPA Integration | Wire `apiClient.ts` Bearer header + role/claim handling | Phase 5 |
| **Phase 7** | Hardening | Redis cache, token blacklist, OIDC key rotation | Phase 3 |

```
Phase 1 ─── Phase 2 ─── Phase 3 ──┬── Phase 4
                                   ├── Phase 5 ─── Phase 6
                                   └── Phase 7
```

---

## 6. Phase Details

### Phase 1: Models & Contracts

**Goal**: Define the data structures for the Global Admin API response.

**Files to create**:

| File | Content |
|------|---------|
| `Models/GlobalAdmin/UserInfoResponse.cs` | DTO matching Integration Services response — `Id`, `Email`, `UserType`, `CompanyId`, `Permissions[]`, `JobTypes[]`, `Industry[]`, `IsWACUser` |
| `Models/GlobalAdmin/Permissions.cs` | `ApplicationId`, `ApplicationName`, `RoleName`, `ClaimList` (comma-separated string) |
| `Models/GlobalAdmin/JobTypeInfo.cs` | `Name`, `Personas[]` |
| `Models/GlobalAdmin/IndustryInfo.cs` | `Name` |
| `Authorization/PortalClaimConstants.cs` | Feature claims for DAPIM: `VIEW_API_CATALOG`, `VIEW_API_DETAIL`, `TRY_API`, `VIEW_SUBSCRIPTIONS`, `MANAGE_SUBSCRIPTIONS`, `VIEW_PRODUCTS`, `VIEW_ADMIN_CONSOLE`, `MANAGE_REGISTRATIONS` |

**Porting notes**:
- Copy `UserInfoResponse` structure from MN's `SharedLibrary/Models/ServiceModels/UserInfoResponse.cs`
- Simplify: remove MN-specific fields (`BackgroundImage`, `Image`, `SettingsUrl`, `LanguageCode`, `DefaultWidgets`) unless needed
- Keep `Permissions[]` with `ApplicationName` filter — change filter from `"Member Network"` to `"API Marketplace"` (confirm with Global Admin team)
- `ClaimList` in MN is a **comma-separated string** — parse to `string[]` in the model or at usage site

**Validation step**: Confirm with Global Admin team:
- [ ] What `ApplicationName` will DAPIM use in Global Admin?
- [ ] What roles will be configured? (Distributor, Vendor, Customer — per design doc)
- [ ] What feature claims will be defined? (Need new claim definitions in Global Admin)

---

### Phase 2: Integration Services Client

**Goal**: Replace the current `GlobalAdminRoleProvider` (which calls `GET /users/{id}/roles`) with a client matching MN's pattern (`GET /integ-api/user-details?email={email}`).

**Files to modify**:

| File | Change |
|------|--------|
| `Services/GlobalAdminRoleProvider.cs` | Refactor to `IntegrationServicesClient` that calls the correct endpoint and returns `UserInfoResponse` |
| `appsettings.json` | Update `GlobalAdmin` section → `IntegrationServices` section with correct base URL |
| `Program.cs` | Update DI registration |

**New service interface**:

```csharp
public interface IIntegrationServicesClient
{
    /// <summary>
    /// Fetches full user details from Global Admin Integration Services API.
    /// Cached per email for the configured TTL.
    /// </summary>
    Task<UserInfoResponse?> GetUserDetailsAsync(string email, CancellationToken ct = default);
}
```

**Key differences from current `GlobalAdminRoleProvider`**:

| Aspect | Current (DAPIM) | Target (from MN) |
|--------|-----------------|-------------------|
| Lookup key | `userId` (oid claim) | `email` (email claim) |
| Endpoint | `GET /users/{userId}/roles` | `GET /integ-api/user-details?email={email}` |
| Auth | `Ocp-Apim-Subscription-Key` header | Service-to-service token (ISS) |
| Response | `string[]` (role names) | `UserInfoResponse` (full profile) |
| Cache | `IMemoryCache` 30 min | Keep `IMemoryCache` 30 min (Redis in Phase 7) |

**`IRoleProvider` stays as a thin wrapper**: It calls `IIntegrationServicesClient.GetUserDetailsAsync()`, filters permissions by application name, and returns role names. This keeps backward compatibility with `ApiAccessHandler`.

---

### Phase 3: Claims Enrichment

**Goal**: Wire the full claims hydration into the existing `ClaimsEnrichmentMiddleware`.

**Files to modify**:

| File | Change |
|------|--------|
| `Authorization/IClaimsEnricher.cs` | Update `ClaimsEnricher` to call `IIntegrationServicesClient`, extract permissions, add: `UserId`, `UserType`, `CompanyId`, `Role` (from filtered permission), `UserSupportedClaims` (from `ClaimList`) |

**Claims to add** (mirroring MN's `UserClaimsTransformer`):

```csharp
new Claim("portal:userId", response.Id.ToString())
new Claim("portal:userType", response.UserType)
new Claim("portal:companyId", response.CompanyId.ToString())
new Claim(ClaimTypes.Role, permission.RoleName)           // For RBAC policies
new Claim("portal:claims", permission.ClaimList)           // Comma-separated feature claims
new Claim("portal:email", response.Email)
```

**Important**: The `ClaimsEnrichmentMiddleware` already exists and calls `IClaimsEnricher.EnrichClaimsAsync()`. The only change is inside `ClaimsEnricher` — the middleware itself stays the same.

---

### Phase 4: Feature Authorization

**Goal**: Add claim-level authorization to Minimal API endpoints.

**Approach**: Use ASP.NET Core authorization policies instead of MN's `[EnforceClaimPermission]` attribute filter.

**In `Program.cs`**, register claim-based policies:

```csharp
builder.Services.AddAuthorization(options =>
{
    // Existing RBAC policies (ApiRead, ApiTryIt, etc.) remain

    // New claim-based policies
    options.AddPolicy("RequireViewApiCatalog", policy =>
        policy.RequireClaim("portal:claims", "VIEW_API_CATALOG"));
    options.AddPolicy("RequireManageSubscriptions", policy =>
        policy.RequireClaim("portal:claims", "MANAGE_SUBSCRIPTIONS"));
    options.AddPolicy("RequireViewAdminConsole", policy =>
        policy.RequireClaim("portal:claims", "VIEW_ADMIN_CONSOLE"));
});
```

**On endpoint groups**:

```csharp
// In ApisEndpoints.cs
group.MapGet("/", handler).RequireAuthorization("RequireViewApiCatalog");

// In AdminEndpoints.cs
group.MapGet("/registrations", handler).RequireAuthorization("RequireViewAdminConsole");
```

**Alternative**: Use a custom `IAuthorizationHandler` that checks comma-separated claims (more flexible, matches MN's OR-logic pattern). Create `PortalClaimRequirement` + `PortalClaimHandler`.

---

### Phase 5: User Profile Endpoint

**Goal**: Add `GET /api/users/me` that returns the full user profile (like MN's `/api/user/profile`).

**File**: `Endpoints/UserEndpoints.cs` (already exists — add the profile response)

**Response shape** (for the SPA):

```json
{
  "userId": 12345,
  "email": "john.doe@komatsu.com",
  "userType": "Distributor",
  "companyId": 42,
  "companyName": "ACME Corp",
  "permissions": [
    {
      "applicationName": "API Marketplace",
      "roleName": "Distributor",
      "claims": ["VIEW_API_CATALOG", "TRY_API", "VIEW_SUBSCRIPTIONS"]
    }
  ],
  "isSuccess": true
}
```

The SPA will call this on first load (after MSAL auth) to get the user's permissions, exactly like MN's `Authorization.jsx` calls `GET /api/user/profile`.

---

### Phase 6: SPA Integration

**Goal**: Wire the DAPIM SPA to use the new BFF profile endpoint.

**Files to modify** (in `mykomasu-dapim-frontend`):

| File | Change |
|------|--------|
| `src/lib/apiClient.ts` | Add `Authorization: Bearer ${accessToken}` header via `getAccessToken()` |
| `src/widgets/auth/AuthProvider.tsx` | After MSAL auth succeeds, call `GET /api/users/me` to fetch permissions; store in context |
| `src/widgets/auth/RoleGate.tsx` | Update to check both roles AND feature claims from the BFF response |
| `src/widgets/auth/useAuth.ts` | Expose `permissions` and `featureClaims` from context |
| `src/lib/store.ts` | Add `userInfo` to Zustand store (optional — could stay in AuthContext) |

**Key change**: Roles should come from the **BFF profile response** (server-authoritative), not from `idTokenClaims.roles` (client-side only):

```typescript
// Before (current — roles from token claims only)
const getRolesFromClaims = (account: AccountInfo | null): string[] => {
  const claims = account?.idTokenClaims as Record<string, unknown>
  return (claims?.roles as string[]) || []
}

// After (roles from BFF /api/users/me response)
const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null)
// Roles = userInfo.permissions[0].roleName
// Claims = userInfo.permissions[0].claims
```

---

### Phase 7: Hardening

**Goal**: Production-readiness improvements.

| Item | Priority | Description |
|------|----------|-------------|
| Redis distributed cache | P2 | Replace `IMemoryCache` with `IDistributedCache` (Redis) for multi-instance deployments |
| Token blacklisting | P2 | On logout, store `jti` in Redis with TTL = token expiry |
| OIDC key rotation | P2 | Cache OIDC discovery keys in Redis (like MN's `OpenIdConfigProviderFactory`) |
| Polly resilience | P2 | Add retry + circuit breaker to Integration Services HTTP client (already have `Microsoft.Extensions.Http.Resilience`) |
| Rate limiting | P3 | Add per-user rate limiting for subscription key regeneration endpoints |
| Correlation ID | P3 | Add `X-Correlation-Id` header to all Integration Services calls |

---

## 7. File Mapping: MN → DAPIM

| MN File | DAPIM Equivalent | Status |
|---------|------------------|--------|
| `SharedLibrary/Handlers/EntraTokenHandler.cs` | `Program.cs` (JwtBearer config) | ✅ Done (uses `Microsoft.Identity.Web` instead of custom handler) |
| `SharedLibrary/Transformers/UserClaimsTransformer.cs` | `Authorization/IClaimsEnricher.cs` + `Middleware/ClaimsEnrichmentMiddleware.cs` | ⚠️ Shell exists — needs Phase 3 |
| `SharedLibrary/Attributes/EnforceRolePermissionAttribute.cs` | `Authorization/ApiAccessHandler.cs` + `rbac-policies.json` | ✅ Done (different approach, same effect) |
| `SharedLibrary/Attributes/EnforceClaimPermissionAttribute.cs` | (new) `Authorization/PortalClaimHandler.cs` | ❌ Phase 4 |
| `Services/External/User/UserAccess.cs` | (refactor) `Services/IntegrationServicesClient.cs` | ❌ Phase 2 |
| `SharedLibrary/Models/ServiceModels/UserInfoResponse.cs` | (new) `Models/GlobalAdmin/UserInfoResponse.cs` | ❌ Phase 1 |
| `SharedLibrary/Constants/ClaimConstants.cs` | (new) `Authorization/PortalClaimConstants.cs` | ❌ Phase 1 |
| `BFFAPI/Extensions/ServiceExtension.cs` | `Program.cs` (DI in Minimal API) | ✅ Done |
| `Services/External/TokenService.cs` | Not needed — `Microsoft.Identity.Web` handles OIDC validation | ✅ N/A |
| `BFFAPI/Controllers/UserController.cs` (`/api/user/profile`) | `Endpoints/UserEndpoints.cs` (`/api/users/me`) | ⚠️ Endpoint exists — needs profile response in Phase 5 |

---

## 8. Configuration Reference

### Current `appsettings.json` (GlobalAdmin section):

```json
{
  "GlobalAdmin": {
    "BaseUrl": "https://apim-globaladmin-uat-jpneast-001.azure-api.net",
    "ApiKey": "",
    "RoleCacheMinutes": 30
  }
}
```

### Target `appsettings.json` (after Phase 2):

```json
{
  "IntegrationServices": {
    "BaseUrl": "https://apim-globaladmin-uat-jpneast-001.azure-api.net",
    "UserDetailsPath": "/integ-api/user-details",
    "ApiKey": "",
    "ApplicationName": "API Marketplace",
    "CacheMinutes": 30,
    "TimeoutSeconds": 15
  }
}
```

### Environment-specific overrides (`appsettings.Development.json`):

```json
{
  "IntegrationServices": {
    "BaseUrl": "https://apim-globaladmin-dev-jpneast-001.azure-api.net",
    "ApiKey": "<dev-subscription-key>"
  }
}
```

---

## 9. Testing Checklist

### Phase 1 — Models
- [ ] `UserInfoResponse` deserializes correctly from sample Global Admin JSON
- [ ] `Permissions` model handles comma-separated `ClaimList` parsing

### Phase 2 — Integration Services Client
- [ ] Mock HTTP handler returns sample `UserInfoResponse`
- [ ] Client caches response by email (verify cache hit on second call)
- [ ] Client handles 404 (unknown user) gracefully
- [ ] Client handles 500 (service unavailable) → returns null, does not crash
- [ ] Client handles timeout → returns null within configured timeout

### Phase 3 — Claims Enrichment
- [ ] Authenticated request has `portal:userId`, `portal:userType`, `portal:companyId` claims after middleware
- [ ] `ClaimTypes.Role` claim contains the correct role name from filtered permissions
- [ ] `portal:claims` contains feature claims for DAPIM's application name
- [ ] Unauthenticated request passes through without enrichment
- [ ] Failed enrichment in Production → proceeds without claims (fail-open)
- [ ] Failed enrichment in Development → throws (fail-closed)

### Phase 4 — Feature Authorization
- [ ] Endpoint with `.RequireAuthorization("RequireViewApiCatalog")` → 200 when user has claim
- [ ] Same endpoint → 403 when user lacks claim
- [ ] Admin role bypasses claim checks

### Phase 5 — User Profile Endpoint
- [ ] `GET /api/users/me` returns correct profile structure
- [ ] Unauthenticated request → 401
- [ ] User with no permissions → returns empty `permissions[]`

### Phase 6 — SPA Integration
- [ ] `apiClient.ts` sends `Authorization: Bearer {access_token}` header
- [ ] SPA fetches `/api/users/me` after MSAL login and stores in context
- [ ] `RoleGate` uses server-provided roles (not token claims)
- [ ] Feature claims gate UI components correctly

### Phase 7 — Hardening
- [ ] Redis cache stores and retrieves user info
- [ ] Token blacklist prevents reuse of logged-out tokens
- [ ] OIDC key rotation works without restart

---

## 10. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Global Admin team hasn't created "API Marketplace" application entry | **Blocker** for Phase 2 — no permissions will be returned | Coordinate early; use mock data until ready |
| Integration Services API contract differs from MN's usage | Medium — wrong endpoint or auth method | Obtain OpenAPI spec from Global Admin team; test with Postman before coding |
| DAPIM uses `access_token` but Integration Services validates `id_token` | Medium — service-to-service auth may fail | Clarify: BFF likely uses its own service credential (app registration), not the user's token |
| IMemoryCache lost on container restart (no Redis) | Low for dev; medium for prod | Phase 7 adds Redis; acceptable for MVP with 30-min TTL |
| Feature claims not yet defined for API Marketplace | Blocks Phase 4 | Define claims independently; map to Global Admin later |
| MN uses comma-separated `ClaimList` string | Low — easy to parse but fragile | Parse to `string[]` in model getter; validate no commas in claim names |

---

## Appendix A: MN Roles Reference

```
UserType → Roles (from EnforceRolePermissionAttribute):
  Employee    → KomatsuUser, KomatsuAdmin
  Subsidiary  → KomatsuUser, KomatsuAdmin
  Distributor → DealerUser, DealerAdmin
  Customer    → CustomerUser, CustomerAdmin
  WACCustomer → WildAreaCustomerUser, WildAreaCustomerAdmin
  Student     → StudentUser
  Supplier    → SupplierUser
```

**DAPIM's planned roles** (from design document):
- `Distributor`
- `Vendor`
- `Customer`
- `Admin` (Entra ID app role)

## Appendix B: MN Feature Claims Reference (Subset)

```
VIEW_SEARCH_DRAWER
VIEW_NOTIFICATION_CTR_DRAWER
VIEW_NOTIFICATION_CENTER_PAGE
VIEW_WAFFLE_MENU
VIEW_SHOPPING_CART_DRW
VIEW_ADMIN_CONSOLE_PAGE
VIEW_USER_PROFILE_DRAWER
VIEW_MN_APPLICATIONS_LIST_PAGE
VIEW_MN_CONTACT_CENTER
VIEW_MEMBERNETWORK_HOMEPAGE
VIEW_MN_HOMEPAGE_BUSINESS_TAB
VIEW_MN_HOMEPAGE_MACHINE_HEALTH_TAB
```

**DAPIM's proposed feature claims** (to be registered in Global Admin):

```
VIEW_API_CATALOG           — Browse API listing
VIEW_API_DETAIL            — View API documentation and operations
TRY_API                    — Use Try-It sandbox
VIEW_SUBSCRIPTIONS         — View own APIM subscriptions
MANAGE_SUBSCRIPTIONS       — Create/regenerate/delete subscriptions
VIEW_PRODUCTS              — Browse product catalog
VIEW_ADMIN_CONSOLE         — Access admin dashboard
MANAGE_REGISTRATIONS       — Approve/reject partner registrations
VIEW_SUPPORT               — Access support/FAQ page
CREATE_SUPPORT_TICKET      — Submit support tickets
VIEW_ANALYTICS             — View platform analytics/stats
```
