## Appendix C: Authentication & Authorization Comparison — DAPIM vs. Member Network

> Captured from initial comparative analysis on March 12, 2026.

### C.1 Tenant Selection & KPS Integration

| Aspect | DAPIM Frontend | MN Frontend |
|--------|---------------|-------------|
| Tenant selection UI | KPS hosted at `login-uat.komatsu.com/spa` — launched via `initiateLogin()` | Same KPS at `login-uat.komatsu.com/spa` — launched via `initiateLogin()` |
| Tenant ID passback | KPS redirects back with `tenantId` query param | Same mechanism |
| Dual-tenant support | Workforce (`login.microsoftonline.com`) + CIAM (`ciamlogin.com`) | Same dual-tenant pattern |
| MSAL config factory | `getMsalConfig(tenantId)` returns `Configuration` per tenant | `getMsalConfig(tenantId)` returns `Configuration` per tenant |
| Startup sequence | `initiateLogin()` → KPS → `tenantId` → `getMsalConfig()` → `PublicClientApplication` → React render | `initiateLogin()` → KPS → `tenantId` → `getMsalConfig()` → `PublicClientApplication` → React render |

**Verdict**: Nearly identical. DAPIM's `initiateLogin.ts` is a TypeScript port of MN's `initiateLogin.js`.

---

### C.2 MSAL Configuration

| Setting | DAPIM (`msalConfig.ts`) | MN (`msalConfig.js`) |
|---------|------------------------|---------------------|
| `@azure/msal-browser` | ^3.18.1 | (via `@azure/msal-react` ^3.0.6) |
| `@azure/msal-react` | ^2.2.0 | ^3.0.6 |
| `cacheLocation` | `localStorage` (**⚠️ should be `sessionStorage`**) | `localStorage` (**⚠️ same issue**) |
| Login scopes | `VITE_LOGIN_SCOPES` (falls back to `User.Read`) | Hardcoded `User.Read` |
| CIAM host | `VITE_CIAM_HOST` env var | Hardcoded `kltdexternaliddev.ciamlogin.com` |
| Workforce tenant | `VITE_WORKFORCE_TENANT_ID` env var | Hardcoded tenant ID |
| CIAM tenant | `VITE_EXTERNAL_TENANT_ID` env var | Hardcoded tenant ID |
| Auth method | `loginRedirect` | `loginRedirect` |

**Verdict**: DAPIM uses environment variables (better for multi-env deployment). MN hardcodes values. Both share the `localStorage` gap.

---

### C.3 Token Type Used for API Calls (Critical Difference)

| Aspect | DAPIM | MN |
|--------|-------|----|
| Token sent to BFF | **Access token** (intended — `getAccessToken()` calls `acquireTokenSilent`) | **ID token** (`acquireUser()` returns `idToken` from `acquireTokenSilent` response) |
| Bearer header injection | ❌ **Missing** — `apiClient.ts` does not attach any token | ✅ `getApi.js` / `postApi.js` / `patchApi.js` all set `Authorization: Bearer ${idToken}` |
| Token audience | `api://<bff-client-id>/Portal.Access` (planned) | Entra ID app (ID token audience = client ID) |

**Verdict**: DAPIM's design is more correct (access tokens are meant for API authorization), but the implementation is incomplete. MN uses ID tokens as bearer tokens — functional but non-standard.

---

### C.4 Role & Permission Models (Major Architectural Difference)

| Aspect | DAPIM | MN |
|--------|-------|----|
| Role source (frontend) | `idTokenClaims.roles` + `idTokenClaims.groups` (Entra ID token claims) | Server-fetched via `GET /api/user/profile` → Integration Services → Global Admin |
| Role storage (frontend) | `AuthContext` (React context via `AuthProvider.tsx`) | `UserContext` (React context via `Authorization.jsx`) |
| Role types | `Distributor`, `Vendor`, `Customer`, `Admin` | `UserType` + `Role` (e.g., Employee/KomatsuAdmin, Distributor/DealerUser) |
| Feature claims | ❌ Not implemented | ✅ Fine-grained claims from Global Admin (e.g., `VIEW_ADMIN_CONSOLE_PAGE`, `VIEW_SHOPPING_CART_DRW`) |
| Claim checking (frontend) | `RoleGate` — checks role names only | `RequireClaim` component + `hasClaim()` utility — checks individual feature claims |
| BFF role enforcement | `rbac-policies.json` maps policies (e.g., `ApiRead`) to allowed roles | `EnforceRolePermissionAttribute` (UserType+Role) + `EnforceClaimPermissionAttribute` (feature claims) |

