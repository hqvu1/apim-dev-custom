# BFF Migration Decision: ASP.NET Core Minimal API + RBAC

> **Decision:** Yes — migrate the BFF to ASP.NET Core Minimal API.
> The RBAC requirement tips the balance from "evolve Express" to "migrate now."
> 
> **Status:** ✅ Migration complete. The .NET BFF (`bff-dotnet/BffApi.csproj`) is the active implementation running on ASP.NET Core 10.

---

## 1. Why the RBAC Requirement Changes the Decision

The previous analysis recommended keeping Express for Phase 1 because the BFF was a **thin proxy** — just pass-through to the APIM Data API with token injection. Adding one external API adapter to Express would be 1–2 days.

But **RBAC that controls per-API access based on Global Admin roles** is not a thin proxy concern. It's a **policy engine** with these responsibilities:

| Responsibility | Express.js (plain JS) | ASP.NET Core |
|---|---|---|
| Validate MSAL JWT on every request (issuer, audience, signature, expiry) | Manual: `jsonwebtoken` + JWKS fetch + cache | Built-in: `AddAuthentication().AddJwtBearer()` — 3 lines |
| Extract roles from token claims | Manual parsing | `User.IsInRole()`, `[Authorize(Roles = "...")]` |
| Map roles → permitted APIs (configurable) | Custom JSON loader, no typing | Typed `IOptions<RbacConfig>`, hot-reload from appsettings |
| Enforce per-route AND per-API-resource authorization | Scattered `if` checks in each handler | `IAuthorizationHandler` + policy-based auth pipeline |
| Admin CRUD for role-API mappings | Manual routes + file I/O or raw SQL | EF Core / Dapper + typed endpoints |
| Audit log for access decisions | `console.log` | Structured logging with `ILogger` + Application Insights |
| Unit test the policy logic | No framework conventions | `WebApplicationFactory` + test auth handler |
| Maintain over 4.5 months + AMS handover | Fragile single file growing past 1000 lines | Clean separation via DI + project structure |

**The tipping point:** RBAC is a cross-cutting concern that touches every request. ASP.NET Core's middleware pipeline, authorization policies, and DI container are purpose-built for this. Doing it properly in Express requires reinventing what ASP.NET Core gives you out of the box.

---

## 2. What the RBAC Layer Needs to Do

```
Browser sends: GET /api/apis/warranty-api
  Authorization: Bearer <MSAL id_token with roles: ["Developer"]>

BFF pipeline:
  ① JWT Validation Middleware
     → Verify token signature against Entra ID JWKS endpoint
     → Check issuer, audience, expiry
     → Extract claims: sub, oid, roles[], groups[]

  ② RBAC Authorization Middleware
     → Load role-to-API permission map (from config or DB)
     → For the requested resource (warranty-api):
        Does "Developer" role have READ access to "warranty-api"? → YES → continue
        Does "Tester" role have TRYIT access to "warranty-api"? → YES for /try routes
        Does "Admin" role have WRITE access? → YES for subscription CRUD

  ③ Route Handler
     → Fetch from APIM Data API or external adapter
     → Return response

If ② fails → 403 { error: "Your role does not have access to this API" }
```

### Permission Model

```
Role (from Global Admin)     API                    Permissions
─────────────────────────────────────────────────────────────────
Admin                        *                      read, write, tryit, manage
GlobalAdmin                  *                      read, write, tryit, manage
Developer                    warranty-api           read, tryit, subscribe
Developer                    punchout-api           read, tryit, subscribe
Developer                    equipment-api          read, tryit, subscribe
Tester                       warranty-api           read, tryit
Tester                       punchout-api           read, tryit
Tester                       equipment-api          read, tryit
Viewer                       *                      read
```

This mapping must be **configurable** (not hardcoded) so that when new APIs are onboarded or roles change in Global Admin, the portal admins can update access without a code deployment.

---

## 3. Recommended Architecture: ASP.NET Core Minimal API

### Project Structure (Actual Implementation)

