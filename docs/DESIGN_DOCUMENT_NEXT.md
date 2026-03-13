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
| **Status** | Draft — with Phase 2 / Next Release annotations |
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
- **Phase 2 / Next Release Items**: Identified gaps from appspec cross-reference (marked with 🔮 throughout)

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
│                                                                │
│  [Optional: Nginx reverse proxy can be used instead if         │  
│   separation of concerns is preferred — see deployment         │  
│   architecture notes]                                          │  
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

**Important for Product:**
- U-4: Pricing / cost plan display (SPA: Pricing Section + BFF)
- U-5: Interactive API console (try-it-out with Swagger/Redoc)
- U-6: SDKs / code snippets in multiple languages
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

**Important for Product:**
- I-7: Auto-generated client libraries
- I-8: Webhooks / event-driven integration options
- I-9: API dependency graph

### **Manage (MVP — Must Have)**

| ID | Requirement | Priority | Component |
|----|-------------|----------|-----------|
| M-1 | View Client ID and secret associated to API | MVP | BFF: Credential Service |
| M-2 | Add, edit, update user profiles (Need to finalize requirements) | MVP | BFF: User Management + Entra ID |

**Important for Product:**
- M-3: Unsubscribe from API
- M-4: Audit logs for API usage and access changes

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

#### **API Catalog Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/apis` | ApiRead | List all APIs (paged via `$top`/`$skip`) |
| GET | `/api/apis/{apiId}` | ApiRead | API detail (with operations) |
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
| PUT | `/api/subscriptions/{subId}` | ApiSubscribe | Update subscription |
| POST | `/api/subscriptions/{subId}/secrets` | ApiSubscribe | Retrieve subscription keys |

#### **Miscellaneous Endpoints**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/tags` | ApiRead | List all APIM tags |
| GET | `/api/stats` | ApiRead | Portal statistics (API count, product count, etc.) |
| GET | `/api/news` | ApiRead | News feed (from static JSON) |
| GET | `/api/users/me` | Authenticated | Current user profile from JWT claims |
| GET | `/api/health` | Anonymous | Health check endpoint |

#### **Admin & Support Endpoints (Placeholders)**

| Method | Path | Auth Policy | Description |
|--------|------|-------------|-------------|
| GET | `/api/admin/**` | ApiManage | Admin-only endpoints (placeholder) |
| GET | `/api/support/**` | Authenticated | Support endpoints (placeholder) |
| POST | `/api/register` | Anonymous | User registration (placeholder) |

