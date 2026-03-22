# BFF API — ASP.NET Core 10 Minimal API

Backend-for-Frontend (BFF) proxy that sits between the React SPA and Azure API Management (APIM) ARM Management API. Runs behind Nginx at `/api/*` on port 3001.

## Architecture

```
┌────────────┐      ┌───────────┐      ┌───────────────────────┐
│  React SPA │ ───► │ Nginx     │ ───► │ BFF (.NET 10)         │
│  :5173     │      │ :8080     │      │ :3001                 │
│ /api/*     │      │ proxy_pass│      │ ├─ JWT Auth (Entra ID) │
└────────────┘      └───────────┘      │ ├─ RBAC Policies       │
                                       │ ├─ ARM Proxy + Cache   │
                                       │ └─ Resilience Pipeline │
                                       └────────┬──────────────┘
                                                 │ App Registration (Client Credentials)
                                       ┌────────▼──────────────┐
                                       │ ARM Management API    │
                                       │ management.azure.com  │
                                       └───────────────────────┘
```

## Features

| Feature | Details |
|---------|---------|
| **Authentication** | JWT Bearer from Entra ID MSAL (dual-tenant: CIAM + Workforce; IssuerSigningKeyResolver for multi-OIDC) |
| **Authorization** | RBAC policies (ApiRead, ApiTryIt, ApiSubscribe, ApiManage) via `rbac-policies.json` |
| **Resilience** | `Microsoft.Extensions.Http.Resilience` — retry 3x, circuit breaker, timeout |
| **Caching** | `IMemoryCache` with 1-min TTL for GET ARM responses |
| **Telemetry** | `x-ms-apim-client` portal header on outbound ARM requests |
| **Logging** | Structured request logging middleware (method/path/status/elapsed) |
| **Security** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers |
| **Mock Mode** | Full offline development with static data (`Features:UseMockMode=true`) |
| **OpenAPI** | Scalar API reference in development mode (`/scalar/v1`) |
| **Pagination** | `$top/$skip/$filter` passthrough to ARM API |

## API Endpoints

### APIs (`/api/apis`)
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/apis` | ApiRead | List APIs (with pagination & RBAC filtering) |
| GET | `/api/apis/highlights` | ApiRead | Top 3 featured APIs |
| GET | `/api/apis/{apiId}` | ApiRead | API detail |
| GET | `/api/apis/{apiId}/operations` | ApiRead | Operations for an API |
| GET | `/api/apis/{apiId}/products` | ApiRead | Products for an API |
| GET | `/api/apis/{apiId}/openapi` | ApiTryIt | OpenAPI spec (YAML) |
| GET | `/api/apis/{apiId}/operations/{operationId}` | ApiRead | Operation detail |
| GET | `/api/apis/{apiId}/operations/{operationId}/tags` | ApiRead | Tags for an operation |
| GET | `/api/apis/{apiId}/operationsByTags` | ApiRead | Operations grouped by tag |
| GET | `/api/apis/{apiId}/schemas` | ApiRead | API schemas |
| GET | `/api/apis/{apiId}/releases` | ApiRead | API releases |
| GET | `/api/apis/{apiId}/hostnames` | ApiRead | API hostnames |

### APIs by Tags / Version Sets
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/apisByTags` | ApiRead | APIs grouped by tag |
| GET | `/api/apiVersionSets/{versionSetId}` | ApiRead | Version set detail |
| GET | `/api/apiVersionSets/{versionSetId}/apis` | ApiRead | APIs in a version set |

### Tags (`/api/tags`)
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/tags` | ApiRead | List tags (optional scope & filter) |

### Products (`/api/products`)
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/products` | ApiRead | List products (with pagination) |

### Subscriptions (`/api/subscriptions`)
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/subscriptions` | ApiRead | List subscriptions (with pagination) |
| GET | `/api/subscriptions/{subId}` | ApiRead | Subscription detail |
| POST | `/api/subscriptions` | ApiSubscribe | Create subscription |
| PATCH | `/api/subscriptions/{subId}` | ApiSubscribe | Update/rename/cancel subscription |
| DELETE | `/api/subscriptions/{subId}` | ApiSubscribe | Delete subscription |
| POST | `/api/subscriptions/{subId}/secrets` | ApiSubscribe | Retrieve subscription keys |

### User (`/api/users`)
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/users/me` | (Authenticated) | Current user profile from JWT claims |

