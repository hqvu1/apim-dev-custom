# BFF Evolution Analysis: Non-APIM API Support & Platform Options

> **Context:** One of the three Phase 1 APIs (Warranty, Parts Punchout, or Equipment Management) may not be hosted in Azure APIM. The BFF must proxy to heterogeneous backends — some via the APIM Data API, some via direct REST endpoints.
>
> **⚠️ Historical Note (March 2026):** This analysis was written when the Express BFF (`bff/server.js`) was the active runtime. The deployment has since been migrated to the **ASP.NET Core 10 BFF** (`bff-dotnet/`), which already implements the backend router pattern via `IApiCatalogService` + `api-registry.json`. The architectural concepts below remain valid; the "Express vs. migrate" decision is now resolved — see `BFF_MIGRATION_DECISION.md`.

---

## 1. The Problem

The current BFF (`bff/server.js`) is **tightly coupled to the APIM Data API**:

```
Every route → fetchFromDataApi() → SAS token → APIM Data API
```

If one API (e.g., SAP Warranty) lives outside APIM — behind a direct REST endpoint, SAP Gateway, or another API gateway — the BFF has no path to reach it. The frontend `ApiCatalog` and `ApiDetails` pages expect a uniform shape (`ApiSummary`, `ApiDetails`), so the BFF must normalize responses from different backends into the same contract.

---

## 2. Target Architecture: Backend Router Pattern

Regardless of which platform hosts the BFF, the core design change is the same — introduce a **backend router** that dispatches requests to the correct upstream based on API metadata:

```
Browser → /api/apis/:apiId/...
  │
  └─ BFF Backend Router
       │
       ├─ Is this API in APIM?
       │    YES → fetchFromDataApi() (existing flow)
       │
       └─ Is this API non-APIM?
            YES → fetch from registered external endpoint
                  with its own auth strategy (API key, OAuth, cert)
                  then normalize response → ApiSummary / ApiDetails shape
```

### API Registry (Configuration-Driven)

```jsonc
// api-registry.json (or environment variables)
{
  "apis": {
    "warranty-api": {
      "source": "external",
      "baseUrl": "https://sap-warranty.komatsu.com/api/v1",
      "auth": {
        "type": "oauth2-client-credentials",
        "tokenUrl": "https://auth.komatsu.com/oauth/token",
        "clientIdEnv": "WARRANTY_CLIENT_ID",
        "clientSecretEnv": "WARRANTY_CLIENT_SECRET",
        "scope": "warranty.read"
      },
      "metadata": {
        "name": "SAP Warranty API",
        "description": "Warranty claims and coverage validation",
        "category": "Warranty",
        "owner": "Komatsu Warranty Team",
        "documentationUrl": "https://docs.komatsu.com/warranty"
      }
    },
    "punchout-api": {
      "source": "apim",
      "apimApiId": "punchout-api"
    },
    "equipment-api": {
      "source": "apim",
      "apimApiId": "equipment-api"
    }
  }
}
```

The `/apis` list endpoint merges APIM-discovered APIs with registry-defined external APIs. Detail/operation/schema endpoints dispatch to the correct upstream.

---

## 3. Platform Comparison

### Option A: Keep Express.js BFF (Evolve Current)

```
Container: Nginx + Node.js (supervisord)  ← no change to deployment model
BFF:       Express.js + backend router module + external API adapters
```

| Pro | Con |
|---|---|
| Zero migration effort — evolve `server.js` | Single-threaded; CPU-bound transforms block the event loop |
| Same container, same Dockerfile, same supervisord | No built-in DI, middleware composition gets messy at scale |
| Team already familiar with the codebase | No type safety (plain JS) — runtime errors in adapters |
| Fastest time-to-deliver for Phase 1 | Test coverage harder without framework conventions |
| Managed Identity already working | Secrets management is manual (env vars) |

**Effort to add external API support:** Small (1–2 days). Add a router module and one adapter per external API.

**When to choose:** You're confident the BFF stays small (< 15 routes), the non-APIM API count won't grow past 2–3, and Phase 1 deadline pressure is high.

---

### Option B: ASP.NET Core Minimal API

```
Container: Nginx + dotnet (supervisord)   OR   separate sidecar container
BFF:       ASP.NET Core 8 Minimal API + typed HttpClient + DI
```