> 🔮 **Phase 2 / Next Release — ServiceNow/ASK & Registration Endpoints:**
> The support and registration endpoints above are currently placeholders. Phase 2 will replace them with fully contracted endpoints for ServiceNow/ASK ticket CRUD and Global Admin user provisioning. See [Phase 2 Roadmap — Items 2 & 3](#-phase-2--next-release-roadmap) for details.

### **Service Layer — Three Modes**

The BFF supports three service implementations, selected at startup via configuration:

#### **ArmApiService (Design-Time Mode — Default)**

Uses the Azure ARM Management API to query APIM resources. Authenticates via App Registration (Service Principal with `ClientSecretCredential`). Unwraps the ARM response envelope to return flat domain objects. Results are cached in-memory for 1 minute to avoid redundant calls.

#### **DataApiService (Runtime Mode)**

Uses the APIM Data API for runtime operations. Returns flat responses without the ARM envelope. User-scoped request prefixing for subscription management.

#### **MockApiService (Development Mode)**

Returns static mock data for local development without any Azure connectivity. Enabled when `Features:UseMockMode = true` in configuration.

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
| **Same-origin** | Nginx serves SPA + proxies `/api/*` → BFF on same domain (no CORS in production) |
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

> 🔮 **Phase 2 / Next Release — Registration Approval Queue & Welcome Email:**
> The registration flow above uses a placeholder endpoint. Phase 2 will implement:
> - **Approval queue**: Where pending registrations are stored (BFF-owned table or Global Admin queue), admin notification mechanism, and the full pending → approved → role-assigned lifecycle
> - **Global Admin provisioning API contracts**: Extend beyond role lookup (`GET /users/{id}/roles`) to include user creation and role assignment
> - **Rejection/denial flow**: For registrations that are not approved
> - **Automated welcome email**: Delivery mechanism (SendGrid, Azure Communication Services, or Office 365 SMTP), email template with quick-start guide, and trigger point (on approval or first login)
>
> See [Phase 2 Roadmap — Items 3 & 4](#-phase-2--next-release-roadmap).

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

> 🔮 **Phase 2 / Next Release — Per-API Onboarding Details:**
> The table above provides a high-level view. Phase 2 will add detailed per-API onboarding documentation including:
> - **Per-API metadata**: Owner contact, current version, backend system, SLA terms
> - **APIM product configuration**: Rate limits, quota, subscription approval mode per API
> - **Sandbox environment details**: URL, credentials, limitations, and who provides each sandbox
> - **Onboarding documentation**: Step-by-step guides for each of the 3 Phase 1 APIs (per appspec Month 1 exit criteria)
> - **OpenAPI spec source and hosting**: Where specs are maintained and how they are imported into APIM
> - **API category/tag assignments**: How each API is categorized and tagged in APIM
>
> See [Phase 2 Roadmap — Item 7](#-phase-2--next-release-roadmap).

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

All outbound HTTP calls from the BFF use the .NET Standard Resilience Handler, which provides:

| Pattern | Configuration |
|---------|---------------|
| **Automatic Retry** | Up to 3 attempts with exponential backoff (starting at 500 ms with jitter) |
| **Circuit Breaker** | Opens after repeated failures within a 60-second window (minimum 5 requests) — prevents cascading failures |
| **Per-Request Timeout** | 30 seconds per individual attempt |
| **Total Timeout** | 90 seconds across all retry attempts |
| **Telemetry Header** | `x-ms-apim-client` header automatically added to all APIM requests for traceability |

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

> 🔮 **Phase 2 / Next Release — AEM CMS Integration Architecture Details:**
> The content architecture above describes the high-level flow but lacks implementation-level detail. Phase 2 will add:
> - **AEM API endpoint contracts**: REST endpoint URLs, authentication mechanism (API key? OAuth?), and response schema for content retrieval and authoring
> - **`AemContentService` BFF class**: A new service implementation following the same pattern as `ArmApiService` / `DataApiService`, with IHttpClientFactory, resilience handler, and caching
> - **Content authoring workflow**: How business editors publish changes in AEM that the portal picks up — publish triggers, cache invalidation strategy
> - **Fallback strategy**: What happens when AEM is unavailable (serve cached content? static fallback pages?)
> - **Content model mapping**: AEM content types → BFF `ContentBlock` / `NewsArticle` DTOs
>
> See [Phase 2 Roadmap — Item 1](#-phase-2--next-release-roadmap).

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

> 🔮 **Phase 2 / Next Release — Multi-Language Scope & Translation Workflow:**
> The i18n infrastructure is in place (en + es locale files wired throughout all pages). Phase 2 will clarify:
> - **Language scope for MVP**: Confirm whether English + Spanish is sufficient, or if additional languages are needed for Phase 1
> - **AEM content localization**: How translated content blocks are delivered from AEM and keyed by locale
> - **API documentation localization**: Whether OpenAPI specs are locale-specific (from APIM) or translated via AEM overlays
> - **Translation handoff workflow**: How the external KNA translation team delivers new/updated locale files (Git PRs? translation management system?)
> - **RTL support**: Consideration for future right-to-left languages (if applicable)
>
> See [Phase 2 Roadmap — Item 5](#-phase-2--next-release-roadmap).

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

> 🔮 **Phase 2 / Next Release — SOC 2, GDPR & Compliance Details:**
> The security controls above address implementation patterns. Phase 2 will add governance-level compliance documentation:
> - **SOC 2 controls matrix**: Mapping SOC 2 Trust Service Criteria to specific portal controls (e.g., CC6.1 → JWT Bearer auth, CC7.2 → structured logging)
> - **GDPR data flow diagram**: What PII is collected, where it resides (Entra ID, Global Admin, AEM), who has access, retention period, and right-to-erasure handling
> - **PII encryption at rest**: Since the portal has no owned database, clarify which upstream systems store PII and confirm their encryption-at-rest guarantees
> - **TRA (Threat Risk Assessment)**: Add a TRA summary section or reference to the TRA deliverable (referenced in Month 3 exit criteria)
> - **Data classification**: Classify portal data as confidential, internal, or public
>
> See [Phase 2 Roadmap — Item 6](#-phase-2--next-release-roadmap).

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
│  │                                                               │  │
│  │  [Deployment Note: Current production uses nginx as a         │  │
│  │   reverse proxy layer (optional; can be removed)              │  │
│  │   by having BFF serve static files directly]                  │  │
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

Container Architecture (single image, three deployment options):

Option A: BFF Only (Recommended — leverages ACE routing)
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
  │    • No nginx, lighter footprint        │
  └─────────────────────────────────────────┘

Option B: Nginx + BFF (Current — separation of concerns)
  ┌─────────────────────────────────────────┐
  │  Dockerfile (multi-stage)               │
  │                                         │
  │  Stage 1: Build SPA (Node 20 + Vite)    │
  │  Stage 2: Build BFF (.NET 10 SDK)       │
  │  Stage 3: Runtime                       │
  │    • .NET 10 ASP.NET runtime            │
  │    • Nginx                              │
  │    • supervisord                        │
  │    • docker-entrypoint.sh               │
  │      (injects runtime-config.js)        │
  │    • Nginx: port 8080 → BFF :3001       │
  │    • More complex but cleaner layering  │
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
| SPA delivery | Nginx inside ACA container (static files) |
| Caching | IMemoryCache (in-process, 1-min TTL) |
| Recovery Time Objective (RTO) | < 1 hour |
| Recovery Point Objective (RPO) | Near-zero (no portal-owned DB) |

### **Observability**

| Capability | Tool | Details |
|-----------|------|---------|
| Distributed tracing | ACA built-in + ILogger | End-to-end: SPA → Nginx → BFF → APIM → Backend |
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

> 🔮 **Phase 2 / Next Release — WCAG Accessibility Audit Plan:**
> The accessibility targets above define the standard. Phase 2 will add a concrete audit plan:
> - **Automated CI checks**: Specify which CI stage runs axe-core, and the fail-on-violation severity threshold
> - **ARIA patterns for complex components**: Swagger UI embed (Try-It page), subscription multi-step flow, filter panels — these require custom ARIA handling
> - **Third-party embed accessibility**: Swagger UI / Redoc have known a11y gaps — document workarounds or alternative rendering approaches
> - **Manual audit timeline**: Schedule manual a11y testing before UAT and before production
> - **Remediation process**: How discovered accessibility issues are triaged, prioritized, and fixed
>
> See [Phase 2 Roadmap — Item 9](#-phase-2--next-release-roadmap).

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

## 🔮 **Phase 2 / Next Release Roadmap**

The following items were identified as gaps between the appspec requirements and the current design document. They are tracked here for the next release cycle.

### **Summary**

| # | Gap | Appspec Reference | Severity | Status |
|---|-----|-------------------|----------|--------|
| 1 | AEM CMS integration contracts & workflow | "Integration with AEM Content Authoring" | High | 🔲 Not Started |
| 2 | ServiceNow/ASK ticket integration | "Integration to centralized Service Delivery" | High | 🔲 Not Started |
| 3 | Registration approval queue & Global Admin provisioning | "Unregistered users to enter details for approval" | High | 🔲 Not Started |
| 4 | Automated welcome email | "Automated Welcome E-Mail with quick-start guide" | Medium | 🔲 Not Started |
| 5 | Multi-language scope & translation workflow | "Multi-language support" | Medium | 🔲 Not Started |
| 6 | SOC 2 / GDPR compliance details | "SOC 2 compliant, GDPR, PII encrypted" | High | 🔲 Not Started |
| 7 | Phase 1 API onboarding specs (per-API) | "3 existing APIs onboarded" | Medium | 🔲 Not Started |
| 8 | KX Member Network integration | "Accessible via KX Member Network" | Medium | 🔲 Not Started |
| 9 | WCAG accessibility audit plan | "WCAG-Compliant UI" | Medium | 🔲 Not Started |
| 10 | Operational runbook | "Runbook" in deliverables | High | 🔲 Not Started |

---

### **Item 1 — AEM CMS Integration Architecture Details**

**Appspec:** *"Dynamic content will be able to be updated dynamically and can be updated through a user interface (no hard coded changes). Integration with the AEM Content Authoring for dynamic content updates."*

**Current State:** High-level content architecture diagram and content type table exist. No implementation-level contracts.

**What to Add:**
- AEM API endpoint contracts (REST endpoints, authentication mechanism, response schema)
- `AemContentService` BFF class design — following the `ArmApiService` / `DataApiService` pattern with IHttpClientFactory, resilience handler, and caching
- Content authoring workflow: how business editors publish → BFF picks up changes (publish triggers, cache invalidation)
- Fallback strategy when AEM is unavailable (serve last-cached content? static fallback?)
- Content model mapping: AEM content types → BFF `ContentBlock` / `NewsArticle` DTOs

---

### **Item 2 — ServiceNow / ASK Ticket Integration**

**Appspec:** *"Integration to a centralized Service Delivery system for defect tracking tied to the portal. For phase 1, this will be either the ASK or Service Now systems."*

**Current State:** Listed in integration map; BFF endpoints marked as "placeholder."

**What to Add:**
- Decision: ASK or ServiceNow (or both) for Phase 1
- API contracts for ticket CRUD operations (create, list, get detail, update status)
- Authentication mechanism (how does BFF authenticate to ServiceNow/ASK?)
- Data model field mapping (portal `SupportTicket` ↔ ServiceNow Incident / ASK ticket)
- Error handling and retry strategy for ticket submission failures
- Replace placeholder `GET /api/support/**` and `POST /api/support/tickets` with real endpoint contracts

---

### **Item 3 — Registration Approval Queue & Global Admin Provisioning**

**Appspec:** *"A feature to allow unregistered users the ability to enter user details to provide to an approval team to onboard into Global Admin. This will follow the same process for all KX applications."*

**Current State:** Registration flow section exists but `POST /api/register` is marked "placeholder." Only `GET /users/{id}/roles` is documented for Global Admin API.

**What to Add:**
- Approval queue design: where pending registrations live (BFF-owned table? Global Admin queue?)
- Admin notification flow: how the approval team is notified of new requests
- Registration-to-role-assignment lifecycle: pending → approved → role assigned → welcome email
- Global Admin API contracts for user provisioning (beyond role lookup)
- Registration form field requirements (name, organization, role requested, contact info)
- Rejection / denial flow

---

### **Item 4 — Automated Welcome Email**

**Appspec:** *"Automated Welcome E-Mail with a quick-start guide."*

**Current State:** Missing entirely from the design document.

**What to Add:**
- Email delivery mechanism: SendGrid, Azure Communication Services, Office 365 SMTP, or Global Admin built-in?
- Email template design: subject line, body content, quick-start guide content/links
- Trigger point in the registration workflow: on approval? on first login?
- BFF service for email dispatch (or does Global Admin handle it?)
- Configuration: sender address, reply-to, branding

---

### **Item 5 — Multi-Language Scope & Translation Workflow**

**Appspec:** *"The portal will offer multi-language support."* and *"Non-English translations will be provided externally from KNA IT team."*

**Current State:** Partial — `react-i18next` with `en.json` / `es.json` wired throughout all SPA pages.

**What to Add:**
- Confirm which languages beyond English and Spanish are in scope for Phase 1
- AEM content localization strategy: how translated content blocks are delivered and keyed by locale
- API documentation localization: from APIM direct or translated via AEM overlays?
- Translation handoff workflow: how external translation team delivers locale files (Git PRs? TMS?)
- RTL support consideration for future languages

---

### **Item 6 — SOC 2, GDPR & Compliance Documentation**

**Appspec:** *"Soc 2 compliant"*, *"Comply with GDPR standards"*, *"PII data stored encrypted."*

**Current State:** Listed in security controls matrix but not detailed for governance review.

**What to Add:**
- **SOC 2**: Controls matrix mapping Trust Service Criteria to portal controls (CC6.1 → JWT Bearer auth, CC7.2 → structured logging, etc.)
- **GDPR**: Data flow diagram — what PII is collected, where stored, access controls, retention, right-to-erasure
- **PII encryption at rest**: Since portal has no database, clarify which upstream systems (Entra ID, Global Admin, AEM) hold PII and their encryption guarantees
- **TRA summary**: Add section or reference to the Threat Risk Assessment deliverable (Month 3 exit criteria)
- **Data classification**: Classify portal data as confidential, internal, or public

---

### **Item 7 — Phase 1 API Onboarding Specs (Per-API)**

**Appspec:** *"3 existing APIs onboarded"*, *"API metadata attached to each API such as owner, version, contact"*, *"An isolated sandbox area will be available for developers."*

**Current State:** Listed in a summary table with backend and category, but no per-API detail.

**What to Add:**
- Per-API metadata: owner contact, current version, backend system, SLA terms
- APIM product configuration per API: rate limits, quota, subscription approval mode
- Sandbox environment details per API: URL, credentials, limitations, provider
- Onboarding documentation per API (Month 1 exit criteria requires this)
- OpenAPI spec source and hosting method
- API category/tag assignments in APIM

---

### **Item 8 — KX Member Network Integration**

**Appspec:** *"Marketplace Portal will be accessible via direct link or via KX Member Network."*

**Current State:** Missing entirely from the design document.

**What to Add:**
- How the portal is linked/embedded from KX Member Network (iframe, deep link, menu integration?)
- SSO pass-through: does a user already authenticated in KX Member Network get seamless portal access?
- Shared Entra ID tenant or cross-tenant trust configuration
- Navigation: back-link from portal to KX Member Network

---

### **Item 9 — WCAG Accessibility Audit Plan**

**Appspec:** *"On-Brand, WCAG-Compliant UI."*

**Current State:** Brief section listing targets (WCAG 2.1 AA, axe-core, Playwright, keyboard, screen reader, contrast).

**What to Add:**
- Concrete accessibility testing plan (automated CI checks + manual testing schedule)
- axe-core CI integration specifics: which stage, fail-on-violation threshold
- ARIA patterns for complex components: Swagger UI embed, subscription multi-step flow, filter panels
- Accessibility testing for third-party embeds (Swagger UI/Redoc known a11y gaps)
- Manual audit timeline (before UAT, before production)
- Remediation process for discovered issues

---

### **Item 10 — Operational Runbook**

**Appspec (Deliverables):** *"Runbook"*, *"Full system architecture diagrams and documentation needed for an Application Management Services (AMS) team to support."*

**Current State:** Missing entirely from the design document.

**What to Add:**
- Incident response procedures: severity definitions, escalation path, contacts
- Deployment and rollback procedures: how to deploy a new version, how to roll back
- Health check and monitoring dashboard guide: which Azure Monitor dashboards to watch, alert meanings
- Common troubleshooting scenarios: BFF → APIM connectivity, MSAL token failures, AEM content not updating, container restart loops
- Scheduled maintenance: certificate rotation, secret rotation, dependency updates
- AMS knowledge transfer checklist (Month 4.5 deliverables)

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

### **Phase 2 / Next Release Priorities**
- 🔮 **High**: AEM integration contracts, ServiceNow/ASK integration, registration approval queue, SOC 2/GDPR compliance details, operational runbook
- 🔮 **Medium**: Welcome email, multi-language workflow, per-API onboarding specs, KX Member Network access, WCAG audit plan

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
| **Nginx** | Optional HTTP reverse proxy — serves SPA static files and routes `/api/*` to BFF; can be replaced by BFF serving static files directly via ACE |
| **supervisord** | Process manager — runs Nginx + .NET BFF inside a single container |
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
| 6 | Optional Nginx layer | Nginx can wrap BFF for separation of concerns (current production); can be removed to let BFF serve files directly, leveraging ACE's built-in routing | Mar 2026 |
| 7 | Bicep over Terraform for IaC | KNA IT preference (per appspec), first-party Azure support | Mar 2026 |
| 8 | AddStandardResilienceHandler over custom Polly | Built-in retry, circuit breaker, timeout with sensible defaults; less code to maintain | Mar 2026 |
| 9 | MSAL.js PCA (SPA token auth) over BFF cookie auth | Simpler implementation; no server-side session storage; supports multi-tenant (workforce + CIAM) | Mar 2026 |
| 10 | ARM + Data API dual-mode over SDK only | ARM API for design-time management data; Data API available as lightweight alternative | Mar 2026 |
| 11 | ACE provides external routing / TLS termination | Removes need for Nginx as ingress proxy; BFF or Nginx+BFF both valid inside container; ACE handles port 8080 edge | Mar 2026 |

### **D. References**

- Komatsu API Marketplace Appspec (KNA Project #802)
- API Marketplace Story Mapping (Microsoft Whiteboard)
- [Microsoft BFF Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends)
- [Microsoft.Identity.Web](https://learn.microsoft.com/en-us/entra/msal/dotnet/)
- [MSAL.js for React](https://learn.microsoft.com/en-us/entra/msal/javascript/)
- [Azure APIM REST API](https://learn.microsoft.com/en-us/rest/api/apimanagement/)
- [Azure APIM Data API](https://learn.microsoft.com/en-us/azure/api-management/developer-portal-alternative-overview)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/overview)
- [Microsoft.Extensions.Http.Resilience](https://learn.microsoft.com/en-us/dotnet/core/resilience/)
- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)

---

*Document prepared for KNA Enterprise Architecture Review Board (EARB) and KNA IT stakeholders.*
*Phase 2 / Next Release annotations added March 2026 — sourced from appspec cross-reference gap analysis.*