```
bff-dotnet/
├── Program.cs                          ← Minimal API composition root (DI, auth, middleware, endpoints)
├── BffApi.csproj                       ← .NET 10, packages: Azure.Identity, Microsoft.Identity.Web,
│                                         Microsoft.Extensions.Http.Resilience, Scalar.AspNetCore
├── appsettings.json                    ← Base configuration (APIM, Entra ID, features)
├── appsettings.Development.json        ← Mock mode + debug logging + CORS origins
├── api-registry.json                   ← API source registry (3 APIs: warranty, punchout, equipment)
├── rbac-policies.json                  ← Role → API → Permission mappings (hot-reloadable)
│
├── Authorization/
│   ├── ApiAccessRequirement.cs         ← IAuthorizationRequirement
│   ├── ApiAccessHandler.cs             ← IAuthorizationHandler (checks role-API map from RBAC config)
│   ├── RbacPolicyProvider.cs           ← Loads rbac-policies.json, evaluates role → API → permission
│   └── Permissions.cs                  ← enum: Read, TryIt, Subscribe, Manage
│
├── Endpoints/
│   ├── ApisEndpoints.cs                ← /api/apis/* (list, highlights, detail, operations, openapi, schemas…)
│   ├── ProductsEndpoints.cs            ← /api/products, /api/products/{id}, /api/products/{id}/apis
│   ├── SubscriptionsEndpoints.cs       ← /api/subscriptions CRUD + secrets + key regeneration
│   └── MiscEndpoints.cs                ← /api/tags, /api/users/me, /api/stats, /api/news, /api/health,
│                                         /api/apisByTags, /api/apiVersionSets/*
│
├── Middleware/
│   ├── RequestLoggingMiddleware.cs      ← Structured logging (method/path/status/elapsed)
│   └── PortalTelemetryHandler.cs        ← x-ms-apim-client DelegatingHandler
│
├── Models/
│   └── ApimContracts.cs                ← All DTOs (PagedResult<T>, ApiSummary, ApiDetails, etc.)
│
└── Services/
    ├── ArmApiService.cs                ← ARM Management API client + DefaultAzureCredential
    │                                     (unwraps ARM {id,name,properties} envelope)
    ├── DataApiService.cs               ← APIM Data API client (flat responses, user-scoped prefixing)
    └── MockApiService.cs               ← Static mock data for offline development
```

### Key Code Patterns

#### Program.cs (Actual Implementation — Minimal API Setup)

```csharp
var builder = WebApplication.CreateBuilder(args);

// ── Configuration ──
builder.Services.Configure<ApimSettings>(builder.Configuration.GetSection("Apim"));
builder.Configuration.AddJsonFile("rbac-policies.json", optional: true, reloadOnChange: true);
builder.Services.Configure<RbacConfig>(builder.Configuration);

var useMockMode = builder.Configuration.GetValue<bool>("Features:UseMockMode");

// ── Authentication: JWT Bearer from Entra ID (multi-tenant) ──
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var entra = builder.Configuration.GetSection("EntraId");
        var tenantId = entra["TenantId"];
        var clientId = entra["ClientId"];
        var externalTenantId = entra["ExternalTenantId"];
        var ciamHost = entra["CiamHost"];

        if (useMockMode && builder.Environment.IsDevelopment())
        {
            // Mock mode: accept any token or auto-grant dev identity
        }
        else
        {
            // Multi-tenant: resolve signing keys from all configured OIDC endpoints
            // (workforce + CIAM) via IssuerSigningKeyResolver
            var metadataAddresses = new List<string>
            {
                $"{instance}{tenantId}/v2.0/.well-known/openid-configuration"
            };
            if (!string.IsNullOrWhiteSpace(externalTenantId) && !string.IsNullOrWhiteSpace(ciamHost))
                metadataAddresses.Add($"https://{ciamHost}/{externalTenantId}/v2.0/.well-known/openid-configuration");

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuers = entra.GetSection("ValidIssuers").Get<string[]>(),
                ValidateAudience = true,
                ValidAudiences = entra.GetSection("ValidAudiences").Get<string[]>(),
                RoleClaimType = "roles",
                IssuerSigningKeyResolver = (token, securityToken, kid, validationParameters) =>
                    configManagers.SelectMany(cm => cm.GetConfigurationAsync(...).SigningKeys)
            };
        }
    });

// ── Authorization: RBAC policies (4 levels) ──
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiRead", p => p.AddRequirements(new ApiAccessRequirement(Permission.Read)))
    .AddPolicy("ApiTryIt", p => p.AddRequirements(new ApiAccessRequirement(Permission.TryIt)))
    .AddPolicy("ApiSubscribe", p => p.AddRequirements(new ApiAccessRequirement(Permission.Subscribe)))
    .AddPolicy("ApiManage", p => p.AddRequirements(new ApiAccessRequirement(Permission.Manage)));

builder.Services.AddSingleton<IAuthorizationHandler, ApiAccessHandler>();

// ── HttpClients with Resilience pipeline ──
builder.Services.AddHttpClient("ArmApi", ...)
    .AddHttpMessageHandler<PortalTelemetryHandler>()
    .AddStandardResilienceHandler(options => { /* retry 3x, circuit breaker, timeout */ });

builder.Services.AddHttpClient("DataApi", ...)
    .AddHttpMessageHandler<PortalTelemetryHandler>()
    .AddStandardResilienceHandler(...);

// ── Services: 3 modes (Mock / Data API / ARM) ──
if (useMockMode)
    builder.Services.AddSingleton<IArmApiService, MockApiService>();
else if (useDataApi)
    builder.Services.AddScoped<IArmApiService, DataApiService>();
else
    builder.Services.AddScoped<IArmApiService, ArmApiService>();

var app = builder.Build();

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ── Map endpoint groups ──
app.MapApisEndpoints();
app.MapApisByTagsEndpoints();
app.MapApiVersionSetEndpoints();
app.MapTagsEndpoints();
app.MapProductsEndpoints();
app.MapSubscriptionsEndpoints();
app.MapStatsEndpoints();
app.MapNewsEndpoints();
app.MapUserEndpoints();
app.MapHealthEndpoints();

app.Run();
```

