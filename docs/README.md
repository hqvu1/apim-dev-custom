# Komatsu API Marketplace Portal - Documentation

This directory contains all project documentation for the Komatsu API Marketplace Portal.

## 📚 Documentation Index

### Architecture & Design
- **[ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md)** — System architecture, auth flows, BFF comparison, API client, folder structure
- **[BFF_IMPLEMENTATION.md](BFF_IMPLEMENTATION.md)** — BFF implementation summary (ASP.NET Core 10, service modes, endpoints)
- **[BFF_MIGRATION_DECISION.md](BFF_MIGRATION_DECISION.md)** — Decision: Express → .NET migration rationale + RBAC design (✅ complete)
- **[BFF_EVOLUTION_ANALYSIS.md](BFF_EVOLUTION_ANALYSIS.md)** — BFF platform options analysis + backend router pattern
- **[APIM_DATA_API_COMPARISON.md](APIM_DATA_API_COMPARISON.md)** — ARM Management API vs Data Plane API comparison
- **[SPA_BEST_PRACTICES.md](SPA_BEST_PRACTICES.md)** — SPA development best practices

### Setup & Development
- **[START_DEBUG.md](START_DEBUG.md)** — Quick start debugging guide (.NET BFF + frontend)
- **[DEBUG_SETUP_GUIDE.md](DEBUG_SETUP_GUIDE.md)** — Comprehensive debugging guide (VS Code configs, mock/real mode, env vars)
- **[PUBLIC_LANDING_PAGE_SETUP.md](PUBLIC_LANDING_PAGE_SETUP.md)** — Public landing page feature implementation
- **[PUBLIC_HOME_PAGE_GUIDE.md](PUBLIC_HOME_PAGE_GUIDE.md)** — Public home page configuration

### APIM Integration
- **[KOMATSU_APIM_INTEGRATION_GUIDE.md](KOMATSU_APIM_INTEGRATION_GUIDE.md)** — Komatsu APIM integration guide
- **[KOMATSU_NA_APIM_INTEGRATION_GUIDE.md](KOMATSU_NA_APIM_INTEGRATION_GUIDE.md)** — Komatsu NA APIM customization framework integration
- **[APIM_INTEGRATION_CHECKLIST.md](APIM_INTEGRATION_CHECKLIST.md)** — Task-by-task APIM integration checklist
- **[THIRDPARTY_APIM_INTEGRATION_GUIDE.md](THIRDPARTY_APIM_INTEGRATION_GUIDE.md)** — Third-party APIM integration guide

### Deployment & Operations
- **[DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md)** — Azure deployment success summary (Feb 2026)
- **[DEPLOYMENT_AUDIT_CHANGES.md](DEPLOYMENT_AUDIT_CHANGES.md)** — Deployment configuration audit & fixes
- **[AZURE_DEPLOYMENT_GUIDE.md](AZURE_DEPLOYMENT_GUIDE.md)** — Comprehensive Azure deployment guide
- **[DOCKER_ENV_MIGRATION.md](DOCKER_ENV_MIGRATION.md)** — Environment variable migration (Azure AD → Entra ID)

### BFF-Specific
- **[../bff-dotnet/README.md](../bff-dotnet/README.md)** — .NET BFF: endpoints, config, project structure, service modes

## 🔗 Related Documentation

### Component-Specific Documentation
- [Home Page Documentation](../src/pages/home/README.md) — Best practices and architecture for the home page
- [Home Page Test Coverage](../src/pages/home/TEST_COVERAGE_SUMMARY.md) — Testing details

### Infrastructure
- [Azure Deployment Guide](../azure/README.md) — Infrastructure and deployment (Bicep + parameters)
- [Azure Managed Identity Setup](../azure/MANAGED_IDENTITY_SETUP.md) — (Legacy) Managed Identity docs
- [Azure Quick Setup](../azure/QUICK_SETUP.md) — App Registration (Service Principal) setup guide

## 📖 Document Conventions

- **✅** = Complete/Implemented
- **⚠️** = Partial/In Progress  
- **❌** = Not Started/Missing
- **🚨** = Critical/High Priority

## 🔄 Document Updates

| Document | Last Updated | Status |
|----------|--------------|--------|
| ARCHITECTURE_DESIGN.md | 2026-03-07 | ✅ Updated (component library, SP auth, deploy) |
| BFF_IMPLEMENTATION.md | 2026-03-07 | ✅ Updated (SP auth via ITokenProvider) |
| BFF_MIGRATION_DECISION.md | 2026-03-05 | ✅ Updated with actual implementation |
| DEBUG_SETUP_GUIDE.md | 2026-03-05 | ✅ Updated for .NET BFF |
| START_DEBUG.md | 2026-03-05 | ✅ Updated for .NET BFF |
| DEPLOYMENT_AUDIT_CHANGES.md | 2026-03-05 | ✅ Updated with .NET BFF notes |
| DEPLOYMENT_SUCCESS.md | 2026-03-05 | ✅ Updated Client ID |
| DOCKER_ENV_MIGRATION.md | 2026-03-07 | ✅ Updated (SP env vars, component library build) |
| SPA_BEST_PRACTICES.md | 2026-03-07 | ✅ Updated (SideNav removed, component library) |
| AZURE_DEPLOYMENT_GUIDE.md | 2026-03-07 | ✅ Updated (component library, SP env vars) |
| BFF_EVOLUTION_ANALYSIS.md | 2026-02-17 | ✅ Historical (pre-migration) |
| PUBLIC_LANDING_PAGE_SETUP.md | 2026-02-17 | ✅ Complete |
| APIM_INTEGRATION_CHECKLIST.md | 2026-02-17 | ⚠️ In Progress |

## 📝 Contributing to Documentation

When adding new documentation:

1. Place general project docs in this `/docs` folder
2. Place component-specific docs near the component (e.g., `/src/pages/home/README.md`)
3. Place deployment docs in `/azure` or `/.github` as appropriate
4. Update this index when adding new documents
5. Use clear, descriptive filenames in UPPER_SNAKE_CASE.md format
6. Include a "Last Updated" date in your document

## 🎯 Quick Links

**For Developers:**
- [Main README](../README.md) — Project overview and setup
- [Start Debugging](START_DEBUG.md) — Quick start guide
- [.NET BFF README](../bff-dotnet/README.md) — BFF endpoints and config

**For DevOps:**
- [Azure Deployment](../azure/README.md) — Infrastructure deployment
- [Deployment Audit](DEPLOYMENT_AUDIT_CHANGES.md) — Config audit & fixes

**For Integrators:**
- [APIM Integration Guide](KOMATSU_NA_APIM_INTEGRATION_GUIDE.md) — Complete integration guide
- [APIM Checklist](APIM_INTEGRATION_CHECKLIST.md) — Integration tasks

