# First Release (Phase 1 MVP) — Gap Analysis: Design Document vs. Appspec

| | |
|---|---|
| **Source Documents** | `appspec.txt`, `API Marketplace Story Mapping` (Whiteboard), `DESIGN_DOCUMENT.md` |
| **Date** | March 2026 |
| **Purpose** | Identify what is missing or under-specified in the Design Document relative to the appspec requirements for the first release |

---

## Summary

The `DESIGN_DOCUMENT.md` is comprehensive in its coverage of architecture, authentication, RBAC, APIM integration, and deployment. However, cross-referencing against the appspec deliverables and the story mapping whiteboard reveals **10 gaps** — areas that are either missing entirely, listed only as placeholders, or lack the detail needed for first-release implementation and EARB review.

---

## Gap Details

### 1. AEM CMS Integration — Architecture Details Missing

**Appspec Requirement:**
> *"Dynamic content will be able to be updated dynamically and can be updated through a user interface (no hard coded changes)."*
> *"Integration with the AEM Content Authoring for dynamic content updates."*

**Design Document Status:** High-level only — mentions content types, cache TTL, and a content architecture diagram, but lacks actionable detail.

**What Needs to Be Added:**
- AEM API endpoint contracts (REST endpoints, authentication mechanism, response schema)
- `AemContentService` class design in BFF — equivalent to the existing `ArmApiService` / `DataApiService` pattern
- Content authoring workflow: how do business editors publish changes that the portal picks up?
- Fallback strategy when AEM is unavailable (cached content? static fallback?)
- Content model mapping (AEM content types → BFF `ContentBlock` / `NewsArticle` DTOs)

---

### 2. ServiceNow / ASK Integration — Only Placeholder

**Appspec Requirement:**
> *"Integration to a centralized Service Delivery system for defect tracking tied to the portal. For phase 1, this will be either the ASK or Service Now systems."*

**Design Document Status:** Listed in the integration map; BFF endpoints marked as "placeholder."

**What Needs to Be Added:**
- Decision: ASK or ServiceNow (or both) for Phase 1
- API contracts for ticket CRUD operations (create, list, get detail, update status)
- Authentication mechanism (how does BFF authenticate to ServiceNow/ASK?)
- Data model field mapping (portal `SupportTicket` ↔ ServiceNow Incident / ASK ticket)
- Error handling and retry strategy for ticket submission failures
- Replace placeholder `GET /api/support/**` and `POST /api/support/tickets` with real endpoint contracts

---

### 3. Global Admin Integration — Registration / Approval Workflow

**Appspec Requirement:**
> *"A feature to allow unregistered users the ability to enter user details to provide to an approval team to onboard into Global Admin. This will follow the same process for all KX applications."*

**Design Document Status:** Registration flow section exists but `POST /api/register` is marked "placeholder." Only `GET /users/{id}/roles` is documented for Global Admin API.

**What Needs to Be Added:**
- Approval queue design (where do pending registrations live? BFF-owned table, or Global Admin queue?)
- Admin notification flow (how is the approval team notified of new registration requests?)
- Registration-to-role-assignment lifecycle (pending → approved → role assigned → welcome email)
- Global Admin API contracts for user provisioning (not just role lookup)
- Registration form field requirements (name, organization, role requested, contact info)
- Rejection / denial flow

---

### 4. Automated Welcome Email

**Appspec Requirement:**
> *"Automated Welcome E-Mail with a quick-start guide."*

**Design Document Status:** Missing entirely.

**What Needs to Be Added:**
- Email delivery mechanism (SendGrid, Azure Communication Services, Office 365 SMTP, or Global Admin built-in?)
- Email template design (subject, body, quick-start guide content/links)
- Trigger point in the registration workflow (on approval? on first login?)
- BFF service for email dispatch (or is this handled by Global Admin?)
- Configuration for email sender address, reply-to, branding

---

### 5. Multi-Language Support — Translation Workflow

**Appspec Requirement:**
> *"The portal will offer multi-language support."*
> *"Non-English translations will be provided externally from KNA IT team."*

**Design Document Status:** Partial — mentions `react-i18next` with `en.json` / `es.json`. Codebase has both locale files and `useTranslation()` hooks wired throughout pages.

**What Needs to Be Added:**
- Which languages beyond English and Spanish are in scope for Phase 1? (Or is en + es sufficient for MVP?)
- AEM content localization strategy — how are translated content blocks delivered and keyed by locale?
- API documentation localization — are OpenAPI specs locale-specific (from APIM) or translated via AEM overlays?
- Translation handoff workflow — how does the external translation team deliver new/updated locale files?
- RTL support consideration (if applicable for future languages)

---

### 6. Security & Compliance — Specific Details

**Appspec Requirements:**
> *"Soc 2 compliant"*
> *"Comply with GDPR standards"*
> *"PII data stored encrypted"*

**Design Document Status:** Listed in the security controls matrix but not detailed enough for compliance review.

**What Needs to Be Added:**
- **SOC 2**: Controls matrix mapping SOC 2 Trust Service Criteria to specific portal controls (e.g., CC6.1 → JWT Bearer auth, CC7.2 → structured logging)
- **GDPR**: Data flow diagram for PII — what PII is collected, where it's stored, who has access, retention period, right-to-erasure handling
- **PII encryption at rest**: The design says "no portal-owned database" — clarify where PII resides (Entra ID? Global Admin? AEM?) and confirm encryption-at-rest for each store
- **TRA (Threat Risk Assessment)**: Referenced in timeline (Month 3 exit criteria) but no template or section in the document — add a TRA summary or reference to the TRA deliverable
- **Data classification**: What data in the portal is classified as confidential, internal, or public?