#### RBAC Authorization Handler

```csharp
public class ApiAccessHandler : AuthorizationHandler<ApiAccessRequirement>
{
    private readonly RbacPolicyProvider _rbac;

    public ApiAccessHandler(RbacPolicyProvider rbac) => _rbac = rbac;

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ApiAccessRequirement requirement)
    {
        // Extract apiId from the route
        var httpContext = context.Resource as HttpContext;
        var apiId = httpContext?.GetRouteValue("apiId")?.ToString();

        // Get user roles from the validated token
        var roles = context.User.Claims
            .Where(c => c.Type == "roles")
            .Select(c => c.Value)
            .ToList();

        // Admin/GlobalAdmin always has full access
        if (roles.Contains("Admin") || roles.Contains("GlobalAdmin"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // For non-specific-API routes (e.g., GET /apis list), check general permission
        if (apiId is null)
        {
            if (_rbac.HasGeneralPermission(roles, requirement.Permission))
                context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // Check role-to-API-specific permission
        if (_rbac.HasApiPermission(roles, apiId, requirement.Permission))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
```

#### Endpoint with RBAC

```csharp
public static class ApisEndpoints
{
    public static void MapApisEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/apis").RequireAuthorization("ApiRead");

        group.MapGet("/", async (IApiCatalogService catalog, HttpContext ctx) =>
        {
            var roles = ctx.User.Claims.Where(c => c.Type == "roles").Select(c => c.Value);
            var apis = await catalog.ListAllAsync();

            // Filter: only return APIs the user's roles can see
            var rbac = ctx.RequestServices.GetRequiredService<IRbacService>();
            var visible = apis.Where(a => rbac.CanAccess(roles, a.Id, Permission.Read));

            return Results.Ok(visible);
        });

        group.MapGet("/{apiId}", async (string apiId, IApiCatalogService catalog) =>
        {
            var details = await catalog.GetDetailsAsync(apiId);
            return details is null ? Results.NotFound() : Results.Ok(details);
        }).RequireAuthorization("ApiRead");

        group.MapGet("/{apiId}/try", async (string apiId, IApiCatalogService catalog) =>
        {
            // TryIt requires elevated permission
            var spec = await catalog.GetOpenApiSpecAsync(apiId);
            return spec is null ? Results.NotFound() : Results.Ok(spec);
        }).RequireAuthorization("ApiTryIt");
    }
}
```

---

## 4. RBAC Configuration (Hot-Reloadable)

### rbac-policies.json

```jsonc
{
  "policies": [
    {
      "role": "Admin",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe", "manage"]
    },
    {
      "role": "GlobalAdmin",
      "apis": ["*"],
      "permissions": ["read", "tryit", "subscribe", "manage"]
    },
    {
      "role": "Developer",
      "apis": ["warranty-api", "punchout-api", "equipment-api"],
      "permissions": ["read", "tryit", "subscribe"]
    },
    {
      "role": "Tester",
      "apis": ["warranty-api", "punchout-api", "equipment-api"],
      "permissions": ["read", "tryit"]
    },
    {
      "role": "Viewer",
      "apis": ["*"],
      "permissions": ["read"]
    }
  ]
}
```

### Phase 1: File-based. Future: Admin UI + Database.

For MVP, `rbac-policies.json` is loaded at startup and can be hot-reloaded via `IOptionsMonitor<RbacConfig>`. The Admin page in the SPA can later manage these via `PUT /admin/rbac/policies` → persist to Cosmos DB or Azure App Configuration.

---

## 5. Migration Plan

### What Changes

| Component | Before (Express) | After (ASP.NET Core) |
|---|---|---|
| BFF runtime | Node.js `server.js` | `dotnet` Minimal API |
| Dockerfile runtime stage | `mcr.microsoft.com/dotnet/aspnet:10.0-preview-alpine` (copied into nginx:alpine) | `mcr.microsoft.com/dotnet/aspnet:10.0-preview-alpine` (copied into nginx:alpine) |
| supervisord | `command=node /app/bff/server.js` | `command=dotnet /app/bff/BffApi.dll` |
| Auth | None (BFF trusts Nginx proximity) | JWT Bearer validation on every request |
| RBAC | None | Policy-based authorization pipeline |
| APIM Data API calls | `node-fetch` + manual token cache | `IHttpClientFactory` + named client + Polly |
| External API support | Not present | `IApiCatalogService` dispatches to adapters |
| Retry | None | Polly policies per HttpClient |
| Test coverage | None | xUnit + WebApplicationFactory |

