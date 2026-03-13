# Global Admin Onboarding Requirements — DAPIM (SPA + BFF)

> **Purpose**: Define what the Global Admin team needs to configure/provide to onboard the DAPIM API Marketplace application (both SPA and BFF).
>
> **Date**: March 12, 2026
> **Source Analysis**: `GLOBAL_ADMIN_PORTING_GUIDE.md`, `MYNOTES.md` (Appendix C & D), MN backend/frontend auth architecture

---

## Table of Contents

1. [Req 1: Register Application in Global Admin](#req-1-register-api-marketplace-as-a-new-application-in-global-admin)
2. [Req 2: Define Roles](#req-2-define-roles-for-the-dapim-application)
3. [Req 3: Define Feature Claims](#req-3-define-and-register-feature-claims-for-dapim)
4. [Req 4: Integration Services API Access](#req-4-integration-services-api-access-for-the-bff)
5. [Req 5: Entra ID App Registration — SPA](#req-5-entra-id-app-registration--spa-public-client)
6. [Req 6: Entra ID App Registration — BFF](#req-6-entra-id-app-registration--bff-confidential-client)
7. [Req 7: KPS Tenant Selection](#req-7-kps-tenant-selection-if-applicable)
8. [Req 8: Environment Configuration Summary](#req-8-environment-configuration-summary)
9. [Blocking Questions](#blocking-questions-must-be-answered-before-implementation-starts)

---

## Req 1: Register "API Marketplace" as a new application in Global Admin

The Integration Services API filters permissions by `ApplicationName`. MN uses `"Member Network"`. DAPIM needs its own entry.

**Action items for Global Admin:**

- [ ] Create a new application record with an agreed-upon name (proposed: `"API Marketplace"`)
- [ ] Assign an `ApplicationId`
- [ ] Confirm the exact `ApplicationName` string — the BFF will use it to filter `Permissions[]` from the `UserInfoResponse`

---

## Req 2: Define roles for the DAPIM application

DAPIM has 4 planned roles (per design document), different from MN's role scheme:

| DAPIM Role | Expected UserTypes | Notes |
|---|---|---|
| **Admin** | Employee (Komatsu internal) | Full platform access; also an Entra ID app role |
| **Distributor** | Distributor | Partner-level API access |
| **Vendor** | Vendor (new — may not exist in GA today) | API provider role |
| **Customer** | Customer | Consumer-level read access |

**For reference — MN's existing role scheme:**

```
UserType → Roles:
  Employee    → KomatsuUser, KomatsuAdmin
  Subsidiary  → KomatsuUser, KomatsuAdmin
  Distributor → DealerUser, DealerAdmin
  Customer    → CustomerUser, CustomerAdmin
  WACCustomer → WildAreaCustomerUser, WildAreaCustomerAdmin
  Student     → StudentUser
  Supplier    → SupplierUser
```

**Action items for Global Admin:**

- [ ] Create role definitions under the new DAPIM application: `Admin`, `Distributor`, `Vendor`, `Customer`
- [ ] Confirm if `Vendor` is a new UserType or maps to an existing one (e.g., `Supplier`?)
- [ ] Map each UserType to its role(s) — the equivalent of MN's `Employee→KomatsuUser/KomatsuAdmin` mapping
- [ ] Confirm the `RoleName` format (e.g., `Global_APIMarketplace_Distributor_User` vs simply `Distributor`)

---

## Req 3: Define and register feature claims for DAPIM

Each role needs a `ClaimList` (comma-separated feature permissions). The 11 proposed claims and their role mapping:

| Claim | Admin | Distributor | Vendor | Customer |
|---|:---:|:---:|:---:|:---:|
| `VIEW_API_CATALOG` | x | x | x | x |
| `VIEW_API_DETAIL` | x | x | x | x |
| `TRY_API` | x | x | x | |
| `VIEW_SUBSCRIPTIONS` | x | x | x | |
| `MANAGE_SUBSCRIPTIONS` | x | x | x | |
| `VIEW_PRODUCTS` | x | x | x | x |
| `VIEW_ADMIN_CONSOLE` | x | | | |
| `MANAGE_REGISTRATIONS` | x | | | |
| `VIEW_SUPPORT` | x | x | x | x |
| `CREATE_SUPPORT_TICKET` | x | x | x | x |
| `VIEW_ANALYTICS` | x | x | | |

**Action items for Global Admin:**

- [ ] Register these claim names in the system for the DAPIM application
- [ ] Assign the role-to-claim mapping per the matrix above (or adjust per business requirements)
- [ ] Confirm the exact claim string format (all-caps with underscores, matching MN convention)

---

## Req 4: Integration Services API access for the BFF

The BFF needs to call the user-details endpoint to hydrate claims at login.

**What DAPIM needs from Global Admin:**

| Item | Details |
|---|---|
| **Endpoint contract** | Confirm: `GET /integ-api/user-details?email={email}` (same as MN?) or is there an alternative path? MN uses `GET /api/globaladmin/userdetail/v1/userdetails?emailID={email}` — clarify which is canonical. |
| **Base URLs by environment** | Dev: `https://api-dev.komatsu.com`? UAT: `https://apim-globaladmin-uat-jpneast-001.azure-api.net`? Prod: ? |
| **Authentication method** | MN uses **ISS service-to-service token** (client credentials flow via `POST /{tenantId}/oauth2/v2.0/token`). DAPIM currently has an `Ocp-Apim-Subscription-Key` approach. **Which method should DAPIM use?** |
| **If APIM subscription key** | Provide a key for each environment |
| **If client credentials (ISS)** | Provide: client ID, client secret (or confirm managed identity), target scope/resource for the token request |
| **Response contract** | Confirm the `UserInfoResponse` schema still applies to new applications — specifically that `Permissions[]` will contain entries where `ApplicationName == "API Marketplace"` once Req 1–3 are complete |

**Expected response structure** (from MN reference):

```json
{
  "userId": 12345,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@komatsu.com",
  "userType": "Distributor",
  "companyId": 42,
  "companyName": "ACME Corp",
  "objectId": "aad-oid-guid",
  "isWACUser": false,
  "permissions": [
    {
      "applicationId": 99,
      "applicationName": "API Marketplace",
      "roleTypeName": "User",
      "roleId": 5,
      "roleName": "Global_APIMarketplace_Distributor_User",
      "claimList": "VIEW_API_CATALOG,VIEW_API_DETAIL,TRY_API,VIEW_SUBSCRIPTIONS,MANAGE_SUBSCRIPTIONS,VIEW_PRODUCTS,VIEW_SUPPORT,CREATE_SUPPORT_TICKET,VIEW_ANALYTICS"
    }
  ]
}
```

> **This is a blocking dependency** — without API access and the application registered in Global Admin, no claims enrichment can work.

---

## Req 5: Entra ID App Registration — SPA (public client)

The SPA already has a dev app registration:

| Setting | Dev Value |
|---|---|
| Client ID | `bd400d26-7db1-44fd-82b7-8c7af757e249` |
| Workforce Tenant | `58be8688-6625-4e52-80d8-c17f3a9ae08a` |
| CIAM Tenant | `511e2453-090d-480c-abeb-d2d95388a675` |
| CIAM Host | `kltdexternaliddev.ciamlogin.com` |

**Action items for Global Admin / Identity team:**

- [ ] Confirm or create **UAT and Prod** app registrations (separate client IDs, or same registration with additional redirect URIs?)
- [ ] Configure **redirect URIs** for each environment (e.g., `https://marketplace-dev.komatsu.com`, `https://marketplace.komatsu.com`)
- [ ] Configure **post-logout redirect URIs** for each environment
- [ ] Ensure the SPA is registered as a **public client** (SPA platform) in the app registration
- [ ] Add the **CIAM user flow** configuration if external partners will authenticate via CIAM
- [ ] Confirm `VITE_LOGIN_SCOPES` — should be `api://<bff-client-id>/Portal.Access` (not `User.Read`)

---

## Req 6: Entra ID App Registration — BFF (confidential client)

The BFF needs credentials for two purposes: (a) validating incoming JWT tokens from the SPA, and (b) calling the Integration Services API.

**Action items:**

- [ ] **Expose an API scope**: `api://bd400d26-7db1-44fd-82b7-8c7af757e249/Portal.Access` — the SPA requests this scope, the BFF validates it as the audience
- [ ] **Service principal credentials** for calling Integration Services:
  - If using client credentials flow: register a client secret or certificate for each environment
  - If using managed identity: grant the BFF's managed identity access to the Integration Services API
- [ ] **App roles** (optional): Define an `Admin` app role in the Entra ID registration so that Komatsu internal users can be assigned the Admin role directly via Entra ID (in addition to Global Admin's role assignment)
- [ ] **Per-environment secrets**: UAT and Prod will need their own client secrets (the dev secret in `appsettings.Development.json` should be rotated — it's currently committed to source)

---

## Req 7: KPS Tenant Selection (if applicable)

MN uses KPS (Komatsu Portal Services) to present a tenant selection screen before MSAL login (workforce vs. CIAM).

**Action items:**

- [ ] Confirm whether DAPIM will use the same KPS redirect flow
- [ ] If yes: add DAPIM's redirect URIs to the KPS allowed-origin list
- [ ] Provide KPS redirect URL and configuration for each environment

---

## Req 8: Environment Configuration Summary

What Global Admin needs to provide per environment:

| Config Item | Dev | UAT | Prod |
|---|---|---|---|
| Integration Services Base URL | `https://api-dev.komatsu.com` ? | `https://apim-globaladmin-uat-jpneast-001.azure-api.net` ? | ? |
| APIM Subscription Key or Client Credentials | ? | ? | ? |
| Entra ID Client ID (SPA/BFF) | `bd400d26-7db1-44fd-82b7-8c7af757e249` | ? | ? |
| Entra ID Client Secret (BFF) | ⚠️ rotate! | ? | ? |
| CIAM Tenant ID + Host | `511e2453...` / `kltdexternaliddev.ciamlogin.com` | ? | ? |
| Workforce Tenant ID | `58be8688-6625-4e52-80d8-c17f3a9ae08a` | ? | ? |
| KPS Redirect URL | ? | ? | ? |
| DAPIM Application Name in GA | `"API Marketplace"` | same | same |
| SPA Redirect URI | `http://localhost:5173` | `https://marketplace-uat.komatsu.com` ? | `https://marketplace.komatsu.com` ? |

---

## Blocking Questions (must be answered before implementation starts)

1. **What is the DAPIM application name in Global Admin?** (Proposed: `"API Marketplace"`)
2. **What auth method should the BFF use to call Integration Services?** (APIM subscription key vs. client credentials vs. managed identity)
3. **Does the `Vendor` UserType exist in Global Admin?** If not, what UserType maps to the Vendor role?
4. **Are the proposed 11 feature claims acceptable?** Does Global Admin need to formally register these?
5. **Will DAPIM use KPS for tenant selection?** Or will it handle tenant selection in the SPA directly?
6. **Are UAT/Prod app registrations separate from Dev?** Or is it one multi-environment registration?

---

## Abbreviations

| Abbreviation | Full Term |
|---|---|
| **APIM** | Azure API Management |
| **BFF** | Backend-for-Frontend |
| **CIAM** | Customer Identity and Access Management (Entra External ID) |
| **DAPIM** | Developer API Marketplace (Komatsu's API Portal project) |
| **GA** | Global Admin (Komatsu's centralized user/role management system) |
| **ISS** | Integration Services (the backend API layer fronting Global Admin data) |
| **JWT** | JSON Web Token |
| **KPS** | Komatsu Portal Services (tenant selection / SSO orchestrator) |
| **MN** | Member Network (existing Komatsu partner portal) |
| **MSAL** | Microsoft Authentication Library |
| **OID** | Object ID (immutable Entra ID user identifier) |
| **RBAC** | Role-Based Access Control |
| **SPA** | Single-Page Application |
| **UAT** | User Acceptance Testing (pre-production environment) |
