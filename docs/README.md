# Komatsu API Marketplace Portal - Documentation

This directory contains all project documentation for the Komatsu API Marketplace Portal.

## 📚 Documentation Index

### Setup & Configuration
- **[PUBLIC_LANDING_PAGE_SETUP.md](PUBLIC_LANDING_PAGE_SETUP.md)**  
  Implementation details for the public landing page feature, including:
  - Architecture changes for public vs. authenticated routes
  - Modified components and files
  - Authentication flow updates

### APIM Integration
- **[Komatsu_APIM_INTEGRATION_GUIDE.md](Komatsu_APIM_INTEGRATION_GUIDE.md)**  
  Comprehensive guide for integrating with Komatsu APIM Customization Framework:
  - Backend service requirements and architecture
  - Frontend code updates needed
  - Environment variable configuration
  - Azure infrastructure setup
  - Security considerations
  - Testing strategy
  - Deployment checklist

- **[APIM_INTEGRATION_CHECKLIST.md](APIM_INTEGRATION_CHECKLIST.md)**  
  Task-by-task checklist for APIM integration:
  - Pre-integration requirements
  - Code implementation tasks
  - Testing requirements
  - Deployment steps
  - Documentation deliverables

## 🔗 Related Documentation

### Component-Specific Documentation
- [Home Page Documentation](../src/pages/home/README.md) - Best practices and architecture for the home page
- [Home Page Test Coverage](../src/pages/home/TEST_COVERAGE_SUMMARY.md) - Testing details

### Deployment & CI/CD
- [GitHub Actions Setup](../.github/GITHUB_ACTIONS_SETUP.md) - CI/CD pipeline configuration
- [Azure Deployment Guide](../azure/README.md) - Infrastructure and deployment
- [CI/CD Comparison](../.github/CI_CD_COMPARISON.md) - Architecture decisions

## 📖 Document Conventions

- **✅** = Complete/Implemented
- **⚠️** = Partial/In Progress  
- **❌** = Not Started/Missing
- **🚨** = Critical/High Priority

## 🔄 Document Updates

| Document | Last Updated | Status |
|----------|--------------|--------|
| PUBLIC_LANDING_PAGE_SETUP.md | 2026-02-17 | ✅ Complete |
| Komatsu_APIM_INTEGRATION_GUIDE.md | 2026-02-17 | ✅ Complete |
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
- [Main README](../README.md) - Project overview and setup
- [Home Page Docs](../src/pages/home/README.md) - Component architecture

**For DevOps:**
- [GitHub Actions Setup](../.github/GITHUB_ACTIONS_SETUP.md) - CI/CD setup
- [Azure Deployment](../azure/README.md) - Infrastructure deployment

**For Integrators:**
- [APIM Integration Guide](Komatsu_APIM_INTEGRATION_GUIDE.md) - Complete integration guide
- [APIM Checklist](APIM_INTEGRATION_CHECKLIST.md) - Integration tasks

