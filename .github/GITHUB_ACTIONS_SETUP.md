# GitHub Actions Deployment Setup Guide

This guide covers setting up GitHub Actions to automatically deploy the Komatsu APIM Portal to Azure Container Apps using a modern matrix-based CI/CD approach.

## 📋 Overview

The GitHub Actions workflows use a **matrix-based deployment strategy** with comprehensive testing gates:

### Workflows

1. **`test.yml`** - Reusable test workflow with unit, component, and integration tests
2. **`auto-deploy.yml`** - Automated deployments triggered by branch pushes
3. **`manual-deploy.yml`** - Manual deployments with environment selection

### Key Features

- ✅ **Matrix-based deployments** - Single workflow for multiple environments
- ✅ **Semantic image tagging** - `dev-SHA`, `prod-SHA` format for traceability
- ✅ **Docker Buildx with caching** - Faster builds using GitHub Actions cache
- ✅ **Comprehensive testing** - Unit, component, and integration tests with coverage
- ✅ **Quality gates** - Configurable test coverage and failure thresholds
- ✅ **Easy Auth configuration** - Automated Azure AD authentication setup
- ✅ **OIDC authentication** - Passwordless Azure login with federated credentials

## 🔐 Azure Setup (One-Time Configuration)

### Step 1: Create Azure AD App Registration for GitHub Actions

```bash
# Set variables (update with your values)
APP_NAME="github-komatsu-apim-portal"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
REPO_OWNER="your-github-org"
REPO_NAME="mykomatsu-apim-dev-custom"

# Create the Azure AD application
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)

# Create a service principal
az ad sp create --id $APP_ID

# Get the object ID
OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)

# Assign Contributor role to the subscription
az role assignment create \
  --role Contributor \
  --subscription $SUBSCRIPTION_ID \
  --assignee-object-id $OBJECT_ID \
  --assignee-principal-type ServicePrincipal
```

### Step 2: Configure Federated Credentials (OIDC)

Configure federated credentials for passwordless authentication:

```bash
# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)

# Create federated credential for develop branch (dev environment)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-dev",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$REPO_OWNER/$REPO_NAME"':ref:refs/heads/develop",
    "description": "GitHub Actions - Development",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Create federated credential for main branch (prod environment)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-prod",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$REPO_OWNER/$REPO_NAME"':ref:refs/heads/main",
    "description": "GitHub Actions - Production",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Optional: Create federated credential for manual deployments (environment-based)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-environment",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$REPO_OWNER/$REPO_NAME"':environment:dev",
    "description": "GitHub Actions - Manual Deployments",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Print the values you'll need for GitHub secrets
echo "======================================"
echo "Add these to GitHub Secrets:"
echo "======================================"
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "======================================"
```

## 🔑 GitHub Repository Setup

### Step 1: Create GitHub Environments

Go to Settings → Environments and create three environments:

#### 1. Development Environment (`dev`)
- **Name**: `dev`
- **Protection rules**: None (auto-deploy from develop branch)
- **Deployment branches**: Only `develop` branch (optional)

#### 2. Staging Environment (`staging`)
- **Name**: `staging`
- **Protection rules**: 
  - Optional: Add reviewers for manual approval
  - Optional: 5-minute wait timer
- **Deployment branches**: Limit to specific branches

#### 3. Production Environment (`prod`)
- **Name**: `prod`
- **Protection rules**:
  - **Required reviewers**: Add 1-2 team members
  - **Wait timer**: 5-10 minutes (optional)
- **Deployment branches**: Only `main` branch

### Step 2: Configure Repository Secrets

Go to Settings → Secrets and variables → Actions → Secrets

Add these **Repository-level secrets**:

#### Azure OIDC Authentication
```
AZURE_CLIENT_ID          # App ID from Azure AD app registration
AZURE_TENANT_ID          # Your Azure AD tenant ID
AZURE_SUBSCRIPTION_ID    # Your Azure subscription ID
```

### Step 3: Configure Environment Variables

For **each environment** (dev, staging, prod), add these **environment variables**:

Go to Settings → Secrets and variables → Actions → click on the environment → Variables tab

#### Container Registry (per environment)
```
ACR_NAME                 # e.g., "komatsuapimdevacr" (dev) or "komatsuapimprodacr" (prod)
```

#### Azure Resources (per environment)
```
AZURE_RESOURCE_GROUP     # e.g., "komatsu-apim-dev-rg" or "komatsu-apim-prod-rg"
CONTAINER_APP_NAME       # e.g., "komatsu-apim-portal-dev-ca"
```

#### Application Configuration (per environment)
```
VITE_AZURE_CLIENT_ID                    # Azure AD app registration client ID for portal
VITE_AZURE_AUTHORITY                    # https://login.microsoftonline.com/{tenant-id}
VITE_AZURE_REDIRECT_URI                 # https://{your-app-url}/auth/callback
VITE_AZURE_POST_LOGOUT_REDIRECT_URI     # https://{your-app-url}
VITE_API_BASE_URL                       # https://your-apim-{env}.azure-api.net
APP_URL                                 # https://{your-app-url} (for Easy Auth)
```

### Step 4: Configure Environment Secrets

For **each environment**, add these **environment secrets**:

Go to Settings → Secrets and variables → Actions → click on the environment → Secrets tab

```
REGISTRY_USERNAME        # ACR admin username (from Azure Container Registry)
REGISTRY_PASSWORD        # ACR admin password (from Azure Container Registry)
```

💡 **Tip**: Get ACR credentials with:
```bash
az acr credential show --name <acr-name> --resource-group <resource-group>
```