---

### 7. Phase 1 API Onboarding — Per-API Details

**Appspec Requirements:**
> *"3 existing APIs onboarded: SAP Warranty API, Parts Punchout API, Equipment Management API"*
> *"API metadata attached to each API such as owner, version, contact"*
> *"An isolated sandbox area will be available for developers to de-risk integrations"*

**Design Document Status:** Listed in a table with backend and category, but no per-API detail.

**What Needs to Be Added:**
- Per-API metadata: owner contact, current version, backend system, SLA terms
- APIM product configuration per API (rate limits, quota, subscription approval mode)
- Sandbox environment details per API (URL, credentials, limitations, who provides it)
- Onboarding documentation per API (Month 1 exit criteria: *"Documents for 3 phase 1 APIs of how to onboard APIs to API Portal"*)
- OpenAPI spec source and hosting (embedded in APIM? imported from file?)
- API category/tag assignments in APIM

---

### 8. KX Member Network Access

**Appspec Requirement:**
> *"Marketplace Portal will be accessible via direct link or via KX Member Network."*

**Design Document Status:** Missing entirely.

**What Needs to Be Added:**
- How is the portal linked/embedded from KX Member Network? (iframe, deep link, menu integration?)
- SSO pass-through: does a user already authenticated in KX Member Network get seamless access to the portal?
- Shared Entra ID tenant or cross-tenant trust?
- Navigation: back-link from portal to KX Member Network?

---

### 9. WCAG / Accessibility Audit Plan

**Appspec Requirement:**
> *"On-Brand, WCAG-Compliant UI"*

**Design Document Status:** Brief section listing WCAG 2.1 AA target, axe-core, Playwright a11y, keyboard nav, screen reader, and color contrast. But no actionable audit plan.

**What Needs to Be Added:**
- Concrete accessibility testing plan (automated CI checks + manual testing schedule)
- axe-core CI integration specifics (which CI stage? fail-on-violation threshold?)
- ARIA patterns for complex components (Swagger UI embed in Try-It, subscription multi-step flow, filter panels)
- Accessibility testing for third-party embeds (Swagger UI/Redoc — known a11y gaps)
- Manual audit timeline (before UAT? before production?)
- Remediation process for discovered a11y issues

---

### 10. Operational Runbook

**Appspec Requirement (Deliverables):**
> *"Runbook"*
> *"Full system architecture diagrams and documentation needed for an Application Management Services (AMS) team to support"*

**Design Document Status:** Missing entirely — no runbook section or reference.

**What Needs to Be Added:**
- Incident response procedures (who to contact, escalation path, severity definitions)
- Deployment and rollback procedures (how to deploy a new version, how to roll back)
- Health check and monitoring dashboard guide (which Azure Monitor dashboards to watch, alert thresholds)
- Common troubleshooting scenarios (BFF not connecting to APIM, MSAL token failures, AEM content not updating)
- Scheduled maintenance procedures (certificate rotation, secret rotation, dependency updates)
- AMS team knowledge transfer checklist (referenced in appspec Month 4.5 deliverables)

---

## Summary Table

| # | Gap | Appspec Reference | Design Doc Status | Severity |
|---|-----|-------------------|-------------------|----------|
| 1 | AEM CMS integration contracts & workflow | "Integration with AEM Content Authoring" | High-level only | High |
| 2 | ServiceNow/ASK ticket integration | "Integration to centralized Service Delivery" | Placeholder | High |
| 3 | Registration approval queue & Global Admin provisioning | "Unregistered users to enter details for approval" | Placeholder | High |
| 4 | Automated welcome email | "Automated Welcome E-Mail with quick-start guide" | Missing entirely | Medium |
| 5 | Multi-language scope & translation workflow | "Multi-language support" | Partial (en/es only) | Medium |
| 6 | SOC 2 / GDPR compliance details | "SOC 2 compliant, GDPR, PII encrypted" | Listed, not detailed | High |
| 7 | Phase 1 API onboarding specs (per-API) | "3 existing APIs onboarded" | Listed, no detail | Medium |
| 8 | KX Member Network integration | "Accessible via KX Member Network" | Missing entirely | Medium |
| 9 | WCAG audit plan | "WCAG-Compliant UI" | Brief section only | Medium |
| 10 | Operational runbook | "Runbook" in deliverables | Missing entirely | High |

---

## Codebase Implementation Note

The **current codebase** is further along than these design doc gaps might suggest. Pages for Catalog, Details, Try-It, Support, News, MyIntegrations, Admin, Register, and Onboarding all exist with real BFF API calls, i18n (`en.json` / `es.json`), and the BFF (.NET 10) has endpoint route groups, RBAC policies, and service layer implementations. The primary gaps are:

1. **BFF-to-downstream integrations** — AEM content service, ServiceNow/ASK ticket service, Global Admin provisioning
2. **Operational & compliance documentation** — runbook, TRA, SOC 2 controls matrix, GDPR data flow
3. **Per-API onboarding artifacts** — specific configuration and documentation for the 3 Phase 1 APIs

---

*Generated from cross-reference of `appspec.txt`, `API Marketplace Story Mapping` (Microsoft Whiteboard), and `DESIGN_DOCUMENT.md` — March 2026.*