**Verdict**: MN has a mature, Global-Admin-backed permission model. DAPIM currently relies only on Entra ID token claims — it needs to adopt the Global Admin integration to match MN's fine-grained authorization.

---

### C.5 Route Protection

| Aspect | DAPIM | MN |
|--------|-------|----|
| Auth guard | `PrivateRoute` wraps all routes (uses `useMsalLogin` hook) | `PrivateRoute` wraps all routes (MSALAuthenticationTemplate-based) |
| Role-based routing | `RoleGate` component hides UI elements per role | `RequireClaim` component hides UI elements per claim |
| Unauthorized view | `AccessDenied` page | Redirect or hidden elements |
| Route-level auth | All routes require authentication (no public routes) | Same — no anonymous access |

---

### C.6 Logout Orchestration

| Aspect | DAPIM | MN |
|--------|-------|----|
| Logout trigger | `useLogout` hook → `instance.logoutRedirect()` | `useLogout` hook → `instance.logoutRedirect()` |
| Cross-tab sync | `BroadcastChannel('mn-auth')` + `SsoLogoutHandler` | `BroadcastChannel('mn-auth')` + `SsoLogoutHandler` |
| KPS session clear | Redirects to `login-uat.komatsu.com/spa?clear=true` | Same redirect pattern |
| Post-logout redirect | Back to SPA origin | Back to SPA origin |
| Passive SLO | ❌ Not implemented | ✅ `PassiveSloGuard` polls for Entra session loss |
| Session cookie watcher | ❌ Not implemented | ✅ `useSessionCookieWatcher` detects cookie expiry |

**Verdict**: DAPIM has the core logout flow. MN adds passive SLO detection (nice-to-have, not critical for MVP).

---

### C.7 Auth Flow Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    SHARED (both apps)                         │
│  User → KPS (tenant selection) → tenantId                    │
│  tenantId → getMsalConfig() → MSAL PublicClientApplication   │
│  MSAL → loginRedirect → Entra ID → tokens                   │
│  BroadcastChannel('mn-auth') for cross-tab logout            │
└──────────────────────────────────────────────────────────────┘

