# BFF Migration Decision: ASP.NET Core Minimal API + RBAC

> **Decision:** Yes — migrate the BFF to ASP.NET Core Minimal API.
> The RBAC requirement tips the balance from "evolve Express" to "migrate now."

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

### Project Structure

```
bff-dotnet/
├── Program.cs                          ← Minimal API entry point
├── appsettings.json                    ← Base configuration
├── appsettings.Development.json        ← Local dev overrides
├── api-registry.json                   ← API source registry (APIM vs external)
├── rbac-policies.json                  ← Role → API → Permission mappings
│
├── Authentication/
│   └── MsalJwtBearerSetup.cs          ← Configure JWT validation for Entra ID
│
├── Authorization/
│   ├── ApiAccessRequirement.cs         ← IAuthorizationRequirement
│   ├── ApiAccessHandler.cs             ← IAuthorizationHandler (checks role-API map)
│   ├── RbacPolicyProvider.cs           ← Loads rbac-policies.json, exposes lookups
│   └── Permissions.cs                  ← enum: Read, TryIt, Subscribe, Manage
│
├── Endpoints/
│   ├── ApisEndpoints.cs                ← GET /apis, GET /apis/{id}
│   ├── SubscriptionsEndpoints.cs       ← CRUD subscriptions
│   ├── TagsEndpoints.cs                ← GET /tags
│   ├── SchemasEndpoints.cs             ← GET /apis/{id}/schemas
│   ├── NewsEndpoints.cs                ← GET /news
│   ├── AdminEndpoints.cs               ← RBAC management (Admin only)
│   └── HealthEndpoints.cs              ← GET /health
│
├── Services/
│   ├── IApiCatalogService.cs           ← Interface: list/get APIs from any source
│   ├── ApimDataApiService.cs           ← APIM Data API client (existing logic ported)
│   ├── ExternalApiService.cs           ← Non-APIM API adapter
│   ├── ApiRegistryService.cs           ← Loads api-registry.json, routes requests
│   ├── ApimTokenService.cs             ← Managed Identity → ARM → SAS token chain
│   └── IRbacService.cs / RbacService.cs← Role-API permission checks + admin CRUD
│
├── Models/
│   ├── ApiSummary.cs                   ← Matches frontend ApiSummary type
│   ├── ApiDetails.cs                   ← Matches frontend ApiDetails type
│   ├── ApiOperation.cs
│   ├── RbacPolicy.cs                   ← Role, ApiId, Permissions[]
│   └── ExternalApiConfig.cs
│
├── Middleware/
│   ├── RequestLoggingMiddleware.cs      ← Structured logging
│   └── RetryDelegatingHandler.cs        ← Polly retry for HttpClient
│
├── Tests/
│   ├── Authorization/
│   │   ├── ApiAccessHandlerTests.cs     ← Unit test RBAC logic
│   │   └── RbacPolicyProviderTests.cs
│   ├── Services/
│   │   ├── ApimDataApiServiceTests.cs
│   │   └── ApiRegistryServiceTests.cs
│   └── Endpoints/
│       ├── ApisEndpointsTests.cs        ← Integration tests with WebApplicationFactory
│       └── SubscriptionsEndpointsTests.cs
│
└── bff-dotnet.csproj
```

### Key Code Patterns

#### Program.cs (Minimal API Setup)

```csharp
var builder = WebApplication.CreateBuilder(args);

// ── Authentication: validate MSAL tokens from the SPA ──
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["EntraId:Authority"];
        options.Audience = builder.Configuration["EntraId:ClientId"];
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = builder.Configuration.GetSection("EntraId:ValidIssuers").Get<string[]>(),
            RoleClaimType = "roles"
        };
    });

// ── Authorization: custom RBAC policies ──
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiRead", p => p.AddRequirements(new ApiAccessRequirement(Permission.Read)))
    .AddPolicy("ApiTryIt", p => p.AddRequirements(new ApiAccessRequirement(Permission.TryIt)))
    .AddPolicy("ApiSubscribe", p => p.AddRequirements(new ApiAccessRequirement(Permission.Subscribe)))
    .AddPolicy("ApiManage", p => p.AddRequirements(new ApiAccessRequirement(Permission.Manage)));

builder.Services.AddSingleton<IAuthorizationHandler, ApiAccessHandler>();
builder.Services.AddSingleton<RbacPolicyProvider>();

// ── HttpClients with Polly retry ──
builder.Services.AddHttpClient("ApimDataApi", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
}).AddPolicyHandler(GetRetryPolicy());

builder.Services.AddHttpClient("ExternalWarrantyApi", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["ExternalApis:Warranty:BaseUrl"]!);
}).AddPolicyHandler(GetRetryPolicy());

// ── Services ──
builder.Services.AddSingleton<ApimTokenService>();
builder.Services.AddSingleton<ApiRegistryService>();
builder.Services.AddScoped<IApiCatalogService, ApiCatalogService>();
builder.Services.AddScoped<IRbacService, RbacService>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// ── Map endpoints ──
app.MapApisEndpoints();
app.MapSubscriptionsEndpoints();
app.MapTagsEndpoints();
app.MapNewsEndpoints();
app.MapAdminEndpoints();
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
| Dockerfile runtime stage | `nodejs npm` in alpine | `mcr.microsoft.com/dotnet/aspnet:8.0-alpine` |
| supervisord | `command=node /app/bff/server.js` | `command=dotnet /app/bff/bff-dotnet.dll` |
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

| Step | Effort | Sprint |
|---|---|---|
| Scaffold `bff-dotnet/` project, Program.cs, DI setup | 1 day | Sprint 1 |
| Port APIM token service (Managed Identity → ARM → SAS) | 1 day | Sprint 1 |
| Port API list/detail routes + transformers | 2 days | Sprint 1 |
| Add JWT Bearer authentication middleware | 0.5 day | Sprint 1 |
| Add RBAC authorization pipeline + policy provider | 2 days | Sprint 1 |
| Add external API adapter (for non-APIM API) | 1 day | Sprint 1 |
| Add Polly retry + portal header | 0.5 day | Sprint 1 |
| Port mock mode endpoints | 0.5 day | Sprint 1 |
| Update Dockerfile (dotnet runtime) | 0.5 day | Sprint 2 |
| Update supervisord.conf | 0.5 day | Sprint 2 |
| Unit + integration tests (RBAC, endpoints) | 2 days | Sprint 2 |
| Validation: run SPA against new BFF locally | 1 day | Sprint 2 |
| Remove old `bff/` Node.js folder | 0.5 day | Sprint 2 |
| **Total** | **~13 days** | **~2 sprints** |

---

## 6. Dockerfile Change

```dockerfile
# ---------- build stage (SPA - unchanged) ----------
FROM node:20-alpine AS spa-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npx vite build --mode production

# ---------- build stage (BFF - NEW) ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS bff-builder
WORKDIR /src
COPY bff-dotnet/*.csproj ./
RUN dotnet restore
COPY bff-dotnet/ ./
RUN dotnet publish -c Release -o /app/bff --no-restore

# ---------- runtime stage ----------
FROM nginx:alpine AS runtime
RUN apk add --no-cache dotnet8-runtime supervisor

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
command=dotnet /app/bff/bff-dotnet.dll --urls http://0.0.0.0:3001
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
