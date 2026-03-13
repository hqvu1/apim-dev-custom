# BFF Implementation Summary

> **Status:** ✅ Migrated to ASP.NET Core 10 (`bff-dotnet/`). The original Node.js BFF (`bff/`) is retained for reference but the .NET BFF is the active implementation.

## What We Built

We've implemented a **Backend-for-Frontend (BFF)** architecture with Azure Managed Identity authentication to solve the authorization issue with APIM Management API. The BFF has been migrated from Node.js Express to **ASP.NET Core 10 Minimal API** for better RBAC, type safety, and resilience.

## Architecture

```
┌────────────┐      ┌───────────┐      ┌────────────────────────────┐
│  React SPA │ ───► │ Nginx     │ ───► │ BFF (.NET 10)              │
│  :5173     │      │ :8080     │      │ :3001                      │
│ /api/*     │      │ proxy_pass│      │ ├─ JWT Auth (Entra ID)      │
└────────────┘      └───────────┘      │ ├─ RBAC Policies            │
                                       │ ├─ ARM/Data API/Mock Proxy  │
                                       │ ├─ IMemoryCache (1-min TTL) │
                                       │ └─ Resilience Pipeline      │
                                       └────────┬───────────────────┘
                                                 │ DefaultAzureCredential
                                       ┌────────▼───────────────────┐
                                       │ ARM Management API         │
                                       │ management.azure.com       │
                                       └────────────────────────────┘
```

## BFF Components

### Current: ASP.NET Core 10 BFF (`bff-dotnet/`)
- **Runtime**: .NET 10 Minimal API (`BffApi.csproj`)
- **Port**: 3001 (internal only)
- **Authentication**: JWT Bearer validation (Entra ID, dual-tenant: workforce + CIAM)
- **Authorization**: RBAC policies via `rbac-policies.json` (hot-reloadable)
- **Service Modes**: ARM (production), Data API (runtime), Mock (development)
- **Resilience**: `Microsoft.Extensions.Http.Resilience` — retry 3x, circuit breaker, timeout
- **Caching**: `IMemoryCache` with 1-min TTL for GET responses
- **OpenAPI**: Scalar API reference at `/scalar/v1` (development only)

### Legacy: Node.js BFF (`bff/`)
- **Runtime**: Node.js Express
- **Port**: 3001
- **Purpose**: Original APIM proxy with Managed Identity (no RBAC)
- **Status**: Retained for reference; `.NET BFF` is the active backend

### Process Management
- **Supervisor** manages both Nginx and BFF
- Health checks on port 8080
- Graceful shutdown handling

### Key Files

| File | Description |
|------|-------------|
| `bff-dotnet/Program.cs` | Composition root — DI, middleware, endpoint mapping |
| `bff-dotnet/BffApi.csproj` | .NET 10 project with `Azure.Identity`, `Microsoft.Identity.Web`, resilience packages |
| `bff-dotnet/appsettings.json` | APIM configuration, Entra ID, feature flags |
| `bff-dotnet/appsettings.Development.json` | Mock mode enabled, debug logging, CORS origins |
| `bff-dotnet/rbac-policies.json` | RBAC role → API → permission mapping |
| `bff-dotnet/api-registry.json` | API source registry (APIM vs external) |
| `bff-dotnet/Services/ArmApiService.cs` | ARM Management API client (production) |
| `bff-dotnet/Services/DataApiService.cs` | APIM Data API client (runtime mode) |
| `bff-dotnet/Services/MockApiService.cs` | Static mock data (development) |
| `Dockerfile` | Multi-stage build: SPA + BFF |
| `nginx.conf` | Proxy `/api/*` → `localhost:3001` |
| `supervisord.conf` | Manages Nginx + BFF processes |

## Environment Variables

### Container App Environment Variables
```bash
AZURE_SUBSCRIPTION_ID=121789fa-2321-4e44-8aee-c6f1cd5d7045
AZURE_RESOURCE_GROUP=kac_apimarketplace_eus_dev_rg
APIM_SERVICE_NAME=demo-apim-feb
APIM_API_VERSION=2022-08-01
MANAGED_IDENTITY_CLIENT_ID=2c46c615-a962-4ce7-a2f9-cc0610ff2043
USE_MOCK_MODE=false
```