┌─── DAPIM ─────────────────────┐  ┌─── MN ─────────────────────────┐
│ Token: access_token (planned) │  │ Token: id_token (non-standard) │
│ Roles: Entra ID claims only   │  │ Roles: Global Admin server     │
│ Claims: ❌ none               │  │ Claims: ✅ fine-grained         │
│ BFF auth: JWT Bearer          │  │ BFF auth: Custom EntraToken    │
│   + rbac-policies.json        │  │   handler + Redis + jti blackl │
│ Profile: stubbed /users/me    │  │ Profile: /api/user/profile     │
│   → calls GlobalAdmin roles   │  │   → calls Integration Services │
└───────────────────────────────┘  └─────────────────────────────────┘
```

---

### C.8 Key Takeaways

1. **Auth bootstrap is identical** — both apps use KPS → MSAL → loginRedirect with the same dual-tenant pattern.
2. **Token type diverges** — DAPIM plans to use access tokens (correct), MN uses ID tokens (works but non-standard). DAPIM's `apiClient.ts` Bearer injection is not yet implemented.
3. **Role/permission model is the biggest gap** — DAPIM relies on Entra ID token claims; MN fetches rich permissions from Global Admin via the BFF. DAPIM must integrate with Global Admin to get feature-level claims.
4. **BFF auth architecture differs** — DAPIM uses `Microsoft.Identity.Web` + Minimal API policies (modern); MN uses a custom `EntraTokenHandler` + Controller attributes (mature but coupled). DAPIM's approach is better for new development.
5. **Logout is mostly ported** — core flow works; passive SLO and session cookie watching are MN extras not critical for MVP.
6. **`localStorage` → `sessionStorage`** — both apps have this security gap. Fix in DAPIM first as part of Sprint 0.
```
┌──────────────────────────────────────────────────────────────────┐
│  DAPIM BFF (keep Minimal API on .NET 10)                         │
│                                                                  │
│  ALREADY DONE:                          PORT FROM MN:            │
│  ├─ JWT Bearer auth                    ├─ Integration Services   │
│  ├─ Dual-tenant (CIAM + Workforce)     │   HTTP client (UserAccess)│
│  ├─ ClaimsEnrichmentMiddleware         ├─ UserInfoResponse model │
│  ├─ GlobalAdminRoleProvider (shell)    ├─ Permissions parsing    │
│  ├─ RBAC policies (rbac-policies.json) │   (filter by app name)  │
│  ├─ SecurityHeadersMiddleware          ├─ OIDC key validation    │
│  ├─ 13 endpoint groups                 ├─ Token blacklist (Redis)│
│  └─ Mock/Data/ARM service modes        └─ Resilience policies    │
└──────────────────────────────────────────────────────────────────┘
```
 The Global Admin integration pattern ports trivially to Minimal API.
What DAPIM needs from MN is the auth pipeline, not the API style. The key pieces to port are:
```
EnforceClaimPermissionAttribute	Can be added as .RequireAuthorization("PolicyName") on route groups
UserAccess (HTTP client to Integration Services)	Needs porting — the HTTP call to GET /integ-api/user-details?email={email}
Token blacklist (Redis jti check)	Not yet implemented — add when Redis is available
```
5. The only meaningful gap is the Global Admin HTTP client.
The kx-apim-dev-custom BFF has a GlobalAdminRoleProvider that already fetches roles and caches them for 30 minutes. What needs to happen:

Wire it to the real Integration Services endpoint (same URL pattern MN uses: GET /integ-api/user-details?email={email})
Parse the UserInfoResponse to extract Permissions[].ClaimList where ApplicationName = "API Marketplace" (instead of "Member Network")
Add the claims to the request principal via the existing ClaimsEnrichmentMiddleware
This is a configuration change + one service implementation, not an architectural rewrite.

What to port from MN (and what to skip)
Port these patterns:

Token validation via OIDC discovery keys (MN's TokenService approach) — improves on the current static key resolver
The UserInfoResponse model and permissions parsing logic
Token blacklisting on logout (when Redis is added)
The Integration Services HTTP client with retry/timeout policies

Summary
Bottom line: Stick with Minimal API. The DAPIM BFF's architecture is already sound — it just needs the real Global Admin HTTP client wired in, following the same UserAccess → Integration Services pattern that MN uses. The API style (Minimal vs. Controller) is orthogonal to that integration.

---

## Appendix D: Architectural Review of GLOBAL_ADMIN_PORTING_GUIDE.md

> **Reviewer**: Software Architect review — March 12, 2026
> **Source document**: `docs/GLOBAL_ADMIN_PORTING_GUIDE.md`
> **Scope**: Evaluate correctness, risks, and completeness of the porting plan

---

### D.1 Overall Assessment

The guide is **well-structured and thorough** — the gap analysis, phase dependencies, file mapping, and testing checklist are all solid. The decision to keep Minimal API is correct. However, there are several concerns ranging from architectural correctness to missing scope items that should be addressed before implementation begins.

---

### D.2 CRITICAL: `id_token` vs `access_token` — Don't Copy MN's Anti-Pattern

The MN frontend sends **`id_token`** to the BFF (`Authorization: Bearer ${idToken}` in `getApi.js`). This is non-standard — `id_token` is for the client, `access_token` is for the resource server. MN works around this with a custom `EntraTokenHandler` that manually validates the JWT.

**DAPIM already does this correctly** — `Microsoft.Identity.Web` validates `access_token` with proper audience, issuer, and OIDC key resolution. The SPA's `getAccessToken()` acquires an access token scoped to `api://<bff-app-id>/Portal.Access`.

