# Docker & Deployment Environment Variable Migration Summary

## Overview
The Dockerfile and deployment files were using **outdated environment variable names** from an old Azure AD configuration. They have been updated to match the current Entra ID multi-tenant authentication setup.

> **Note (March 2026):** The BFF has been fully migrated from Node.js (`bff/server.js`) to ASP.NET Core 10 (`bff-dotnet/`). The Dockerfile now has a 3-stage build: frontend (node:20-alpine), BFF (`dotnet/sdk:10.0-preview`), and runtime (nginx:alpine + ASP.NET Core runtime). The .NET BFF uses `appsettings.json` with environment variable overrides (using `__` separator, e.g., `Apim__SubscriptionId`). The frontend `VITE_*` build args below still apply. See [BFF_IMPLEMENTATION.md](BFF_IMPLEMENTATION.md) for the current .NET BFF configuration.

## Changes Made

### ✅ Updated Files

#### 1. **Dockerfile**
- ❌ Old: `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_REDIRECT_URI`, `VITE_AZURE_POST_LOGOUT_REDIRECT_URI`, `VITE_API_BASE_URL`
- ✅ New: All current environment variables from `.env` file including:
  - `VITE_ENTRA_CLIENT_ID`
  - `VITE_EXTERNAL_TENANT_ID`
  - `VITE_WORKFORCE_TENANT_ID`
  - `VITE_CIAM_HOST`
  - `VITE_KPS_URL`
  - `VITE_LOGIN_SCOPES`
  - `VITE_LOGOUT_MODE`
  - `VITE_USE_MOCK_AUTH`
  - `VITE_PUBLIC_HOME_PAGE` *(new)*
  - `VITE_PORTAL_API_BASE`
  - `VITE_PORTAL_API_SCOPE`
  - `VITE_DEFAULT_LOCALE`
  - `VITE_AEM_LOGOUT_URL`
  - `VITE_CDN_ICON`
  - `VITE_BASE_URL`

#### 2. **azure/container-app.bicep**
- Updated all parameter names to match new variables
- Updated secrets to use `entra-client-id` and `portal-api-scope`
- Updated container environment variables
- Added `PORTAL_API_BACKEND_URL` for Nginx proxy configuration

#### 3. **azure/parameters.dev.json**
- Replaced old parameter names with new Entra ID configuration
- Added all missing parameters

#### 4. **azure/parameters.staging.json**
- Same updates as dev parameters
- Updated staging-specific URLs

#### 5. **azure/parameters.prod.json**
- Same updates as dev parameters
- Updated production-specific URLs
- Changed CIAM host to production variant

#### 6. **azure/deploy.sh** (Bash deployment script)
- Updated Docker build args to use new variable names

#### 7. **azure/deploy.ps1** (PowerShell deployment script)
- Updated Docker build args to use new variable names

### ⚠️ Files That Still Need Updates

#### GitHub Actions Workflows
The following workflow files still reference old environment variable names:
- `.github/workflows/auto-deploy.yml`
- `.github/workflows/manual-deploy.yml` (likely)
- `.github/workflows/test.yml` (if it builds Docker images)

**Action Required:**
1. Update GitHub repository variables/secrets:
   - Remove: `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_REDIRECT_URI`, `VITE_AZURE_POST_LOGOUT_REDIRECT_URI`, `VITE_API_BASE_URL`
   - Add new variables matching the `.env` file structure

2. Update workflow files to reference new variable names in:
   - Build environment variables
   - Docker build arguments
   - Container environment variable lists

## Environment Variable Mapping