### BFF Configuration (`appsettings.json`)
```json
{
  "Apim": {
    "SubscriptionId": "121789fa-2321-4e44-8aee-c6f1cd5d7045",
    "ResourceGroup": "kac_apimarketplace_eus_dev_rg",
    "ServiceName": "demo-apim-feb",
    "ApiVersion": "2022-08-01"
  },
  "EntraId": {
    "TenantId": "58be8688-6625-4e52-80d8-c17f3a9ae08a",
    "ClientId": "bd400d26-7db1-44fd-82b7-8c7af757e249"
  },
  "Features": { "UseMockMode": false }
}
```

## Required Azure Configuration

### Step 1: Managed Identity (✅ COMPLETED)
```bash
az containerapp identity assign \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --system-assigned
```

**Result**: 
- Principal ID: `01d35a0d-f8d2-4f6e-90b1-730c2235e2b8`
- Tenant ID: `58be8688-6625-4e52-80d8-c17f3a9ae08a`

### Step 2: Grant APIM Permissions (⏳ NEEDS ADMIN)

**You need an Azure admin to run**:
```bash
az role assignment create \
  --role "API Management Service Reader Role" \
  --assignee "01d35a0d-f8d2-4f6e-90b1-730c2235e2b8" \
  --scope "/subscriptions/121789fa-2321-4e44-8aee-c6f1cd5d7045/resourceGroups/kac_apimarketplace_eus_dev_rg/providers/Microsoft.ApiManagement/service/demo-apim-feb"
```

## API Endpoints

### APIs (`/api/apis`)
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/apis` | ApiRead | List APIs with pagination & RBAC filtering |
| GET | `/api/apis/highlights` | ApiRead | Top 3 featured APIs |
| GET | `/api/apis/{apiId}` | ApiRead | API detail |
| GET | `/api/apis/{apiId}/operations` | ApiRead | Operations for an API |
| GET | `/api/apis/{apiId}/products` | ApiRead | Products associated with an API |
| GET | `/api/apis/{apiId}/openapi` | ApiTryIt | OpenAPI spec (YAML) |
| GET | `/api/apis/{apiId}/operations/{operationId}` | ApiRead | Operation detail |
| GET | `/api/apis/{apiId}/operations/{operationId}/tags` | ApiRead | Tags for an operation |
| GET | `/api/apis/{apiId}/operationsByTags` | ApiRead | Operations grouped by tag |
| GET | `/api/apis/{apiId}/schemas` | ApiRead | API schemas |
| GET | `/api/apis/{apiId}/releases` | ApiRead | API releases |
| GET | `/api/apis/{apiId}/hostnames` | ApiRead | API hostnames |

### Other Endpoints
| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/apisByTags` | ApiRead | APIs grouped by tag |
| GET | `/api/apiVersionSets/{id}` | ApiRead | Version set detail |
| GET | `/api/tags` | ApiRead | List tags |
| GET | `/api/products` | ApiRead | List products |
| GET | `/api/subscriptions` | ApiRead | List subscriptions |
| POST | `/api/subscriptions` | ApiSubscribe | Create subscription |
| PATCH | `/api/subscriptions/{id}` | ApiSubscribe | Update subscription |
| DELETE | `/api/subscriptions/{id}` | ApiSubscribe | Delete subscription |
| GET | `/api/stats` | ApiRead | Platform statistics |
| GET | `/api/news` | ApiRead | News items |
| GET | `/api/users/me` | Authenticated | Current user profile |
| GET | `/api/health` | Anonymous | Health check |

## Service Modes

The BFF supports 3 backend modes, selectable via configuration:

| Mode | Config | Service Class | Description |
|------|--------|---------------|-------------|
| **Mock** | `UseMockMode=true` + Development | `MockApiService` | Static data, no Azure required |
| **Data API** | `UseDataApi=true` | `DataApiService` | APIM runtime endpoint, user bearer token |
| **ARM** | Default | `ArmApiService` | ARM Management API, `DefaultAzureCredential` |

### Data Flow
```
Mock:     MockApiService → static in-memory data
Data API: DataApiService → https://{apim}.azure-api.net/developer → flat JSON
ARM:      ArmApiService  → https://management.azure.com/subscriptions/... → unwrap {properties} envelope
```

All three return the same `PagedResult<T>` shape (`{ value: [...], count: N }`) to the SPA.

## How It Works

1. **Container starts**:
   - `docker-entrypoint.sh` exports environment variables
   - Supervisor starts Nginx (port 8080) and BFF (port 3001)