**Recommendation**: The guide's Section 1.3 should explicitly call out that DAPIM must **NOT** adopt MN's `id_token` pattern. Phase 6 mentions using `getAccessToken()` but should state this as a deliberate architectural divergence from MN, not just an implementation detail. Add a decision record:

> **ADR**: DAPIM uses `access_token` (standard OAuth2) for BFF calls, unlike MN which uses `id_token`. This means `EntraTokenHandler` and `TokenService` from MN are **not ported** — `Microsoft.Identity.Web` handles this correctly.

---

### D.3 CRITICAL: Phase 4 — `RequireClaim` Won't Work for Comma-Separated Claims

The guide proposes:
```csharp
options.AddPolicy("RequireViewApiCatalog", policy =>
    policy.RequireClaim("portal:claims", "VIEW_API_CATALOG"));
```

This does **exact string match** on the claim value. If `portal:claims` is `"VIEW_API_CATALOG,TRY_API,VIEW_SUBSCRIPTIONS"`, it won't match `"VIEW_API_CATALOG"`.

The guide mentions a custom `IAuthorizationHandler` as an "alternative" — it should be the **primary recommendation**. The `RequireClaim` approach should be removed to avoid confusion.

**Recommendation**: Promote the `PortalClaimRequirement` + `PortalClaimHandler` pattern as the only approach. Or better — instead of storing claims as a single comma-separated string, add **one claim per feature** during enrichment:

```csharp
// In ClaimsEnricher (Phase 3) — split ClaimList into individual claims
foreach (var claim in permission.ClaimList.Split(',', StringSplitOptions.TrimEntries))
{
    identity.AddClaim(new Claim("portal:feature", claim));
}
```

Then `RequireClaim("portal:feature", "VIEW_API_CATALOG")` works natively with ASP.NET Core. This is cleaner and lets you use standard `RequireAssertion` with OR-logic when needed.

---

### D.4 HIGH: Phase Ordering — Bearer Header Fix Should Be Phase 0

The guide correctly identifies that `apiClient.ts` is missing the `Authorization: Bearer` header (copilot-instructions.md calls this out). But this is buried in Phase 6, which depends on Phase 5.

**The SPA cannot make any authenticated BFF call without a Bearer header.** This blocks development of every phase on the backend, because you can't integration-test without the SPA sending tokens.

**Recommendation**: Extract the Bearer header fix into **Phase 0** (or create a "Phase 0.5: SPA Plumbing"). It's a 5-line change to `apiClient.ts` and enables all subsequent integration testing.

---

### D.5 HIGH: Service-to-Service Auth for Integration Services API

The MN backend uses **client credentials flow** (ISS token) to call Global Admin:
- `TokenService.GetISSTokenAsync()` posts to `/{tenantId}/oauth2/v2.0/token` with `client_id`, `client_secret`, `scope`
- The resulting access token is sent as `Authorization: Bearer {iss-token}` to Integration Services

The DAPIM BFF currently uses **APIM subscription key** (`Ocp-Apim-Subscription-Key` header) for its Global Admin calls.

The guide's Phase 2 says to align with MN's endpoint (`GET /integ-api/user-details?email={email}`) but doesn't clarify which auth method to use for the service-to-service call. The config reference still shows `"ApiKey": ""` (subscription key pattern).

**Recommendation**: Determine which auth mechanism the Integration Services API actually requires:
- If it's behind APIM with subscription key → keep the current `Ocp-Apim-Subscription-Key` pattern (simpler)
- If it requires OAuth2 client credentials → port the ISS token pattern from MN's `TokenService`
- Add this as a **blocking question** in the risk register, not just a "clarify" note

---

### D.6 MEDIUM: KPS (Tenant Selection) Is Not Addressed

