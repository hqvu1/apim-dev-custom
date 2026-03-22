# Komatsu.ApimMarketplace.Bff.Tests — Test Project Documentation

> **Project:** `Komatsu.ApimMarketplace.Bff.Tests`
> **Target:** .NET 10 · xUnit 2.9 · NSubstitute 5.3
> **SUT:** `Komatsu.ApimMarketplace.Bff` (ASP.NET Core Minimal API)

---

## Quick Start

```bash
# Run all tests
cd bff-dotnet
dotnet test Komatsu.ApimMarketplace.Bff.Tests/Komatsu.ApimMarketplace.Bff.Tests.csproj

# Run a specific test class
dotnet test --filter "FullyQualifiedName~RbacPolicyProviderTests"

# Run with verbose output
dotnet test Komatsu.ApimMarketplace.Bff.Tests/Komatsu.ApimMarketplace.Bff.Tests.csproj -v n
```

---

## Project Structure

```
Komatsu.ApimMarketplace.Bff.Tests/
├── BffWebApplicationFactory.cs          # WebApplicationFactory + TestAuthHandler + helpers
├── Authorization/
│   ├── ApiAccessHandlerTests.cs         # 7 tests  — RBAC handler (dev mode, roles, claims)
│   └── RbacPolicyProviderTests.cs       # 13 tests — Policy evaluation (permissions, wildcards)
├── Endpoints/
│   ├── ApisEndpointsTests.cs            # 11 tests — /api/apis (CRUD, pagination, try-config)
│   ├── MiscEndpointsTests.cs            # 8 tests  — /api/tags, stats, news, users, products, health
│   ├── PortalEndpointsTests.cs          # 13 tests — /api/support, registration, admin
│   └── SubscriptionsEndpointsTests.cs   # 9 tests  — /api/subscriptions (CRUD, secrets, keys)
└── Middleware/
    └── MiddlewareTests.cs               # 3 tests  — RequestLogging, SecurityHeaders
                                         ─────────
                                          64 total
```

---

## Test Categories

### 1. Authorization (20 unit tests)

Pure unit tests using **NSubstitute** mocks. No HTTP server needed.

#### `RbacPolicyProviderTests` — 13 tests

Tests the `RbacPolicyProvider` which loads role-to-API permission mappings from `rbac-policies.json`.

| Test | Verifies |
|------|----------|
| `HasGeneralPermission_ReturnsTrue_WhenRoleHasPermission` | Role with matching permission passes |
| `HasGeneralPermission_ReturnsFalse_WhenRoleLacksPermission` | Role without the permission is denied |
| `HasGeneralPermission_ReturnsFalse_WhenRoleNotConfigured` | Unknown roles are denied |
| `HasGeneralPermission_IsCaseInsensitive` | Role and permission matching is case-insensitive |
| `HasApiPermission_ReturnsTrue_WithWildcardApis` | `"*"` wildcard grants access to any API |
| `HasApiPermission_ReturnsTrue_WhenApiExplicitlyListed` | Explicit API ID match grants access |
| `HasApiPermission_ReturnsFalse_WhenApiNotListed` | Unlisted API is denied |
| `HasApiPermission_ReturnsFalse_WhenPermissionNotGranted` | Correct API but wrong permission is denied |
| `HasApiPermission_ChecksMultipleRoles` | User with multiple roles gets union of permissions |
| `GetAccessibleApis_ReturnsNull_WhenWildcard` | Wildcard returns `null` (means "all APIs") |
| `GetAccessibleApis_ReturnsSpecificApis` | Returns exact set of permitted API IDs |
| `GetAccessibleApis_AggregatesAcrossMultipleRoles` | Aggregates APIs from all matching roles |
| `GetAccessibleApis_ReturnsEmpty_WhenNoMatchingPermission` | No matching permission returns empty set |

#### `ApiAccessHandlerTests` — 7 tests

Tests the `ApiAccessHandler` which enforces RBAC on every protected request.

| Test | Verifies |
|------|----------|
| `Succeeds_WhenDevUser_InDevelopment` | Synthetic `dev-user` identity gets full access in dev |
| `Succeeds_WhenAdminRole` | Admin role always succeeds (fast path) |
| `Succeeds_WhenDeveloperRole_HasReadPermission` | Developer with `read` permission passes |
| `Fails_WhenDeveloperRole_LacksManagePermission` | Developer without `manage` is denied |
| `Fails_WhenNoUserIdInToken_InProduction` | Missing `oid`/`sub` claim is denied in production |
| `Succeeds_WhenNoUserId_InDevelopment_AndAuthenticated` | Dev mode fallback grants access when authenticated |
| `Succeeds_WhenNoRolesReturned_InDevelopment` | Dev mode fallback when Global Admin returns no roles |

---

### 2. Endpoint Integration Tests (41 tests)