2. **User visits site**:
   - Nginx serves React static files
   - React app loads in browser, MSAL authenticates the user

3. **React calls API**:
   - `fetch('/api/apis')` with Bearer token
   - Nginx proxies to BFF: `http://localhost:3001/api/apis`

4. **BFF authenticates & authorizes**:
   - Validates JWT against Entra ID JWKS (workforce or CIAM tenant)
   - Checks RBAC policies (role → API → permission mapping)
   - Routes to appropriate service (ARM, Data API, or Mock)

5. **ARM mode (production)**:
   - Uses `DefaultAzureCredential` to get Managed Identity token
   - Calls `https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{name}/apis?api-version=2022-08-01`
   - Unwraps ARM `{ id, name, properties: {...} }` envelope → flat contracts
   - Returns `PagedResult<T>` to the SPA

## Security Benefits

✅ No APIM credentials in frontend code  
✅ JWT Bearer validation on every request  
✅ RBAC policies enforce per-API, per-role access  
✅ Managed Identity tokens auto-rotate  
✅ Least-privilege access (read-only APIM role)  
✅ Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)  
✅ Resilience pipeline (retry, circuit breaker, timeout)  
✅ IMemoryCache prevents thundering herd  

## Testing

### Local Testing (Mock Mode — no Azure required)
```bash
cd bff-dotnet
dotnet restore --source https://api.nuget.org/v3/index.json
dotnet run  # Mock mode enabled in Development environment
```

Access Scalar API docs at http://localhost:3001/scalar/v1

### Local Testing (ARM Mode — requires Azure CLI)
```bash
az login
cd bff-dotnet
ASPNETCORE_ENVIRONMENT=Production dotnet run
```

### Container Testing
```bash
docker build -t komatsu-apim-portal:dev .
docker run -p 8080:8080 \
  -e AZURE_SUBSCRIPTION_ID=121789fa-2321-4e44-8aee-c6f1cd5d7045 \
  -e AZURE_RESOURCE_GROUP=kac_apimarketplace_eus_dev_rg \
  -e APIM_SERVICE_NAME=demo-apim-feb \
  -e APIM_API_VERSION=2022-08-01 \
  -e ENTRA_TENANT_ID=58be8688-6625-4e52-80d8-c17f3a9ae08a \
  -e ENTRA_CLIENT_ID=bd400d26-7db1-44fd-82b7-8c7af757e249 \
  -e ENTRA_EXTERNAL_TENANT_ID=511e2453-090d-480c-abeb-d2d95388a675 \
  -e ENTRA_CIAM_HOST=kltdexternaliddev.ciamlogin.com \
  komatsu-apim-portal:dev
```

> **Note:** The Dockerfile now uses a multi-stage build: frontend (node:20-alpine), .NET BFF (dotnet/sdk:10.0-preview), and runtime (nginx:alpine + ASP.NET Core runtime). Supervisor manages nginx + `dotnet /app/bff/BffApi.dll` on port 3001.

## Troubleshooting

### BFF won't start
- Check supervisor logs: `docker exec <container> cat /var/log/supervisor/bff-stderr*.log`
- Verify .NET 10 runtime installed: `docker exec <container> dotnet --version`

### 401/403 errors
- Ensure Managed Identity is enabled on the Container App
- Verify APIM role assignment (admin must grant this)
- Check JWT token: valid issuer, audience, and signing key
- Review RBAC policies in `rbac-policies.json`

### Can't reach BFF from Nginx
- Verify BFF is listening on port 3001
- Check supervisor status
- Ensure `nginx.conf` proxies to `localhost:3001`

### SPA shows no data (BFF returns `{ value: [...] }`)
- The SPA uses `unwrapArray<T>()` in `src/api/client.ts` to handle both flat arrays and `PagedResult<T>` envelopes
- Ensure the SPA's API hooks call `unwrapArray` on `result.data`

## Next Steps

1. ~~**Complete BFF migration**: Update Dockerfile to build and run .NET BFF instead of Node.js~~ ✅ **Done** (March 2026)
2. **Add integration tests**: xUnit + `WebApplicationFactory`
3. **Monitor** BFF logs via Application Insights
4. **Remove legacy `bff/`** — the Node.js BFF is no longer used in Docker/ACA deployments

---

*See also: [bff-dotnet/README.md](../bff-dotnet/README.md), [ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md), [BFF_MIGRATION_DECISION.md](BFF_MIGRATION_DECISION.md)*