The MN frontend has a **pre-MSAL step**: `initiateLogin()` redirects to KPS (`login-uat.komatsu.com/spa`) to select the tenant before MSAL login. This is how the dual-tenant scheme works in practice — the user first lands at KPS, KPS sets `tenantId` in the redirect URL, and then MSAL uses the appropriate authority.

The DAPIM marketplace SPA's `msalConfig.ts` has `TENANT_DETAILS` for both workforce and CIAM, but the guide doesn't mention how tenant selection happens. Does DAPIM need KPS integration, or is it workforce-only for now?

**Recommendation**: Add a section or FAQ item:
> **Q**: Does DAPIM require KPS for tenant selection?
> **A**: [Decision needed] If DAPIM supports both workforce and CIAM tenants, a tenant selection mechanism is required before MSAL login. Options: (a) Port KPS redirect from MN, (b) Use a local tenant selector in the SPA, (c) Default to workforce for MVP.

---

### D.7 MEDIUM: Fail-Open vs Fail-Closed — Check the Direction

The guide's Phase 3 testing checklist says:
> - Failed enrichment in Production → proceeds without claims (**fail-open**)
> - Failed enrichment in Development → throws (**fail-closed**)

This is **backwards for security**. In production, if claims enrichment fails, a user request should be denied (fail-closed) because no roles = no permissions = RBAC handler denies access. In development, fail-open is useful for local testing without the Integration Services API.

**Corrected checklist item**:
> - Failed enrichment in **Production** → proceeds without claims → RBAC **denies** access (effectively fail-closed via RBAC)
> - Failed enrichment in **Development** → logs warning, proceeds (fail-open for local dev)

If the intent is that the middleware itself doesn't block but RBAC downstream does, document that explicitly. The current wording in the checklist is misleading.

---

### D.8 MEDIUM: `IClaimsTransformation` vs Custom Middleware

MN uses `IClaimsTransformation` (the standard ASP.NET Core hook that runs after authentication). DAPIM uses a custom `ClaimsEnrichmentMiddleware`.

Both work, but `IClaimsTransformation` has a known behavior: it runs on **every request** after auth, including for already-enriched identities (can cause duplicate claims if not guarded). The custom middleware approach gives more control over execution conditions.

**The current approach is fine** — just ensure the middleware checks `context.User.Identity?.IsAuthenticated == true` and skips if claims are already enriched (check for `portal:userId` claim existence).

---

### D.9 LOW: Email Stability Concern

MN looks up users by **email**. Email can change (marriage, alias change, etc.), and some Entra ID tenants may not populate the email claim consistently. The DAPIM BFF currently uses **oid** (object ID), which is immutable.

**Recommendation**: If the Integration Services API supports lookup by OID, prefer it. If email is the only option, document this as a known limitation and ensure the `preferred_username` or `email` claim extraction is robust (fall back to `upn` if `email` is absent).

---

### D.10 LOW: Missing Items for Completeness

| Item | Concern |
|------|---------|
| **Logout flow** | MN supports front-channel logout + token blacklisting. The guide addresses blacklisting (Phase 7) but not the SPA-side logout redirect or MSAL `logoutRedirect`. |
| **OneTrust** | MN has OneTrust known-user integration. Confirm DAPIM doesn't need this. |
| **.NET 10 records** | Phase 1 models should use `record` types for DTOs (immutable, concise) — this is a .NET 10 best practice. |
| **OpenAPI spec** | The risk register mentions "obtain OpenAPI spec from Global Admin team" — this should be a **Phase 0 prerequisite**, not a mitigation. Without the spec, Phase 2 is speculative. |
| **Multi-instance cache** | The guide says IMemoryCache is "acceptable for MVP" but if DAPIM runs on Azure Container Apps with >1 replica, user roles won't be shared between instances. Either pin sessions or add Redis earlier. |

---

### D.11 Summary of Recommendations