### Misc
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/stats` | ApiRead | Platform statistics |
| GET | `/api/news` | ApiRead | News items |
| GET | `/api/health` | Anonymous | Health check + version |

## Getting Started

### Prerequisites
- .NET 10 SDK (`dotnet --version` → 10.x)
- Azure subscription with APIM instance (for production)

### Run in Mock Mode (no Azure required)

```bash
cd bff-dotnet
dotnet restore --source https://api.nuget.org/v3/index.json
ASPNETCORE_ENVIRONMENT=Development dotnet run
```

Mock mode is enabled automatically in Development via `appsettings.Development.json`.  
Access the Scalar API docs at [http://localhost:3001/scalar/v1](http://localhost:3001/scalar/v1).

### Configuration

**appsettings.json**:
```json
{
  "Apim": {
    "SubscriptionId": "...",
    "ResourceGroup": "...",
    "ServiceName": "...",
    "ApiVersion": "2022-08-01",
    "ArmScope": "https://management.azure.com/.default",
    "DataApiScope": "https://management.azure.com/.default",
    "ServicePrincipal": {
      "TenantId": "<your-tenant-id>",
      "ClientId": "<your-sp-client-id>",
      "ClientSecret": "<your-sp-client-secret>"
    }
  },
  "EntraId": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<your-tenant-id>",
    "ClientId": "<your-client-id>",
    "ValidIssuers": ["https://login.microsoftonline.com/<tenant>/v2.0"]
  },
  "Features": {
    "UseMockMode": false
  }
}
```

### RBAC Configuration

Roles and permissions are defined in `rbac-policies.json` (hot-reloaded):

```json
{
  "roles": {
    "Admin": { "permissions": { "*": ["read", "tryit", "subscribe", "manage"] } },
    "Developer": { "permissions": { "warranty-api": ["read", "tryit", "subscribe"] } },
    "Viewer": { "permissions": { "*": ["read"] } }
  }
}
```

## Project Structure

```
bff-dotnet/
├── Program.cs                      # Composition root — DI, middleware, endpoints
├── Komatsu.ApimMarketplace.Bff.csproj                   # .NET 10, packages
├── appsettings.json                # APIM, Entra ID, feature flags
├── appsettings.Development.json    # Mock mode enabled
├── rbac-policies.json              # RBAC role → permission mapping
├── api-registry.json               # API source registry
├── Authorization/
│   ├── Permissions.cs              # Permission enum (Read, TryIt, Subscribe, Manage)
│   ├── ApiAccessRequirement.cs     # IAuthorizationRequirement
│   ├── ApiAccessHandler.cs         # IAuthorizationHandler (checks RBAC)
│   └── RbacPolicyProvider.cs       # Loads & evaluates rbac-policies.json
├── Endpoints/
│   ├── ApisEndpoints.cs            # /api/apis/* with RBAC filtering
│   ├── ProductsEndpoints.cs        # /api/products
│   ├── SubscriptionsEndpoints.cs   # /api/subscriptions/* lifecycle
│   └── MiscEndpoints.cs            # /api/tags, /api/users/me, /api/stats, /api/news, /api/health
├── Middleware/
│   ├── RequestLoggingMiddleware.cs  # Structured request/response logging
│   └── PortalTelemetryHandler.cs   # x-ms-apim-client outbound header
├── Models/
│   └── ApimContracts.cs            # DTO shapes matching SPA types.ts
└── Services/
    ├── ArmApiService.cs            # Real ARM Management API client + caching (uses ITokenProvider)
    ├── DataApiService.cs           # APIM Data API client (runtime mode, uses ITokenProvider)
    ├── MockApiService.cs           # Full offline mock implementation
    └── AppRegistrationTokenProvider.cs # ITokenProvider impl using ClientSecretCredential
```

## Service Modes

The BFF supports 3 backend modes via configuration:

| Mode | Config | Service Class | Backend |
|------|--------|---------------|---------|
| **Mock** | `UseMockMode=true` + Dev env | `MockApiService` | Static in-memory data |
| **Data API** | `UseDataApi=true` | `DataApiService` | `https://{apim}.azure-api.net/developer` (flat JSON, SP token) |
| **ARM** | Default | `ArmApiService` | `https://management.azure.com/...` (unwraps properties envelope, SP token) |

All modes return the same `PagedResult<T>` shape: `{ value: [...], count: N }`.

## Design Decisions

See the architecture documents for full context:
- [ARCHITECTURE_DESIGN.md](../docs/ARCHITECTURE_DESIGN.md) — overall system design
- [BFF_EVOLUTION_ANALYSIS.md](../docs/BFF_EVOLUTION_ANALYSIS.md) — BFF pattern evolution
- [BFF_MIGRATION_DECISION.md](../docs/BFF_MIGRATION_DECISION.md) — Node.js → .NET migration rationale
- [APIM_DATA_API_COMPARISON.md](../docs/APIM_DATA_API_COMPARISON.md) — ARM vs Data Plane API choice