### What Does NOT Change

| Component | Status |
|---|---|
| SPA (React/Vite/MUI) | Unchanged — still calls `/api/...` |
| Frontend auth (MSAL) | Unchanged — still sends Bearer token |
| Frontend types (`ApiSummary`, `ApiDetails`) | Unchanged — BFF returns same shape |
| Nginx config | Unchanged — still proxies `/api/` → `localhost:3001` |
| Bicep IaC | Minor — add dotnet runtime to container, remove Node.js |
| Container App Managed Identity | Unchanged — `DefaultAzureCredential` works in .NET SDK too |
| Mock mode | Port to ASP.NET Core `IsDevelopment()` check |

### Timeline Estimate

> **Status:** Core migration is ✅ complete. Dockerfile, supervisord, Bicep, and docker-compose all updated to use .NET BFF. Remaining: unit tests.

| Step | Effort | Status |
|---|---|---|
| Scaffold `bff-dotnet/` project, Program.cs, DI setup | 1 day | ✅ Complete |
| Port APIM token service (Managed Identity → ARM) | 1 day | ✅ Complete |
| Port API list/detail routes + transformers | 2 days | ✅ Complete |
| Add JWT Bearer authentication middleware | 0.5 day | ✅ Complete |
| Add RBAC authorization pipeline + policy provider | 2 days | ✅ Complete |
| Add Data API mode (alternative to ARM) | 1 day | ✅ Complete |
| Add Polly resilience + portal telemetry header | 0.5 day | ✅ Complete |
| Port mock mode endpoints | 0.5 day | ✅ Complete |
| Update Dockerfile (dotnet runtime) | 0.5 day | ✅ Complete |
| Update supervisord.conf | 0.5 day | ✅ Complete |
| Unit + integration tests (RBAC, endpoints) | 2 days | ⚠️ Pending |
| Validation: run SPA against new BFF locally | 1 day | ✅ Complete |
| Remove old `bff/` Node.js folder | 0.5 day | ⚠️ Pending (kept as reference) |

---

## 6. Dockerfile Change

> **Note:** The .NET BFF uses **ASP.NET Core 10** (not 8.0 as originally planned).

```dockerfile
# ---------- build stage (SPA - unchanged) ----------
FROM node:20-alpine AS spa-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npx vite build --mode production

# ---------- build stage (BFF - .NET 10) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS bff-builder
WORKDIR /src
COPY bff-dotnet/*.csproj ./
RUN dotnet restore
COPY bff-dotnet/ ./
RUN dotnet publish -c Release -o /app/bff --no-restore

# ---------- runtime stage ----------
FROM nginx:alpine AS runtime
RUN apk add --no-cache dotnet10-runtime supervisor

COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY supervisord.conf /etc/supervisor.d/services.ini

COPY --from=spa-builder /app/dist /usr/share/nginx/html
COPY --from=bff-builder /app/bff /app/bff

# ... permissions, healthcheck same as before
```

### supervisord.conf Change

```ini
[program:bff]
command=dotnet /app/bff/BffApi.dll --urls http://0.0.0.0:3001
directory=/app/bff
autostart=true
autorestart=true
environment=ASPNETCORE_ENVIRONMENT="Production",ASPNETCORE_URLS="http://+:3001"
```

---

## 7. Summary

| Question | Answer |
|---|---|
| **Should you migrate to ASP.NET Core?** | **Yes.** RBAC is a cross-cutting concern that benefits enormously from ASP.NET Core's authorization pipeline, DI, and typed middleware. Doing it properly in Express means reinventing what .NET provides natively. |
| **Should you include RBAC in the BFF?** | **Yes.** The BFF is the enforcement point — it validates the MSAL token, checks role-to-API permissions, then proxies to the correct backend. The frontend `RoleGate` is for UX (hide/show), the BFF is for security (allow/deny). |
| **Should you use Azure Functions instead?** | **No.** The RBAC middleware needs to run on every request with consistent low latency. Functions cold start + per-invocation pricing doesn't fit a request/response proxy. |
| **When?** | **Now, during build phase (Months 2–3).** ~13 days across 2 sprints. The SPA doesn't change, so frontend work continues in parallel. |
| **Risk?** | **Low.** The SPA calls `/api/...` through Nginx — it never knows the backend changed. Same container, same Managed Identity, same Bicep (minor update). |

---

*Decision document for KNA Project #802 — Komatsu API Marketplace Portal.*
