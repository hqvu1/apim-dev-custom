# 🏗️ Komatsu API Marketplace Portal — Design Document
# SPA + BFF (.NET) Architecture

<div align="center">

![Design](https://img.shields.io/badge/Design-Document-2196F3?style=for-the-badge&logo=blueprint&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-Enterprise-4CAF50?style=for-the-badge&logo=microsoft-azure&logoColor=white)
![Status](https://img.shields.io/badge/Status-Draft-orange?style=for-the-badge&logo=docs&logoColor=white)

**Complete System Design & Architecture Specification**
*KNA Project #802 — Cloud-Hosted API Marketplace Portal for Komatsu Partners*

</div>

| | |
|---|---|
| **Project** | KNA Project #802 — Komatsu API Marketplace |
| **Document Version** | 1.1 |
| **Date** | March 2026 |
| **Status** | Draft |
| **Classification** | Internal — KNA IT |

---

## 📋 **Document Overview**

This design document provides a comprehensive technical specification for the **Komatsu API Marketplace Portal** — a cloud-hosted SPA backed by a .NET Backend-for-Frontend (BFF) service that enables Komatsu partners and internal teams to discover, understand, integrate with, manage, and get support for Komatsu's API catalog.

### 🎯 **Document Scope**
- **System Architecture**: SPA + BFF pattern with Azure cloud-native deployment
- **Authentication**: OAuth 2.0 with Entra ID, Global Admin role integration
- **Security Design**: Enterprise-grade RBAC, token management, APIM key isolation
- **Integration Patterns**: Azure APIM, AEM CMS, ServiceNow, Global Admin
- **Deployment Strategy**: Azure Container Apps with Bicep IaC

---

## 🎯 **Executive Summary**

This document defines the software architecture for the **Komatsu API Marketplace Portal** — a cloud-hosted Single Page Application (SPA) backed by a .NET Backend-for-Frontend (BFF) service. The portal enables Komatsu partners (dealers, distributors, vendors) and internal teams to discover, understand, integrate with, manage, and get support for Komatsu's API catalog.

The architecture follows the **SPA + BFF pattern** to:

- Aggregate and shape responses from Azure APIM (ARM Management API or Data API)
- Enforce RBAC and security policies in a single, auditable perimeter via JWT Bearer authentication
- Provide an optimized, responsive, Komatsu-branded UI via a React SPA with Material UI
- Keep APIM subscription keys and Azure credentials server-side (BFF uses App Registration via ClientSecretCredential)

```
┌──────────────────────────────────────────────────────────────────┐
│                        End Users (Browser)                       │
│            Dealer / Distributor / Vendor / Internal              │
└────────────────────────────┬─────────────────────────────────────┘
                             │  HTTPS (TLS 1.3)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│     Azure Container Apps Ingress (Managed Platform Routing)      │
│                Custom Domain / ACE :443 → :8080                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌─────────────────────────────▼──────────────────────────────────┐
│          Azure Container (Single Container, port 8080)         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  BFF — ASP.NET Core 10 Minimal API (port 8080)           │  │
│  │                                                          │  │
│  │  • Serves compiled SPA (static files)                    │  │
│  │  • JWT Bearer auth (Entra ID / MSAL tokens)              │  │
│  │  • RBAC policies (ApiRead, ApiTryIt, ApiSubscribe,       │  │
│  │    ApiManage)                                            │  │
│  │  • /api/* routes → ARM / Data API services               │  │
│  │  • IRoleProvider (Global Admin API → business roles)     │  │
│  │  • IHttpClientFactory + AddStandardResilienceHandler     │  │
│  │  • ITokenProvider (ClientSecretCredential) → ARM / Data  │  │
│  │  • IMemoryCache (1-min TTL response dedup,               │  │
│  │    30-min role cache)                                    │  │
│  │  • Structured logging + portal telemetry header          │  │
│  │  • Security headers (via middleware)                     │  │
│  │  • Gzip compression (via middleware)                     │  │
│  │  • SPA routing fallback (client-side routes)             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  Azure APIM  │ │  Global Admin │ │  Entra ID    │
    │              │ │  API          │ │              │
    │ • ARM API    │ │ • User roles  │ │ • OIDC /     │
    │ • Data API   │ │ • Ocp-Apim-   │ │   MSAL       │
    │ • APIs,      │ │   Sub-Key     │ │ • Multi-     │
    │   Products   │ │   auth        │ │   tenant JWT │
    │ • Subs, Tags │ │ • 30-min cache│ │   validation │
    └──────────────┘ └───────────────┘ └──────────────┘
```

---

## 💼 **Business Context**

### **Problem Statement**

Komatsu partners face three core challenges:
1. **Discoverability** — No consolidated catalog of available APIs
2. **Onboarding friction** — Manual process to request access, lacking documentation and sandbox testing
3. **Integration complexity** — Limited guidance, no try-it-out capability, no self-service credential management

### **Target Goals**

| Goal | Measured By |
|------|------------|
| Consolidated API discovery | API catalog page views, search usage |
| Drive integrations with distributors/vendors | Number of successful 3rd-party integrations |
| Reduce onboarding effort | Time-to-first-API-call metric |
| Reduce support requests | Ticket volume before vs. after portal |
| User satisfaction | NPS surveys, feedback scores |

### **Success Metrics (KPIs)**

- Reduction in manual data entry for dealer onboarding
- Increase in the number of successful API integrations via third-parties
- Increase in user satisfaction (API documentation quality, sandbox testing)
- Portal adoption tracking (DAU/MAU, session duration, pages per session)
- Support ticket deflection rate

---

## 👥 **Personas & User Journeys**

### **Personas**

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| **Dealer / Distributor** | External partner integrating Komatsu APIs into their business systems | Discover APIs, read docs, get credentials, test in sandbox, go live |
| **Komatsu Customer** | Internal stakeholder consuming API services | Browse catalog, understand capabilities, track usage |
| **Vendor** | External technology provider building on Komatsu APIs | Deep technical integration, SDK access, sandbox testing |
| **Admin** | Komatsu IT / Portal administrator | Manage content, onboard APIs, manage users/roles, view analytics |

### **User Journey Map (from Story Mapping)**

```
  DISCOVER  →   UNDERSTAND  →    INTEGRATE   →     MANAGE    →    SUPPORT
  ─────────    ───────────     ────────────      ──────────      ─────────
  Browse by     View API        Select &          View client     Submit
  category      documentation   subscribe         credentials     tickets

  Search w/     View use        Generate          Add/edit/       Knowledge
  filters       cases           credentials       delete users    base search

  API listing   View pricing    Sandbox           Assign roles    Email/phone
  w/ briefs                     testing                           support

                                Integration       Manage creds    Track ticket
                                guides            (rotate/revoke) status
```

---

## 📋 **Functional Requirements (Story Map Alignment)**

### **Discover (MVP — Must Have)**

| ID | Requirement | Priority | Component |
|----|-------------|----------|-----------|
| D-1 | Browse APIs by category | MVP | SPA: Catalog Page |
| D-2 | Search APIs with filters (region, system, data type) | MVP | SPA: Search + BFF: Search API |
| D-3 | API listing with brief descriptions and icons | MVP | SPA: API Cards + BFF: APIM metadata |

#### **API Catalog — Detailed Design**

> **Rationale**: The self-hosted APIM developer portal provides an instant API catalog (list, tile, and dropdown views) with Lunr.js full-text search out-of-box. Our custom SPA must match or exceed this capability while adding Komatsu branding, RBAC-filtered visibility (via `ApiRead` policy), and BFF-proxied metadata.

**Catalog Views**

| View | Description | Component |
|------|-------------|-----------|
| **Card Grid** (default) | Responsive card grid showing API name, icon, brief description, category tag, version badge, and status indicator (Active/Preview/Deprecated) | `ApiCatalogGrid` using MUI `Card` components |
| **List View** | Compact list with sortable columns (name, category, version, last updated) for power users | `ApiCatalogList` using MUI `DataGrid` |
| **Category Browse** | Grouped sections by category with expandable API listings under each | `ApiCategoryAccordion` |

**Search & Filter**

| Feature | Implementation | Data Source |
|---------|---------------|-------------|
| **Full-text search** | Client-side search index built from APIM metadata (API names, descriptions, tags, operations) | BFF: `GET /api/apis` → SPA indexes with [Fuse.js](https://fusejs.io/) (lightweight, ~5KB vs Lunr.js ~8KB) |
| **Category filter** | Faceted filter chips — click to toggle categories on/off | BFF: `GET /api/tags` |
| **Tag filter** | Multi-select tag filter (e.g., "SAP", "Equipment", "Commerce") | BFF: API tag metadata from APIM |
| **Status filter** | Active / Preview / Deprecated toggle | APIM API revision status |
| **Sort** | By name (A-Z, Z-A), Last updated, Popularity (subscription count) | Client-side sort on cached data |

**Data Flow**

```
SPA (Catalog Page)          BFF                           Azure APIM
─────────────────          ───                           ──────────
  usePortalApi('apis')──►  GET /api/apis             ──►  APIM Management API
                            • List all products           • Products.ListByService
                            • Enrich with AEM content     • APIs.ListByService
                            • Filter by user role          • Tags
                            • Cache 1 min (IMemoryCache)  • OpenAPI specs (metadata)
                       ◄──  ApiResponse[]            ◄──

  usePortalApi('tags') ──► GET /api/tags
                            • Tag metadata for filter UI
                            • Cached 1 min
```

**BFF Response Contract — `GET /api/apis`**

```typescript
interface CatalogItem {
  id: string              // APIM API ID
  slug: string            // URL-friendly name
  name: string            // Display name
  description: string     // Brief description (from APIM or AEM)
  category: string        // e.g., "Enterprise", "Commerce", "Asset Management"
  tags: string[]          // e.g., ["SAP", "warranty", "dealer"]
  version: string         // Current version (e.g., "v1.0")
  status: 'active' | 'preview' | 'deprecated'
  iconUrl: string         // Category icon URL (from AEM or static assets)
  lastUpdated: string     // ISO 8601 date
  subscriptionCount: number  // Popularity metric (admin-only detail)
  sandboxAvailable: boolean
  operationCount: number  // Number of endpoints
}
```

**Important for Product (Post-MVP):**
- D-4: Tagging system ("popular", "new", "recommended")
- D-5: Featured APIs / curated collections
- D-6: Save/favorite APIs for quick access

**Nice to Have:**
- D-7: Personalized recommendations based on user behavior
- D-8: Trending APIs dashboard
- D-9: API comparison tool

### **Understand (MVP — Must Have)**

| ID | Requirement | Priority | Component |
|----|-------------|----------|-----------|
| U-1 | Detailed API documentation (endpoints, parameters, responses) | MVP | SPA: Doc Viewer + BFF: APIM/AEM |
| U-2 | API use cases and examples | MVP | SPA: Use Cases Page + AEM CMS |
| U-3 | Value proposition messaging | MVP | SPA: Landing / API detail |

#### **Interactive API Console (Try-It) — Detailed Design**

> **Rationale**: The self-hosted APIM portal's "Try It" widget is its strongest feature — interactive console with OAuth 2.0 flow detection, multi-language code snippet generation, request/response visualization, and GraphQL support. Our design must deliver equivalent functionality while keeping APIM subscription keys server-side (via BFF YARP proxy).

**Architecture**

```
  SPA (Try-It Page)              BFF (YARP Proxy)              APIM Gateway
  ─────────────────              ────────────────              ────────────
  1. Load OpenAPI spec    ──►   GET /api/apis/{apiId}        ──► APIM: fetch spec
  2. Render Swagger UI                                            (OpenAPI 3.0 JSON)
  3. User fills params
  4. Execute request      ──►   POST /api/sandbox/{apiSlug}  ──► APIM Sandbox
     (method, path,              /operations/{operationId}        Gateway
      headers, body)             • Inject Ocp-Apim-Sub-Key       (rate-limited,
                                 • Forward request                 isolated env)
                                 • Strip server headers
  5. Display response     ◄──   Response + timing metadata   ◄──
  6. Generate code snippet       (computed client-side from request/response)
```

**SPA Components**

| Component | Library | Purpose |
|-----------|---------|----------|
| `TryItConsole` | Custom React component | Container: API selector, operation list, request builder, response viewer |
| `RequestBuilder` | Custom | Method badge, path params, query params, headers, body editor |
| `ResponseViewer` | Custom + Prism.js | JSON syntax highlighting, status code badge, headers, timing |
| `CodeSnippetGenerator` | Custom | Generate cURL, JavaScript (fetch), Python (requests), C# (HttpClient) from the executed request |
| `OpenApiViewer` | [Scalar](https://github.com/scalar/scalar) or [Stoplight Elements](https://github.com/stoplightio/elements) | Render full OpenAPI spec documentation (endpoints, schemas, examples) |

**Code Snippet Generation** (client-side, inspired by APIM portal's built-in snippets)

| Language | Template | Notes |
|----------|----------|-------|
| **cURL** | `curl -X {method} "{url}" -H "Authorization: Bearer {token}" ...` | Default snippet |
| **JavaScript** | `fetch("{url}", { method, headers, body })` | ES6 async/await |
| **Python** | `requests.{method}("{url}", headers=..., json=...)` | Uses `requests` library |
| **C#** | `httpClient.{method}Async("{url}", content)` | .NET HttpClient |

**Security**: The SPA never sees APIM subscription keys. The BFF's YARP proxy injects the `Ocp-Apim-Subscription-Key` header server-side. The user's Bearer token authenticates the SPA→BFF leg; the subscription key authenticates the BFF→APIM leg.

**Important for Product:**
- U-4: Pricing / cost plan display (SPA: Pricing Section + BFF)
- U-5: Interactive API console (try-it-out with Swagger/Redoc) — **detailed above**
- U-6: SDKs / code snippets in multiple languages — **code snippet generator above covers MVP**
- U-7: Version history and changelog

**Nice to Have:**
- U-8: Video tutorials, community use cases, performance metrics

### **Integrate (MVP — Must Have)**

| ID | Requirement | Priority | Component |
|----|-------------|----------|-----------|
| I-1 | Select and subscribe to APIs | MVP | SPA + BFF: Subscription Service |
| I-2 | Auto-generated client credentials (API key, OAuth token) | MVP | BFF: APIM Subscription API |
| I-3 | Sandbox environment for testing (the API needs to have it) | MVP | BFF: Sandbox proxy → APIM |
| I-4 | Integration guides (Postman, Swagger) | MVP | SPA: Guides + AEM CMS |
| I-5 | Rate limit and quota visibility | MVP | BFF: APIM Policy reporting |
| I-6 | SLA display | MVP | SPA: SLA Section |

#### **Subscription Flow — Detailed Design**

> **Rationale**: The self-hosted APIM portal provides self-service product subscription with immediate key provisioning. Our design must match this flow while enforcing RBAC (only Distributor/Vendor roles via `ApiSubscribe` policy can subscribe) and keeping subscription keys server-side.

**Subscription Lifecycle**

```
  SPA                            BFF                              APIM
  ───                            ───                              ────
  1. Browse catalog
  2. Select API product
  3. Click "Subscribe"    ──►   POST /api/subscriptions           ──► APIM Management API
     { productId,                 • Validate role (Distributor      Subscription.CreateOrUpdate
       displayName }                or Vendor via ApiSubscribe)
                                  • Check existing subscription
                                  • Create APIM subscription
                                  • Store subscription ID
  4. Confirmation page    ◄──   { subscriptionId, state,          ◄── { primaryKey,
     (No keys shown)              productName, createdUtc }             secondaryKey, ... }
     "Keys managed securely                                        Keys stored in BFF memory
      by the portal"                                               (never sent to SPA)

  5. View credentials     ──►   GET /api/subscriptions/{subId}    ──► APIM: Get subscription
     (masked display)             /secrets                             • primaryKey, secondaryKey
                                  • Return masked keys
                                  • Full key only on explicit
                                    "Reveal" action with re-auth
  6. Rotate key           ──►   POST /api/subscriptions/{subId}   ──► APIM: RegenerateKey
                                  /secrets (regenerate)
  7. Revoke subscription  ──►   PUT /api/subscriptions/{subId}    ──► APIM: Subscription.Update
                                  (cancel state)
```

**Subscription States** (aligned with APIM)

| State | Description | SPA Display |
|-------|-------------|-------------|
| `submitted` | Awaiting admin approval (if product requires it) | "Pending approval" badge |
| `active` | Approved and usable | Green "Active" badge + credential access |
| `suspended` | Temporarily disabled by admin | Orange "Suspended" badge |
| `cancelled` | Revoked by user or admin | Greyed out, no credential access |
| `expired` | Past expiration date | Red "Expired" badge |

**BFF Response Contract — `GET /api/subscriptions`**

```typescript
interface SubscriptionSummary {
  id: string                 // APIM subscription ID
  displayName: string        // User-provided name
  productId: string          // APIM product ID
  productName: string        // Display name
  state: 'submitted' | 'active' | 'suspended' | 'cancelled' | 'expired'
  createdUtc: string         // ISO 8601
  expiresUtc: string | null  // null = no expiry
  primaryKeyHint: string     // Last 4 chars only (e.g., "...a3f2")
  secondaryKeyHint: string   // Last 4 chars only
}
```

**Credential Display Security**

| Action | Auth Required | Rate Limited | Audit Logged |
|--------|:---:|:---:|:---:|
| View masked key hints | Bearer token | No | No |
| Reveal full primary key | Bearer token + re-auth prompt | 5/min per user | Yes |
| Reveal full secondary key | Bearer token + re-auth prompt | 5/min per user | Yes |
| Regenerate key | Bearer token + confirmation dialog | 2/min per user | Yes |
| Copy key to clipboard | Client-side only (from revealed value) | N/A | No |

> **Key Difference from APIM Portal**: The self-hosted APIM portal shows subscription keys directly in the browser. Our design keeps keys server-side by default, showing only masked hints (`...a3f2`). Full keys are revealed only on explicit user action with re-authentication, and all reveals are audit-logged.

**Important for Product:**
- I-7: Auto-generated client libraries
- I-8: Webhooks / event-driven integration options
- I-9: API dependency graph

### **Manage (MVP — Must Have)**

| ID | Requirement | Priority | Component |
|----|-------------|----------|-----------|
| M-1 | View Client ID and secret associated to API | MVP | BFF: Credential Service |
| M-2 | Add, edit, update user profiles (Need to finalize requirements) | MVP | BFF: User Management + Entra ID |

#### **Credential & Subscription Management Dashboard — Detailed Design**

> **Rationale**: The self-hosted APIM portal provides a built-in subscription management page where users see their active subscriptions, keys, and usage quotas. Our design must deliver this in the SPA dashboard while keeping the BFF as the security boundary for key operations.

**Dashboard Sections (`/my/integrations`)**

| Section | Data Source | Visible To |
|---------|-------------|------------|
| **Active Subscriptions** | BFF: `GET /api/subscriptions` | Distributor, Vendor (via `ApiSubscribe` policy) |
| **Credential Vault** | BFF: `POST /api/subscriptions/{subId}/secrets` | Distributor, Vendor |
| **Usage & Quotas** | BFF: `GET /api/stats` → APIM Policy reporting | All authenticated (via `ApiRead` policy) |
| **Profile** | BFF: `GET /api/users/me` → JWT claims + Global Admin | All authenticated |

**Credential Vault UX**

```
┌─────────────────────────────────────────────────────────────────┐
│  My Credentials                                      [+ Subscribe] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  SAP Warranty API                          Active ●         │  │
│  │  Subscribed: Jan 15, 2026                                   │  │
│  │                                                              │  │
│  │  Primary Key:    ****************************a3f2  [Reveal]  │  │
│  │  Secondary Key:  ****************************7b1e  [Reveal]  │  │
│  │                                                              │  │
│  │  [Regenerate Primary]  [Regenerate Secondary]  [Unsubscribe] │  │
│  │                                                              │  │
│  │  Quota: 1,247 / 10,000 calls this month  ████████░░ 12.5%   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Parts Punchout API                        Active ●         │  │
│  │  ...                                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Important for Product:**
- M-3: Unsubscribe from API
- M-4: Audit logs for API usage and access changes
- M-5: Alerts for unusual activity

### **Support (MVP — Must Have)**

| ID | Requirement | Priority | Component |
|----|-------------|----------|-----------|
| S-1 | Submit support tickets | MVP | SPA + BFF: ServiceNow/ASK integration |
| S-2 | Ticket tracking with response status | MVP | SPA: Ticket Dashboard + BFF |
| S-3 | Knowledge base with search | MVP | SPA: KB Page + BFF: Content API |
| S-4 | Email/phone contact options | MVP | SPA: Contact Page |

**Important for Product:**
- S-5: Schedule technical demos
- S-6: Support SLAs and escalation workflows visible to users

**Nice to Have:**
- S-7: Live chat / community forum
- S-8: AI assistant for common issues

### **Cross-Cutting (MVP — Must Have)**

| ID | Requirement | Priority |
|----|-------------|----------|
| X-1 | Unified SSO authentication (Entra ID / Global Admin) | MVP |
| X-2 | Enterprise-grade security (OAuth2, rate limiting, logging) | MVP |
| X-3 | Mobile-friendly responsive UI | MVP |
| X-4 | Role-based dashboards (Dealer vs Internal vs Vendor) | Important |
| X-5 | Localization support for key regions | Important |
| X-6 | No anonymous access | MVP |

---

## 🏗️ **Architecture Overview**

### **Architecture Style**

**SPA + BFF (Backend-for-Frontend)** — a two-tier pattern where:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **SPA** | React 19, Vite 5, TypeScript 5.6, MUI 7 | UI rendering, routing, client state, MSAL.js authentication |
| **BFF** | ASP.NET Core 10 (.NET 10) Minimal API | JWT Bearer validation, RBAC enforcement, APIM proxy (ARM/Data API), response caching, static file serving |
| **Platform Ingress** | Azure Container Apps | External HTTP(S) routing, TLS termination, traffic management |

### **Why SPA + BFF?**

| Concern | SPA-Only | SPA + BFF ✓ |
|---------|----------|-------------|
| APIM credential security | Browser holds subscription keys (exposure risk) | BFF uses App Registration (ClientSecretCredential); keys never reach browser |
| API aggregation | Multiple round-trips from browser | BFF aggregates/unwraps APIM ARM responses |
| CORS management | Complex per-API CORS | Single-origin via BFF serving static files + same-domain API calls |
| Secret management | Cannot store secrets in client | BFF uses App Registration + ClientSecretCredential (ITokenProvider) |
| Resilience | Client-side retry only | BFF uses AddStandardResilienceHandler (retry, circuit breaker, timeout) |
| RBAC enforcement | Client-side checks only (bypassable) | Server-side RBAC policies (ApiRead, ApiTryIt, ApiSubscribe, ApiManage) |
| Compliance | Hard to audit client calls | Centralized structured logging via RequestLoggingMiddleware |

### **Component Mapping**

```
┌─────────────────────────────────────────────────────────────┐
│                     SPA (React 19 + MUI 7)                  │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ ApiCatalog│ │ApiDetails│ │ ApiTryIt │ │MyIntegrations│   │
│  │  Page    │ │  Page    │ │  Page    │ │   Page       │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘    │
│       │            │            │               │           │
│  ┌────┴────────────┴────────────┴───────────────┴───────┐   │
│  │              Shared Services Layer                   │   │
│  │  • usePortalApi() hook (fetch → BFF + Bearer token)  │   │
│  │  • useAuth() hook (MSAL PCA via @azure/msal-react)   │   │
│  │  • i18next provider (en, es)  • ErrorBoundary        │   │
│  │  • appConfig (runtime → build-time → fallback)       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │  Bearer token (JWT from MSAL.js)
                             │  via HTTP to BFF on same port 8080
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               BFF (ASP.NET Core 10 Minimal API)             │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Auth Pipeline   │  │      Endpoint Route Groups       │ │
│  │  • JWT Bearer    │  │  /api/apis        → ArmApiService│ │
│  │    (Entra ID)    │  │  /api/products    → ArmApiService│ │
│  │  • RBAC policies │  │  /api/subscriptions→ ArmApiService││
│  │    (4 permission │  │  /api/tags        → ArmApiService│ │
│  │     levels)      │  │  /api/stats       → ArmApiService│ │
│  └──────────────────┘  │  /api/news        → Static JSON  │ │
│                        │  /api/users       → JWT claims   │ │
│  ┌──────────────────┐  │  /api/health      → Anonymous    │ │
│  │ Cross-Cutting    │  └──────────────────────────────────┘ │
│  │ • Health checks  │                                       │
│  │ • Structured log │  ┌──────────────────────────────────┐ │
│  │ • IMemoryCache   │  │  Service Layer                   │ │
│  │ • Security hdrs  │  │  • ArmApiService (ARM Mgmt API)  │ │
│  │ • Portal telemetry│ │  • DataApiService (Data API)     │ │
│  │   (x-ms-apim-    │  │  • MockApiService (local dev)    │ │
│  │    client header)│  └─────────────────────────────────┘  │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚛️ **SPA Frontend Design**

### **Technology Stack**

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.0.0 | UI framework |
| react-dom | 19.0.0 | DOM rendering |
| Vite | 5.4.2 | Build tooling & dev server |
| TypeScript | 5.6.3 | Type safety |
| react-router-dom | 6.26.2 | Client-side routing (lazy-loaded pages) |
| @azure/msal-browser | 3.20.0 | Entra ID authentication (PublicClientApplication) |
| @azure/msal-react | 2.0.10 | React MSAL integration hooks & provider |
| @mui/material | 7.0.0 | Material UI component library |
| @mui/icons-material | 7.0.0 | Material UI icons |
| @emotion/react | 11.11.4 | CSS-in-JS styling (MUI dependency) |
| @emotion/styled | 11.11.5 | Styled components (MUI dependency) |
| i18next | 23.12.2 | Internationalization framework |
| react-i18next | 14.1.3 | React i18n integration |
| Vitest | 1.6.1 | Unit testing framework |
| @testing-library/react | 14.1.2 | Component testing utilities |

### **SPA Route Structure**

```
/                               → Home (public if publicHomePage enabled, else authenticated)
/apis                           → ApiCatalog (browse, search, filter)
/apis/:apiId                    → ApiDetails (documentation, operations, plans)
/apis/:apiId/try                → ApiTryIt (interactive sandbox console)
/register                       → Register (new user registration)
/profile/onboarding             → Onboarding (post-registration setup)
/my/integrations                → MyIntegrations (subscriptions, credentials)
/support                        → Support (ticket submission, knowledge base)
/news                           → News (announcements feed)
/admin                          → Admin (RoleGate: Admin/GlobalAdmin only)
/sso-logout                     → SsoLogoutHandler (SSO logout callback)
/access-denied                  → AccessDenied (403 page)
*                               → NotFound (404 page)
```

### **Module Architecture**

The SPA is organized into the following high-level modules:

| Module | Purpose |
|--------|--------|
| **API Client** | Centralized HTTP layer — all calls go to the BFF with Bearer token authentication, automatic retry, and error mapping |
| **Auth** | MSAL integration for Entra ID login, token acquisition, and role/permission management |
| **Components** | Reusable UI elements — layout shell, API cards, role-based gating, error boundaries, notifications |
| **Pages** | Route-level screens — Home, API Catalog, API Details, Try-It Console, My Integrations, Support, News, Admin, Registration |
| **i18n** | Internationalization — English and Spanish locale files via i18next |
| **Hooks & Utils** | Shared data-fetching hooks, login/logout utilities, and helper functions |

### **Key SPA Design Decisions**

| Decision | Description |
|----------|------------|
| **API Client** | All SPA HTTP calls go exclusively to the BFF. The SPA acquires a JWT token from MSAL.js and sends it as a Bearer token. No direct calls to APIM or downstream services. Includes built-in retry logic and error mapping. |
| **Configuration Cascade** | Configuration is resolved in priority order: (1) Runtime injection at container startup, (2) Build-time environment variables, (3) Sensible defaults. This allows the same Docker image to be deployed to any environment without rebuilding. |
| **Role-Based UI** | Routes are protected by two layers: `PrivateRoute` ensures the user is authenticated (redirects to login otherwise), and `RoleGate` checks the user's Entra ID roles to show or hide sections (e.g., Admin pages require Admin or GlobalAdmin role). |

---

## 🌐 **BFF (.NET) Backend Design**

### **Technology Stack**

| Technology | Version | Purpose |
|-----------|---------|---------|
| .NET | 10.0 | Runtime |
| ASP.NET Core | 10.0 | Web framework (Minimal API) |
| Microsoft.Identity.Web | 3.8.3 | JWT Bearer token validation (Entra ID) |
| Azure.Identity | 1.13.2 | ClientSecretCredential (App Registration) for ARM / Data API tokens |
| Microsoft.Extensions.Http.Resilience | 9.6.0 | AddStandardResilienceHandler (retry, circuit breaker, timeout) |
| Microsoft.Extensions.Caching.Memory | 10.0.0 | In-memory response caching (IMemoryCache, 1-min TTL) |
| Microsoft.AspNetCore.OpenApi | 10.0.0 | OpenAPI document generation (development only) |
| Scalar.AspNetCore | 2.4.19 | API documentation UI (development only) |
| HealthChecks | built-in | Anonymous health endpoint |

### **Project Organization**

The BFF is organized into the following modules:

| Module | Purpose |
|--------|--------|
| **Authorization** | RBAC pipeline — checks user roles from JWT against hot-reloadable permission policies |
| **Endpoints** | REST API route groups — APIs, Products, Subscriptions, Tags, Stats, News, Users, Health, Admin, Support, Registration |
| **Services** | Backend data access — three interchangeable implementations (ARM Management API, Data API, Mock) selected by configuration |
| **Middleware** | Cross-cutting HTTP processing — structured request/response logging, security headers, portal telemetry headers |
| **Models** | Data transfer objects and contract types for APIM responses |

### **Application Startup**

At startup, the BFF configures the following pipeline:

1. **Configuration** — Loads APIM connection settings, Entra ID configuration, feature flags, and RBAC policies from JSON config files
2. **Authentication** — Registers JWT Bearer validation for multi-tenant Entra ID tokens (workforce + CIAM)
3. **Authorization** — Registers four RBAC policies (Read, TryIt, Subscribe, Manage) that check user roles against a hot-reloadable policy file
4. **Caching** — In-memory response cache with 1-minute TTL to reduce redundant APIM calls
5. **HTTP Clients** — Configured with automatic retry (3 attempts, exponential backoff), circuit breaker, and timeout policies
6. **Service Selection** — Based on configuration, one of three data services is activated: ARM API (production), Data API (runtime alternative), or Mock (local development)
7. **Middleware** — Request logging, security headers, CORS, authentication, and authorization
8. **Endpoints** — All REST API routes are mapped (APIs, Products, Subscriptions, Tags, Stats, News, Users, Health, Admin, Support)

### **Endpoint Design (REST Contracts)**

> **Rationale**: These endpoints are informed by the self-hosted APIM developer portal's built-in capabilities (catalog, subscriptions, try-it, user profile) — re-implemented as BFF routes with RBAC enforcement and server-side key management.

#### **API Catalog Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/apis` | ApiRead | List all APIs (paged via `$top`/`$skip`) |
| GET | `/api/apis/{apiId}` | ApiRead | API detail (with operations, OpenAPI spec) |
| GET | `/api/apis/{apiId}/operations` | ApiRead | List operations for an API |
| GET | `/api/apis/bytags` | ApiRead | List APIs grouped by tag |
| GET | `/api/apis/versionsets` | ApiRead | List API version sets |

#### **Product Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/products` | ApiRead | List all APIM products |
| GET | `/api/products/{productId}` | ApiRead | Product detail |

#### **Subscription & Credential Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/subscriptions` | ApiSubscribe | List user subscriptions |
| GET | `/api/subscriptions/{subId}` | ApiSubscribe | Subscription detail |
| PUT | `/api/subscriptions/{subId}` | ApiSubscribe | Update subscription (state change) |
| POST | `/api/subscriptions/{subId}/secrets` | ApiSubscribe | Retrieve subscription keys (masked by default) |
| POST | `/api/subscriptions/{subId}/secrets/reveal` | ApiSubscribe | Reveal full key (audit-logged, rate-limited) |
| POST | `/api/subscriptions/{subId}/secrets/regenerate` | ApiSubscribe | Regenerate primary or secondary key |

#### **Sandbox / Try-It Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| ANY | `/api/sandbox/{apiSlug}/**` | ApiTryIt | YARP-proxied request to APIM sandbox gateway (BFF injects subscription key) |

#### **Content Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/news` | ApiRead | News & announcements (from static JSON or AEM, cached 5min) |
| GET | `/api/content/pages/{slug}` | ApiRead | Dynamic CMS page content (from AEM, cached 10min) |

#### **Support Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/support/tickets` | Authenticated | List user's support tickets (from ServiceNow/ASK) |
| POST | `/api/support/tickets` | Authenticated | Create support ticket |
| GET | `/api/support/tickets/{ticketId}` | Authenticated | Get ticket detail + status |
| GET | `/api/support/kb/search?q={query}` | Authenticated | Search knowledge base articles |

#### **User & Auth Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/users/me` | Authenticated | Current user profile + roles from JWT claims |
| PUT | `/api/users/me` | Authenticated | Update profile (preferred language, display name) |
| POST | `/api/register` | Anonymous | Submit registration request (pending Global Admin approval) |

#### **Miscellaneous Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/tags` | ApiRead | List all APIM tags |
| GET | `/api/stats` | ApiRead | Portal statistics (API count, product count, etc.) |
| GET | `/api/health` | Anonymous | Health check endpoint |

#### **Admin Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/admin/users` | ApiManage | List all portal users with roles |
| GET | `/api/admin/analytics/overview` | ApiManage | Portal usage analytics (DAU, page views, top APIs) |
| GET | `/api/admin/subscriptions` | ApiManage | All subscriptions across users |
| POST | `/api/admin/apis/{apiSlug}/onboard` | ApiManage | Onboard new API to catalog (metadata + APIM product config) |

### **Service Layer — Three Modes**

The BFF supports three service implementations, selected at startup via configuration:

#### **ArmApiService (Design-Time Mode — Default)**

Uses the Azure ARM Management API to query APIM resources. Authenticates via App Registration (Service Principal with `ClientSecretCredential`). Unwraps the ARM response envelope to return flat domain objects. Results are cached in-memory for 1 minute to avoid redundant calls.

#### **DataApiService (Runtime Mode)**

Uses the APIM Data API for runtime operations. Returns flat responses without the ARM envelope. User-scoped request prefixing for subscription management.

#### **MockApiService (Development Mode)**

Returns static mock data for local development without any Azure connectivity. Enabled when `Features:UseMockMode = true` in configuration.

#### **Service Interface Patterns**

The BFF uses a service layer pattern with dependency injection. Each service encapsulates a downstream integration:

| Service | Interface | Downstream | Resilience |
|---------|-----------|------------|------------|
| `ArmApiService` / `DataApiService` / `MockApiService` | `IApiService` | APIM Management API / Data API | Retry (3x, exponential) + Circuit Breaker + IMemoryCache 1 min |
| `SubscriptionService` | `IApiService` (subscription methods) | APIM Management API | Retry (2x) + Circuit Breaker |
| `CredentialService` | `IApiService` (secrets methods) | APIM Management API | Retry (2x) + audit logging on every reveal/regenerate |
| `SandboxProxyService` | (YARP config) | APIM Gateway | Timeout (30s) + rate limit (100 req/min per user) |
| `ContentService` | `IContentService` | Adobe AEM REST API | Retry (2x) + IMemoryCache (5-30 min TTL by content type) |
| `SupportService` | `ISupportService` | ServiceNow/ASK REST API | Retry (2x) + Circuit Breaker |
| `RoleProvider` | `IRoleProvider` | Global Admin API | Retry (2x) + IMemoryCache (30 min for roles) |

**Service Registration Example**

```csharp
// Program.cs — Service registration with AddStandardResilienceHandler
builder.Services.AddSingleton<ITokenProvider, AppRegistrationTokenProvider>();

// Service selection based on configuration
if (features.UseMockMode)
    builder.Services.AddScoped<IApiService, MockApiService>();
else if (features.UseDataApi)
    builder.Services.AddScoped<IApiService, DataApiService>();
else
    builder.Services.AddScoped<IApiService, ArmApiService>();

builder.Services.AddScoped<IRoleProvider, GlobalAdminRoleProvider>();

// HttpClient with resilience pipeline
builder.Services.AddHttpClient("ArmApi", client =>
{
    client.BaseAddress = new Uri(apimConfig.ManagementEndpoint);
})
.AddStandardResilienceHandler();  // Polly: retry + circuit breaker + timeout
```

### **YARP Reverse Proxy (Try-It Console)**

> **Rationale**: The self-hosted APIM portal's Try-It console makes direct browser→APIM calls (requiring CORS and exposing subscription keys). Our BFF uses YARP to proxy sandbox requests, keeping subscription keys server-side.

**YARP Configuration**

```csharp
// Program.cs — YARP reverse proxy for sandbox
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// appsettings.json — YARP route config
{
  "ReverseProxy": {
    "Routes": {
      "sandbox-route": {
        "ClusterId": "apim-sandbox",
        "Match": { "Path": "/api/sandbox/{**remainder}" },
        "Transforms": [
          { "PathRemovePrefix": "/api/sandbox" },
          { "RequestHeader": "Ocp-Apim-Subscription-Key", "Set": "{sandbox-key}" },
          { "RequestHeaderRemove": "Authorization" },
          { "ResponseHeaderRemove": "Ocp-Apim-Trace" }
        ]
      }
    },
    "Clusters": {
      "apim-sandbox": {
        "Destinations": {
          "primary": { "Address": "https://{apim-name}.azure-api.net" }
        }
      }
    }
  }
}
```

**Transform Pipeline**

| Step | Transform | Purpose |
|------|-----------|----------|
| 1 | `PathRemovePrefix: /api/sandbox` | Strip BFF prefix, forward clean path to APIM |
| 2 | `RequestHeader: Ocp-Apim-Subscription-Key` | Inject APIM subscription key from Key Vault (never from browser) |
| 3 | `RequestHeaderRemove: Authorization` | Remove user's Bearer token before forwarding to APIM |
| 4 | `ResponseHeaderRemove: Ocp-Apim-Trace` | Strip APIM diagnostic headers from response |

**Rate Limiting**: Sandbox requests are rate-limited per-user (100 requests/minute) via ASP.NET Core Rate Limiter middleware applied to the `/api/sandbox/**` route group.

---

## 🔐 **Authentication & Authorization**

### **Auth Flow (MSAL.js PCA + JWT Bearer + Global Admin Roles)**

```
  Browser (SPA)           BFF (.NET 10)           Global Admin API       APIM
  ─────────────           ─────────────           ────────────────       ────
       │                       │                        │                  │
       │ 1. SPA login via      │                        │                  │
       │    MSAL PCA (Entra)   │                        │                  │
       │───────────────────────────────────────────►  Entra ID             │
       │◄──────────────────────────────────────────  (JWT returned)        │
       │                       │                        │                  │
       │ 2. SPA calls BFF:     │                        │                  │
       │    Authorization:     │                        │                  │
       │    Bearer {jwt}       │                        │                  │
       │─────────────────────► │                        │                  │
       │                       │                        │                  │
       │                       │ 3. Validate JWT        │                  │
       │                       │    (JWKS multi-tenant) │                  │
       │                       │                        │                  │
       │                       │ 4. Extract user-id     │                  │
       │                       │    (oid or sub claim)  │                  │
       │                       │                        │                  │
       │                       │ 5. GET /users/{id}/    │                  │
       │                       │    roles               │                  │
       │                       │───────────────────────►│                  │
       │                       │    (Ocp-Apim-Sub-Key)  │                  │
       │                       │◄───────────────────────│                  │
       │                       │    ["Distributor"]     │                  │
       │                       │                        │                  │
       │                       │ 6. RBAC check          │                  │
       │                       │    (rbac-policies.json │                  │
       │                       │     → ApiAccessHandler)│                  │
       │                       │                        │                  │
       │                       │ 7. Call APIM via       │                  │
       │                       │    App Registration SP │                  │
       │                       │───────────────────────────────────────►   │
       │                       │◄──────────────────────────────────────    │
       │                       │                        │                  │
       │ 8. BFF returns        │                        │                  │
       │    filtered response  │                        │                  │
       │◄───────────────────── │                        │                  │
```

### **Key Security Properties**

| Property | Implementation |
|----------|---------------|
| **SPA authentication** | MSAL.js `PublicClientApplication` — acquires tokens via popup/redirect flow |
| **Token transport** | Bearer token in `Authorization` header for every `/api/*` call |
| **Multi-tenant validation** | BFF resolves JWKS signing keys from workforce + CIAM (external) tenant OIDC endpoints |
| **Role source** | BFF extracts user-id (`oid`/`sub` claim) from JWT, then calls **Global Admin API** to fetch business roles (Distributor, Vendor, Customer, Admin) |
| **Role caching** | `IMemoryCache` — 30-minute TTL per user, reducing Global Admin API traffic |
| **APIM credentials** | BFF uses `ClientSecretCredential` (App Registration Service Principal) — never exposed to browser |
| **Development mode** | Mock auth: any/no token accepted; `MockRoleProvider` returns Distributor role for all users |
| **Token refresh** | MSAL.js handles silent token refresh client-side (acquireTokenSilent) |
| **Same-origin** | BFF serves SPA static files + `/api/*` on same port 8080 (no CORS in production) |
| **Fail-closed** | If Global Admin API is unreachable, BFF returns empty roles → user gets no access |

### **RBAC Model**

| Permission Level | Enum Value | Access Scope |
|-----------------|------------|--------------|
| **Read** | `Permission.Read` | Browse APIs, view documentation, view tags, view products |
| **TryIt** | `Permission.TryIt` | All Read + interactive API testing console |
| **Subscribe** | `Permission.Subscribe` | All TryIt + manage subscriptions, view/rotate credentials |
| **Manage** | `Permission.Manage` | Full access including admin endpoints |

**Role-to-Permission Mapping** — defined in a hot-reloadable configuration file (`rbac-policies.json`):

| Permission | Allowed Roles |
|-----------|---------------|
| **Read** | Customer, Vendor, Distributor, Admin |
| **TryIt** | Vendor, Distributor, Admin |
| **Subscribe** | Vendor, Distributor, Admin |
| **Manage** | Distributor, Admin |

**Role Source:** Business roles are fetched from the **Global Admin API** (`GET /users/{userId}/roles`) at runtime. The BFF extracts the user's `oid` (or `sub`) claim from the validated JWT, calls the Global Admin API with the `Ocp-Apim-Subscription-Key` header, and receives a list of business roles (e.g., `["Distributor"]`). Roles are cached for 30 minutes per user. The BFF then checks these roles against `rbac-policies.json` for every protected endpoint.

### **Registration / Onboarding Flow**

1. Unregistered user navigates to portal → redirected to `/register`
2. User fills registration form (name, org, role requested)
3. SPA POST `/api/register` → placeholder endpoint (future: approval queue)
4. Admin assigns business role via Global Admin (Distributor, Vendor, or Customer)
5. User logs in → MSAL acquires JWT → BFF calls Global Admin API for roles → portal RBAC enforced

---

## 🔌 **API Gateway & APIM Integration**

### **Azure APIM Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      Azure API Management                       │
│                                                                 │
│  Products:                                                      │
│  ┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐  │
│  │  SAP Warranty    │ │ Parts Punchout  │ │ Equipment Mgmt   │  │
│  │  API             │ │ API             │ │ API              │  │
│  │                  │ │                 │ │                  │  │
│  │ • Production env │ │ • Production env│ │ • Production env │  │
│  │ • Sandbox env    │ │ • Sandbox env   │ │ • Sandbox env    │  │
│  │ • OpenAPI spec   │ │ • OpenAPI spec  │ │ • OpenAPI spec   │  │
│  │ • Rate policies  │ │ • Rate policies │ │ • Rate policies  │  │
│  └──────────────────┘ └─────────────────┘ └──────────────────┘  │
│                                                                 │
│  Policies:                                                      │
│  • OAuth2 token validation                                      │
│  • Rate limiting (per subscription)                             │
│  • Request/response logging → App Insights                      │
│  • CORS (BFF origin only ?)                                     │
│  • Request size limits                                          │
│  • Backend circuit-breaker                                      │
└─────────────────────────────────────────────────────────────────┘
```

### **BFF ↔ APIM Communication**

| Interaction | Method | Purpose |
|-------------|--------|---------|
| **ARM Management API** | HTTPS via IHttpClientFactory ("ArmApi") | Query APIs, products, subscriptions, tags, version sets (design-time mode) |
| **Data API** | HTTPS via IHttpClientFactory ("DataApi") | Query APIs, products, subscriptions (runtime mode — flat responses) |
| **Mock Mode** | Static in-memory data | Local development without Azure connectivity |

> **Note:** The BFF uses `ITokenProvider` (`AppRegistrationTokenProvider` → `ClientSecretCredential`) to acquire ARM / Data API bearer tokens. The same App Registration credentials work identically across local dev, Docker, and Azure Container Apps.

### **Phase 1 APIs**

| API | Backend | Category | Sandbox Available |
|-----|---------|----------|-------------------|
| SAP Warranty API | SAP | Enterprise | Yes (provided by API owner) |
| Parts Punchout API | Internal | Commerce | Yes (provided by API owner) |
| Equipment Management API | Komatsu | Asset Management | Yes (provided by API owner) |

---

## 📊 **Data Model**

### **Domain Entities**

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   ApiProduct     │     │   ApiCategory    │     │   ApiVersion     │
│──────────────────│     │──────────────────│     │──────────────────│
│ id               │────►│ id               │     │ id               │
│ name             │     │ name             │     │ apiProductId     │
│ slug             │     │ slug             │     │ version          │
│ description      │     │ description      │     │ openApiSpecUrl   │
│ categoryId       │     │ icon             │     │ changelog        │
│ owner            │     └──────────────────┘     │ status           │
│ version          │                              │ publishedDate    │
│ status           │     ┌──────────────────┐     └──────────────────┘
│ iconUrl          │     │  Subscription    │
│ region           │     │──────────────────│     ┌──────────────────┐
│ dataType         │     │ id               │     │  SupportTicket   │
│ slaDescription   │     │ userId           │     │──────────────────│
│ pricingTier      │     │ apiProductId     │     │ id               │
│ sandboxEnabled   │     │ state            │     │ userId           │
│ contactEmail     │     │ primaryKey       │     │ subject          │
│ tags[]           │     │ secondaryKey     │     │ description      │
│ metadata{}       │     │ createdUtc       │     │ status           │
└──────────────────┘     │ expiresUtc       │     │ externalId       │
                          └──────────────────┘    │ createdUtc       │
┌──────────────────┐                              │ updatedUtc       │
│   UserProfile    │     ┌──────────────────┐     └──────────────────┘
│──────────────────│     │  ContentBlock    │
│ id (Entra OID)   │     │──────────────────│     ┌──────────────────┐
│ displayName      │     │ id               │     │  NewsArticle     │
│ email            │     │ slug             │     │──────────────────│
│ organization     │     │ title            │     │ id               │
│ roles[]          │     │ body (HTML)      │     │ title            │
│ preferredLang    │     │ locale           │     │ summary          │
│ registeredUtc    │     │ lastModifiedUtc  │     │ body             │
│ lastLoginUtc     │     │ author           │     │ publishedDate    │
└──────────────────┘     └──────────────────┘     │ category         │
                                                  │ tags[]           │
                                                  └──────────────────┘
```

### **Data Sources (Need Persist Source for RBAC/Use Global Admin Apis)**

| Entity | Source | Notes |
|--------|--------|-------|
| ApiProduct, ApiCategory | Azure APIM (Management API) | Products and tags configured in APIM |
| Subscription, Credential | Azure APIM (Management API) | APIM subscription keys |
| UserProfile, Roles | Entra ID (Microsoft Graph) | Global Admin manages users |
| ContentBlock, NewsArticle | AEM CMS (Content API) | Dynamic content from AEM |
| SupportTicket | ServiceNow / ASK (REST API) | Ticket CRUD via integration |
| OpenAPI Specs | Azure APIM | Embedded in APIM product definitions |

> **Key Decision:** The BFF may not need to own a database. All state is derived from authoritative upstream systems (APIM, Entra ID, Global Admin). This reduces operational complexity and data synchronization issues. IMemoryCache is used for response deduplication with a 1-minute TTL.

---

## 🔄 **Integration Architecture**

### **Integration Map**

```
  ┌────────────────────────────────────────────────────────────┐
  │                    BFF (ASP.NET Core 10)                   │
  │                                                            │
  │   ┌──────────┐  ┌──────────┐  ┌───────────┐ ┌──────────┐   │
  │   │ ArmApi   │  │ DataApi  │  │ GlobalAdmin│ │ Mock    │   │
  │   │ Service  │  │ Service  │  │ RoleProvider│ │ Service│   │
  │   └────┬──────┘  └────┬─────┘  └─────┬─────┘ └──────────┘  │
  └────────┼──────────────┼───────────────┼────────────────────┘
           │              │               │
    ┌──────▼──────┐ ┌─────▼─────┐  ┌─────▼──────┐
    │ Azure APIM  │ │ Azure APIM│  │ Global     │
    │ ARM Mgmt API│ │ Data API  │  │ Admin API  │
    │             │ │           │  │            │
    │ • APIs      │ │ • APIs    │  │ • User     │
    │ • Products  │ │ • Products│  │   roles    │
    │ • Subs      │ │ • Subs    │  │ • Business │
    │ • Tags      │ └───────────┘  │   perms    │
    └─────────────┘                └────────────┘
```

### **Integration Details**

| System | Protocol | Auth | Purpose |
|--------|----------|------|---------|
| **Azure APIM (ARM Management API)** | REST (HTTPS) | ClientSecretCredential (App Registration SP) | API catalog, products, subscriptions, tags, version sets — design-time mode |
| **Azure APIM (Data API)** | REST (HTTPS) | ClientSecretCredential (App Registration SP) | Same as ARM but flat responses — runtime mode |
| **Global Admin API** | REST (HTTPS) | `Ocp-Apim-Subscription-Key` header | Fetch user business roles (Distributor, Vendor, Customer, Admin) by user-id; cached 30 min |
| **Entra ID** | OIDC + JWKS | JWT Bearer validation (multi-tenant) | User authentication via MSAL.js; BFF validates JWT tokens from workforce + CIAM tenants |

### **Resilience Patterns**

All outbound HTTP calls from the BFF use the .NET Standard Resilience Handler (`AddStandardResilienceHandler`), which provides:

| Pattern | Configuration |
|---------|---------------|
| **Automatic Retry** | Up to 3 attempts with exponential backoff (starting at 500 ms with jitter) |
| **Circuit Breaker** | Opens after repeated failures within a 60-second window (minimum 5 requests) — prevents cascading failures |
| **Per-Request Timeout** | 30 seconds per individual attempt |
| **Total Timeout** | 90 seconds across all retry attempts |
| **Telemetry Header** | `x-ms-apim-client` header automatically added to all APIM requests for traceability |

**Polly Resilience Pipeline (code-level configuration)**

```csharp
// Standard resilience pipeline (applied to all BFF→downstream HttpClients)
builder.Services.AddHttpClient("ArmApi")
    .AddResilienceHandler("standard", pipeline =>
    {
        pipeline.AddRetry(new RetryStrategyOptions<HttpResponseMessage>
        {
            MaxRetryAttempts = 3,
            Delay = TimeSpan.FromMilliseconds(500),
            BackoffType = DelayBackoffType.Exponential,
            ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                .Handle<HttpRequestException>()
                .HandleResult(r => r.StatusCode >= System.Net.HttpStatusCode.InternalServerError)
        });
        pipeline.AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
        {
            FailureRatio = 0.5,
            SamplingDuration = TimeSpan.FromSeconds(30),
            MinimumThroughput = 5,
            BreakDuration = TimeSpan.FromSeconds(30)
        });
        pipeline.AddTimeout(TimeSpan.FromSeconds(10));
    });
```

**Per-Downstream Resilience Matrix**

| Downstream | Retry | Circuit Breaker | Timeout | Cache |
|-----------|-------|-----------------|---------|-------|
| APIM Management API | 3x exponential | 5 failures / 30s → open 30s | 10s | IMemoryCache 1 min (catalog) |
| APIM Gateway (sandbox) | 1x | Disabled (user-facing latency) | 30s | None |
| Adobe AEM | 2x exponential | 5 failures / 60s → open 60s | 10s | IMemoryCache 5-30 min |
| ServiceNow/ASK | 2x exponential | 5 failures / 60s → open 60s | 15s | None |
| Global Admin (roles) | 2x exponential | 3 failures / 30s → open 30s | 5s | IMemoryCache 30 min |

---

## 📝 **Content Management (AEM Integration)**

### **Content Architecture**

```
  AEM Author                    BFF                          SPA
  ──────────                    ───                          ───
  Content editors    ────►   /api/content/news         ────►  News Section
  manage in AEM              (cached 5 min)                  (dynamic render)
  Author UI
                     ────►   /api/content/pages/{slug} ────►  Dynamic pages
                             (cached 10 min)                 (CMS-driven)

  Admin Portal UI    ────►   PUT /api/content/pages    ────►  AEM Author API
  (for quick edits)          (Admin role only)               (create/update)
```

### **Dynamic Content Types**

| Content Type | Source | Cache TTL | Editable By |
|-------------|--------|-----------|-------------|
| News & Announcements | AEM | 5 min | Business content editors |
| API descriptions (enriched) | AEM | 10 min | API owners |
| Use case pages | AEM | 10 min | Content editors |
| Landing page hero content | AEM | 30 min | Marketing |
| Footer links | AEM | 1 hour | Admin |
| API deprecation notices | AEM | 5 min | API owners |

---

## 🌍 **Multi-Language Support**

### **Strategy**

| Layer | Approach |
|-------|----------|
| **SPA static strings** | `react-i18next` with JSON locale files (en, es, etc.) |
| **API documentation** | Delivered per-locale from APIM/AEM; BFF adds `Accept-Language` header |
| **Dynamic content (AEM)** | AEM delivers locale-specific content variants; locale in URL path (`/api/content/pages/{slug}?locale=es`) |
| **Translations** | Provided externally by KNA translation team (per appspec assumption) |

### **SPA i18n Implementation**

The SPA uses the industry-standard `react-i18next` library with JSON locale files. The user's browser language is detected automatically, with English as the default fallback. Adding a new language requires only creating a new JSON translation file — no code changes needed.

---

## 🛡️ **Security & Compliance**

### **Security Controls Matrix**

| Control | Implementation | Requirement |
|---------|---------------|-------------|
| **Authentication** | MSAL.js PCA in SPA → JWT Bearer validation in BFF (multi-tenant Entra ID) | OAuth2 / Entra ID |
| **Authorization** | RBAC — 4 permission levels (Read, TryIt, Subscribe, Manage) enforced via BFF policies | Appspec RBAC requirement |
| **Token security** | SPA holds MSAL-managed tokens; BFF validates JWT; APIM keys use ClientSecretCredential (never in browser) | Best practice |
| **Same-origin** | BFF serves static SPA files on same port as `/api/*` endpoints; ACE handles external TLS termination | Best practice |
| **Encryption in transit** | TLS 1.3 (ACE ingress → BFF on port 8080, BFF → APIM) | KNA IT Security |
| **Secret management** | App Registration ClientSecretCredential; client secret in Container App secrets / Key Vault | SOC 2 |
| **Resilience** | AddStandardResilienceHandler: retry 3x with exponential backoff, circuit breaker, timeout | Availability |
| **Caching** | IMemoryCache with 1-minute TTL for GET response deduplication | Performance |
| **Input validation** | ASP.NET Core model binding + Minimal API parameter validation | OWASP |
| **CORS** | Open in dev; same-origin via BFF serving static files in production (no CORS needed) | Best practice |
| **Security Headers** | SecurityHeadersMiddleware: X-Content-Type-Options, X-Frame-Options, CSP, etc. | OWASP |
| **Structured logging** | RequestLoggingMiddleware: method, path, status, duration, user ID | Audit |
| **Portal telemetry** | PortalTelemetryHandler: x-ms-apim-client header on all outbound APIM requests | Observability |
| **Dependency scanning** | GitHub Advanced Security (SAST, secret scanning) | KNA IT: Code scanning |
| **WCAG compliance** | MUI 7 components + semantic HTML + ARIA attributes | Appspec |

### **Threat Model Summary**

| Threat | Mitigation |
|--------|-----------|
| XSS | CSP headers via SecurityHeadersMiddleware, React auto-escaping, MUI components |
| Token theft | MSAL.js manages token cache; APIM keys use ClientSecretCredential (never in browser) |
| APIM key exposure | Keys stay server-side (BFF uses App Registration SP); never sent to browser |
| Injection | ASP.NET Core model binding, parameterized APIM API queries |
| DDoS | ACA ingress controls, APIM rate limiting, BFF resilience (circuit breaker) |
| Broken access control | RBAC enforced at BFF middleware (ApiAccessHandler); hot-reloadable policies |

---

## ☁️ **Infrastructure & Deployment**

### **Environment Strategy**

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Development** | Active development, feature branches | `dev-apimarketplace.komatsu.com` |
| **Quality (QA/UAT)** | SIT, performance, UAT testing | `qa-apimarketplace.komatsu.com` |
| **Production** | Live portal | `apimarketplace.komatsu.com` |

### **Azure Resource Architecture**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Resource Group: rg-apimarketplace-{env}          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │        Azure Container Apps — External Ingress (port 8080)    │  │
│  │                   ACE Routes → Container :8080                │  │
│  └───────────────────┬───────────────────────────────────────────┘  │
│                      │                                              │
│  ┌───────────────────▼───────────────────────────────────────────┐  │
│  │          Container: Single Process (BFF — .NET 10)            │  │
│  │               Listens on Port 8080                            │  │
│  │                                                               │  │
│  │  • Serves compiled SPA static files (React build output)      │  │
│  │  • /api/* routes → ARM / Data API proxying                    │  │
│  │  • JWT Bearer auth (Entra ID)                                 │  │
│  │  • RBAC policies (ApiRead, TryIt, Subscribe, Manage)          │  │
│  │  • Middleware: Security headers, GZIP compression             │  │
│  │  • IMemoryCache (response deduplication)                      │  │
│  │  • AddStandardResilienceHandler (retry, circuit breaker)      │  │
│  │  • Structured request logging                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────┐  ┌──────────────────┐   ┌───────────────────────┐  │
│  │ Azure APIM  │  │ App Registration │   │ Application Insights  │  │
│  │ (Existing)  │  │ (Service         │   │ + Log Analytics       │  │
│  │             │  │  Principal)      │   │                       │  │
│  │ • Gateway   │  │ • ARM API access │   │ • Request logging     │  │
│  │ • Products  │  │ • ClientSecret   │   │ • Metrics             │  │
│  │ • APIs      │  │   Credential     │   │ • Diagnostics         │  │
│  └─────────────┘  └──────────────────┘   └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

Container Architecture (single image):

  ┌─────────────────────────────────────────┐
  │  Dockerfile (multi-stage)               │
  │                                         │
  │  Stage 1: Build SPA (Node 20 + Vite)    │
  │  Stage 2: Build BFF (.NET 10 SDK)       │
  │  Stage 3: Runtime                       │
  │    • .NET 10 ASP.NET runtime            │
  │    • docker-entrypoint.sh               │
  │      (injects runtime-config.js)        │
  │    • BFF serves SPA on port 8080        │
  │    • Single process, lighter footprint  │
  └─────────────────────────────────────────┘
```

### **Infrastructure as Code (Bicep)**

Per the appspec requirement, all resources are deployed via **Bicep** (preferred by KNA IT). The `azure/` directory contains:

| File | Purpose |
|------|---------|
| **container-app.bicep** | Azure Container App resource definition (compute, networking, secrets, scaling) |
| **parameters.{env}.json** | Environment-specific parameters (Dev, Staging, Production) |
| **deploy.ps1 / deploy.sh** | Deployment scripts (PowerShell and Bash) |
| **QUICK_SETUP.md** | App Registration (Service Principal) setup guide |

### **CI/CD Pipeline (Azure DevOps)**

The CI/CD pipeline automates build, test, and deployment across all environments:

| Stage | Trigger | Actions |
|-------|---------|--------|
| **Build** | Push to `main` or `release/*` | Multi-stage Docker build (SPA + BFF in one image), push to Azure Container Registry |
| **Test** | Same as Build | Run Vitest + RTL unit tests with coverage, TypeScript type checking |
| **Security Scan** | Same as Build | Credential scanning, Software Composition Analysis (SCA) |
| **Deploy to Dev** | Build succeeds on `main` | Update Azure Container App with new image (automatic) |
| **Deploy to Staging** | Manual approval gate | Same deployment process with staging parameters |
| **Deploy to Production** | Manual approval gate | Same deployment process with production parameters |

---

## 🧪 **Testing Strategy**

### **Testing Pyramid**

```
                    ▲
                   / \        E2E Tests (Playwright)
                  /   \       • Critical user flows
                 /     \      • Cross-browser
                /───────\
               /         \    Integration Tests
              /           \   • BFF → APIM mocks
             /             \  • BFF → Entra ID mocks
            /               \ • API contract tests
           /─────────────────\
          /                   \   Unit Tests (≥70% coverage)
         /                     \  • SPA: Vitest + RTL
        /                       \ • BFF: xUnit + NSubstitute
       /─────────────────────────\
```

### **Coverage Targets**

| Layer | Framework | Target | Scope |
|-------|-----------|--------|-------|
| **SPA Unit** | Vitest + React Testing Library | ≥ 70% | Components, hooks, services |
| **BFF Unit** | xUnit + NSubstitute | ≥ 70% | Endpoints, services, validators |
| **BFF Integration** | WebApplicationFactory + WireMock | Key flows | APIM, Entra ID, AEM integration |
| **E2E** | Playwright | Critical paths | Login, catalog browse, subscribe, try-it |
| **Security** | GitHub Advanced Security | 0 critical/high | SAST, secret scanning, SCA |
| **Performance** | k6 / Azure Load Testing | Pass SLA | Response times, throughput |

### **SPA Test Infrastructure (Existing — Enhanced)**

The current codebase already has MSW (Mock Service Worker) for API mocking (see [testServer.ts](src/tests/testServer.ts)). This will be extended to mock BFF endpoints instead of direct downstream APIs.

---

## 📈 **Non-Functional Requirements**

### **Performance**

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint (FCP) | < 1.5s | Lighthouse CI |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse CI |
| Time to Interactive (TTI) | < 3.5s | Lighthouse CI |
| BFF API response (P95) | < 500ms | Application Insights |
| BFF API response (P99) | < 1000ms | Application Insights |
| Catalog list query | < 300ms | Application Insights |

### **Availability & Scalability**

| Metric | Target |
|--------|--------|
| Uptime SLA | 99.9% (single region, Phase 1) |
| ACA auto-scale | 2–10 replicas (CPU/memory based) |
| SPA delivery | BFF serves static files directly on port 8080 |
| Caching | IMemoryCache (in-process, 1-min TTL) |
| Recovery Time Objective (RTO) | < 1 hour |
| Recovery Point Objective (RPO) | Near-zero (no portal-owned DB) |

### **Observability**

| Capability | Tool | Details |
|-----------|------|---------|
| Distributed tracing | ACA built-in + ILogger | End-to-end: SPA → BFF → APIM → Backend |
| Structured logging | ILogger (console provider) | RequestLoggingMiddleware logs method, path, status, duration |
| Portal telemetry | PortalTelemetryHandler | `x-ms-apim-client` header on all outbound APIM requests |
| Metrics & dashboards | Azure Monitor + Workbooks | Request rates, error rates, latency percentiles |
| Alerting | Azure Monitor Alerts | P95 latency > 1s, error rate > 5%, health check failures |
| SPA error tracking | Browser console + BFF logs | Unhandled errors surfaced via API error responses |

### **Accessibility**

| Standard | Target | Tooling |
|----------|--------|---------|
| WCAG 2.1 AA | Full compliance | axe-core in CI, manual audit |
| Keyboard navigation | Full support | Playwright a11y assertions |
| Screen reader | Full support | ARIA attributes, semantic HTML |
| Color contrast | 4.5:1 minimum | Lighthouse audit |
| Focus management | Visible indicators | Custom CSS focus styles |

---

## 🚀 **Phase 1 MVP Scope**

### **In Scope**

| Area | Deliverables |
|------|-------------|
| **SPA** | Landing page, API catalog (browse + search + filter), API detail (docs, use cases, pricing), Try-It console (Swagger embed), subscription flow, credential management, user dashboard, support ticket portal, knowledge base, news section, profile |
| **BFF** | All endpoints in Section 7.4, APIM integration (ARM + Data API modes), Entra ID JWT Bearer auth, IMemoryCache, health checks |
| **Auth** | Entra ID (workforce + CIAM tenants), MSAL.js PCA, permission-based RBAC (Read/TryIt/Subscribe/Manage) |
| **APIs** | 3 APIs onboarded: SAP Warranty, Parts Punchout, Equipment Management |
| **Infra** | 3 environments (Dev/QA/Prod), Bicep IaC, CI/CD pipelines, custom DNS |
| **Security** | TRA, EARB review, SOC 2 + GDPR compliance, code scanning |
| **Docs** | Reference architecture, physical architecture, integrations doc, runbook, IaC scripts, user guides |

### **Out of Scope (Post-MVP)**

- Multi-region deployment
- AI assistant for support
- Live chat/community forum
- API comparison tool
- Personalized recommendations
- Auto-generated client libraries
- Webhooks / event-driven integrations
- User activity heatmaps
- Video tutorials

### **Timeline Alignment**

| Month | Activities | Architecture Deliverables |
|-------|-----------|--------------------------|
| **Month 1** | Requirements, functional/non-functional design, API discovery sessions | This design document, EARB review prep |
| **Months 2–3** | Build marketplace portal | SPA + BFF implementation, IaC, CI/CD, 3 APIs onboarded |
| **Month 4** | SIT, performance, UAT, production deployment | Integration tests, E2E tests, performance validation, EARB review |
| **Month 4.5** | Hypercare, documentation, AMS knowledge transfer | Final documentation, runbook, KT sessions |

---

## ✅ **Conclusion**

The Komatsu API Marketplace Portal represents a modern, enterprise-grade platform built with the SPA + BFF pattern and cloud-native Azure services. The architecture balances developer experience with enterprise security requirements.

### **Key Achievements**
- ✅ **Secure Token Architecture**: BFF-managed APIM credentials with App Registration (ClientSecretCredential) — no keys in browser
- ✅ **Enterprise RBAC**: Four permission levels (Read, TryIt, Subscribe, Manage) enforced server-side via Global Admin roles
- ✅ **Multi-Tenant Auth**: Support for both Workforce and CIAM Entra ID tenants via MSAL.js
- ✅ **Cloud-Native Infrastructure**: Azure Container Apps with Bicep IaC, single-container deployment
- ✅ **Modern Tech Stack**: React 19, .NET 10 Minimal API, MUI 7, TypeScript 5.6
- ✅ **Comprehensive Integration**: Azure APIM (ARM + Data API), AEM CMS, Global Admin, ServiceNow

### **Business Impact**
- **🚀 Accelerated Onboarding**: Self-service API discovery, documentation, and sandbox testing
- **🔒 Enterprise Security**: Centralized authentication, RBAC, and audit logging
- **📊 Operational Efficiency**: Automated credential management and support workflows
- **🌍 Global Reach**: Multi-language support (English + Spanish) with i18next
- **💰 Reduced Support Costs**: Self-service portal with knowledge base and ticket tracking

The Komatsu API Marketplace Portal serves as a flagship example of modern enterprise API platform development within the Komatsu ecosystem, demonstrating best practices for security, cloud-native deployment, and developer experience design.

---

## 📎 **Appendices**

### **A. Configuration Reference**

#### **BFF Configuration**

The BFF is configured via JSON files (`appsettings.json`) with environment-specific overrides. Key configuration sections include:

| Section | Purpose |
|---------|--------|
| **Apim** | Azure APIM connection details (subscription, resource group, service name) |
| **EntraId** | Entra ID tenant and client IDs for JWT validation |
| **Apim:ServicePrincipal** | App Registration credentials for APIM API access (ClientSecretCredential) |
| **Features** | Feature flags (e.g., mock mode toggle, Data API mode) |
| **Logging** | Structured logging level configuration |

Sensitive values (client secrets) are injected via Azure Container App secrets or Key Vault references — never stored in source control.

#### **SPA Runtime Configuration**

The SPA uses build-time environment variables (via Vite) for default settings, with a **runtime override mechanism** (`runtime-config.js`) that allows changing configuration at container startup without rebuilding the application.

| Setting | Purpose |
|---------|---------|
| **API Base URL** | BFF base path (same origin — served from same container on port 8080) |
| **MSAL Client ID** | Entra ID app registration for user authentication |
| **MSAL Authority** | Entra ID tenant authority URL |
| **Public Home Page** | Feature flag to show public landing page |
| **Default Locale** | Default language (English, with Spanish support) |

### **B. Glossary**

| Term | Definition |
|------|-----------|
| **SPA** | Single Page Application — client-rendered web app served as static assets |
| **BFF** | Backend-for-Frontend — a server-side layer purpose-built for the SPA |
| **APIM** | Azure API Management — API gateway that hosts and manages Komatsu APIs |
| **MSAL** | Microsoft Authentication Library — handles Entra ID authentication |
| **ACA** | Azure Container Apps — serverless container hosting platform |

| **IMemoryCache** | .NET in-process memory cache with TTL-based expiration |
| **Global Admin** | Komatsu's centralized identity management framework built on Entra ID |
| **ARM API** | Azure Resource Manager API — used by BFF to query APIM at design-time |
| **Data API** | APIM Data API (runtime) — alternative to ARM for portal data access |
| **TRA** | Threat Risk Assessment |
| **EARB** | Enterprise Architecture Review Board |
| **AMS** | Application Management Services — operational support team |

### **C. Decision Log**

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | SPA + BFF over Server-Side Rendering | Rich interactive UX (Try-It console, Swagger embed); BFF proxies APIM with App Registration (ClientSecretCredential) | Mar 2026 |
| 2 | .NET 10 for BFF over Node.js | Aligns with Komatsu IT ecosystem; strong Azure SDK support; Minimal API performance; Microsoft.Identity.Web | Mar 2026 |
| 3 | No portal-owned database (Phase 1) | All data sourced from APIM and Entra ID — avoids sync complexity | Mar 2026 |
| 4 | IMemoryCache over Redis | No external dependency; 1-min TTL sufficient for API catalog deduplication; stateless BFF | Mar 2026 |
| 5 | Single ACA container (SPA + BFF) | BFF serves SPA static files + reverse proxies to API endpoints; simplifies deployment, networking, and CORS | Mar 2026 |
| 6 | BFF serves static files directly | No Nginx layer — BFF handles both SPA delivery and API routing on port 8080; simplifies container to single process; ACE handles external TLS termination | Mar 2026 |
| 7 | Bicep over Terraform for IaC | KNA IT preference (per appspec), first-party Azure support | Mar 2026 |
| 8 | AddStandardResilienceHandler over custom Polly | Built-in retry, circuit breaker, timeout with sensible defaults; less code to maintain | Mar 2026 |
| 9 | MSAL.js PCA (SPA token auth) over BFF cookie auth | Simpler implementation; no server-side session storage; supports multi-tenant (workforce + CIAM) | Mar 2026 |
| 10 | ARM + Data API dual-mode over SDK only | ARM API for design-time management data; Data API available as lightweight alternative | Mar 2026 |
| 11 | ACE provides external routing / TLS termination | ACE handles TLS termination and routes traffic to BFF on port 8080; no additional proxy layer needed inside container | Mar 2026 |
| 12 | Custom catalog + try-it over self-hosted APIM portal | Self-hosted APIM portal (Paperbits/Knockout.js) evaluated — wins on instant catalog + try-it, but blocked by: no Global Admin RBAC, no AEM CMS, no ServiceNow, no i18n, APIM keys in browser, Knockout.js maintenance burden. See `finding_compare_custom_selfhost_apim_dev.md` | Mar 2026 |
| 13 | Fuse.js for client-side API search | Lightweight (~5KB) fuzzy search library; builds index from BFF-provided catalog metadata; matches APIM portal's Lunr.js capability without sending search queries to server | Mar 2026 |
| 14 | Scalar/Stoplight Elements for OpenAPI rendering | Full OpenAPI 3.0 spec rendering (endpoints, schemas, examples) in SPA; combined with custom `TryItConsole` for sandboxed execution via BFF YARP proxy | Mar 2026 |
| 15 | Masked credential display with reveal-on-demand | APIM portal shows keys in plaintext; our design shows last-4-char hints by default, full key only on explicit reveal with re-auth + audit logging | Mar 2026 |
| 16 | YARP for Try-It Sandbox proxy | Native .NET reverse proxy; avoids separate proxy infrastructure; transforms inject APIM subscription key server-side and strip sensitive headers | Mar 2026 |

### **D. References**

- Komatsu API Marketplace Appspec (KNA Project #802)
- API Marketplace Story Mapping (Microsoft Whiteboard)
- [Microsoft BFF Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends)
- [YARP Documentation](https://microsoft.github.io/reverse-proxy/)
- [Microsoft.Identity.Web](https://learn.microsoft.com/en-us/entra/msal/dotnet/)
- [MSAL.js for React](https://learn.microsoft.com/en-us/entra/msal/javascript/)
- [Azure APIM REST API](https://learn.microsoft.com/en-us/rest/api/apimanagement/)
- [Azure APIM Data API](https://learn.microsoft.com/en-us/azure/api-management/developer-portal-alternative-overview)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/overview)
- [Microsoft.Extensions.Http.Resilience](https://learn.microsoft.com/en-us/dotnet/core/resilience/)
- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)

---

*Document prepared for KNA Enterprise Architecture Review Board (EARB) and KNA IT stakeholders.*