| Pro | Con |
|---|---|
| **Type safety** — C# interfaces for each backend adapter | Rewrite of existing BFF (medium effort) |
| **Built-in DI** — clean separation: `IApimApiService`, `IExternalApiService` | Team needs C# familiarity |
| **`IHttpClientFactory`** — proper connection pooling, retry policies (Polly), named clients per backend | Heavier container image (~80 MB vs ~25 MB for Node) |
| **`DefaultAzureCredential`** — same Managed Identity SDK, first-class .NET support | Supervisord config change (dotnet instead of node) |
| **Native AOT** option — sub-50ms cold start, small binary | AOT limits some reflection-based features |
| **Komatsu IT alignment** — .NET is likely a primary stack for KAC ICT; aligns with enterprise standards | Build pipeline change (dotnet restore/build/publish) |
| **70% test coverage** easy with xUnit + `WebApplicationFactory` | — |

**Effort to migrate + add external API support:** Medium (5–7 days). Rewrite routes, add typed service layer, update Dockerfile.

**Architecture sketch:**

```
Program.cs (Minimal API)
├── Services/
│   ├── IApiCatalogService.cs        ← aggregates APIM + external APIs
│   ├── ApimDataApiService.cs        ← existing APIM Data API logic
│   ├── ExternalApiService.cs        ← per-API adapter with named HttpClient
│   └── ApiRegistryService.cs        ← loads api-registry.json
├── Middleware/
│   ├── MsalTokenValidationMiddleware.cs  ← validates Bearer token, extracts roles
│   └── RetryPolicyHandler.cs        ← Polly: retry 429/500, circuit breaker
├── Models/
│   ├── ApiSummary.cs
│   ├── ApiDetails.cs
│   └── ExternalApiConfig.cs
├── Endpoints/
│   ├── ApisEndpoints.cs             ← GET /apis, GET /apis/{id}
│   ├── SubscriptionsEndpoints.cs    ← CRUD
│   ├── TagsEndpoints.cs
│   └── HealthEndpoints.cs
└── appsettings.json / api-registry.json
```

**When to choose:** You expect 4+ heterogeneous backends in future phases, the team has .NET skills, or Komatsu's EARB prefers .NET for backend services.

---

### Option C: Azure Functions (Isolated Worker)

```
Hosting: Azure Functions on Consumption or Flex Consumption plan
         OR containerized in the same ACA with the SPA
BFF:     C# or Node.js isolated functions, one function per route group
```

| Pro | Con |
|---|---|
| **Per-function scaling** — hot APIs scale independently | Cold start latency (1–3s on Consumption plan) |
| **Cost** — pay-per-execution, zero cost at idle | More complex local dev (func host + Azurite) |
| **Built-in bindings** — Timer triggers for token refresh, Queue triggers for async ops | Deployment model change (function app vs container) |
| **Managed Identity** — first-class support | Splits the container: SPA in ACA, Functions in separate resource |
| **Durable Functions** — useful for multi-step API onboarding workflows | Over-engineered for a BFF with < 20 endpoints |

**Effort to migrate:** Medium-Large (7–10 days). Rewrite routes as functions, new IaC for Function App, change Nginx proxy target.

**When to choose:** You want independent scaling per API backend, or you plan to add async workflows (onboarding approvals, webhook processing) in future phases.

---

## 4. Recommendation

### For Phase 1 MVP: **Option A (Evolve Express BFF) + Backend Router Pattern**

**Rationale:**
1. **Deadline pressure** — 4.5-month timeline, currently in build phase. A platform migration risks the schedule.
2. **Minimal scope** — Only 1 of 3 APIs may be non-APIM. Adding one adapter to Express is 1–2 days.
3. **No deployment change** — Same container, same Dockerfile, same supervisord, same Bicep.
4. **The router pattern is portable** — The abstraction (API registry + adapters) can be lifted into any platform later.

### For Post-Phase 1 (Month 5+): **Option B (ASP.NET Core Minimal API)**

**Rationale:**
1. **Growth trajectory** — Future phases add API key management, credential rotation, admin console, analytics. A typed service layer with DI scales better than a monolithic `server.js`.
2. **Polly retry policies** — Built-in circuit breaker, retry, timeout. Essential when proxying to 5+ heterogeneous backends.
3. **`IHttpClientFactory`** — Proper connection pool lifecycle management, named clients per backend with different auth strategies.
4. **Enterprise alignment** — C# / .NET is standard for Komatsu backend services. Easier AMS handover.
5. **Test coverage** — `WebApplicationFactory` makes integration testing trivial. Helps hit the 70% target on backend code.
6. **The migration is incremental** — Replace one route group at a time, run both BFFs behind Nginx until fully migrated.

### Azure Functions: Not Recommended for BFF

Functions are ideal for event-driven workloads, not for a request/response proxy that the SPA hits on every page navigation. The cold start, split deployment, and debugging complexity outweigh the benefits when the BFF is co-located with the SPA in a single container.

