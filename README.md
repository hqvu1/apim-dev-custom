# Komatsu API Marketplace Portal

React + Vite SPA scaffold for the Komatsu API Marketplace portal UI.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy `.env.example` to `.env` and fill in Entra ID + KPS values.
3. Start the dev server:
   - `npm run dev`

## Notes

- The app expects a Portal API base at `VITE_PORTAL_API_BASE` (default `/api`).
- Login uses the KPS tenant-selection flow before MSAL redirects.
- `VITE_USE_MOCK_AUTH` allows local UI work without Entra ID/KPS.

## Auth Flow

- KPS tenant selection runs before MSAL initialization.
- MSAL redirects use the tenant-specific authority and land on `/`.
- Front-channel logout is handled at `/sso-logout`.

## Auth Env Vars

- `VITE_ENTRA_CLIENT_ID`: Entra app client id.
- `VITE_EXTERNAL_TENANT_ID`: CIAM tenant id (external users).
- `VITE_WORKFORCE_TENANT_ID`: Workforce tenant id.
- `VITE_CIAM_HOST`: CIAM host (default `kltdexternaliddev.ciamlogin.com`).
- `VITE_KPS_URL`: KPS tenant selection URL.
- `VITE_LOGIN_SCOPES`: MSAL login scopes (comma-separated).
- `VITE_LOGOUT_MODE`: `client-only`, `msal-only`, `full`, `msal-plus-bff`.
- `VITE_AEM_LOGOUT_URL` or `VITE_CDN_ICON`: SLO helper for AEM logout.
- `VITE_BASE_URL`: Base for post-logout redirect (defaults to origin).

## Troubleshooting Login

- `AADSTS900144` (missing `client_id`): ensure `.env` exists, `VITE_ENTRA_CLIENT_ID` is set, and restart `npm run dev`.
- Stuck redirecting: clear `localStorage` `tenantId`/`email` and retry KPS; verify `VITE_KPS_URL`.
- Logout loop: check `VITE_BASE_URL` and front-channel logout route `/sso-logout` is registered in Entra.
- Scope errors (invalid or insufficient scope): verify `VITE_LOGIN_SCOPES` and `VITE_PORTAL_API_SCOPE` match the Entra app registrations and consented permissions.

## Deployment

### Automated Deployment with GitHub Actions (Recommended)

The application uses a **matrix-based CI/CD pipeline** with comprehensive testing for deployments to Azure Container Apps:

#### Key Features
- ✅ **Automated deployments** from `develop` (dev) and `main` (prod) branches
- ✅ **Comprehensive testing** - Unit, component, and integration tests
- ✅ **Quality gates** - Test coverage and failure thresholds
- ✅ **Semantic tagging** - Images tagged with `dev-{sha}`, `prod-{sha}`
- ✅ **Docker Buildx caching** - Faster builds using GitHub Actions cache
- ✅ **Easy Auth automation** - Azure AD authentication configured automatically
- ✅ **OIDC authentication** - Passwordless Azure login with federated credentials

#### Deployment Flow

**Development**:
```bash
git checkout develop
git merge feature/my-feature
git push origin develop
# → Runs tests → Builds image → Deploys to dev → Configures Easy Auth
```

**Production**:
```bash
git checkout main
git merge develop
git push origin main
# → Runs tests → Builds image → [Waits for approval] → Deploys to prod → Configures Easy Auth
```

**Manual Deployment**:
1. Go to **Actions** tab in GitHub
2. Select **Manual Deploy** workflow
3. Choose environment (dev/staging/prod) and branch
4. Click **Run workflow**

#### Setup Instructions
See [.github/GITHUB_ACTIONS_SETUP.md](.github/GITHUB_ACTIONS_SETUP.md) for complete setup guide.

**Quick Start**:
1. Configure Azure federated credentials (OIDC)
2. Add GitHub repository secrets for Azure authentication
3. Set up GitHub environments (dev, staging, prod)
4. Configure environment variables for each environment
5. Push to your branch - deployment happens automatically!

### Manual Deployment Scripts (Alternative)

For manual deployments or local infrastructure testing:

```bash
# Using PowerShell (Windows)
cd azure
.\deploy.ps1 -Environment dev

# Using Bash (Linux/macOS)
cd azure
chmod +x deploy.sh
./deploy.sh dev
```

### Local Docker Testing

Test the containerized application locally:

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:8080

# Or build and run manually
docker build -t komatsu-apim-portal .
docker run -p 8080:8080 komatsu-apim-portal
```

### Testing

Run tests locally before pushing:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

## Documentation

### Project Documentation
- [Public Landing Page Setup](docs/PUBLIC_LANDING_PAGE_SETUP.md) - Implementation details for public home page
- [Infosys APIM Integration Guide](docs/INFOSYS_APIM_INTEGRATION_GUIDE.md) - Complete guide for APIM integration
- [APIM Integration Checklist](docs/APIM_INTEGRATION_CHECKLIST.md) - Step-by-step integration tasks

### Deployment & CI/CD
- [GitHub Actions Setup Guide](.github/GITHUB_ACTIONS_SETUP.md) - Complete CI/CD configuration
- [Azure Deployment Guide](./azure/README.md) - Manual deployment and infrastructure details
- [CI/CD Comparison](.github/CI_CD_COMPARISON.md) - Architecture comparison and design decisions