| # | Priority | Action |
|---|----------|--------|
| 1 | **Critical** | Add ADR: DAPIM uses `access_token`, not `id_token` — do NOT port `EntraTokenHandler`/`TokenService` |
| 2 | **Critical** | Fix Phase 4: Replace `RequireClaim` with individual feature claims or custom `PortalClaimHandler` |
| 3 | **High** | Move Bearer header fix to Phase 0 — it blocks all integration testing |
| 4 | **High** | Clarify Integration Services auth mechanism (subscription key vs client credentials) — blocking question |
| 5 | **Medium** | Address KPS/tenant selection — does DAPIM need it? |
| 6 | **Medium** | Fix fail-open/fail-closed direction in Phase 3 checklist |
| 7 | **Medium** | Ensure `ClaimsEnrichmentMiddleware` guards against duplicate enrichment |
| 8 | **Low** | Prefer OID over email for user lookup if API supports it |
| 9 | **Low** | Add OpenAPI spec acquisition as Phase 0 prerequisite |
| 10 | **Low** | Use `record` types for Phase 1 DTOs (.NET 10 best practice) |

---

### D.12 Verdict

The porting guide is a **strong foundation**. The phased approach with clear dependencies is the right way to execute. Addressing the items above — especially the `id_token`/`access_token` distinction (D.2) and the Phase 4 claim matching issue (D.3) — will prevent subtle bugs and keep the architecture on solid ground. The most impactful quick win is moving Bearer header injection to Phase 0 (D.4)

---

## Appendix E: Access Token Flow Analysis — Both DAPIM SPAs

> Captured from code trace on March 12, 2026, covering `kx-apim-dev-custom` (branch: `walk-back`) and `kx-apim-marketplace-custom` (branch: `Auth`).

### E.1 kx-apim-dev-custom — Correctly Wired (Reference Implementation)

This SPA has a fully working access token flow end-to-end:

**Scope configuration chain:**
1. `.env.development` / `.env.production` → `VITE_PORTAL_API_SCOPE=api://komatsu-apim-portal/.default`
2. `src/config.ts` → centralized config singleton:
   ```ts
   entra: {
     portalApiScope: resolve("PORTAL_API_SCOPE", "VITE_PORTAL_API_SCOPE", "User.Read"),
   }
   ```
3. `src/auth/msalConfig.ts` → `loginRequest = { scopes: [appConfig.entra.portalApiScope] }`

**Token acquisition:**
4. `src/auth/AuthProvider.tsx` → `acquireTokenSilent({...loginRequest, account})` → returns `result.accessToken` (correct — not `idToken`)

**Bearer header injection:**
5. `src/api/client.ts` → full authenticated API client:
   - `request()` calls `getAccessToken()` per request
   - Sets `Authorization: Bearer ${token}` header
   - Has retry logic (MAX_RETRIES=2, exponential backoff), AbortController, structured `ApiError` types
   - `usePortalApi()` hook wires `useAuth().getAccessToken` into get/post/patch/delete methods

**Result**: MSAL requests a proper API-scoped access token from Entra ID, and every BFF call includes it as a Bearer header. The BFF can validate the token's audience (`api://komatsu-apim-portal`) and issuer.

---

### E.2 kx-apim-marketplace-custom — Was Broken, Now Fixed

**Problems found (before fix):**

| # | File | Issue |
|---|------|-------|
| 1 | `.env` | `VITE_LOGIN_SCOPES=User.Read` — requests Microsoft Graph scope, gets Graph-scoped token useless for BFF auth |
| 2 | `msalConfig.ts` | `const portalScope = import.meta.env.VITE_LOGIN_SCOPES \|\| 'User.Read'` — reads wrong env var |
| 3 | `apiClient.ts` | No `Authorization: Bearer` header — BFF calls are unauthenticated |

**Problem 1 — Wrong scope**: The SPA was requesting `User.Read` (a Microsoft Graph delegated permission). MSAL returns a token whose audience is `https://graph.microsoft.com` — this token is valid for calling Graph but **useless for authenticating to the BFF**. The BFF expects a token with audience `api://komatsu-apim-portal`.