Integration tests using `WebApplicationFactory<Program>`. A real ASP.NET Core test server runs with `MockApiService` providing data, and `TestAuthHandler` auto-authenticating all requests as an Admin user.

#### `ApisEndpointsTests` — 11 tests

| Test | Endpoint | Verifies |
|------|----------|----------|
| `ListApis_ReturnsOk_WithPagedResult` | `GET /api/apis` | Returns paged API list |
| `ListApis_SupportsPagination` | `GET /api/apis?top=1&skip=0` | `$top`/`$skip` passthrough |
| `ListHighlights_ReturnsOk_WithArray` | `GET /api/apis/highlights` | Returns ≤3 highlighted APIs |
| `GetApi_ReturnsOk_ForExistingApi` | `GET /api/apis/warranty-api` | Returns single API by ID |
| `GetApi_ReturnsNotFound_ForMissingApi` | `GET /api/apis/nonexistent-api` | 404 for unknown API |
| `ListOperations_ReturnsOk_WithOperations` | `GET /api/apis/{id}/operations` | Returns operations list |
| `ListApiProducts_ReturnsOk` | `GET /api/apis/{id}/products` | Returns linked products |
| `GetApiSubscriptionStatus_ReturnsOk` | `GET /api/apis/{id}/subscription` | Per-API subscription status |
| `GetTryItConfig_ReturnsOperationLabels` | `GET /api/apis/{id}/try-config` | Try-It console config |
| `ListChangeLog_ReturnsOk` | `GET /api/apis/{id}/releases` | Changelog endpoint |
| `ListHostnames_ReturnsOk` | `GET /api/apis/{id}/hostnames` | API hostnames |

#### `SubscriptionsEndpointsTests` — 9 tests

| Test | Endpoint | Verifies |
|------|----------|----------|
| `ListSubscriptions_ReturnsOk_WithPagedResult` | `GET /api/subscriptions` | Returns paged subscriptions |
| `GetSubscription_ReturnsOk_ForExisting` | `GET /api/subscriptions/{id}` | Single subscription by ID |
| `GetSubscription_ReturnsNotFound_ForMissing` | `GET /api/subscriptions/{id}` | 404 for unknown sub |
| `CreateSubscription_ReturnsCreated` | `POST /api/subscriptions` | Creates with 201 + body |
| `DeleteSubscription_ReturnsNoContent` | `DELETE /api/subscriptions/{id}` | Deletes with 204 |
| `ListSecrets_ReturnsOk_WithKeys` | `POST /api/subscriptions/{id}/secrets` | Returns primary/secondary keys |
| `RegeneratePrimaryKey_ReturnsOk` | `POST …/regeneratePrimaryKey` | Key rotation succeeds |
| `RegenerateSecondaryKey_ReturnsOk` | `POST …/regenerateSecondaryKey` | Key rotation succeeds |
| `GetMySubscriptions_ReturnsOk_ViaUserAlias` | `GET /api/users/me/subscriptions` | Alias route works |

#### `MiscEndpointsTests` — 8 tests

| Test | Endpoint | Verifies |
|------|----------|----------|
| `ListTags_ReturnsOk_WithTags` | `GET /api/tags` | Tag listing for catalog filters |
| `GetStats_ReturnsOk_WithCounts` | `GET /api/stats` | Platform statistics (API/product/sub counts) |
| `GetNews_ReturnsOk_WithItems` | `GET /api/news` | News feed returns items |
| `GetCurrentUser_ReturnsOk_WithProfile` | `GET /api/users/me` | Profile from MSAL token claims |
| `ListProducts_ReturnsOk` | `GET /api/products` | Product catalog list |
| `GetProduct_ReturnsOk_ForExisting` | `GET /api/products/starter` | Single product by ID |
| `GetProduct_ReturnsNotFound_ForMissing` | `GET /api/products/nonexistent` | 404 for unknown product |
| `Health_ReturnsOk_Anonymous` | `GET /api/health` | Health probe (no auth required) |

#### `PortalEndpointsTests` — 13 tests

Tests for the portal-specific endpoints that unblock the SPA (Support, Registration, Admin).

| Test | Endpoint | Verifies |
|------|----------|----------|
| `GetFaqs_ReturnsOk_WithFaqList` | `GET /api/support/faqs` | FAQ list for knowledge base |
| `CreateTicket_ReturnsCreated` | `POST /api/support/tickets` | Ticket creation with 201 |
| `GetMyTickets_ReturnsOk` | `GET /api/support/my-tickets` | User's ticket history |
| `CreateTicket_ThenGetMyTickets_ContainsNewTicket` | `POST` then `GET` | End-to-end ticket flow |
| `GetRegistrationConfig_ReturnsFields` | `GET /api/registration/config` | Dynamic form fields |
| `SubmitRegistration_ReturnsCreated` | `POST /api/registration` | Registration with 201 |
| `GetRegistrationStatus_ReturnsStatus` | `GET /api/registration/status` | Onboarding status check |
| `ListRegistrations_ReturnsOk` | `GET /api/admin/registrations` | Admin: list all registrations |
| `ListRegistrations_FiltersByPending` | `GET …?status=pending` | Admin: filter by status |
| `ApproveRegistration_ReturnsOk` | `POST …/{id}/approve` | Admin: approve → status="Approved" |
| `RejectRegistration_ReturnsOk` | `POST …/{id}/reject` | Admin: reject → status="Rejected" |
| `ApproveRegistration_ReturnsNotFound_ForMissing` | `POST …/NONEXISTENT/approve` | 404 for unknown reg |
| `GetAdminMetrics_ReturnsOk_WithMetrics` | `GET /api/admin/metrics` | Admin metrics with labels |

