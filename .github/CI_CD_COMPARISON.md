# Container CI/CD Process Comparison

## Overview Comparison

| Aspect | **mykomatsu-apim-dev-custom** | **undercarriage-trackshoe-lookup-frontend** |
|--------|-------------------------------|---------------------------------------------|
| **Infrastructure** | Bicep templates | Bicep templates |
| **Container Runtime** | Nginx (static SPA) | Node.js + Express (with backend API) |
| **Image Build** | Azure ACR Build | Docker Buildx (local then push) |
| **Deployment Method** | Azure ARM Deploy action | Azure CLI direct update |
| **Authentication** | Federated Credentials (OIDC) | Federated Credentials (OIDC) |
| **Environments** | dev, staging, prod | dev, prod |
| **Branch Strategy** | develop → staging → main | develop → release/* → main |
| **Private Packages** | None | Palantir Foundry (with fallback) |
| **Testing** | Basic build/Docker test | Comprehensive test suite (unit, component, E2E) |
| **Secrets Management** | GitHub Secrets → Build Args | GitHub Secrets → Container App Secrets |
| **Easy Auth** | Not configured | Fully configured with Azure AD |

---

## Detailed Comparison

### 1. **Workflow Structure**

#### **mykomatsu-apim-dev-custom**
```
.github/workflows/
├── build-test.yml       # Build validation on PRs
├── deploy-dev.yml       # Auto-deploy to dev (develop branch)
├── deploy-staging.yml   # Auto-deploy to staging (staging branch)
└── deploy-prod.yml      # Auto-deploy to prod (main branch)
```

**Characteristics:**
- Separate workflow per environment
- Simpler, more straightforward
- Each environment independently triggered
- No test suite integration

#### **undercarriage-trackshoe-lookup-frontend**
```
.github/workflows/
├── test.yml             # Reusable test workflow (unit, component, E2E)
├── auto-deploy.yml      # Dynamic multi-environment with matrix
└── manual-deploy.yml    # Manual trigger with environment selection
```

**Characteristics:**
- Matrix-based deployment (single workflow for all environments)
- Reusable test workflow called by deployment workflows
- More complex but more DRY (Don't Repeat Yourself)
- Comprehensive testing before deployment

---

### 2. **Build Process**

#### **mykomatsu-apim-dev-custom**
```yaml
# Uses Azure ACR Build directly
az acr build \
  --registry $ACR_NAME \
  --image $APP_NAME:$SHA \
  --build-arg VITE_AZURE_CLIENT_ID="..." \
  --file Dockerfile \
  .
```

**Advantages:**
- ✅ No local Docker daemon needed
- ✅ Build happens in Azure (faster for large images)
- ✅ ACR handles layer caching automatically
- ✅ Simple - no tag/push steps

**Container:**
- Nginx serving static React build
- ~50MB final image size
- No backend server runtime

#### **undercarriage-trackshoe-lookup-frontend**
```yaml
# Build locally with Docker Buildx, then push
docker buildx build \
  --platform linux/amd64 \
  --secret id=foundry_token,src=/tmp/foundry_token \
  --build-arg VITE_AZURE_CLIENT_ID="..." \
  --cache-from type=gha \
  --cache-to type=gha,mode=max \
  --push \
  .
```

**Advantages:**
- ✅ GitHub Actions cache integration (faster subsequent builds)
- ✅ Docker secrets for sensitive tokens during build
- ✅ Better control over build process
- ✅ Multi-platform support

**Container:**
- Node.js Express server + React frontend
- ~500MB final image size
- Backend API with Foundry integration
- Dynatrace OneAgent integration

---

### 3. **Deployment Strategy**

#### **mykomatsu-apim-dev-custom**
```yaml
# Deploy Bicep first, then build image, then update
1. Deploy Bicep infrastructure (azure/arm-deploy action)
2. Build container image (az acr build)
3. Update Container App (az containerapp update)
```

**Flow:**
- Infrastructure changes applied first
- Image built with environment-specific build args
- Container app updated with new image
- Simple, sequential process

#### **undercarriage-trackshoe-lookup-frontend**
```yaml
# Separate jobs: test → build → deploy
1. Run comprehensive test suite
2. Build matrix determines target environments
3. Build and push to environment-specific ACRs
4. Deploy matrix runs deployments
5. Configure Easy Auth per environment
```

**Flow:**
- Testing gate before any deployment
- Parallel builds for multiple environments (if needed)
- Secrets stored in Azure Container App (more secure)
- Easy Auth configuration applied post-deployment

---

### 4. **Secrets & Configuration Management**

#### **mykomatsu-apim-dev-custom**

**Build-time secrets (passed as build args):**
```yaml
--build-arg VITE_AZURE_CLIENT_ID="${{ secrets.VITE_AZURE_CLIENT_ID }}"
--build-arg VITE_API_BASE_URL="${{ secrets.VITE_API_BASE_URL }}"
```

**Runtime:** No runtime secrets (static SPA)

**Security Level:** Medium
- Build args become layer metadata (visible in image)
- Suitable for public/semi-public values
- No runtime secrets needed

#### **undercarriage-trackshoe-lookup-frontend**

**Build-time secrets (Docker secrets - secure):**
```yaml
--secret id=foundry_token,src=/tmp/foundry_token
```

**Runtime secrets (Azure Container App secrets):**
```bash
az containerapp secret set \
  --secrets foundry-client-secret=$SECRET \
            pricing-api-password=$SECRET

az containerapp update \
  --set-env-vars FOUNDRY_CLIENT_SECRET=secretref:foundry-client-secret
```

**Security Level:** High
- Build secrets not stored in layers
- Runtime secrets encrypted in Azure
- Secret references instead of plain values

---

### 5. **Testing & Quality Gates**

#### **mykomatsu-apim-dev-custom**
```yaml
# build-test.yml
- TypeScript compilation check
- Build verification
- Docker image build test
- Health check endpoint test
```

**Coverage:** Basic validation only

#### **undercarriage-trackshoe-lookup-frontend**
```yaml
# test.yml (reusable workflow)
- Unit tests (utilities, config)
- Component tests (UI components, pages)
- E2E tests (API integration)
- Coverage reporting
- Test result publishing
```

**Coverage:** Comprehensive testing with:
- Configurable thresholds (TEST_FAILURE_THRESHOLD, COVERAGE_THRESHOLD)
- Test result annotations on PRs
- Coverage reports uploaded as artifacts
- Vitest for testing framework

---

### 6. **Environment Management**

#### **mykomatsu-apim-dev-custom**

**Environments:**
- `development` (develop branch)
- `staging` (staging branch)
- `production` (main branch)

**Resource Groups:**
```
rg-komatsu-apim-portal-dev
rg-komatsu-apim-portal-staging
rg-komatsu-apim-portal-prod
```

**Configuration:** Separate parameter files per environment

#### **undercarriage-trackshoe-lookup-frontend**

**Environments:**
- `dev` (develop branch)
- `prod` (release/* and main branches)

**Resource Groups:**
- Single resource group per environment
- Environment-specific variables in GitHub

**Configuration:** 
- Matrix-based environment selection
- Environment-specific secrets/vars in GitHub
- Dynamic auth config per environment

---

### 7. **Advanced Features**

#### **mykomatsu-apim-dev-custom**
- ✅ Federated credentials (passwordless)
- ✅ Deployment summaries with URLs
- ✅ Path ignore for docs/markdown
- ✅ Environment-based approvals
- ❌ No Easy Auth configuration
- ❌ No test suite
- ❌ No backend API

#### **undercarriage-trackshoe-lookup-frontend**
- ✅ Federated credentials (passwordless)
- ✅ Comprehensive test suite (unit, component, E2E)
- ✅ Easy Auth (Azure AD) auto-configuration
- ✅ Backend API with Foundry integration
- ✅ Dynatrace OneAgent monitoring
- ✅ Email notification system (SendGrid)
- ✅ Private npm package support (Foundry)
- ✅ GitHub Actions cache for Docker layers
- ✅ Semantic versioning for images (dev-SHA, prod-SHA)
- ✅ Matrix strategy for DRY workflows
- ✅ Manual deployment workflow with environment picker

---

## Image Tagging Strategy

### **mykomatsu-apim-dev-custom**
```
komatsuapimportaldevacr.azurecr.io/komatsu-apim-portal:abc1234  # SHA
komatsuapimportaldevacr.azurecr.io/komatsu-apim-portal:latest   # Latest
```

### **undercarriage-trackshoe-lookup-frontend**
```
tsalookupdevacr.azurecr.io/tsa-lookup-ui:dev-abc1234    # Environment + SHA
tsalookupdevacr.azurecr.io/tsa-lookup-ui:dev-latest     # Environment + Latest
tsalookupprodacr.azurecr.io/tsa-lookup-ui:prod-abc1234  # Separate ACR per env
tsalookupprodacr.azurecr.io/tsa-lookup-ui:prod-latest
```

**Benefit:** Clear environment separation, easier rollback, audit trail

---

## Recommendations to Align

### High Priority

1. **Add Comprehensive Testing**
   - Create unit tests for utilities and components
   - Add component tests for UI
   - Set up E2E tests for critical flows
   - Use reusable test workflow pattern

2. **Implement Semantic Tagging**
   - Use `$ENV-$SHA` pattern for images
   - Keep environment-specific latest tags
   - Easier to track which version is deployed where

3. **Add Easy Auth Configuration**
   - Auto-configure Azure AD authentication
   - Set up excluded paths for static assets
   - Configure allowed audiences and redirect URLs

### Medium Priority

4. **Consolidate Workflows with Matrix**
   - Convert to single auto-deploy workflow
   - Use matrix strategy for environments
   - Reduce duplication across deploy-* files

5. **Enhance Secrets Management**
   - If adding backend: Store runtime secrets in Container App
   - Use secret references instead of env vars for sensitive data
   - Implement Docker secrets for build-time sensitive values

6. **Add Manual Deploy Workflow**
   - Create workflow_dispatch with environment picker
   - Useful for hotfixes and testing

### Optional

7. **Add Monitoring Integration**
   - Consider Application Insights SDK
   - Add health check monitoring
   - Set up alerts for failures

8. **Improve Build Caching**
   - Switch to Docker Buildx with GitHub Actions cache
   - Faster builds after initial run
   - Better for frequent deployments

---

## Architecture Decision Summary

### When to use **mykomatsu-apim-dev-custom** approach:
- ✅ Static SPA with no backend
- ✅ Simple deployment requirements
- ✅ Want minimal complexity
- ✅ Don't need comprehensive testing
- ✅ Build args contain only public/semi-public values

### When to use **undercarriage-trackshoe-lookup-frontend** approach:
- ✅ Full-stack app with backend API
- ✅ Complex deployment requirements
- ✅ Need comprehensive testing before deploy
- ✅ Handle sensitive secrets at runtime
- ✅ Need Easy Auth integration
- ✅ Want monitoring/observability
- ✅ Multiple environments with different configs

---

## Migration Path

If you want to adopt best practices from undercarriage project:

### Phase 1: Testing (Week 1)
1. Set up Vitest
2. Create test.yml workflow
3. Add basic unit tests
4. Integrate test workflow into deployments

### Phase 2: Enhanced Security (Week 2)
1. Implement Docker secrets for build
2. Add Easy Auth configuration step
3. Switch to semantic image tags

### Phase 3: Workflow Optimization (Week 3)
1. Consolidate deploy workflows into matrix
2. Add manual deploy workflow
3. Implement GitHub Actions cache

### Phase 4: Monitoring (Week 4)
1. Add Application Insights integration
2. Set up deployment notifications
3. Configure health check monitoring