| Old Variable | New Variable(s) | Notes |
|-------------|-----------------|-------|
| `VITE_AZURE_CLIENT_ID` | `VITE_ENTRA_CLIENT_ID` | Renamed to match Microsoft's rebranding |
| `VITE_AZURE_AUTHORITY` | `VITE_EXTERNAL_TENANT_ID` + `VITE_WORKFORCE_TENANT_ID` + `VITE_CIAM_HOST` | Split into separate tenant configs |
| `VITE_AZURE_REDIRECT_URI` | *(Removed)* | App uses `window.location.origin` dynamically |
| `VITE_AZURE_POST_LOGOUT_REDIRECT_URI` | *(Removed)* | Handled by logout flow |
| `VITE_API_BASE_URL` | `VITE_PORTAL_API_BASE` | Renamed for clarity |
| *(New)* | `VITE_KPS_URL` | Komatsu Portal System tenant selection |
| *(New)* | `VITE_LOGIN_SCOPES` | OAuth scopes configuration |
| *(New)* | `VITE_LOGOUT_MODE` | Logout strategy selection |
| *(New)* | `VITE_USE_MOCK_AUTH` | Development bypass |
| *(New)* | `VITE_PUBLIC_HOME_PAGE` | Public demo mode |
| *(New)* | `VITE_PORTAL_API_SCOPE` | Portal API OAuth scope |
| *(New)* | `VITE_DEFAULT_LOCALE` | i18n configuration |

## Deployment Checklist

### Before Deploying:

- [x] Updated Dockerfile with new build args
- [x] Updated Bicep template parameters
- [x] Updated environment-specific parameter files
- [x] Updated deployment scripts (deploy.sh, deploy.ps1)
- [ ] Update GitHub Actions workflow files
- [ ] Update GitHub repository variables/secrets
- [ ] Test local Docker build with new variables
- [ ] Update deployment documentation

### Local Testing:

```bash
# Test Docker build locally
docker build \
  --build-arg VITE_ENTRA_CLIENT_ID="your-client-id" \
  --build-arg VITE_EXTERNAL_TENANT_ID="your-external-tenant-id" \
  --build-arg VITE_WORKFORCE_TENANT_ID="your-workforce-tenant-id" \
  --build-arg VITE_CIAM_HOST="kltdexternaliddev.ciamlogin.com" \
  --build-arg VITE_KPS_URL="https://login-uat.komatsu.com/spa" \
  --build-arg VITE_LOGIN_SCOPES="User.Read" \
  --build-arg VITE_LOGOUT_MODE="msal-plus-bff" \
  --build-arg VITE_USE_MOCK_AUTH="false" \
  --build-arg VITE_PUBLIC_HOME_PAGE="false" \
  --build-arg VITE_PORTAL_API_BASE="https://d-apim.developer.azure-api.net" \
  --build-arg VITE_PORTAL_API_SCOPE="api://komatsu-apim-portal/.default" \
  --build-arg VITE_DEFAULT_LOCALE="en" \
  -t komatsu-apim-portal:test .

# Test the container (with .NET BFF env vars)
docker run -p 8080:8080 \
  -e ASPNETCORE_ENVIRONMENT="Production" \
  -e ASPNETCORE_URLS="http://+:3001" \
  -e Apim__SubscriptionId="121789fa-2321-4e44-8aee-c6f1cd5d7045" \
  -e Apim__ResourceGroup="kac_apimarketplace_eus_dev_rg" \
  -e Apim__ServiceName="demo-apim-feb" \
  -e EntraId__TenantId="58be8688-6625-4e52-80d8-c17f3a9ae08a" \
  -e EntraId__ClientId="bd400d26-7db1-44fd-82b7-8c7af757e249" \
  -e Features__UseMockMode="false" \
  komatsu-apim-portal:test
```

## Next Steps

1. **Review GitHub Actions workflows** and update variable references
2. **Update GitHub repository settings** with new variable names
3. **Test local Docker build** to verify all variables are properly injected
4. **Update any CI/CD documentation** to reflect new variable names
5. **Coordinate with team** on deprecating old variable names

## References

- [.env](.env) - Current environment variable configuration
- [Dockerfile](Dockerfile) - Container build configuration
- [azure/container-app.bicep](azure/container-app.bicep) - Infrastructure as Code
- [README.md](README.md) - Updated documentation