**Problem 2 — Wrong env var name**: Even if the value were correct, using `VITE_LOGIN_SCOPES` is inconsistent with the dev-custom SPA which uses `VITE_PORTAL_API_SCOPE`.

**Problem 3 — Missing Bearer header**: Even with a correct token, the `ApiClient` class never attached it to requests. The `credentials: 'include'` only sends cookies (which this app doesn't use for auth — it uses Bearer tokens per architecture decision #2).

**Fixes applied:**

| # | File | Change |
|---|------|--------|
| 1 | `.env` | Replaced `VITE_LOGIN_SCOPES=User.Read` with `VITE_PORTAL_API_SCOPE=api://komatsu-apim-portal/.default` |
| 2 | `.env.example` | Updated to show `VITE_PORTAL_API_SCOPE=api://your-app/.default` |
| 3 | `msalConfig.ts` | Changed to `import.meta.env.VITE_PORTAL_API_SCOPE \|\| 'User.Read'` |
| 4 | `apiClient.ts` | Added optional `TokenProvider` constructor param; `request()` now calls it and sets `Authorization: Bearer ${token}` |
| 5 | `useApiClient.ts` | **New hook** — wires `useAuth().getAccessToken` into an `ApiClient` instance (equivalent to dev-custom's `usePortalApi()`) |
| 6 | `Health.tsx` | Updated to use `useApiClient()` hook instead of bare `apiClient` singleton |

**What was already correct:**
- `AuthProvider.tsx` already used `result.accessToken` (not `idToken`) — the token type was fine, just the scope and injection were wrong
- `loginUtils/getAccessToken.ts` standalone utility was also correct

---

### E.3 MN Frontend — Uses id_token (Anti-Pattern)

For comparison, the Member Network SPA (`kx-membernetwork-frontend`, branch: `develop`) has a **3-bug chain** that sends `id_token` instead of `access_token`:

1. **`src/utils/loginUtils/acquireUser.js`** — requests scopes `['openid', 'profile', 'User.Read']`, returns `[idToken, accessToken]` tuple
2. **`src/api/getApi.js`, `postApi.js`, `patchApi.js`** — destructures `const [idToken] = await acquireTokens(instance)` (element 0 = id_token) and sends it as `Authorization: Bearer ${idToken}`
3. **MN BFF `TokenService.cs`** — accepts the id_token because `ValidateAudience = false` in `TokenValidationParameters`

This "works" in practice because the BFF skips audience validation, but it's non-standard. ID tokens are identity assertions meant for the client, not authorization tokens meant for APIs.

**Do NOT copy this pattern into DAPIM.** The DAPIM BFF should validate the token audience (`api://komatsu-apim-portal`), which would reject id_tokens.

---

### E.4 Side-by-Side Comparison

| Aspect | dev-custom (✅) | marketplace-custom (✅ after fix) | MN frontend (⚠️) |
|--------|----------------|----------------------------------|-------------------|
| Scope env var | `VITE_PORTAL_API_SCOPE` | `VITE_PORTAL_API_SCOPE` | N/A (hardcoded) |
| Scope value | `api://komatsu-apim-portal/.default` | `api://komatsu-apim-portal/.default` | `User.Read` |
| Token type sent | `accessToken` | `accessToken` | `idToken` |
| Bearer header | ✅ `client.ts` `request()` | ✅ `apiClient.ts` `request()` | ✅ (but sends wrong token type) |
| Auth hook | `usePortalApi()` | `useApiClient()` | N/A (inline in each API file) |
| Centralized config | `config.ts` singleton | Direct `import.meta.env` | N/A |
| BFF audience validation | Expected: validates `api://komatsu-apim-portal` | Same BFF | `ValidateAudience = false` |

### E.5 Remaining Gap

Both DAPIM SPAs still use `cacheLocation: 'localStorage'` in MSAL config. Per the copilot-instructions.md and security best practice, this should be changed to `'sessionStorage'` to limit XSS token exposure. This is tracked in Sprint 0 gap analysis. to unblock integration testing across all phases.