---

### 3. Middleware (3 unit tests)

| Test | Class | Verifies |
|------|-------|----------|
| `InvokeAsync_LogsRequestAndResponse` | `RequestLoggingMiddleware` | Logs method, path, status, elapsed |
| `InvokeAsync_LogsError_WhenExceptionThrown` | `RequestLoggingMiddleware` | Logs error on exception |
| `InvokeAsync_AddsSecurityHeaders` | `SecurityHeadersMiddleware` | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |

---

## Test Infrastructure

### `BffWebApplicationFactory`

Custom `WebApplicationFactory<Program>` that configures the test host:

- **Environment:** `Development`
- **Config:** `Features:UseMockMode = true`
- **Auth:** `TestAuthHandler` registered as `"Test"` scheme, set as default via `PostConfigure<AuthenticationOptions>`
- **RBAC:** All named policies (`ApiRead`, `ApiTryIt`, `ApiSubscribe`, `ApiManage`) overridden to require only authentication (bypasses `ApiAccessHandler` + `IRoleProvider`)
- **Data:** `MockApiService` provides in-memory mock data (no external Azure calls)

### `TestAuthHandler`

Auto-authenticates every request with the following identity:

| Claim | Value |
|-------|-------|
| `sub` | `test-user` |
| `oid` | `test-user` |
| `name` | `Test User` |
| `preferred_username` | `test@localhost` |
| `roles` | `Admin` |

### `TestHelpers`

Extension method `ReadJsonAsync<T>()` for deserializing JSON responses with case-insensitive property matching.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `xunit` | 2.9.3 | Test framework |
| `xunit.runner.visualstudio` | 3.1.4 | VS Test Explorer integration |
| `Microsoft.NET.Test.Sdk` | 17.14.1 | Test host runtime |
| `NSubstitute` | 5.3.0 | Mocking framework (for unit tests) |
| `Microsoft.AspNetCore.Mvc.Testing` | 10.0.4 | `WebApplicationFactory` for integration tests |
| `coverlet.collector` | 6.0.4 | Code coverage collection |

---

## Coverage Map

| BFF Layer | Test File | Coverage |
|-----------|-----------|----------|
| **RBAC Policy Engine** | `RbacPolicyProviderTests` | Permission checks, wildcards, multi-role, case-insensitivity |
| **RBAC Auth Handler** | `ApiAccessHandlerTests` | Dev mode, admin fast-path, role lookup, missing claims |
| **API Catalog** | `ApisEndpointsTests` | List, get, pagination, operations, products, highlights, try-config |
| **Subscriptions** | `SubscriptionsEndpointsTests` | CRUD, secrets, key rotation, user alias |
| **Tags / Stats / News / Users / Products / Health** | `MiscEndpointsTests` | All miscellaneous endpoints |
| **Support / Registration / Admin** | `PortalEndpointsTests` | Tickets, FAQs, registration CRUD, admin approve/reject, metrics |
| **Middleware** | `MiddlewareTests` | Request logging, error logging, security headers |

### Not Yet Covered

| Component | Reason |
|-----------|--------|
| `ArmApiService` | Requires ARM API mocking (HTTP message handler); out of scope for unit tests |
| `DataApiService` | Requires APIM Data API mocking; covered indirectly via `MockApiService` |
| `GlobalAdminRoleProvider` | External HTTP dependency; `IRoleProvider` is mocked in `ApiAccessHandlerTests` |
| `SoapLegacyApiService` | Legacy SOAP integration; requires dedicated HTTP mocking |

---

## Running in CI

```yaml
# Azure DevOps / GitHub Actions step
- name: Run BFF tests
  run: |
    cd bff-dotnet
    dotnet test Komatsu.ApimMarketplace.Bff.Tests/Komatsu.ApimMarketplace.Bff.Tests.csproj \
      --configuration Release \
      --logger "trx;LogFileName=test-results.trx" \
      --collect:"XPlat Code Coverage"
```

---

## Known Issues Discovered by Tests

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `/api/apis` returning empty bodies | `LegacyApiMonitoringMiddleware` didn't reset `MemoryStream.Position` before `CopyToAsync` | Added `memoryStream.Position = 0;` in `finally` block |