**Exception:** If future phases introduce async workflows (API onboarding approval queues, scheduled credential rotation, webhook receivers), add them as standalone Functions alongside the BFF — not as a replacement for it.

---

## 5. Implementation Plan: Express BFF + Backend Router (Phase 1)

### Step 1: Add API Registry

```javascript
// bff/apiRegistry.js
const apiRegistry = {
  // External APIs (non-APIM) — loaded from config or env
  external: {},
  
  // Populated at startup from environment or JSON file
  init() {
    const registryJson = process.env.API_REGISTRY_JSON;
    if (registryJson) {
      const parsed = JSON.parse(registryJson);
      this.external = parsed.apis || {};
    }
  },

  isExternal(apiId) {
    return apiId in this.external && this.external[apiId].source === 'external';
  },

  getConfig(apiId) {
    return this.external[apiId] || null;
  }
};
```

### Step 2: Add External API Adapter

```javascript
// bff/adapters/externalApiAdapter.js

// Each external API gets an adapter that:
// 1. Authenticates using its own auth strategy
// 2. Fetches data from the external endpoint
// 3. Normalizes the response to ApiSummary / ApiDetails shape

async function fetchFromExternalApi(apiConfig, path, method = 'GET', body = null) {
  const token = await getExternalApiToken(apiConfig.auth);
  const url = `${apiConfig.baseUrl}${path}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`External API ${apiConfig.metadata.name} returned ${response.status}`);
  }

  return response.json();
}

function transformExternalToSummary(apiConfig) {
  return {
    id: apiConfig.id,
    name: apiConfig.metadata.name,
    description: apiConfig.metadata.description,
    status: 'Production',
    owner: apiConfig.metadata.owner,
    tags: apiConfig.metadata.tags || [],
    category: apiConfig.metadata.category,
    plan: 'Paid',
    source: 'external', // flag for the frontend to know this is non-APIM
  };
}
```

### Step 3: Modify Route Handlers

```javascript
// In GET /apis handler:
// 1. Fetch from APIM Data API (existing)
// 2. Fetch external API metadata from registry
// 3. Merge and return combined list

// In GET /apis/:apiId handler:
// 1. Check registry: is this external?
//    YES → use external adapter
//    NO  → use existing APIM Data API flow
```

### Step 4: No Deployment Changes

The Dockerfile, supervisord.conf, nginx.conf, and Bicep templates remain unchanged. The new adapter modules are just additional `.js` files in the `bff/` folder.

---

## 6. Future Migration Path: Express → ASP.NET Core

```
Phase 1 (now):
  Nginx → Express BFF (server.js + adapters)
  
Phase 2 (post-MVP):
  Nginx → ASP.NET Core Minimal API (port 3001)
  
Migration steps:
  1. Create bff-dotnet/ folder with Minimal API project
  2. Port route groups one at a time (apis, subscriptions, tags, etc.)
  3. Run both BFFs on different ports during transition
  4. Update nginx.conf to route to the new port
  5. Remove bff/ (Express) once all routes are migrated
  6. Update Dockerfile: replace Node.js with dotnet runtime
  7. Update supervisord.conf: dotnet instead of node
```

The SPA never changes — it always calls `/api/...` through Nginx. The backend swap is invisible to the frontend.

---

## 7. Decision Matrix

| Factor | Express (A) | ASP.NET Core (B) | Azure Functions (C) |
|---|---|---|---|
| Phase 1 delivery risk | ✅ Low | ⚠️ Medium | ❌ High |
| Non-APIM API support | ✅ Adapter pattern | ✅ Typed HttpClient + DI | ✅ Per-function adapters |
| Heterogeneous backend scaling | ⚠️ Manual | ✅ Polly + IHttpClientFactory | ✅ Per-function scaling |
| Type safety | ❌ Plain JS | ✅ C# strong typing | ✅ C# or TS |
| Test coverage ease | ⚠️ Manual setup | ✅ WebApplicationFactory | ⚠️ Requires func host |
| Container image size | ✅ ~25 MB | ⚠️ ~80 MB (or ~15 MB AOT) | N/A (separate resource) |
| Deployment change | ✅ None | ⚠️ Dockerfile update | ❌ New IaC + resource |
| Cold start | ✅ None (always running) | ✅ None (always running) | ❌ 1–3s (Consumption) |
| AMS handover ease | ⚠️ Node.js niche | ✅ .NET standard | ⚠️ Functions expertise |
| Future phase readiness | ⚠️ Grows unwieldy | ✅ Scales well | ✅ Event-driven features |

**Verdict:** Start with **A** now, plan migration to **B** after Phase 1 launch.

---

*Analysis created for the Komatsu API Marketplace Portal — BFF evolution planning.*
