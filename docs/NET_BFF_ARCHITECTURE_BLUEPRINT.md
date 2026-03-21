# .NET BFF Architecture Blueprint

> **Canonical reference** for building .NET Backend-for-Frontend (BFF) services in this project and future React + .NET full-stack applications.  
> Drawn entirely from the production implementation in [`bff-dotnet/`](../bff-dotnet/).

---

## Table of Contents

1. [Overview & Architecture Diagram](#1-overview--architecture-diagram)
2. [Project Structure](#2-project-structure)
3. [Composition Root (Program.cs)](#3-composition-root-programcs)
4. [Authentication: Multi-Tenant JWT Validation](#4-authentication-multi-tenant-jwt-validation)
5. [Authorization: RBAC Pipeline](#5-authorization-rbac-pipeline)
6. [Service Layer: Strategy Pattern](#6-service-layer-strategy-pattern)
7. [Role Provider: Global Admin Integration](#7-role-provider-global-admin-integration)
8. [Token Provider: Credential Chain](#8-token-provider-credential-chain)
9. [Resilient HTTP Clients](#9-resilient-http-clients)
10. [Middleware Stack](#10-middleware-stack)
11. [Minimal API Endpoint Groups](#11-minimal-api-endpoint-groups)
12. [Configuration Reference](#12-configuration-reference)
13. [Frontend ↔ BFF Contract](#13-frontend--bff-contract)
14. [Deployment Model](#14-deployment-model)
15. [Testing Strategy](#15-testing-strategy)
16. [Best Practices Checklist](#16-best-practices-checklist)
17. [End-to-End Data Flow & Fetch Reference](#17-end-to-end-data-flow--fetch-reference)
    - [17.1 Master Data Flow Diagram](#171-master-data-flow-diagram)
    - [17.2 Inbound: SPA → BFF](#172-inbound-spa--bff)
    - [17.3 BFF Middleware Pipeline](#173-bff-middleware-pipeline-per-request-processing)
    - [17.4 Outbound: BFF → ARM Management API](#174-outbound-bff--arm-management-api)
    - [17.5 Outbound: BFF → APIM Data API](#175-outbound-bff--apim-data-api)
    - [17.6 Outbound: BFF → Global Admin API](#176-outbound-bff--global-admin-api-role-provider)
    - [17.7 Outbound: BFF → Legacy SOAP APIs](#177-outbound-bff--legacy-soap-apis)
    - [17.8 Complete Endpoint → Data Source Map](#178-complete-endpoint--data-source-map)
    - [17.9 Page-Level Fetch Orchestration](#179-page-level-fetch-orchestration)
    - [17.10 Resilience & Error Handling Matrix](#1710-resilience--error-handling-matrix)
    - [17.11 Token Flow Diagram](#1711-token-flow-diagram)

---

## 1. Overview & Architecture Diagram

The BFF sits between the React SPA and Azure API Management (APIM). Nginx proxies all `/api/*` traffic to the BFF on port 3001; the BFF validates JWTs, enforces RBAC, acquires service-principal tokens, and forwards requests to either the ARM Management API or the APIM Data API.

```
┌────────────────────────────────────────────────────────────────────┐
│                     Container (Port 8080)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Nginx (reverse proxy)                                       │  │
│  │  ├─ /          → React SPA (static files)                   │  │
│  │  └─ /api/*     → BFF :3001                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  .NET 10 Minimal API BFF (:3001)                             │  │
│  │  ├─ JWT Bearer (Entra ID / MSAL)                             │  │
│  │  ├─ RBAC Authorization (rbac-policies.json)                  │  │
│  │  ├─ IHttpClientFactory + Resilience                          │  │
│  │  ├─ IMemoryCache (response dedup)                            │  │
│  │  └─ Structured Logging                                       │  │
│  └──────────┬──────────────┬──────────────┬────────────────────┘  │
│             │              │              │                        │
│             ▼              ▼              ▼                        │
│     ARM Mgmt API    Data API     Global Admin API                 │
│     (APIM)          (APIM)       (Roles)                          │
└────────────────────────────────────────────────────────────────────┘
```

**Key characteristics:**

| Concern | Approach |
|---------|----------|
| SPA framework | React + Vite + TypeScript |
| BFF runtime | .NET 10 Minimal API |
| Auth | Entra ID JWT Bearer (MSAL) — multi-tenant |
| APIM backend | ARM Management API or APIM Data API |
| Deployment | Azure Container Apps — Nginx + supervisord |

---

## 2. Project Structure

```
bff-dotnet/
├── BffApi.slnx                         # Solution file
├── README.md                           # Quick-start guide
├── LEGACY_API_SCAFFOLDING_STATUS.md    # Legacy SOAP bridge status
│
├── BffApi/                             # Main application
│   ├── Program.cs                      # Composition root (DI + middleware + endpoints)
│   ├── BffApi.csproj                   # .NET 10, NuGet references
│   ├── appsettings.json                # Production defaults
│   ├── appsettings.Development.json    # Mock mode enabled, relaxed auth
│   ├── rbac-policies.json              # Role → permission mapping (hot-reload)
│   ├── rbac-config-example.json        # Annotated example RBAC config
│   ├── api-registry.json               # API source registry
│   │
│   ├── Authorization/                  # RBAC subsystem
│   │   ├── Permissions.cs              # Permission enum (Read, TryIt, Subscribe, Manage)
│   │   ├── ApiAccessRequirement.cs     # IAuthorizationRequirement wrapper
│   │   ├── ApiAccessHandler.cs         # IAuthorizationHandler — evaluates RBAC
│   │   ├── RbacPolicyProvider.cs       # Loads rbac-policies.json; HasGeneralPermission / HasApiPermission
│   │   ├── ResourceOwnershipHandler.cs # Ownership check (subscription owner)
│   │   ├── IClaimsEnricher.cs          # Interface for JWT claims enrichment
│   │   └── RoleDefinition.cs           # Role definition models
│   │
│   ├── Endpoints/                      # Minimal API route groups (extension methods)
│   │   ├── ApisEndpoints.cs            # /api/apis/* — 12 endpoints
│   │   ├── ProductsEndpoints.cs        # /api/products
│   │   ├── SubscriptionsEndpoints.cs   # /api/subscriptions/* — full lifecycle
│   │   ├── MiscEndpoints.cs            # /api/tags, /api/users/me, /api/stats, /api/news, /api/health
│   │   ├── AdminEndpoints.cs           # /api/admin/* — admin operations
│   │   ├── SupportEndpoints.cs         # /api/support
│   │   └── RegistrationEndpoints.cs    # /api/registration
│   │
│   ├── Middleware/                     # Cross-cutting concerns
│   │   ├── RequestLoggingMiddleware.cs  # Structured {Method} {Path} → {Status} ({Elapsed}ms)
│   │   ├── SecurityHeadersMiddleware.cs # X-Content-Type-Options, X-Frame-Options, etc.
│   │   ├── PortalTelemetryHandler.cs    # DelegatingHandler: x-ms-apim-client outbound header
│   │   ├── ClaimsEnrichmentMiddleware.cs # Enriches ClaimsPrincipal from Global Admin
│   │   └── LegacyApiMonitoringMiddleware.cs # Latency + error tracking for /api/apis
│   │
│   ├── Models/                         # DTO / contract shapes
│   │   ├── ApimContracts.cs            # PagedResult<T>, ApiContract, OperationContract, etc.
│   │   ├── PortalContracts.cs          # Portal-specific response models
│   │   └── LegacyModels.cs             # Legacy API response shapes
│   │
│   └── Services/                       # External API clients
│       ├── IArmApiService.cs           # Unified service interface (strategy target)
│       ├── ArmApiService.cs            # ARM Management API client + ARM→contract transform
│       ├── DataApiService.cs           # APIM Data API client (flat JSON, user-scoped)
│       ├── MockApiService.cs           # Full offline mock with static in-memory data
│       ├── UnifiedApiService.cs        # Combines cloud + legacy catalog
│       ├── AppRegistrationTokenProvider.cs  # ITokenProvider — SP credential + DefaultAzureCredential
│       ├── GlobalAdminRoleProvider.cs  # IRoleProvider — roles from Global Admin API (cached 30 min)
│       └── Legacy/                     # Legacy SOAP / binary API bridge
│           ├── ILegacyApiService.cs
│           ├── SoapLegacyApiService.cs
│           ├── LegacyAuthenticationBridge.cs
│           └── LegacySubscriptionService.cs
│
└── BffApi.Tests/                       # xUnit integration + unit tests
    ├── BffApi.Tests.csproj
    ├── BffWebApplicationFactory.cs     # WebApplicationFactory<Program>
    ├── Authorization/
    │   ├── ApiAccessHandlerTests.cs
    │   └── RbacPolicyProviderTests.cs
    ├── Endpoints/
    │   ├── ApisEndpointsTests.cs
    │   ├── SubscriptionsEndpointsTests.cs
    │   ├── MiscEndpointsTests.cs
    │   └── PortalEndpointsTests.cs
    └── Middleware/
        └── MiddlewareTests.cs          # RequestLogging + SecurityHeaders
```

---

## 3. Composition Root (Program.cs)

`bff-dotnet/BffApi/Program.cs` is the single composition root that wires together configuration, DI services, the middleware pipeline, and endpoint groups. The file is deliberately ordered so each concern is visible in one place.

### 3.1 Step-by-Step Walkthrough

#### Step 1 — Configuration Binding

```csharp
// IOptions<T> for each config section
builder.Services.Configure<ApimSettings>(
    builder.Configuration.GetSection(ApimSettings.SectionName));
builder.Services.Configure<ServicePrincipalSettings>(
    builder.Configuration.GetSection($"{ApimSettings.SectionName}:ServicePrincipal"));
builder.Services.Configure<GlobalAdminSettings>(
    builder.Configuration.GetSection(GlobalAdminSettings.SectionName));

// Hot-reload RBAC policies from rbac-policies.json (IOptionsMonitor)
builder.Configuration.AddJsonFile("rbac-policies.json", optional: true, reloadOnChange: true);
builder.Services.Configure<RbacPoliciesConfig>(builder.Configuration);

var useMockMode = builder.Configuration.GetValue<bool>("Features:UseMockMode");
```

`reloadOnChange: true` means an admin can update `rbac-policies.json` at runtime and the change takes effect within seconds — no restart required.

#### Step 2 — JSON Serialization

```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition =
        JsonIgnoreCondition.WhenWritingNull;
});
```

All API responses use camelCase and omit null properties, matching the SPA's TypeScript interfaces.

#### Step 3 — Authentication

Three branches depending on the environment and configuration:

| Branch | Condition | Behaviour |
|--------|-----------|-----------|
| Mock Dev | `useMockMode && IsDevelopment` | Skip validation; auto-inject `dev-user` Admin identity |
| Multi-tenant | `TenantId` and `ClientId` configured | Full JWT validation; keys aggregated from workforce + CIAM OIDC endpoints |
| Dev fallback | `IsDevelopment` only | Accept any token; skip signature check |

See [Section 4](#4-authentication-multi-tenant-jwt-validation) for the multi-tenant key resolver.

#### Step 4 — Authorization

```csharp
var authBuilder = builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiRead",      p => p.AddRequirements(new ApiAccessRequirement(Permission.Read)))
    .AddPolicy("ApiTryIt",     p => p.AddRequirements(new ApiAccessRequirement(Permission.TryIt)))
    .AddPolicy("ApiSubscribe", p => p.AddRequirements(new ApiAccessRequirement(Permission.Subscribe)))
    .AddPolicy("ApiManage",    p => p.AddRequirements(new ApiAccessRequirement(Permission.Manage)));

if (useMockMode && builder.Environment.IsDevelopment())
{
    // Allow anonymous in mock mode so endpoints work without JWT
    authBuilder.SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAssertion(_ => true).Build());
}

builder.Services.AddSingleton<IAuthorizationHandler, ApiAccessHandler>();
builder.Services.AddSingleton<RbacPolicyProvider>();
```

#### Step 5 — HttpClient + Resilience

Three named clients are registered with `AddStandardResilienceHandler` (see [Section 9](#9-resilient-http-clients)):

```csharp
builder.Services.AddTransient<PortalTelemetryHandler>();

builder.Services.AddHttpClient("ArmApi", ...)
    .AddHttpMessageHandler<PortalTelemetryHandler>()
    .AddStandardResilienceHandler(options => { /* retry 3x, 30s/90s timeout */ });

builder.Services.AddHttpClient("DataApi", ...)
    .AddHttpMessageHandler<PortalTelemetryHandler>()
    .AddStandardResilienceHandler(options => { /* retry 3x, 30s/90s timeout */ });

builder.Services.AddHttpClient("GlobalAdmin", ...)
    .AddStandardResilienceHandler(options => { /* retry 2x, 10s/30s timeout */ });
```

#### Step 6 — Service Registration (Strategy Pattern)

```csharp
var useDataApi = apimSettings?.UseDataApi ?? false;

if (useMockMode)
    builder.Services.AddSingleton<IArmApiService, MockApiService>();
else if (useDataApi)
    builder.Services.AddScoped<IArmApiService, DataApiService>();
else
    builder.Services.AddScoped<IArmApiService, ArmApiService>();
```

The SPA-facing code calls `IArmApiService`; the concrete implementation is chosen by feature flags without changing any endpoint code.

#### Step 7 — Role Provider

```csharp
if (useMockMode)
    builder.Services.AddSingleton<IRoleProvider, MockRoleProvider>();
else
    builder.Services.AddSingleton<IRoleProvider, GlobalAdminRoleProvider>();
```

`MockRoleProvider` returns `["Distributor"]` (all permissions) in development.  
`GlobalAdminRoleProvider` calls the Global Admin API and caches results for 30 minutes.

#### Step 8 — Token Provider

```csharp
if (!useMockMode)
    builder.Services.AddSingleton<ITokenProvider, AppRegistrationTokenProvider>();
```

`AppRegistrationTokenProvider` tries `ClientSecretCredential` first; falls back to `DefaultAzureCredential` on failure or ARM 403.

#### Step 9 — CORS

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
```

Development: `AllowAnyOrigin` so the Vite dev server on `:5173` can hit the BFF.  
Production: Nginx enforces same-origin; CORS policy is effectively unused.

#### Step 10 — OpenAPI / Scalar (dev only)

```csharp
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
}
// ...
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();   // /scalar/v1
}
```

#### Step 11 — Middleware Pipeline

Order matters; the pipeline is assembled exactly as shown:

```
LegacyApiMonitoringMiddleware   ← monitors /api/apis calls
MapOpenApi / MapScalarApiReference  ← dev only, before auth
RequestLoggingMiddleware         ← logs every request
SecurityHeadersMiddleware        ← adds security response headers
UseCors()
UseAuthentication()
UseAuthorization()
```

#### Step 12 — Endpoint Mapping

```csharp
app.MapApisEndpoints();
app.MapApisByTagsEndpoints();
app.MapApiVersionSetEndpoints();
app.MapTagsEndpoints();
app.MapProductsEndpoints();
app.MapSubscriptionsEndpoints();
app.MapStatsEndpoints();
app.MapNewsEndpoints();
app.MapUserEndpoints();
app.MapSupportEndpoints();
app.MapRegistrationEndpoints();
app.MapAdminEndpoints();
app.MapHealthEndpoints();
```

Each `Map*Endpoints()` is an extension method on `WebApplication` defined in the corresponding `Endpoints/*.cs` file. This keeps `Program.cs` free of route definitions.

#### Step 13 — Startup Banner

```csharp
app.Lifetime.ApplicationStarted.Register(() =>
{
    app.Logger.LogInformation("APIM Portal BFF (.NET 10) Started");
    app.Logger.LogInformation("API Mode: {Mode}", useMockMode ? "Mock" : ...);
    app.Logger.LogInformation("Auth: {Mode}", ...);
    // Global Admin URL, Data API URL, RBAC config, etc.
});
```

The banner logs the effective configuration on startup — useful for diagnosing misconfiguration in containers.

#### Step 14 — Testability

```csharp
// Bottom of Program.cs
namespace BffApi { public partial class Program; }
```

The `partial class Program` declaration makes `Program` accessible to `WebApplicationFactory<Program>` in the test project without exposing internals.

### 3.2 Design Patterns Summary

| Pattern | Implementation |
|---------|---------------|
| Configuration Binding | `IOptions<T>` with `IOptionsMonitor<T>` hot-reload for RBAC |
| Strategy Pattern | `IArmApiService` → `MockApiService` / `ArmApiService` / `DataApiService` |
| Factory Pattern | `IHttpClientFactory` with three named clients |
| Fail-Closed Security | `GlobalAdminRoleProvider` returns `[]` on error → RBAC denies |
| Mock Mode | Feature flag `Features:UseMockMode` swaps all live services for dev stubs |
| Testability | `partial class Program` for `WebApplicationFactory<Program>` |
| Extension Methods | `Map*Endpoints()` keep `Program.cs` readable |

---

## 4. Authentication: Multi-Tenant JWT Validation

Source: `bff-dotnet/BffApi/Program.cs` lines 109–233.

### 4.1 Problem

The SPA can authenticate users via two Entra ID tenants:

- **Workforce tenant** — internal employees (`login.microsoftonline.com/{tenantId}`)
- **CIAM tenant** — external users (`{ciamHost}/{externalTenantId}`)

Standard `options.Authority` only supports a single OIDC endpoint. Setting it to one tenant will reject tokens from the other.

### 4.2 Solution: Aggregated IssuerSigningKeyResolver

```csharp
var metadataAddresses = new List<string>
{
    $"{instance}{tenantId}/v2.0/.well-known/openid-configuration"
};

if (!string.IsNullOrWhiteSpace(externalTenantId) && !string.IsNullOrWhiteSpace(ciamHost))
{
    metadataAddresses.Add(
        $"https://{ciamHost}/{externalTenantId}/v2.0/.well-known/openid-configuration");
}

// ConfigurationManager<OpenIdConnectConfiguration> caches JWKS automatically.
var configManagers = metadataAddresses
    .Select(addr => new ConfigurationManager<OpenIdConnectConfiguration>(
        addr,
        new OpenIdConnectConfigurationRetriever(),
        new HttpDocumentRetriever()))
    .ToList();

options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer           = true,
    ValidIssuers             = entra.GetSection("ValidIssuers").Get<string[]>() ?? [],
    ValidateAudience         = true,
    ValidAudiences           = validAudiences,
    ValidateIssuerSigningKey = true,
    RoleClaimType            = "roles",
    NameClaimType            = "preferred_username",

    // Aggregate signing keys from ALL configured OIDC endpoints
    IssuerSigningKeyResolver = (token, securityToken, kid, validationParameters) =>
    {
        return configManagers
            .SelectMany(cm =>
            {
                try
                {
                    var cfg = cm.GetConfigurationAsync(CancellationToken.None)
                                 .GetAwaiter().GetResult();
                    return cfg.SigningKeys;
                }
                catch
                {
                    return Enumerable.Empty<SecurityKey>(); // fail-safe
                }
            })
            .ToList();
    }
};
```

### 4.3 Development Fallback

When no `Authorization` header is present in Development mode, a synthetic identity is injected automatically:

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = ctx =>
    {
        if (builder.Environment.IsDevelopment()
            && string.IsNullOrEmpty(ctx.Request.Headers.Authorization))
        {
            var claims = new[]
            {
                new Claim("sub", "dev-user"),
                new Claim("name", "Local Developer"),
                new Claim("preferred_username", "dev@localhost"),
                new Claim("roles", "Admin"),
            };
            ctx.Principal = new ClaimsPrincipal(
                new ClaimsIdentity(claims, "DevAuth"));
            ctx.Success();
        }
        return Task.CompletedTask;
    }
};
```

### 4.4 Best Practices

| Practice | Why |
|----------|-----|
| No `options.Authority` | Prevents single-tenant lock-in when multi-tenant is needed |
| `ConfigurationManager<OpenIdConnectConfiguration>` | Auto-caches JWKS; refreshes on key rotation |
| `ValidIssuers` from config | Easy to update without code changes |
| Dev fallback identity | Enables local development without a full Entra ID setup |
| Fail-safe key resolver | Returns `[]` on OIDC fetch error instead of throwing |

---

## 5. Authorization: RBAC Pipeline

### 5.1 Policy-Based Authorization

Four named policies map directly to the `Permission` enum:

```csharp
public enum Permission { Read, TryIt, Subscribe, Manage }
```

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiRead",      p => p.AddRequirements(new ApiAccessRequirement(Permission.Read)))
    .AddPolicy("ApiTryIt",     p => p.AddRequirements(new ApiAccessRequirement(Permission.TryIt)))
    .AddPolicy("ApiSubscribe", p => p.AddRequirements(new ApiAccessRequirement(Permission.Subscribe)))
    .AddPolicy("ApiManage",    p => p.AddRequirements(new ApiAccessRequirement(Permission.Manage)));
```

Each endpoint declares its required policy:

```csharp
app.MapGet("/api/apis", ...)
    .RequireAuthorization("ApiRead");

app.MapPost("/api/subscriptions", ...)
    .RequireAuthorization("ApiSubscribe");
```

In mock mode, the fallback policy allows anonymous access so all endpoints are reachable during local development.

### 5.2 ApiAccessHandler

`bff-dotnet/BffApi/Authorization/ApiAccessHandler.cs`

`ApiAccessHandler` is the `IAuthorizationHandler` that executes RBAC checks for every protected request:

```csharp
public sealed class ApiAccessHandler(
    RbacPolicyProvider rbac,
    IRoleProvider roleProvider,
    ILogger<ApiAccessHandler> logger,
    IHostEnvironment env)
    : AuthorizationHandler<ApiAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ApiAccessRequirement requirement)
    {
        // 1. Extract user ID from JWT (oid preferred, fall back to sub)
        var userId = context.User.Claims
            .FirstOrDefault(c => c.Type is "oid"
                or "http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value
            ?? context.User.Claims.FirstOrDefault(c => c.Type is "sub")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            // Dev fast-path: grant full access to any authenticated user
            if (env.IsDevelopment() && context.User.Identity?.IsAuthenticated == true)
            {
                context.Succeed(requirement);
                return;
            }
            return; // deny
        }

        // 2. Dev fast-path for synthetic "dev-user" identity
        if (env.IsDevelopment() && userId == "dev-user")
        {
            context.Succeed(requirement);
            return;
        }

        // 3. Fetch roles from Global Admin API (cached 30 min)
        var roles = await roleProvider.GetUserRolesAsync(userId);

        // 4. Admin fast-path
        if (roles.Any(r => r.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
        {
            context.Succeed(requirement);
            return;
        }

        // 5. Extract apiId from route
        var httpContext = context.Resource as HttpContext;
        var apiId = httpContext?.GetRouteValue("apiId")?.ToString();

        if (apiId is null)
            // General permission check (list endpoints)
            if (rbac.HasGeneralPermission(roles, requirement.Permission))
                context.Succeed(requirement);
        else
            // Per-API permission check
            if (rbac.HasApiPermission(roles, apiId, requirement.Permission))
                context.Succeed(requirement);
    }
}
```

**Decision flow:**

```
Request arrives
  │
  ├─ No userId in JWT
  │    ├─ Development + authenticated → GRANT (dev fast-path)
  │    └─ Otherwise → DENY
  │
  ├─ userId == "dev-user" (Development)  → GRANT
  │
  ├─ Fetch roles from GlobalAdmin (cached)
  │    └─ Error → returns [] → DENY (fail-closed)
  │
  ├─ Role == "Admin" → GRANT
  │
  ├─ apiId in route?
  │    ├─ No  → HasGeneralPermission(roles, permission)
  │    └─ Yes → HasApiPermission(roles, apiId, permission)
  │
  └─ Granted or denied accordingly
```

### 5.3 Hot-Reloadable RBAC Policies

`rbac-policies.json` is loaded via `IOptionsMonitor<RbacPoliciesConfig>`, which means changes take effect without restarting the BFF:

```json
{
  "policies": [
    {
      "role": "Admin",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe", "manage"]
    },
    {
      "role": "Distributor",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe", "manage"]
    },
    {
      "role": "Vendor",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe"]
    },
    {
      "role": "Customer",
      "apis": ["*"],
      "permissions": ["read"]
    }
  ]
}
```

`RbacPolicyProvider` (`bff-dotnet/BffApi/Authorization/RbacPolicyProvider.cs`) exposes:

- `HasGeneralPermission(roles, permission)` — used by list endpoints (no `apiId`)
- `HasApiPermission(roles, apiId, permission)` — used by per-API endpoints
- `GetAccessibleApis(roles, permission)` — returns `null` for wildcard `"*"` (all APIs), or a `HashSet<string>` of allowed API IDs for filtering list responses

### 5.4 Permission Model

| Permission | Enum Value | Default Allowed Roles |
|-----------|------------|----------------------|
| Read | `Permission.Read` | Customer, Vendor, Distributor, Admin |
| TryIt | `Permission.TryIt` | Vendor, Distributor, Admin |
| Subscribe | `Permission.Subscribe` | Vendor, Distributor, Admin |
| Manage | `Permission.Manage` | Distributor, Admin |

The `apis` field in each policy entry accepts a wildcard `"*"` (all APIs) or a list of specific API IDs, enabling per-API permission overrides.

---

## 6. Service Layer: Strategy Pattern

### 6.1 `IArmApiService` Interface

`bff-dotnet/BffApi/Services/IArmApiService.cs` (also inferred from implementations)

All three service implementations satisfy the same interface, making the strategy switch transparent to endpoint code:

```csharp
public interface IArmApiService
{
    // ── APIs ──────────────────────────────────────────────────────────────────
    Task<PagedResult<ApiContract>> GetApisAsync(
        int? top, int? skip, string? filter, CancellationToken ct = default);
    Task<ApiContract?> GetApiAsync(string apiId, CancellationToken ct = default);
    Task<PagedResult<OperationContract>> GetApiOperationsAsync(
        string apiId, int? top, int? skip, CancellationToken ct = default);
    Task<PagedResult<ProductContract>> GetApiProductsAsync(
        string apiId, CancellationToken ct = default);
    Task<string> GetApiOpenApiAsync(string apiId, CancellationToken ct = default);
    Task<IReadOnlyList<TagContract>> GetApiTagsAsync(string apiId, CancellationToken ct = default);
    Task<IReadOnlyList<VersionSetContract>> GetApiVersionSetsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<SchemaContract>> GetApiSchemasAsync(
        string apiId, CancellationToken ct = default);
    Task<IReadOnlyList<ApiContract>> GetApiChangelogAsync(
        string apiId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetApiHostnamesAsync(
        string apiId, CancellationToken ct = default);

    // ── Products ──────────────────────────────────────────────────────────────
    Task<PagedResult<ProductContract>> GetProductsAsync(
        int? top, int? skip, CancellationToken ct = default);
    Task<ProductContract?> GetProductAsync(string productId, CancellationToken ct = default);
    Task<PagedResult<ApiContract>> GetProductApisAsync(
        string productId, CancellationToken ct = default);

    // ── Subscriptions ─────────────────────────────────────────────────────────
    Task<PagedResult<SubscriptionContract>> GetSubscriptionsAsync(
        int? top, int? skip, CancellationToken ct = default);
    Task<SubscriptionContract?> GetSubscriptionAsync(
        string subId, CancellationToken ct = default);
    Task<SubscriptionContract> CreateSubscriptionAsync(
        CreateSubscriptionRequest req, CancellationToken ct = default);
    Task<SubscriptionContract> UpdateSubscriptionAsync(
        string subId, UpdateSubscriptionRequest req, CancellationToken ct = default);
    Task DeleteSubscriptionAsync(string subId, CancellationToken ct = default);
    Task<SubscriptionSecretsContract> GetSubscriptionSecretsAsync(
        string subId, CancellationToken ct = default);
    Task RegenerateSubscriptionKeyAsync(
        string subId, string keyType, CancellationToken ct = default);

    // ── Tags ──────────────────────────────────────────────────────────────────
    Task<PagedResult<TagContract>> GetTagsAsync(
        string? scope, string? filter, CancellationToken ct = default);

    // ── Stats ─────────────────────────────────────────────────────────────────
    Task<StatsContract> GetStatsAsync(CancellationToken ct = default);
}
```

### 6.2 Three Implementations

| Mode | Feature Flag | Service Class | Backend | Lifetime |
|------|-------------|---------------|---------|---------|
| **Mock** | `Features:UseMockMode=true` + `IsDevelopment` | `MockApiService` | Static in-memory data | Singleton |
| **Data API** | `Apim:UseDataApi=true` | `DataApiService` | `https://{apim}.azure-api.net/developer` | Scoped |
| **ARM** | Default | `ArmApiService` | `https://management.azure.com/...` | Scoped |

All implementations return the same `PagedResult<T>` envelope:

```json
{
  "value": [ /* items */ ],
  "count": 42,
  "nextLink": "https://..."
}
```

### 6.3 ARM → Contract Transformation

`ArmApiService` must unwrap ARM's nested `properties` envelope before returning data to the SPA:

**ARM response shape:**
```json
{
  "id": "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{svc}/apis/petstore",
  "name": "petstore",
  "type": "Microsoft.ApiManagement/service/apis",
  "properties": {
    "displayName": "Petstore",
    "description": "A sample API",
    "path": "petstore",
    "protocols": ["https"],
    "apiVersion": "v2",
    "isCurrent": true
  }
}
```

**BFF contract shape (returned to SPA):**
```json
{
  "id": "petstore",
  "name": "Petstore",
  "description": "A sample API",
  "path": "petstore",
  "protocols": ["https"],
  "apiVersion": "v2",
  "isCurrent": true
}
```

The transformation (`TransformApiContract`) extracts `name` as `id`, promotes all `properties.*` fields to the top level, and maps `displayName` → `name` to match the SPA's TypeScript types.

### 6.4 DataApiService Mode

When `UseDataApi=true`, the BFF calls the APIM Data API directly:

- **Base URL:** `https://{apimServiceName}.azure-api.net/developer`
- **Auth:** Bearer token from `ITokenProvider` (same credential chain)
- **Advantage:** Flat JSON responses — no properties envelope to unwrap
- **Use case:** Runtime data access (actual subscriptions, users) vs. ARM design-time management

---

## 7. Role Provider: Global Admin Integration

Source: `bff-dotnet/BffApi/Services/GlobalAdminRoleProvider.cs`

### 7.1 Auth Flow

```
SPA user logs in via MSAL (Entra ID)
  │
  └─ SPA sends JWT in Authorization: Bearer {token}
       │
       └─ BFF validates JWT → extracts oid / sub claim
            │
            └─ BFF calls GlobalAdmin API
                 GET /users/{userId}/roles
                 Header: Ocp-Apim-Subscription-Key: {apiKey}
                 │
                 └─ Response: ["Distributor", "Vendor"]
                      │
                      └─ BFF caches per userId for 30 minutes
                           │
                           └─ Roles fed into ApiAccessHandler → RBAC decision
```

### 7.2 Implementation

```csharp
public async Task<IReadOnlyList<string>> GetUserRolesAsync(
    string userId, CancellationToken ct = default)
{
    var cacheKey = $"ga-roles:{userId}";

    // Return from IMemoryCache if fresh
    if (_cache.TryGetValue<IReadOnlyList<string>>(cacheKey, out var cached))
        return cached!;

    try
    {
        var client = _httpFactory.CreateClient("GlobalAdmin");
        var url = $"{_settings.BaseUrl.TrimEnd('/')}/users/{Uri.EscapeDataString(userId)}/roles";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (!string.IsNullOrWhiteSpace(_settings.ApiKey))
            request.Headers.Add("Ocp-Apim-Subscription-Key", _settings.ApiKey);

        var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var roles = await response.Content.ReadFromJsonAsync<string[]>(ct) ?? [];

        var ttl = TimeSpan.FromMinutes(_settings.RoleCacheMinutes);
        _cache.Set(cacheKey, (IReadOnlyList<string>)roles, ttl);
        return roles;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to fetch roles for user {UserId}", userId);
        return []; // fail-closed: RBAC will deny access
    }
}
```

### 7.3 Key Behaviours

| Behaviour | Detail |
|-----------|--------|
| **Fail-closed** | Any exception returns `[]` → RBAC denies — no privilege escalation on API failure |
| **Cache TTL** | Configurable via `GlobalAdmin:RoleCacheMinutes` (default 30 min) |
| **Cache key** | `ga-roles:{userId}` — per-user isolation |
| **Auth header** | `Ocp-Apim-Subscription-Key` sent only when `ApiKey` is configured |
| **Mock** | `MockRoleProvider` returns `["Distributor"]` in dev — all permissions granted |

### 7.4 Configuration

```json
"GlobalAdmin": {
  "BaseUrl": "https://apim-globaladmin-uat-jpneast-001.azure-api.net",
  "ApiKey": "",
  "RoleCacheMinutes": 30
}
```

---

## 8. Token Provider: Credential Chain

Source: `bff-dotnet/BffApi/Services/AppRegistrationTokenProvider.cs`

The BFF uses a single service-principal identity for all outbound calls to ARM / Data API. `AppRegistrationTokenProvider` implements `ITokenProvider` with a two-tier credential chain.

### 8.1 Credential Chain

```
GetTokenAsync(scope)
  │
  ├─ SP configured AND not invalidated?
  │    ├─ YES → try ClientSecretCredential
  │    │         ├─ Success → cache token → return
  │    │         └─ AuthenticationFailedException → fall through to DefaultAzureCredential
  │    └─ NO  → skip to DefaultAzureCredential
  │
  └─ DefaultAzureCredential
       (Managed Identity → Azure CLI → Environment Variables → ...)
       ├─ Success → cache token → return
       └─ Failure → OperationCanceledException (30s timeout) or rethrow
```

### 8.2 Implementation Highlights

```csharp
public sealed class AppRegistrationTokenProvider : ITokenProvider
{
    private readonly ClientSecretCredential? _spCredential;
    private readonly DefaultAzureCredential _fallbackCredential;
    private readonly Dictionary<string, AccessToken> _tokenCache = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private volatile bool _spInvalidated;

    public async Task<string> GetTokenAsync(string scope, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            // Return cached token with 5-min safety buffer
            if (_tokenCache.TryGetValue(scope, out var cached) &&
                cached.ExpiresOn > DateTimeOffset.UtcNow.AddMinutes(5))
                return cached.Token;

            // 30s timeout on token acquisition
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            // ... credential chain logic ...
        }
        finally { _lock.Release(); }
    }

    // Called by ArmApiService when ARM returns 403 AuthorizationFailed
    public void InvalidateCredential()
    {
        _spInvalidated = true;          // permanent switch to DefaultAzureCredential
        _lock.Wait();
        try { _tokenCache.Clear(); }
        finally { _lock.Release(); }
    }
}
```

### 8.3 Key Behaviours

| Behaviour | Detail |
|-----------|--------|
| **Primary credential** | `ClientSecretCredential` (App Registration) — explicit, predictable |
| **Fallback credential** | `DefaultAzureCredential` — Managed Identity, Azure CLI, env vars |
| **Auto-invalidation** | On ARM 403, permanently switch to fallback (no retry of bad SP secret) |
| **Token cache** | In-memory, per scope, 5-min safety buffer before actual expiry |
| **Thread safety** | `SemaphoreSlim(1,1)` prevents concurrent token requests |
| **Timeout** | 30s with diagnostic log message on timeout |
| **Managed Identity** | Optional `ManagedIdentityClientId` for user-assigned MI |

---

## 9. Resilient HTTP Clients

Source: `bff-dotnet/BffApi/Program.cs` lines 261–321

All named HTTP clients use `Microsoft.Extensions.Http.Resilience` (`AddStandardResilienceHandler`) for production-grade resilience.

### 9.1 Client Configuration

| Client | Retry | Attempt Timeout | Total Timeout | Circuit Breaker | Handler |
|--------|-------|-----------------|---------------|-----------------|---------|
| `ArmApi` | 3× exponential + jitter (500ms base) | 30s | 90s | 60s window, 5 min throughput | `PortalTelemetryHandler` |
| `DataApi` | 3× exponential + jitter (500ms base) | 30s | 90s | 60s window, 5 min throughput | `PortalTelemetryHandler` |
| `GlobalAdmin` | 2× exponential + jitter (300ms base) | 10s | 30s | 60s window, 3 min throughput | — |

### 9.2 ArmApi / DataApi Configuration

```csharp
builder.Services.AddHttpClient("ArmApi", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.Timeout = TimeSpan.FromSeconds(60);
})
.AddHttpMessageHandler<PortalTelemetryHandler>()
.AddStandardResilienceHandler(options =>
{
    options.Retry.MaxRetryAttempts       = 3;
    options.Retry.BackoffType            = Polly.DelayBackoffType.Exponential;
    options.Retry.UseJitter              = true;
    options.Retry.Delay                  = TimeSpan.FromMilliseconds(500);
    options.AttemptTimeout.Timeout       = TimeSpan.FromSeconds(30);
    options.TotalRequestTimeout.Timeout  = TimeSpan.FromSeconds(90);
    options.CircuitBreaker.SamplingDuration  = TimeSpan.FromSeconds(60);
    options.CircuitBreaker.MinimumThroughput = 5;
});
```

### 9.3 GlobalAdmin Configuration

```csharp
builder.Services.AddHttpClient("GlobalAdmin", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.Timeout = TimeSpan.FromSeconds(30);
})
.AddStandardResilienceHandler(options =>
{
    options.Retry.MaxRetryAttempts       = 2;
    options.Retry.BackoffType            = Polly.DelayBackoffType.Exponential;
    options.Retry.UseJitter              = true;
    options.Retry.Delay                  = TimeSpan.FromMilliseconds(300);
    options.AttemptTimeout.Timeout       = TimeSpan.FromSeconds(10);
    options.TotalRequestTimeout.Timeout  = TimeSpan.FromSeconds(30);
    options.CircuitBreaker.SamplingDuration  = TimeSpan.FromSeconds(60);
    options.CircuitBreaker.MinimumThroughput = 3;
});
```

GlobalAdmin uses tighter timeouts (10s/30s) because role fetch failures are fail-closed and a slow role provider would degrade every request.

### 9.4 PortalTelemetryHandler

`bff-dotnet/BffApi/Middleware/PortalTelemetryHandler.cs`

A `DelegatingHandler` added to `ArmApi` and `DataApi` clients that injects the APIM analytics header:

```csharp
public sealed class PortalTelemetryHandler : DelegatingHandler
{
    private const string HeaderName = "x-ms-apim-client";
    private static readonly string HeaderValue =
        $"custom-bff-dotnet|{Environment.MachineName}|portal-request";

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.TryAddWithoutValidation(HeaderName, HeaderValue);
        return base.SendAsync(request, ct);
    }
}
```

Without this header, portal traffic is indistinguishable from direct API calls in APIM analytics dashboards.

---

## 10. Middleware Stack

Source: `bff-dotnet/BffApi/Program.cs` lines 413–437, and the `Middleware/` directory.

### 10.1 Pipeline Order

```
Incoming HTTP Request
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  1. LegacyApiMonitoringMiddleware                       │
│     Monitors /api/apis — tracks latency, errors        │
├─────────────────────────────────────────────────────────┤
│  2. MapOpenApi / MapScalarApiReference (dev only)       │
│     Swagger/Scalar endpoints at /openapi, /scalar/v1   │
├─────────────────────────────────────────────────────────┤
│  3. RequestLoggingMiddleware                            │
│     Logs: {Method} {Path} → {Status} ({Elapsed}ms)     │
├─────────────────────────────────────────────────────────┤
│  4. SecurityHeadersMiddleware                           │
│     Adds X-Content-Type-Options, X-Frame-Options, etc. │
├─────────────────────────────────────────────────────────┤
│  5. UseCors()                                          │
│     Dev: AllowAnyOrigin; Prod: Nginx same-origin       │
├─────────────────────────────────────────────────────────┤
│  6. UseAuthentication()                                 │
│     JWT Bearer validation (multi-tenant JWKS)          │
├─────────────────────────────────────────────────────────┤
│  7. UseAuthorization()                                  │
│     Policy enforcement via ApiAccessHandler            │
├─────────────────────────────────────────────────────────┤
│  Endpoint Handlers (Minimal API route groups)           │
└─────────────────────────────────────────────────────────┘
        │
        ▼
   HTTP Response
```

### 10.2 Middleware Details

#### 1. LegacyApiMonitoringMiddleware

`bff-dotnet/BffApi/Middleware/LegacyApiMonitoringMiddleware.cs`

- Intercepts only `/api/apis` requests
- Records elapsed time via `Stopwatch`
- Logs: `Legacy API call: Path={Path} | User={User} | Status={Status} | Duration={Duration}ms`
- Buffers response body through `MemoryStream` for post-processing
- Designed as a hook point for Application Insights `TelemetryClient` integration

#### 2. RequestLoggingMiddleware

`bff-dotnet/BffApi/Middleware/RequestLoggingMiddleware.cs`

```csharp
public async Task InvokeAsync(HttpContext context)
{
    var sw = Stopwatch.StartNew();
    try
    {
        await next(context);
        logger.LogInformation("{Method} {Path} → {StatusCode} ({Elapsed:F0}ms)",
            context.Request.Method, context.Request.Path,
            context.Response.StatusCode, sw.Elapsed.TotalMilliseconds);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "{Method} {Path} → EXCEPTION ({Elapsed:F0}ms): {Message}",
            context.Request.Method, context.Request.Path,
            sw.Elapsed.TotalMilliseconds, ex.Message);
        throw;
    }
}
```

#### 3. SecurityHeadersMiddleware

`bff-dotnet/BffApi/Middleware/RequestLoggingMiddleware.cs` (same file, second class)

```csharp
public Task InvokeAsync(HttpContext context)
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"]        = "SAMEORIGIN";
    context.Response.Headers["Referrer-Policy"]        = "strict-origin-when-cross-origin";
    context.Response.Headers["X-XSS-Protection"]      = "1; mode=block";
    return next(context);
}
```

Mirrors the headers already set by `nginx.conf`. Both are set so the BFF is secure when run standalone (e.g., during tests or local dev without Nginx).

#### 4. PortalTelemetryHandler

`DelegatingHandler` — not ASP.NET Core middleware. See [Section 9.4](#94-portaltelemetryhandler).

#### 5. ClaimsEnrichmentMiddleware

`bff-dotnet/BffApi/Middleware/ClaimsEnrichmentMiddleware.cs`

Provides a hook to enrich the `ClaimsPrincipal` with additional claims after JWT validation — e.g., adding role claims from a custom source. Implements `IClaimsEnricher` contract.

---

## 11. Minimal API Endpoint Groups

Source: `bff-dotnet/BffApi/Endpoints/`

Every group is implemented as an extension method on `WebApplication`:

```csharp
public static class ApisEndpoints
{
    public static WebApplication MapApisEndpoints(this WebApplication app)
    {
        app.MapGet("/api/apis", ...).RequireAuthorization("ApiRead");
        // ...
        return app;
    }
}
```

### 11.1 Full Endpoint Table

#### APIs (`/api/apis`)

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/apis` | `ApiRead` | List APIs with `$top/$skip/$filter` pagination and RBAC filtering |
| GET | `/api/apis/highlights` | `ApiRead` | Top 3 featured APIs |
| GET | `/api/apis/{apiId}` | `ApiRead` | API detail |
| GET | `/api/apis/{apiId}/operations` | `ApiRead` | Operations for an API |
| GET | `/api/apis/{apiId}/products` | `ApiRead` | Products linked to an API |
| GET | `/api/apis/{apiId}/openapi` | `ApiTryIt` | OpenAPI spec (YAML/JSON) |
| GET | `/api/apis/{apiId}/operations/{operationId}` | `ApiRead` | Single operation detail |
| GET | `/api/apis/{apiId}/operations/{operationId}/tags` | `ApiRead` | Tags for an operation |
| GET | `/api/apis/{apiId}/operationsByTags` | `ApiRead` | Operations grouped by tag |
| GET | `/api/apis/{apiId}/schemas` | `ApiRead` | API schemas |
| GET | `/api/apis/{apiId}/releases` | `ApiRead` | API releases / changelog |
| GET | `/api/apis/{apiId}/hostnames` | `ApiRead` | API gateway hostnames |

#### APIs by Tags / Version Sets

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/apisByTags` | `ApiRead` | APIs grouped by tag |
| GET | `/api/apiVersionSets/{versionSetId}` | `ApiRead` | Version set detail |
| GET | `/api/apiVersionSets/{versionSetId}/apis` | `ApiRead` | APIs within a version set |

#### Tags

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/tags` | `ApiRead` | List all tags (optional `scope` and `filter`) |

#### Products (`/api/products`)

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/products` | `ApiRead` | List products with pagination |
| GET | `/api/products/{productId}` | `ApiRead` | Product detail |
| GET | `/api/products/{productId}/apis` | `ApiRead` | APIs in a product |

#### Subscriptions (`/api/subscriptions`)

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/subscriptions` | `ApiRead` | List subscriptions with pagination |
| GET | `/api/subscriptions/{subId}` | `ApiRead` | Subscription detail |
| POST | `/api/subscriptions` | `ApiSubscribe` | Create new subscription |
| PATCH | `/api/subscriptions/{subId}` | `ApiSubscribe` | Update / rename / cancel |
| DELETE | `/api/subscriptions/{subId}` | `ApiSubscribe` | Delete subscription |
| POST | `/api/subscriptions/{subId}/secrets` | `ApiSubscribe` | Retrieve primary/secondary keys |
| POST | `/api/subscriptions/{subId}/regeneratePrimaryKey` | `ApiManage` | Regenerate primary key |
| POST | `/api/subscriptions/{subId}/regenerateSecondaryKey` | `ApiManage` | Regenerate secondary key |

#### User

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/users/me` | Authenticated | Current user profile from JWT claims |

#### Misc

| Method | Path | Policy | Description |
|--------|------|--------|-------------|
| GET | `/api/stats` | `ApiRead` | Platform statistics |
| GET | `/api/news` | `ApiRead` | News items |
| GET | `/api/health` | Anonymous | Health check + version |
| POST | `/api/support` | Authenticated | Submit support request |
| POST | `/api/registration` | Anonymous | Portal registration |
| GET/POST | `/api/admin/*` | `ApiManage` | Admin operations |

---

## 12. Configuration Reference

### 12.1 `appsettings.json` Structure

```json
{
  "Apim": {
    "SubscriptionId": "<azure-subscription-id>",
    "ResourceGroup": "<resource-group-name>",
    "ServiceName": "<apim-service-name>",
    "ApiVersion": "2022-08-01",
    "ManagedIdentityClientId": "",
    "UseDataApi": false,
    "DataApiUrl": "",
    "ArmScope": "https://management.azure.com/.default",
    "DataApiScope": "https://management.azure.com/.default",
    "ServicePrincipal": {
      "TenantId": "<sp-tenant-id>",
      "ClientId": "<sp-client-id>",
      "ClientSecret": "<injected-via-keyvault>"
    }
  },
  "EntraId": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<workforce-tenant-id>",
    "ClientId": "<spa-app-registration-client-id>",
    "ExternalTenantId": "<ciam-tenant-id>",
    "CiamHost": "<tenant>.ciamlogin.com",
    "ValidIssuers": [
      "https://login.microsoftonline.com/<tenantId>/v2.0",
      "https://<ciamHost>/<externalTenantId>/v2.0"
    ],
    "ValidAudiences": [
      "<clientId>",
      "api://<clientId>"
    ]
  },
  "GlobalAdmin": {
    "BaseUrl": "https://apim-globaladmin-uat-jpneast-001.azure-api.net",
    "ApiKey": "<injected-via-keyvault>",
    "RoleCacheMinutes": 30
  },
  "Features": {
    "UseMockMode": false
  },
  "LegacyApis": {
    "Enabled": false,
    "Soap": {
      "Endpoint": "https://legacy-api.example.com/soap",
      "AuthEndpoint": "https://legacy-api.example.com/auth",
      "TimeoutSeconds": 30,
      "CacheTTLMinutes": 60
    },
    "Monitoring": {
      "LogAllRequests": true,
      "AlertOnFailure": true,
      "FailureThresholdPercent": 5
    }
  }
}
```

### 12.2 `appsettings.Development.json`

```json
{
  "Features": {
    "UseMockMode": true
  },
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "BffApi": "Debug"
    }
  }
}
```

### 12.3 `rbac-policies.json`

```json
{
  "policies": [
    {
      "role": "Admin",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe", "manage"]
    },
    {
      "role": "Distributor",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe", "manage"]
    },
    {
      "role": "Vendor",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe"]
    },
    {
      "role": "Customer",
      "apis": ["*"],
      "permissions": ["read"]
    }
  ]
}
```

**Per-API overrides** — restrict a role to specific APIs:

```json
{
  "policies": [
    {
      "role": "Vendor",
      "apis": ["parts-api", "warranty-api"],
      "permissions": ["read", "tryit", "subscribe"]
    }
  ]
}
```

### 12.4 Configuration Sections Summary

| Section | Purpose | Hot-Reload |
|---------|---------|-----------|
| `Apim` | APIM instance, ARM scope, service principal | No |
| `Apim:ServicePrincipal` | SP credentials (inject via Key Vault) | No |
| `EntraId` | JWT validation parameters (issuers, audiences) | No |
| `GlobalAdmin` | Role provider URL, API key, cache TTL | No |
| `Features:UseMockMode` | Swap all services to mocks in development | No |
| `rbac-policies.json` | Role → API → permission mapping | **Yes** (`reloadOnChange`) |

> ⚠️ **Never commit secrets.** Inject `Apim:ServicePrincipal:ClientSecret`, `GlobalAdmin:ApiKey`, and `EntraId:ClientId` via Azure Container App secrets or Key Vault references.

---

## 13. Frontend ↔ BFF Contract

### 13.1 Authentication Flow

```
React SPA (MSAL.js)
  │
  ├─ 1. User clicks Sign In
  ├─ 2. MSAL redirects to Entra ID (workforce or CIAM tenant)
  ├─ 3. Entra ID issues JWT access token (audience = BFF app registration)
  ├─ 4. MSAL caches token in session/localStorage
  └─ 5. Every /api/* fetch includes: Authorization: Bearer {jwt}

BFF
  ├─ Validates JWT signature against multi-tenant JWKS
  ├─ Checks issuer is in ValidIssuers
  ├─ Checks audience is in ValidAudiences
  ├─ Extracts oid/sub → fetches roles from Global Admin API
  └─ Enforces RBAC policy before calling ARM / Data API
```

### 13.2 TypeScript API Client (SPA side)

```typescript
// src/api/client.ts
const apiClient = {
  async get<T>(path: string): Promise<T> {
    const token = await msalInstance.acquireTokenSilent({
      scopes: ["api://<clientId>/.default"]
    });
    const response = await fetch(`/api${path}`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
};
```

### 13.3 Shared Contract Shapes

The BFF's `bff-dotnet/BffApi/Models/ApimContracts.cs` mirrors the SPA's `src/api/types.ts`:

```typescript
// TypeScript (SPA)
interface PagedResult<T> {
  value: T[];
  count?: number;
  nextLink?: string;
}

interface ApiContract {
  id: string;
  name: string;
  description?: string;
  path?: string;
  protocols?: string[];
  apiVersion?: string;
  isCurrent?: boolean;
  apiVersionSetId?: string;
  subscriptionRequired?: boolean;
}

interface ProductContract {
  id: string;
  name: string;
  description?: string;
  state?: string;
  subscriptionRequired?: boolean;
  approvalRequired?: boolean;
}

interface SubscriptionContract {
  id: string;
  name: string;
  scope: string;
  state: string;
  createdDate?: string;
  primaryKey?: string;
  secondaryKey?: string;
}
```

```csharp
// C# (BFF) — bff-dotnet/BffApi/Models/ApimContracts.cs
public sealed class PagedResult<T>
{
    [JsonPropertyName("value")]
    public required IReadOnlyList<T> Value { get; init; }

    [JsonPropertyName("nextLink")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? NextLink { get; init; }

    [JsonPropertyName("count")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Count { get; init; }
}
```

### 13.4 RBAC Mirror (SPA vs BFF)

The SPA mirrors BFF RBAC policies in `src/auth/permissions.ts` purely for **UI-level** hide/show logic. The BFF is the actual security boundary:

```typescript
// src/auth/permissions.ts — mirrors rbac-policies.json
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Admin:       ["read", "tryit", "subscribe", "manage"],
  Distributor: ["read", "tryit", "subscribe", "manage"],
  Vendor:      ["read", "tryit", "subscribe"],
  Customer:    ["read"]
};

export function hasPermission(roles: string[], permission: Permission): boolean {
  return roles.some(role =>
    ROLE_PERMISSIONS[role]?.includes(permission) ?? false
  );
}
```

> ⚠️ **SPA RBAC is UI-only.** A malicious client can bypass it. All security enforcement happens in the BFF's `ApiAccessHandler`.

---

## 14. Deployment Model

### 14.1 Multi-Stage Dockerfile

```
Stage 1: node:20-alpine    — builds React SPA (npm run build → /app/dist)
Stage 2: mcr.microsoft.com/dotnet/sdk:10.0 — publishes .NET BFF (dotnet publish)
Stage 3: mcr.microsoft.com/dotnet/aspnet:10.0 — runtime image
  + nginx:alpine
  + supervisord
  → copies SPA dist → Nginx wwwroot
  → copies BFF publish output
  → copies nginx.conf + supervisord.conf
```

### 14.2 `nginx.conf` (Key Sections)

```nginx
server {
    listen 8080;

    # React SPA — catch-all for client-side routing
    location / {
        root   /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # BFF proxy — all /api/* traffic
    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   Authorization $http_authorization;

        # Security headers
        add_header X-Content-Type-Options "nosniff";
        add_header X-Frame-Options "SAMEORIGIN";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
    }
}
```

### 14.3 `supervisord.conf`

```ini
[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true

[program:bff]
command=dotnet /app/BffApi.dll --urls http://+:3001
autostart=true
autorestart=true
environment=ASPNETCORE_ENVIRONMENT="Production"
```

### 14.4 Azure Container Apps Secrets

Sensitive configuration is injected via Container App secrets:

```json
{
  "secrets": [
    { "name": "sp-client-secret",    "keyVaultUrl": "https://<kv>.vault.azure.net/secrets/sp-secret" },
    { "name": "global-admin-apikey", "keyVaultUrl": "https://<kv>.vault.azure.net/secrets/ga-apikey" }
  ],
  "env": [
    { "name": "Apim__ServicePrincipal__ClientSecret", "secretRef": "sp-client-secret" },
    { "name": "GlobalAdmin__ApiKey",                   "secretRef": "global-admin-apikey" }
  ]
}
```

See `azure/container-app.bicep` for the full Bicep deployment template.

---

## 15. Testing Strategy

### 15.1 Test Project

`bff-dotnet/BffApi.Tests/` — xUnit, NSubstitute, `Microsoft.AspNetCore.Mvc.Testing`

```
BffApi.Tests/
├── BffWebApplicationFactory.cs          # WebApplicationFactory<Program> with mock services
├── Authorization/
│   ├── ApiAccessHandlerTests.cs         # Unit tests for RBAC handler logic
│   └── RbacPolicyProviderTests.cs       # Policy loading and evaluation
├── Endpoints/
│   ├── ApisEndpointsTests.cs            # Integration tests: GET /api/apis, GET /api/apis/{id}
│   ├── SubscriptionsEndpointsTests.cs   # Subscription CRUD lifecycle
│   ├── MiscEndpointsTests.cs            # Health, user, stats, news endpoints
│   └── PortalEndpointsTests.cs          # Portal-specific endpoint tests
└── Middleware/
    └── MiddlewareTests.cs               # RequestLoggingMiddleware, SecurityHeadersMiddleware
```

### 15.2 WebApplicationFactory Setup

The `partial class Program` declaration enables `WebApplicationFactory<Program>`:

```csharp
// bff-dotnet/BffApi.Tests/BffWebApplicationFactory.cs
public class BffWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace live services with mocks
            services.AddSingleton<IArmApiService>(
                Substitute.For<IArmApiService>());
            services.AddSingleton<IRoleProvider>(
                new MockRoleProvider(/* logger */));

            // Use in-memory configuration
            services.Configure<ApimSettings>(opts =>
            {
                opts.ServiceName = "test-apim";
                opts.ResourceGroup = "test-rg";
            });
        });

        builder.UseEnvironment("Development");
    }
}
```

### 15.3 Example Integration Test

```csharp
public class ApisEndpointsTests(BffWebApplicationFactory factory)
    : IClassFixture<BffWebApplicationFactory>
{
    [Fact]
    public async Task GetApis_ReturnsPagedResult()
    {
        // Arrange
        var mockService = factory.Services.GetRequiredService<IArmApiService>();
        mockService.GetApisAsync(default, default, default, default)
            .Returns(new PagedResult<ApiContract>
            {
                Value = [new ApiContract { Id = "test-api", Name = "Test API" }],
                Count = 1
            });

        // Act
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/apis");

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content
            .ReadFromJsonAsync<PagedResult<ApiContract>>();
        Assert.Single(result!.Value);
        Assert.Equal("test-api", result.Value[0].Id);
    }
}
```

### 15.4 Test Coverage Summary

| Category | Tests | Focus |
|----------|-------|-------|
| Authorization | `ApiAccessHandlerTests` | RBAC grant/deny for each permission |
| RBAC Config | `RbacPolicyProviderTests` | Wildcard, per-API, missing-role scenarios |
| API Endpoints | `ApisEndpointsTests` | List, detail, operations, OpenAPI |
| Subscriptions | `SubscriptionsEndpointsTests` | Full CRUD + key lifecycle |
| Misc | `MiscEndpointsTests` | Health, user profile, stats |
| Portal | `PortalEndpointsTests` | Portal-specific features |
| Middleware | `MiddlewareTests` | Security headers present; request log format |
| **Total** | **64 tests** | See `bff-dotnet/BffApi.Tests/README.md` |

---

## 16. Best Practices Checklist

### Security

| Practice | Status | Implementation |
|----------|--------|----------------|
| JWT Bearer validation | ✅ | `AddJwtBearer` with multi-tenant `IssuerSigningKeyResolver` |
| Audience validation | ✅ | `ValidAudiences` from config — prevents token reuse across apps |
| Policy-based RBAC | ✅ | `ApiAccessHandler` + `rbac-policies.json` |
| Fail-closed roles | ✅ | `GlobalAdminRoleProvider` returns `[]` on error |
| Security headers | ✅ | `SecurityHeadersMiddleware` + Nginx `add_header` |
| No secrets in source | ✅ | Key Vault references for SP secret + Global Admin API key |
| CORS restricted in prod | ✅ | Production: Nginx same-origin; Dev: `AllowAnyOrigin` |
| Input sanitization | ✅ | `Uri.EscapeDataString(userId)` in Global Admin URL |

### Resilience

| Practice | Status | Implementation |
|----------|--------|----------------|
| HTTP retry with backoff | ✅ | `AddStandardResilienceHandler` — 3× exponential + jitter |
| Circuit breaker | ✅ | 60s sampling window, configurable throughput minimum |
| Request timeout | ✅ | 30s per-attempt, 90s total (ARM); 10s/30s (GlobalAdmin) |
| Token acquisition timeout | ✅ | 30s `CancellationTokenSource` in `AppRegistrationTokenProvider` |
| Credential fallback | ✅ | SP → `DefaultAzureCredential` on 403 or auth failure |

### Performance

| Practice | Status | Implementation |
|----------|--------|----------------|
| Response caching | ✅ | `IMemoryCache` with 1-min TTL for GET ARM responses |
| Role caching | ✅ | Global Admin roles cached 30 min per user |
| Token caching | ✅ | In-memory token cache with 5-min safety buffer |
| Null omission | ✅ | `JsonIgnoreCondition.WhenWritingNull` reduces payload size |
| Pagination passthrough | ✅ | `$top/$skip/$filter` forwarded to ARM / Data API |

### Testability

| Practice | Status | Implementation |
|----------|--------|----------------|
| `partial class Program` | ✅ | Enables `WebApplicationFactory<Program>` |
| Strategy pattern | ✅ | `IArmApiService` / `IRoleProvider` / `ITokenProvider` — all mockable |
| Mock mode | ✅ | `Features:UseMockMode` replaces live services with `Mock*` stubs |
| NSubstitute mocking | ✅ | Interface-based design throughout |

### Developer Experience

| Practice | Status | Implementation |
|----------|--------|----------------|
| Zero-config local dev | ✅ | `UseMockMode=true` in `appsettings.Development.json` |
| OpenAPI / Scalar | ✅ | Auto-generated Scalar UI at `/scalar/v1` in Development |
| Dev identity injection | ✅ | Synthetic `dev-user` Admin identity when no Bearer token |
| Hot-reload RBAC | ✅ | Edit `rbac-policies.json` → changes apply without restart |
| Startup banner | ✅ | Logs effective config (mode, URLs, auth) on start |
| Structured logging | ✅ | `ILogger` with `{Method} {Path} → {Status} ({Elapsed}ms)` |

### Deployment

| Practice | Status | Implementation |
|----------|--------|----------------|
| Multi-stage Dockerfile | ✅ | Node build → .NET publish → Nginx + supervisord runtime |
| Single container | ✅ | Nginx + BFF in one container — simplifies ACA deployment |
| Key Vault references | ✅ | No secrets in container image or environment variables |
| Health endpoint | ✅ | `GET /api/health` (anonymous) for ACA health probes |
| supervisord | ✅ | Manages both Nginx and BFF processes in one container |

### Configuration

| Practice | Status | Implementation |
|----------|--------|----------------|
| `IOptions<T>` binding | ✅ | Strongly-typed config for all sections |
| `IOptionsMonitor<T>` | ✅ | Hot-reload for `rbac-policies.json` |
| Environment overrides | ✅ | `appsettings.{Environment}.json` + env vars + Key Vault |
| Config validation | ✅ | Guard clauses in constructors (e.g., `AppRegistrationTokenProvider`) |

---

*Document generated from the production implementation in `bff-dotnet/`. For quick-start instructions see [`bff-dotnet/README.md`](../bff-dotnet/README.md). For architecture decision records see [`docs/BFF_MIGRATION_DECISION.md`](BFF_MIGRATION_DECISION.md) and [`docs/BFF_EVOLUTION_ANALYSIS.md`](BFF_EVOLUTION_ANALYSIS.md).*

---

## 17. End-to-End Data Flow & Fetch Reference

This section documents **every** data flow in the system, from the React SPA through the BFF to each backend service. Use it to answer: *"What happens—step by step—when a page loads, a subscription is created, or an admin action is taken?"*

---

### 17.1 Master Data Flow Diagram

The diagram below shows all data paths at once, including the four named HTTP clients and both token flows.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Browser                                                               │
│                                                                             │
│  React SPA (Vite + TypeScript)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Pages: Home, ApiCatalog, ApiDetails, ApiTryIt, Admin, Support, …   │   │
│  │    │                                                                 │   │
│  │    ├─ usePortalApi() / useApimCatalog() / useApiData<T>()           │   │
│  │    │     └─ request() in src/api/client.ts                          │   │
│  │    │           └─ MSAL getAccessToken() → Bearer header             │   │
│  │    │                                                                 │   │
│  │    ├─ useApimClient()  (src/api/apimClient.ts)  — legacy alternate  │   │
│  │    └─ useMapiClient()  (src/api/mapiClient.ts)  — direct ARM client │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                     │  HTTPS /api/*  (Authorization: Bearer <user-JWT>)     │
└─────────────────────┼───────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Container (port 8080)                                                      │
│                                                                             │
│  Nginx (reverse proxy)                                                      │
│  ├─ /          →  React SPA static files                                   │
│  └─ /api/*     →  BFF :3001                                                │
│                         │                                                   │
│                         ▼                                                   │
│  .NET 10 Minimal API BFF (:3001)                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Middleware pipeline (in order):                                     │   │
│  │    LegacyApiMonitoringMiddleware → RequestLoggingMiddleware          │   │
│  │    → SecurityHeadersMiddleware → CORS → UseAuthentication()          │   │
│  │    → ClaimsEnrichmentMiddleware → UseAuthorization()                 │   │
│  │                                                                      │   │
│  │  Endpoint groups:                                                    │   │
│  │    ApisEndpoints / ProductsEndpoints / SubscriptionsEndpoints        │   │
│  │    MiscEndpoints / AdminEndpoints / SupportEndpoints                 │   │
│  │    RegistrationEndpoints                                             │   │
│  │                                                                      │   │
│  │  Service layer (strategy pattern):                                   │   │
│  │    IArmApiService ──→ ArmApiService  (ARM named client)             │   │
│  │                   └─→ DataApiService (DataApi named client)         │   │
│  │                   └─→ MockApiService (dev only)                     │   │
│  │    IRoleProvider  ──→ GlobalAdminRoleProvider (GlobalAdmin client)  │   │
│  │    IUnifiedApiService → UnifiedApiService (cloud + legacy merge)    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │               │              │               │                  │
│           ▼               ▼              ▼               ▼                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────────┐      │
│  │  ArmApi      │ │  DataApi     │ │GlobalAdmin│ │  LegacySoap      │      │
│  │  HttpClient  │ │  HttpClient  │ │HttpClient │ │  HttpClient      │      │
│  └──────┬───────┘ └──────┬───────┘ └────┬─────┘ └───────┬──────────┘      │
└─────────┼────────────────┼──────────────┼───────────────┼──────────────────┘
          │                │              │               │
          ▼                ▼              ▼               ▼
  ARM Management    APIM Data API   Global Admin    Legacy SOAP
  API (APIM)        (runtime)       API (roles)     APIs (NTLM)
  SP bearer token   SP bearer token  API key         legacy auth
```

**Token flows summary:**

| Direction | Token type | Acquisition | Header |
|-----------|-----------|-------------|--------|
| Browser → BFF (inbound) | Entra ID JWT (user) | `MSAL.acquireTokenSilent()`, scope `api://<bff-client-id>/Portal.Access` (where `<bff-client-id>` is `EntraId:ClientId` from config / `VITE_AAD_CLIENT_ID` env var) | `Authorization: Bearer <user-JWT>` |
| BFF → ARM / Data API (outbound) | Service-principal bearer token | `ITokenProvider.GetTokenAsync(scope)` → `ClientSecretCredential` → `DefaultAzureCredential` fallback | `Authorization: Bearer <sp-token>` |
| BFF → Global Admin API (outbound) | API key | `GlobalAdminSettings.ApiKey` config value | `Ocp-Apim-Subscription-Key: <key>` |
| BFF → Legacy SOAP (outbound) | NTLM / legacy auth | `LegacyAuthenticationBridge` | Varies per legacy system |

---

### 17.2 Inbound: SPA → BFF

All four layers of the React fetch stack, from low-level to high-level.

#### 17.2.1 `request()` — core authenticated fetch (`src/api/client.ts`)

The single function all hooks ultimately delegate to.

```
caller
  │
  ├─ getAccessToken() via MSAL (useAuth hook)
  │     → acquireTokenSilent() → Entra ID → JWT
  │
  ├─ fetch(`${API_BASE}${path}`, { Authorization: Bearer <token>, ...options })
  │
  ├─ Response handling:
  │     401 → ApiError { code: "UNAUTHORIZED" }
  │     403 → ApiError { code: "FORBIDDEN" }
  │     404 → ApiError { code: "NOT_FOUND" }
  │     429/500/502/503/504 → retry (up to MAX_RETRIES=2)
  │     AbortError → ApiError { code: "ABORTED" }
  │     network error → ApiError { code: "NETWORK" }
  │
  └─ Returns: ApiResult<T> = { data: T | null, error: ApiError | null }
```

**Retry configuration:**

| Parameter | Value |
|-----------|-------|
| `MAX_RETRIES` | `2` |
| `RETRY_BASE_DELAY_MS` | `500` ms |
| Backoff formula | `500 * 2^attempt` ms (500 ms, 1000 ms) |
| Retryable status codes | `429, 500, 502, 503, 504` |
| AbortController | Passed via `options.signal`; aborted requests return `{ code: "ABORTED" }` |

**`ApiResult<T>` / `ApiError` contract:**

```typescript
// src/api/client.ts
type ApiError = {
  message: string;
  status?: number;
  code?: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "NETWORK" | "ABORTED" | "SERVER";
};

type ApiResult<T> = { data: T | null; error: ApiError | null };
```

#### 17.2.2 `usePortalApi()` — low-level CRUD hook (`src/api/client.ts`)

Wraps `request()` with `useCallback` for stable React references. Used directly by pages for one-off fetches.

```typescript
const { get, post, patch, delete: del } = usePortalApi();

// Usage examples from pages:
get<NewsItem[]>("/news")
get<ApiSummary[]>("/apis/highlights")
get<PlatformStats>("/stats")
post<SupportTicket>("/support/tickets", body)
get<SupportTicket[]>("/support/my-tickets")
get<RegistrationRequest[]>("/admin/registrations?status=pending")
get<AdminMetric[]>("/admin/metrics")
```

Each method signature:

| Method | Signature | HTTP verb |
|--------|-----------|-----------|
| `get` | `<T>(path, signal?) → Promise<ApiResult<T>>` | GET |
| `post` | `<T>(path, body, signal?) → Promise<ApiResult<T>>` | POST |
| `patch` | `<T>(path, body, signal?) → Promise<ApiResult<T>>` | PATCH |
| `delete` | `<T>(path, signal?) → Promise<ApiResult<T>>` | DELETE |

#### 17.2.3 `useApimCatalog()` — typed catalog operations (`src/api/client.ts`)

High-level hook for the APIM catalog. Mirrors the URL conventions of the official `api-management-developer-portal` `apiService.ts`.

| Operation | HTTP call | Notes |
|-----------|-----------|-------|
| `listApis(opts?)` | `GET /apis?$top=N&$skip=N&skipWorkspaces=true[&tags[i]=…][&$filter=contains(name,'…')]` | Returns `ApiSummary[]` (mapped from `ApimApiContract`) |
| `getApi(apiId)` | 3 sequential calls: `GET /apis/{id}?expandApiVersionSet=true` → `GET /apis/{id}/operations?$top=100` → `GET /apis/{id}/products?$top=50` | Returns `ApiDetails` with operations + products merged |
| `listProducts(opts?)` | `GET /products?$top=N&$skip=N&$filter=state eq 'published'` | Returns `ApiProduct[]` |
| `listSubscriptions()` | `GET /subscriptions?$top=100` | Returns `ApiSubscription[]` |
| `createSubscription(productId, displayName)` | `POST /subscriptions` with `{ scope, displayName, state: "submitted" }` | Returns `ApiSubscription` |
| `cancelSubscription(subscriptionId)` | `DELETE /subscriptions/{id}` | Returns `void` |

**`getApi()` parallel fetch detail:**

```
useApimCatalog.getApi("petstore")
  │
  ├─ 1. GET /apis/petstore?expandApiVersionSet=true  → ApiContract
  ├─ 2. GET /apis/petstore/operations?$top=100        → PagedResult<OperationContract>
  └─ 3. GET /apis/petstore/products?$top=50           → PagedResult<ProductContract>
        (Note: steps 2 and 3 are sequential after step 1 resolves)
  │
  └─ Maps into: ApiDetails { ...summary, operations[], plans[], overview, ... }
```

#### 17.2.4 `useApimClient()` — legacy/alternate client (`src/api/apimClient.ts`)

Direct client used primarily by `ApiTryIt` and other pages that need the `api-version` query parameter style. Uses `VITE_APIM_GATEWAY_URL` or `VITE_PORTAL_API_BASE` as base.

| Operation | HTTP call |
|-----------|-----------|
| `getApis()` | `GET /apis?api-version=2022-08-01` |
| `getApiById(apiId)` | Parallel: `GET /apis/{id}?api-version=2022-08-01` + `GET /apis/{id}/operations?api-version=2022-08-01` |

Returns `ApiSummary[]` / `ApiDetails | null` (no `ApiResult` wrapper — returns `null` on error).

#### 17.2.5 `useApiData<T>(path)` — generic fetch-on-mount hook (`src/hooks/useApiData.ts`)

Encapsulates the "fetch on mount, cancel on unmount" pattern. Used across `ApiCatalog`, `ApiDetails`, `News`, `MyIntegrations`, etc.

```typescript
const { data, loading, error, refetch } = useApiData<ApiSummary[]>("/apis");
//      T | null  bool     ApiError | null  () => void
```

**Lifecycle:**

```
mount
  │
  ├─ AbortController created
  ├─ setLoading(true)
  ├─ usePortalApi().get<T>(path, signal)
  │     └─ on success: setData(result.data), setLoading(false)
  │     └─ on error:   setError(result.error), setLoading(false)
  │
unmount
  └─ controller.abort()  → in-flight fetch receives AbortError → ignored
```

**Options:**

| Option | Type | Effect |
|--------|------|--------|
| `skip` | `boolean` | Skip initial fetch (useful for conditional loading based on auth state) |

#### 17.2.6 `useBffHealth()` — periodic health polling (`src/hooks/useBffHealth.ts`)

Polls `GET /api/health` (anonymous BFF endpoint) on an interval.

| Return value | Meaning |
|-------------|---------|
| `"checking"` | Initial state / request in-flight |
| `"healthy"` | BFF returned HTTP 200 |
| `"unhealthy"` | Non-200 or network error |

Default polling interval: **60 seconds**. Components display a degraded-mode banner when `status === "unhealthy"`.

#### 17.2.7 `useMapiClient()` — direct ARM Management API client (`src/api/mapiClient.ts`)

Builds the ARM base URL from Vite env vars and calls Azure Resource Manager directly (bypassing the BFF). Used for low-level ARM operations in development/testing scenarios.

**Base URL construction:**

```
https://management.azure.com/subscriptions/${VITE_AZURE_SUBSCRIPTION_ID}
  /resourceGroups/${VITE_AZURE_RESOURCE_GROUP}
  /providers/Microsoft.ApiManagement/service/${VITE_AZURE_APIM_SERVICE_NAME}
```

Methods: `get`, `post`, `put`, `patch`, `delete`, `getAll` (auto-follows `nextLink` pagination).

---

### 17.3 BFF Middleware Pipeline (per-request processing)

Every request entering the BFF at `:3001` traverses this middleware stack in order (`bff-dotnet/BffApi/Program.cs`):

```
Incoming HTTP request (/api/...)
  │
  1. LegacyApiMonitoringMiddleware   — latency tracking, error counters for legacy API paths
  │                                    (bff-dotnet/BffApi/Middleware/LegacyApiMonitoringMiddleware.cs)
  │
  2. RequestLoggingMiddleware        — structured logging: {Method} {Path} → {Status} ({Elapsed}ms)
  │                                    (bff-dotnet/BffApi/Middleware/RequestLoggingMiddleware.cs)
  │
  3. SecurityHeadersMiddleware       — adds HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  │                                    (bff-dotnet/BffApi/Middleware/RequestLoggingMiddleware.cs — defined in same file)
  │
  4. CORS                            — allow-list for same-origin Nginx proxy and dev origins
  │
  5. UseAuthentication()             — validates JWT Bearer token (Entra ID multi-tenant)
  │                                    — in mock mode: auto-succeeds with synthetic "dev-user" Admin
  │
  6. ClaimsEnrichmentMiddleware      — extracts OID from JWT, calls GlobalAdminRoleProvider,
  │                                    merges returned business roles into ClaimsPrincipal
  │                                    (bff-dotnet/BffApi/Middleware/ClaimsEnrichmentMiddleware.cs)
  │
  7. UseAuthorization()              — evaluates RBAC policies via ApiAccessHandler
  │                                    policies: ApiRead / ApiTryIt / ApiSubscribe / ApiManage
  │                                    (bff-dotnet/BffApi/Authorization/ApiAccessHandler.cs)
  │
  ▼
  Endpoint handler (IArmApiService call → response)
```

**Sequence diagram for a typical authenticated request:**

```
SPA                  Nginx             BFF                Entra ID       Global Admin
 │                    │                 │                     │               │
 │─ GET /api/apis ──►│                 │                     │               │
 │                    │─ proxy ───────►│                     │               │
 │                    │                │─ validate JWT ─────►│               │
 │                    │                │◄─ OK (claims) ──────│               │
 │                    │                │─ GET /users/{oid}/roles ────────────►│
 │                    │                │◄─ ["Distributor"] ──────────────────│
 │                    │                │                     │               │
 │                    │                │─ RBAC check → allow │               │
 │                    │                │─ ArmApiService.ListApisAsync()      │
 │                    │                │   (ARM call with SP token)          │
 │                    │◄─ 200 JSON ────│                     │               │
 │◄─ 200 JSON ────────│                │                     │               │
```

---

### 17.4 Outbound: BFF → ARM Management API

**Service:** `ArmApiService` (`bff-dotnet/BffApi/Services/ArmApiService.cs`)  
**Named HTTP client:** `"ArmApi"`

#### Token acquisition

```
ArmApiService.GetTokenAsync(scope)
  │
  └─ ITokenProvider.GetTokenAsync("https://management.azure.com/.default")
        │
        ├─ try: ClientSecretCredential (TenantId + ClientId + ClientSecret from KeyVault)
        │         → POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
        │         → bearer token (SP identity)
        │
        └─ on 403 / failure: _tokenProvider.InvalidateCredential()
                               → retry with DefaultAzureCredential
                               → (ManagedIdentity → EnvVars → AzureCLI → VisualStudio)
```

#### Base URL construction

```
https://management.azure.com/subscriptions/{SubscriptionId}
  /resourceGroups/{ResourceGroup}
  /providers/Microsoft.ApiManagement/service/{ServiceName}
```

Configured via `appsettings.json` section `"Apim"`: `SubscriptionId`, `ResourceGroup`, `ServiceName`, `ApiVersion` (default `"2022-08-01"`).

#### Generic fetch methods

| Method | Signature | Notes |
|--------|-----------|-------|
| `FetchArmAsync(path, ct, method?, body?)` | → `JsonElement` | Attaches Bearer token, handles 403 by retrying with fallback credential |
| `FetchArmCachedAsync(path, ct)` | → `JsonElement` | `IMemoryCache` dedup with **1-minute TTL**; cache key `"arm:{path}"` |

#### ARM response envelope unwrapping

ARM returns resources with a `properties` sub-object. The service strips this envelope to produce flat contracts:

```json
// ARM raw response (GET /apis/petstore)
{
  "id": "/subscriptions/.../apis/petstore",
  "name": "petstore",
  "properties": {
    "displayName": "Petstore API",
    "path": "/petstore",
    "protocols": ["https"],
    "subscriptionRequired": true
  }
}

// After TransformApiContract() → ApiContract
{
  "id": "petstore",
  "name": "Petstore API",
  "path": "/petstore",
  "protocols": ["https"],
  "subscriptionRequired": true
}
```

Transformer functions: `TransformApiContract`, `TransformOperationContract`, `TransformProductContract`, `TransformSubscriptionContract`, `TransformTagContract`.

#### Resilience (via `Program.cs` `AddResilienceHandler`)

| Policy | Configuration |
|--------|---------------|
| Retry | 3 attempts, exponential backoff |
| Per-attempt timeout | 30 seconds |
| Total request timeout | 90 seconds |
| Telemetry header | `PortalTelemetryHandler` (a `DelegatingHandler` registered on the `ArmApi`/`DataApi` named clients, separate from Polly policies) adds `x-ms-apim-client: apim-dev-portal` on every outbound ARM/Data API request (`bff-dotnet/BffApi/Middleware/PortalTelemetryHandler.cs`) |

---

### 17.5 Outbound: BFF → APIM Data API

**Service:** `DataApiService` (`bff-dotnet/BffApi/Services/DataApiService.cs`)  
**Named HTTP client:** `"DataApi"`

Registered when `Apim:UseDataApi = true`. Implements the same `IArmApiService` interface as `ArmApiService`, so endpoint handlers are unaware of which backend is active.

#### Key differences from `ArmApiService`

| Aspect | ArmApiService | DataApiService |
|--------|---------------|----------------|
| Base URL | `https://management.azure.com/subscriptions/…` | `Apim:DataApiUrl` (e.g. `https://<apim>.azure-api.net/developer`) |
| Token scope | `Apim:ArmScope` | `Apim:DataApiScope` |
| Response shape | ARM envelope `{ properties: { … } }` | Flat JSON — fields directly on object |
| Subscription prefix | Not applicable | `/users/{userId}/subscriptions/…` (user-scoped) |
| API version | `Apim:ApiVersion` (2022-08-01) | `Apim:DataApiVersion` (2022-04-01-preview) |

#### User-scoped prefix

The Data API requires subscription paths to be prefixed with the caller's identity:

```csharp
// DataApiService.UserPrefix()
string UserPrefix(string path) {
    var userId = GetCurrentUserId(); // oid or sub claim from JWT
    return $"/users/{userId}/{path.TrimStart('/')}";
}

// e.g. GET /subscriptions → /users/abc-123/subscriptions
```

#### Caching

Same pattern as `ArmApiService`: `IMemoryCache` with `"dataapi:{path}"` cache key and **1-minute TTL**.

---

### 17.6 Outbound: BFF → Global Admin API (Role Provider)

**Service:** `GlobalAdminRoleProvider` (`bff-dotnet/BffApi/Services/GlobalAdminRoleProvider.cs`)  
**Named HTTP client:** `"GlobalAdmin"`

Called by `ClaimsEnrichmentMiddleware` on **every authenticated request** (before RBAC evaluation).

#### Flow

```
ClaimsEnrichmentMiddleware
  │
  └─ IRoleProvider.GetUserRolesAsync(userId)
        │
        ├─ IMemoryCache check → key "ga-roles:{userId}"
        │     HIT  → return cached roles (TTL: 30 min)
        │
        └─ MISS → GET {GlobalAdmin:BaseUrl}/users/{userId}/roles
                    header: Ocp-Apim-Subscription-Key: {GlobalAdmin:ApiKey}
                    │
                    ├─ success → cache + return string[] (e.g. ["Distributor"])
                    └─ error   → log + return []  (fail-closed → RBAC denies all)
```

#### Fail-closed behavior

If the Global Admin API is unreachable or returns an error, `GetUserRolesAsync` returns an empty array `[]`. The RBAC pipeline then denies access to all protected endpoints. This prevents unauthorized access during Global Admin API outages.

#### Resilience (named client `"GlobalAdmin"` in `Program.cs`)

| Policy | Configuration |
|--------|---------------|
| Retry | 2 attempts |
| Per-attempt timeout | 10 seconds |
| Total request timeout | 30 seconds |
| Cache TTL | **30 minutes** (configurable via `GlobalAdmin:RoleCacheMinutes`) |

---

### 17.7 Outbound: BFF → Legacy SOAP APIs

**Services:** `SoapLegacyApiService`, `LegacySubscriptionService`, `LegacyAuthenticationBridge`, `UnifiedApiService`  
(all in `bff-dotnet/BffApi/Services/Legacy/`)

#### Component responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| `ILegacyApiService` / `SoapLegacyApiService` | `Legacy/SoapLegacyApiService.cs` | SOAP envelope construction, XML response parsing, maps to `ApiDetail[]` |
| `LegacyAuthenticationBridge` | `Legacy/LegacyAuthenticationBridge.cs` | Acquires NTLM / legacy auth tokens for SOAP backends |
| `LegacySubscriptionService` | `Legacy/LegacySubscriptionService.cs` | Subscription lifecycle for legacy systems (create/cancel) |
| `UnifiedApiService` | `Services/UnifiedApiService.cs` | Merges cloud + legacy catalogs in a single `Task.WhenAll` parallel fetch |

#### `UnifiedApiService` parallel fetch

```csharp
// UnifiedApiService.GetAllApisAsync()
var cloudTask  = GetCloudApisAsync();   // IArmApiService.ListApisAsync()
var legacyTask = GetLegacyApisAsync();  // ILegacyApiService.GetApisAsync()

await Task.WhenAll(cloudTask, legacyTask);

var all = cloudApis.Concat(legacyApis).OrderBy(a => a.Name).ToList();
```

**Cache keys and TTLs:**

| Cache key | TTL |
|-----------|-----|
| `"unified:cloud-apis"` | **60 minutes** |
| `"unified:legacy-apis"` | **60 minutes** |

On error in either branch, the failing branch returns an empty list — the other branch's results are still returned (graceful degradation).

---

### 17.8 Complete Endpoint → Data Source Map

All BFF endpoints, their auth requirements, the service method called, the upstream API hit, and caching behaviour.

#### APIs (`/api/apis/*`) — `ApisEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/apis` | `ApiRead` | `IArmApiService.ListApisAsync(top, skip, filter)` | ARM / Data API | `PagedResult<ApiContract>` | ✅ 1 min |
| GET | `/api/apis/highlights` | `ApiRead` | `IArmApiService.ListApisAsync(top: 3)` | ARM / Data API | `List<ApiContract>` | ✅ 1 min |
| GET | `/api/apis/{apiId}` | `ApiRead` | `IArmApiService.GetApiAsync(apiId, revision?)` | ARM / Data API | `ApiContract` | ✅ 1 min |
| GET | `/api/apis/{apiId}/operations` | `ApiRead` | `IArmApiService.ListOperationsAsync(apiId, top, skip)` | ARM / Data API | `PagedResult<OperationContract>` | ✅ 1 min |
| GET | `/api/apis/{apiId}/products` | `ApiRead` | `IArmApiService.ListProductsForApiAsync(apiId)` | ARM / Data API | `PagedResult<ProductContract>` | ✅ 1 min |
| GET | `/api/apis/{apiId}/openapi` | `ApiTryIt` | `IArmApiService.ExportOpenApiSpecAsync(apiId, format)` | ARM / Data API | `302 redirect` or inline JSON | ❌ |
| GET | `/api/apis/{apiId}/operations/{opId}` | `ApiRead` | `IArmApiService.GetOperationAsync(apiId, opId)` | ARM / Data API | `OperationContract` | ✅ 1 min |
| GET | `/api/apis/{apiId}/operations/{opId}/tags` | `ApiRead` | `IArmApiService.GetOperationTagsAsync(apiId, opId)` | ARM / Data API | `IReadOnlyList<TagContract>` | ✅ 1 min |
| GET | `/api/apis/{apiId}/operationsByTags` | `ApiRead` | `IArmApiService.GetOperationsByTagsAsync(…)` | ARM / Data API | `PagedResult<TagGroup<OperationContract>>` | ✅ 1 min |
| GET | `/api/apis/{apiId}/schemas` | `ApiRead` | `IArmApiService.GetApiSchemasAsync(apiId)` | ARM / Data API | `PagedResult<SchemaContract>` | ✅ 1 min |
| GET | `/api/apis/{apiId}/releases` | `ApiRead` | `IArmApiService.GetApiChangeLogAsync(apiId, top, skip)` | ARM / Data API | `PagedResult<ChangeLogContract>` | ✅ 1 min |
| GET | `/api/apis/byTags` | `ApiRead` | `IArmApiService.GetApisByTagsAsync(…)` | ARM / Data API | `PagedResult<TagGroup<ApiContract>>` | ✅ 1 min |

#### Products (`/api/products/*`) — `ProductsEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/products` | `ApiRead` | `IArmApiService.ListProductsAsync(top, skip)` | ARM / Data API | `PagedResult<ProductContract>` | ✅ 1 min |
| GET | `/api/products/{productId}` | `ApiRead` | `IArmApiService.GetProductAsync(productId)` | ARM / Data API | `ProductContract` | ✅ 1 min |
| GET | `/api/products/{productId}/apis` | `ApiRead` | `IArmApiService.GetProductApisAsync(productId, top, skip, filter)` | ARM / Data API | `PagedResult<ApiContract>` | ✅ 1 min |

#### Subscriptions (`/api/subscriptions/*`) — `SubscriptionsEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/subscriptions` | `ApiSubscribe` | `IArmApiService.ListSubscriptionsAsync(top, skip)` | ARM / Data API | `PagedResult<SubscriptionContract>` | ✅ 1 min |
| GET | `/api/subscriptions/{subId}` | `ApiSubscribe` | `IArmApiService.GetSubscriptionAsync(subId)` | ARM / Data API | `SubscriptionContract` | ✅ 1 min |
| POST | `/api/subscriptions` | `ApiSubscribe` | `IArmApiService.CreateSubscriptionAsync(request)` | ARM / Data API | `SubscriptionContract` 201 | ❌ |
| PATCH | `/api/subscriptions/{subId}` | `ApiSubscribe` | `IArmApiService.UpdateSubscriptionAsync(subId, body)` | ARM / Data API | `SubscriptionContract` | ❌ |
| DELETE | `/api/subscriptions/{subId}` | `ApiSubscribe` | `IArmApiService.DeleteSubscriptionAsync(subId)` | ARM / Data API | 204 No Content | ❌ |
| POST | `/api/subscriptions/{subId}/secrets` | `ApiSubscribe` | `IArmApiService.ListSubscriptionSecretsAsync(subId)` | ARM / Data API | `SubscriptionContract` | ❌ |
| POST | `/api/subscriptions/{subId}/regeneratePrimaryKey` | `ApiSubscribe` | `IArmApiService.RegeneratePrimaryKeyAsync(subId)` | ARM / Data API | `SubscriptionContract` | ❌ |
| POST | `/api/subscriptions/{subId}/regenerateSecondaryKey` | `ApiSubscribe` | `IArmApiService.RegenerateSecondaryKeyAsync(subId)` | ARM / Data API | `SubscriptionContract` | ❌ |

#### Misc (`/api/tags`, `/api/stats`, `/api/news`, `/api/users`, `/api/health`) — `MiscEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/tags` | `ApiRead` | `IArmApiService.ListTagsAsync(scope, filter)` | ARM / Data API | `PagedResult<TagContract>` | ✅ 1 min |
| GET | `/api/stats` | `ApiRead` | `IArmApiService.GetStatsAsync()` | ARM / Data API (4× count queries) | `PlatformStats` | ✅ 1 min |
| GET | `/api/news` | `ApiRead` | Static in-memory data | None (static) | `NewsItem[]` | ❌ |
| GET | `/api/users/me` | Authenticated | JWT claims extraction | None (from token) | `UserProfile` | ❌ |
| GET | `/api/users/me/subscriptions` | Authenticated | `IArmApiService.ListSubscriptionsAsync(top, skip)` | ARM / Data API | `PagedResult<SubscriptionContract>` | ✅ 1 min |
| GET | `/api/health` | Anonymous | Inline static response | None | `{ status, service, timestamp, version }` | ❌ |

#### Admin (`/api/admin/*`) — `AdminEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/admin/registrations` | `ApiManage` | In-memory mock list | None (mock) | `List<RegistrationRequest>` | ❌ |
| POST | `/api/admin/registrations/{id}/approve` | `ApiManage` | In-memory mock mutation | None (mock) | `RegistrationRequest` | ❌ |
| POST | `/api/admin/registrations/{id}/reject` | `ApiManage` | In-memory mock mutation | None (mock) | `RegistrationRequest` | ❌ |
| GET | `/api/admin/metrics` | `ApiManage` | `IArmApiService.GetStatsAsync()` + mock counts | ARM / Data API | `AdminMetric[]` | ❌ |

#### Support (`/api/support/*`) — `SupportEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/support/faqs` | Authenticated | In-memory static array | None (static) | `string[]` | ❌ |
| POST | `/api/support/tickets` | Authenticated | In-memory ticket store | None (mock) | `SupportTicket` 201 | ❌ |
| GET | `/api/support/my-tickets` | Authenticated | In-memory ticket store | None (mock) | `List<SupportTicket>` | ❌ |

#### Registration (`/api/registration/*`) — `RegistrationEndpoints.cs`

| Method | Path | Auth Policy | Service Method | Upstream | Response | Cached |
|--------|------|-------------|----------------|----------|----------|--------|
| GET | `/api/registration/config` | Authenticated | Static config | None | `RegistrationConfig` | ❌ |
| POST | `/api/registration` | Authenticated | In-memory store | None (mock) | `RegistrationRequest` 201 | ❌ |
| GET | `/api/registration/status` | Authenticated | In-memory store lookup | None (mock) | `RegistrationStatus` | ❌ |

---

### 17.9 Page-Level Fetch Orchestration

How each React page initiates and coordinates its data fetches.

#### Home (`src/pages/home/index.tsx`)

```typescript
// Three parallel fetches on mount via Promise.all
const [newsResult, highlightsResult, statsResult] = await Promise.all([
  get<NewsItem[]>("/news"),                   // GET /api/news
  get<ApiSummary[]>("/apis/highlights"),       // GET /api/apis/highlights
  get<PlatformStats>("/stats"),               // GET /api/stats
]);
```

| Fetch | Endpoint | Hook | Auth |
|-------|----------|------|------|
| News items | `GET /api/news` | `usePortalApi().get` | `ApiRead` |
| Highlighted APIs (top 3) | `GET /api/apis/highlights` | `usePortalApi().get` | `ApiRead` |
| Platform statistics | `GET /api/stats` | `usePortalApi().get` | `ApiRead` |

On partial failure (any single fetch errors), the page shows a toast and renders with available data. `cancelled` guard prevents state updates after unmount.

#### ApiCatalog (`src/pages/ApiCatalog.tsx`)

| Fetch | Endpoint | Hook | Auth |
|-------|----------|------|------|
| API list (paginated) | `GET /api/apis?$top=N&$skip=N[&$filter=…][&tags[i]=…]` | `usePortalApi` + `useApimCatalog` | `ApiRead` |

Pagination triggers re-fetch with updated `$skip`. Tag filters are appended as `tags[0]=…&tags[1]=…`.

#### ApiDetails (`src/pages/ApiDetails.tsx`)

| Fetch | Endpoint | Hook | Notes |
|-------|----------|------|-------|
| API metadata | `GET /api/apis/{id}?expandApiVersionSet=true` | `useApimCatalog().getApi` | |
| Operations list | `GET /api/apis/{id}/operations?$top=100` | `useApimCatalog().getApi` | Same call, parallel |
| Linked products | `GET /api/apis/{id}/products?$top=50` | `useApimCatalog().getApi` | Same call, parallel |

All three fetches are initiated inside `useApimCatalog().getApi(apiId)` which fans them out and merges the results into an `ApiDetails` object.

#### ApiTryIt (`src/pages/ApiTryIt.tsx`)

| Fetch | Endpoint | Hook | Notes |
|-------|----------|------|-------|
| API + operations | `GET /api/apis/{id}?api-version=2022-08-01` + `GET /api/apis/{id}/operations?api-version=2022-08-01` | `useApimClient().getApiById` | Parallel `Promise.all` inside `getApiById` |

The resulting `ApiDetails.openApiUrl` is then used to fetch the OpenAPI spec inline or redirect via `GET /api/apis/{id}/openapi`.

#### MyIntegrations (`src/pages/MyIntegrations.tsx`)

| Fetch | Endpoint | Hook | Auth |
|-------|----------|------|------|
| User subscriptions | `GET /api/users/me/subscriptions` | `usePortalApi().get` or `useApiData` | Authenticated |

Subscription actions trigger additional calls:
- Regenerate key: `POST /api/subscriptions/{subId}/regeneratePrimaryKey`
- Cancel: `DELETE /api/subscriptions/{subId}`

#### Admin (`src/pages/Admin.tsx`)

| Fetch | Endpoint | Hook | Auth |
|-------|----------|------|------|
| Pending registrations | `GET /api/admin/registrations?status=pending` | `usePortalApi().get` | `ApiManage` |
| Portal metrics | `GET /api/admin/metrics` | `usePortalApi().get` | `ApiManage` |

Both fetches run in parallel. Approve/reject actions trigger `POST /api/admin/registrations/{id}/approve` or `.../reject`.

#### Support (`src/pages/Support.tsx`)

| Fetch | Endpoint | Hook | Auth |
|-------|----------|------|------|
| FAQ list | `GET /api/support/faqs` | `usePortalApi().get` | Authenticated |
| My tickets | `GET /api/support/my-tickets` | `usePortalApi().get` | Authenticated |

Creating a ticket triggers `POST /api/support/tickets` with `{ category, api, impact, description }`.

#### Register / Onboarding (`src/pages/Register.tsx`, `src/pages/Onboarding.tsx`)

| Fetch | Endpoint | Hook | Auth |
|-------|----------|------|------|
| Form config | `GET /api/registration/config` | `usePortalApi().get` | Authenticated |
| Submit registration | `POST /api/registration` | `usePortalApi().post` | Authenticated |
| Registration status | `GET /api/registration/status` | `usePortalApi().get` | Authenticated |

---

### 17.10 Resilience & Error Handling Matrix

Cross-cutting summary of retry, caching, and error handling at each layer.

| Layer | Component | Retry Strategy | Cache | Timeout | Error Handling |
|-------|-----------|---------------|-------|---------|----------------|
| SPA | `request()` in `src/api/client.ts` | 2 retries, exp backoff (500 ms base), codes `[429, 500–504]` | None | Browser default | Returns `ApiResult` with typed `ApiError.code` |
| SPA | `useApiData<T>` | Inherits from `request()` | None | Browser default | Sets `error` state; `refetch()` to retry manually |
| SPA | `useBffHealth` | No retry (poll every 60 s) | None | Browser default | Sets status to `"unhealthy"` |
| BFF | `ArmApiService` | Polly 3× retry, exponential | `IMemoryCache` 1 min | 30 s / 90 s total | Log + rethrow `HttpRequestException`; 403 → credential invalidation + one-time retry |
| BFF | `DataApiService` | Polly 3× retry, exponential | `IMemoryCache` 1 min | 30 s / 90 s total | Log + rethrow `HttpRequestException` |
| BFF | `GlobalAdminRoleProvider` | Polly 2× retry | `IMemoryCache` 30 min | 10 s / 30 s total | Catch-all → return `[]` (fail-closed) |
| BFF | `SoapLegacyApiService` | Timeout only | `IMemoryCache` 60 min | Configurable | Return empty list on exception |
| BFF | `UnifiedApiService` | Per-source (see above) | `IMemoryCache` 60 min | Per-source | Graceful degradation: bad source returns `[]`, other source still returned |

**SPA error code → UI mapping:**

| `ApiError.code` | Meaning | Typical UI action |
|-----------------|---------|-------------------|
| `UNAUTHORIZED` | JWT expired / missing | Redirect to MSAL login |
| `FORBIDDEN` | Insufficient RBAC role | Show "Access Denied" page |
| `NOT_FOUND` | Resource does not exist | Show 404 message inline |
| `NETWORK` | Connection refused / DNS | Show "Service unavailable" banner |
| `ABORTED` | React unmount cleanup | Silently ignored |
| `SERVER` | 5xx after all retries | Show generic error toast |

---

### 17.11 Token Flow Diagram

End-to-end view of both token paths (user-facing MSAL and service-to-service SP).

```
User Browser
  │
  ├─ MSAL acquireTokenSilent()
  │    scope: api://<bff-client-id>/Portal.Access
  │    cache hit → return cached JWT
  │    cache miss → POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
  │                  (auth code / refresh token flow)
  │                  ← access token (JWT, ~1 h expiry)
  │
  └─ Every API call: Authorization: Bearer <user-access-token>
                     ─────────────────────────────────────────►
                                                              BFF (.NET)
                                                               │
                                                               ├─ JWT validation
                                                               │   Authority: https://login.microsoftonline.com/{tenant}/v2.0
                                                               │   Audience:  api://<bff-client-id>
                                                               │   Multi-tenant: ValidIssuers list
                                                               │
                                                               ├─ Extract OID claim → user identity
                                                               │
                                                               ├─ GlobalAdminRoleProvider.GetUserRolesAsync(oid)
                                                               │   → GET {GlobalAdminBaseUrl}/users/{oid}/roles
                                                               │       Ocp-Apim-Subscription-Key: <key>
                                                               │   ← ["Distributor", "Admin"]  (cached 30 min)
                                                               │
                                                               ├─ ClaimsPrincipal enriched with business roles
                                                               │
                                                               ├─ RBAC policy evaluation (ApiAccessHandler)
                                                               │   → allow / deny
                                                               │
                                                               │  For APIM calls (ARM Management API):
                                                               ├─ ITokenProvider.GetTokenAsync("https://management.azure.com/.default")
                                                               │   primary:  ClientSecretCredential
                                                               │             TenantId + ClientId + ClientSecret
                                                               │             → POST /oauth2/v2.0/token (client_credentials)
                                                               │             ← SP access token (cached by Azure.Identity)
                                                               │   fallback: DefaultAzureCredential
                                                               │             → ManagedIdentity / EnvVars / AzureCLI
                                                               │
                                                               ├─ Outbound: Authorization: Bearer <sp-token>
                                                               │           x-ms-apim-client: apim-dev-portal
                                                               │           ─────────────────────────────►
                                                               │                                        ARM / Data API
                                                               │                                         (Azure APIM)
                                                               │
                                                               │  For Global Admin calls:
                                                               └─ Ocp-Apim-Subscription-Key: <key>
                                                                  ──────────────────────────────────►
                                                                                                  Global Admin API
```

**Token cache behaviour:**

| Token | Cached by | TTL |
|-------|-----------|-----|
| User JWT (inbound) | MSAL in browser (`localStorage` / `sessionStorage`) | ~1 hour (token expiry) |
| SP bearer token (outbound ARM/Data API) | `Azure.Identity` SDK | ~1 hour (token expiry) |
| Global Admin roles | `IMemoryCache` in BFF | 30 minutes (configurable) |
| ARM/Data API responses | `IMemoryCache` in BFF | 1 minute per path |
| Unified/Legacy catalog | `IMemoryCache` in BFF | 60 minutes |