### Step 5: Optional - Configure Test Thresholds

Add these **Repository variables** to customize test quality gates:

```
TEST_FAILURE_THRESHOLD   # Default: 0 (max % of tests that can fail)
COVERAGE_THRESHOLD       # Default: 80 (min % code coverage required)
```

## 🚀 Deployment Workflow

### Automatic Deployments

#### Deploy to Development
Push to the `develop` branch triggers automatic deployment to dev:

```bash
git checkout develop
git merge feature/my-feature
git push origin develop
```

**What happens:**
1. ✅ Runs test suite (unit, component, integration tests)
2. 🔨 Builds Docker image with tag `dev-{git-sha}`
3. 📦 Pushes to dev ACR
4. 🚀 Deploys to dev Container App
5. 🔐 Configures Easy Auth (Azure AD)

#### Deploy to Production
Push to the `main` branch triggers deployment to production:

```bash
git checkout main
git merge develop  # or staging
git push origin main
```

**What happens:**
1. ✅ Runs full test suite
2. 🔨 Builds Docker image with tag `prod-{git-sha}`
3. 📦 Pushes to prod ACR
4. ⏸️ Waits for manual approval (if configured)
5. 🚀 Deploys to prod Container App
6. 🔐 Configures Easy Auth

### Manual Deployments

Trigger manual deployments via GitHub Actions UI:

1. Go to **Actions** tab
2. Select **Manual Deploy** workflow
3. Click **Run workflow**
4. Choose:
   - **Branch** to deploy from
   - **Environment** (dev/staging/prod)
   - **Skip tests** (optional, not recommended)
5. Click **Run workflow**

### Semantic Image Tagging

Images are tagged with semantic versioning for traceability:

| Environment | Tags |
|-------------|------|
| Development | `dev-{git-sha}`, `dev-latest` |
| Staging | `staging-{git-sha}`, `staging-latest` |
| Production | `prod-{git-sha}`, `prod-latest` |

**Example**: `komatsuapimdevacr.azurecr.io/komatsu-apim-portal:dev-a1b2c3d`

### Viewing Deployment Status

1. **Actions Tab**: See real-time workflow progress
2. **Environments**: View deployment history and approvals
3. **Commit Status**: See deployment status next to commits

## 🧪 Testing Strategy

### Test Workflow Structure

The `test.yml` workflow runs three types of tests:

1. **Unit Tests** - Config, utils, theme tests
2. **Component Tests** - React component tests
3. **Integration Tests** - Auth, API integration tests

### Test Quality Gates

Tests must pass before deployment:

- ✅ All tests must pass (or below failure threshold)
- ✅ Code coverage must meet minimum threshold (default 80%)
- ✅ Test results published as PR comments
- ✅ Coverage reports uploaded as artifacts

### Running Tests Locally

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## 🔧 Troubleshooting

### Deployment Fails with "401 Unauthorized"

**Cause**: Azure OIDC credentials not configured correctly

**Solution**:
1. Verify federated credentials exist for the branch/environment
2. Check `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` secrets
3. Ensure service principal has Contributor role

```bash
# List federated credentials
az ad app federated-credential list --id $APP_ID

# Verify role assignment
az role assignment list --assignee $APP_ID --subscription $SUBSCRIPTION_ID
```

### ACR Login Fails

**Cause**: Missing or incorrect registry credentials

**Solution**:
1. Enable ACR admin user in Azure Portal
2. Get credentials: `az acr credential show --name <acr-name>`
3. Update `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` secrets

### Build Fails - Missing Environment Variables

**Cause**: Environment variables not configured in GitHub

**Solution**:
1. Check environment variables in Settings → Environments → {env} → Variables
2. Ensure all `VITE_*` variables are set
3. Verify variables are available in correct environment

### Easy Auth Configuration Fails

**Cause**: Missing Azure AD configuration or permissions

**Solution**:
1. Verify `VITE_AZURE_CLIENT_ID` is correct
2. Check `APP_URL` matches Container App FQDN
3. Ensure Azure AD app has correct redirect URIs configured

### Tests Failing in CI but Pass Locally

**Cause**: Different Node.js version or environment

**Solution**:
1. Check Node.js version matches (workflow uses Node 20)
2. Run `npm ci` instead of `npm install` locally
3. Check for race conditions in tests

## 📊 Monitoring & Logs

### View Workflow Logs
1. Go to **Actions** tab
2. Click on workflow run
3. Click on specific job to see detailed logs

### View Container App Logs
```bash
# Stream logs
az containerapp logs show \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --follow

# View recent logs
az containerapp logs show \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --tail 100
```

### Application Insights
Monitor application performance:
```bash
# Get Application Insights details
az monitor app-insights component show \
  --app <app-insights-name> \
  --resource-group <resource-group>
```

## 🔄 Rollback Strategy

### Option 1: Revert Git Commit
```bash
git revert <bad-commit-sha>
git push origin main
# Triggers new deployment with reverted code
```

### Option 2: Deploy Previous Image Tag
Use manual deploy workflow to deploy a previous known-good image tag.

### Option 3: Manual Rollback via Azure CLI
```bash
# Get previous image tag
az containerapp revision list \
  --name <container-app-name> \
  --resource-group <resource-group>

# Activate previous revision
az containerapp revision activate \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --revision <revision-name>
```

## 📚 Additional Resources

- [GitHub Actions Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure AD OIDC with GitHub](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure)
- [Docker Buildx](https://docs.docker.com/build/buildx/)
- [Vitest Testing Framework](https://vitest.dev/)
