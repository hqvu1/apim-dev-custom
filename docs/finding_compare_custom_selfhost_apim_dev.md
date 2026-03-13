# DAPIM Custom SPA+BFF vs. Self-Hosted APIM Developer Portal

> **Date**: March 13, 2026
> **Source**: Architectural comparison of `kx-apim-marketplace-custom` (Custom SPA+BFF design) vs. `api-management-developer-portal` (Microsoft OSS self-hosted APIM portal)
> **Business Requirements**: `appspec.txt` (KNA Project #802), API Marketplace Story Mapping whiteboard, `DESIGN_DOCUMENT.md`

---

## 1. What Each Approach Is

| | **Custom SPA + BFF** (current design) | **Self-Hosted APIM Dev Portal** (api-management-developer-portal repo) |
|---|---|---|
| **Origin** | Ground-up Komatsu build: React 19 + Vite + .NET 10 BFF | Microsoft OSS fork (MIT): Paperbits CMS + Knockout.js + Webpack |
| **Content model** | SPA pages in code; dynamic content from AEM CMS via BFF | Built-in visual page designer (Paperbits); content stored inside APIM backend |
| **API metadata source** | BFF fetches from APIM Management SDK, shapes responses | Runtime JS fetches directly from APIM Management API (CORS) |
| **Hosting** | Azure Static Web App (SPA) + Azure Container App (BFF) | Static publish to CDN, or SPA-mode on App Service / Container |

---

## 2. Business Requirements Coverage

| appspec.txt Requirement | Custom SPA+BFF | Self-Hosted APIM Portal | Verdict |
|---|---|---|---|
| **Komatsu-branded UI (design standards)** | Full control — uses `@komatsu-nagm/component-library` + MUI 7 + Figma-matched theme | Custom CSS/SCSS theming on Paperbits widgets; limited — can't swap MUI in without rewriting view layer | **Custom wins** |
| **No anonymous access** | `PrivateRoute` + MSAL guard + BFF `FallbackPolicy` | Built-in auth gate, but anonymous pages are the default — must reconfigure every page/widget | **Custom wins** |
| **Global Admin RBAC (Admin/Distributor/Vendor/Customer)** | BFF queries Global Admin API by RID, caches roles, injects as claims, enforces per-endpoint | No Global Admin integration. Only 3 static roles (`everyone`, `anonymous`, `authenticated`). Would need a custom `RoleService` + major plumbing | **Custom wins decisively** |
| **Entra ID dual-tenant (workforce + CIAM)** | Fully implemented: `getMsalConfig(tenantId)`, KPS tenant selector, dual auth scheme in BFF | Has AAD sign-in via MSAL, but single-tenant only. No CIAM tenant switching, no KPS integration | **Custom wins** |
| **API catalog (browse by category, search, filters)** | Planned: SPA catalog page + BFF aggregation from APIM | **Built-in**: API list widget, tiles, dropdown, Lunr.js full-text search | **APIM Portal wins** (ready now) |
| **Try-It / Swagger console** | Planned: YARP reverse proxy + sandbox via BFF (keys stay server-side) | **Built-in**: Interactive console with auth flow detection, code snippets, GraphQL support | **APIM Portal wins** (ready now) |
| **Subscription management (keys, credentials)** | Planned: BFF manages APIM subscriptions via Management SDK, never exposes keys to browser | **Built-in**: User self-service subscription with key display (keys **are** shown in browser) | **Custom wins** on security; APIM Portal wins on time-to-market |
| **APIM keys never in browser** | Yes — BFF holds all subscription keys server-side | No — portal shows subscription keys directly to the user in the browser | **Custom wins** (security requirement) |
| **AEM CMS integration** | Designed: BFF routes `/api/content` → AEM | Not supported. Content lives only in APIM. No external CMS connector | **Custom wins** |
| **ServiceNow / ASK support tickets** | Designed: BFF routes `/api/support` → ServiceNow | Not built-in. Would need a custom widget from scratch | **Custom wins** |
| **Multi-language / i18n** | Designed: `react-i18next`, `SideNav` already uses translation keys | No built-in i18n framework. All widget text is hardcoded. Would need to wrap every component | **Custom wins** |
| **News & Announcements** | Planned: SPA page + AEM CMS content | Not built-in. A custom widget would be needed | **Custom wins** (AEM integration) |
| **Use cases per API** | Planned: SPA detail page + AEM CMS | Not built-in — a custom widget is needed | **Custom wins** |
| **Registration / onboarding** | Designed: BFF detects no role → shows form → Global Admin approval queue → welcome email | Built-in basic registration (username/email). No approval workflow. No Global Admin integration | **Custom wins** |
| **Mobile-responsive UI** | Guaranteed — MUI 7 + React responsive primitives | Paperbits templates are responsive, but custom widgets need manual responsive work | **Roughly equal** |
| **SOC 2 / GDPR / WCAG** | Under control — can enforce per the BFF audit logging, PII encryption, accessibility via MUI | Hosting is your responsibility. No GDPR consent UI. WCAG depends on widget quality | **Custom easier to control** |
| **Cost plan / pricing display** | Planned: SPA section | Not built-in — custom widget needed | **Custom wins** |
| **Admin console (content mgmt, user mgmt, analytics)** | Planned: SPA `/admin` routes | Has a built-in **Designer** (page builder) — great for content, but no user/role management or business analytics | **APIM Portal wins** for content editing; **Custom wins** for user/role/analytics admin |
| **3 APIs onboarded (SAP, Parts Punchout, Equipment)** | BFF fetches from APIM — APIs must be published in APIM first | Same prerequisite — portal pulls from APIM. But catalog display is **ready now** | **Equal** (both depend on APIM) |

---

## 3. Architecture Trade-offs

| Dimension | Custom SPA+BFF | Self-Hosted APIM Portal |
|---|---|---|
| **Time to first demo** | Slower — catalog/try-it pages still TBD | Faster — out-of-box API catalog + try-it console work immediately |
| **Time to production** | Longer up-front; but every feature is purpose-built for Komatsu requirements | Faster if requirements are generic; **much slower** if you need Global Admin, AEM, ServiceNow, CIAM, i18n |
| **Maintainability** | React 19 + .NET 10 — mainstream, well-understood, strong hiring pool | Paperbits CMS + Knockout.js — niche framework, limited community, steep learning curve |
| **Upgrade path** | You own the code; upgrade React/Vite/.NET independently | Tied to Microsoft's APIM portal releases. Custom widgets may break on major updates |
| **Security posture** | BFF pattern: no secrets/keys in browser, centralized audit, server-side RBAC | No BFF: APIM keys shown in browser, auth tokens in sessionStorage, CORS to APIM Management API |
| **Custom widget effort** | Standard React components — any developer can contribute | Paperbits + Knockout.js + InversifyJS DI — significant learning curve, design/runtime split per widget |
| **Bundle size** | SPA ~200-400KB (Vite tree-shaking) | ~2MB minified (full Paperbits + Knockout + Fluent UI + Monaco) |
| **Testing story** | Vitest + Testing Library + Playwright — standard React ecosystem | Mocha + Chai — functional but less ergonomic; no component-level testing story |

---

## 4. What the APIM Portal Does Better (and what you'd lose by not using it)

1. **Instant API catalog UI** — The portal renders APIM APIs with zero frontend code. Categories, search (Lunr.js), versioning are ready.
2. **Interactive API console** — The "Try It" widget supports OAuth 2.0 flows, multiple auth schemes, code snippet generation, and GraphQL — all built-in.
3. **Visual page builder** — The Paperbits designer lets admins create/edit pages without deploying code.
4. **Subscription self-service** — Users can subscribe to products and manage API keys without admin intervention.

---

## 5. Where the APIM Portal Falls Short Against appspec.txt

| Gap | Severity | Why It Matters |
|---|---|---|
| **No Global Admin RBAC** | **Blocker** | appspec.txt requires Global Admin auth framework. Portal only has 3 static roles. You'd need to build a custom `RoleService`, extend the auth pipeline, and wire delegation — effectively building half a BFF anyway |
| **No AEM CMS integration** | **High** | appspec.txt requires "dynamic content updated through AEM Content Authoring." Portal content lives inside APIM — no external CMS connector exists |
| **No ServiceNow / ASK integration** | **High** | appspec.txt requires "integration to centralized Service Delivery system." Portal has no support ticket widget or service connector |
| **No multi-language (i18n)** | **High** | appspec.txt requires "multi-language support." Portal has no i18n framework — every widget would need manual wrapping |
| **APIM keys exposed to browser** | **High** | appspec.txt says "credentials encrypted at rest and in transit" and design says "No APIM keys in browser." Portal shows subscription keys directly in the UI |
| **No CIAM tenant switching** | **Medium** | appspec.txt supports external partners via CIAM. Portal supports AAD but not dual-tenant with KPS orchestration |
| **No Komatsu component library** | **Medium** | appspec.txt requires Komatsu design standards. Portal uses Fluent UI — reskinning to match `@komatsu-nagm/component-library` would mean rewriting the view layer |
| **Knockout.js / Paperbits tech stack** | **Medium** | Niche framework with limited community. Komatsu team expertise is React/TypeScript — maintenance burden is higher |

---

## 6. Hybrid Option: Could You Use Both?

In theory, you could use the self-hosted portal for the **API catalog + try-it console** and the custom SPA+BFF for **everything else** (auth, admin, support, AEM content). In practice:

- **Two separate apps** with different auth systems, frameworks, and hosting — doubles operational complexity
- **Inconsistent UX** — Paperbits widgets look and behave differently from MUI/Komatsu component library
- **Auth friction** — Users would need to authenticate twice (MSAL in custom SPA, APIM portal auth), or you'd build SSO delegation — more plumbing

**Verdict**: A hybrid approach is architecturally awkward and would likely cost more than building the catalog/try-it features natively in the custom SPA (especially since the `src/api/` layer with `useApiService`, `useProductService`, and `useMapiClient` hooks already exists in the codebase).

---

## 7. Self-Hosted APIM Portal — Technical Deep Dive

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| CMS Framework | Paperbits | 0.1.661 |
| Views | Knockout.js + React bridge | 3.5.1 / 18.2.0 |
| Bundler | Webpack | 5.88.2 |
| Language | TypeScript | 4.9.5 |
| Auth | @azure/msal-browser | 2.37.1+ |
| UI Libraries | Fluent UI, Monaco Editor | 8.x / 0.29.1 |
| Node Runtime | Node.js | 18–22 |

### Three-Tier Module System

1. **ApimDesignModule** — Designer/CMS editor interface (drag-and-drop page builder, content management)
2. **ApimRuntimeModule** — Runtime user-facing portal (~50 Knockout.js view-model-bound components)
3. **ApimPublishModule** — Static site generator (converts portal to static HTML for CDN hosting)

### Built-in Features

- **API catalog**: List, tiles, dropdown views + Lunr.js full-text search
- **Interactive console**: Try-It with OAuth 2.0 flow detection, code snippets, GraphQL support
- **User system**: Local auth, AAD, AAD B2C, OAuth 2.0, registration, profile management
- **Subscriptions**: Product subscription, key management, approval workflows
- **Analytics**: D3.js usage charts, Application Insights telemetry
- **Content**: Markdown rendering, syntax highlighting (Prism.js), terms-of-use acceptance

### Authentication Model

- **Built-in authenticators**: DefaultAuthenticator (cookies + sessionStorage), SsoAuthenticator (SAS token), ArmAuthenticator (designer), StaticAuthenticator
- **Identity providers**: Local, Azure AD (MSAL v2), Azure AD B2C, OAuth 2.0 delegation
- **Token format**: `SharedAccessSignature` (APIM-specific) or Bearer
- **Roles**: Only 3 static roles — `everyone`, `anonymous`, `authenticated`
- **Limitations**: No Global Admin role lookup, no group-based RBAC, no app role parsing from JWT, no CIAM dual-tenant

### Hosting Options

| Scenario | Approach |
|----------|---------|
| High traffic, global | Static publishing → Azure CDN |
| Single region, frequent admin changes | SPA mode → App Service |
| Containerized | Docker → AKS / Container Apps |
| Tight APIM coupling | SPA mode (faster auth/data refresh) |

---

## 8. Recommendation

**Stick with the Custom SPA + BFF design.** The business requirements in appspec.txt go significantly beyond what the self-hosted APIM portal provides:

- Global Admin RBAC, AEM CMS, ServiceNow/ASK, i18n, CIAM dual-tenant, and the "no keys in browser" security requirement are all **blockers** that the APIM portal doesn't address.
- The APIM portal's strengths (instant catalog, try-it console, subscription management) are features that the custom SPA already has infrastructure for (`src/api/` hooks, YARP proxy design, BFF subscription endpoints).
- The custom SPA's React 19 + MUI 7 + .NET 10 stack matches Komatsu's team skillset and the `@komatsu-nagm/component-library` design system. The Paperbits/Knockout.js stack would introduce a learning curve with minimal community support.

**The APIM portal is a great accelerator for organizations with standard API catalog needs.** Komatsu's requirements — enterprise RBAC, external CMS, multi-language, custom design system, service desk integration — push it well beyond what the portal was designed for. The custom build is the right architectural choice.

---

## Abbreviations

| Abbreviation | Full Term |
|---|---|
| **AEM** | Adobe Experience Manager (Content Management System) |
| **APIM** | Azure API Management |
| **BFF** | Backend-for-Frontend |
| **CDN** | Content Delivery Network |
| **CIAM** | Customer Identity and Access Management (Entra External ID) |
| **CORS** | Cross-Origin Resource Sharing |
| **DAPIM** | Developer API Marketplace (Komatsu's API Portal project) |
| **KPS** | Komatsu Portal Services (tenant selection / SSO orchestrator) |
| **MUI** | Material UI (React component library) |
| **MSAL** | Microsoft Authentication Library |
| **OSS** | Open-Source Software |
| **RBAC** | Role-Based Access Control |
| **RID** | Resource Identifier (user object ID) |
| **SPA** | Single-Page Application |
| **YARP** | Yet Another Reverse Proxy (.NET reverse proxy library) |
