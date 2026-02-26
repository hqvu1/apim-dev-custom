# Deployment Audit & Changes — February 25, 2026

## Summary

After migrating the BFF from direct APIM management URLs to **Azure ARM endpoints**, several deployment configuration files were out of sync. This audit verifies the full pipeline: `server.js` → `supervisord.conf` → `docker-entrypoint.sh` → `Dockerfile` → `container-app.bicep`.

---

## Issues Found & Fixed

### 1. `supervisord.conf` — CRITICAL: Wrong API version & stale env vars

**Problem:**
```ini
# BEFORE (broken)
environment=NODE_ENV="production",BFF_PORT="3001",APIM_MANAGEMENT_URL="%(ENV_APIM_MANAGEMENT_URL)s",APIM_API_VERSION="2021-08-01"
```
- Hardcoded `APIM_API_VERSION="2021-08-01"` — BFF expects `2022-08-01`
- Passed `APIM_MANAGEMENT_URL` — no longer used by the BFF (switched to ARM)
- Missing: `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `APIM_SERVICE_NAME`, `AZURE_CLIENT_ID`, `USE_MOCK_MODE`

**Fix:**
```ini
# AFTER (correct)
environment=NODE_ENV="production",BFF_PORT="3001",USE_MOCK_MODE="%(ENV_USE_MOCK_MODE)s",AZURE_SUBSCRIPTION_ID="%(ENV_AZURE_SUBSCRIPTION_ID)s",AZURE_RESOURCE_GROUP="%(ENV_AZURE_RESOURCE_GROUP)s",APIM_SERVICE_NAME="%(ENV_APIM_SERVICE_NAME)s",APIM_API_VERSION="%(ENV_APIM_API_VERSION)s",AZURE_CLIENT_ID="%(ENV_MANAGED_IDENTITY_CLIENT_ID)s"
```
All values now dynamically read from the container environment using `%(ENV_...)s` syntax.

---

### 2. `docker-entrypoint.sh` — Stale env var export

**Problem:**
```sh
# BEFORE (broken)
: "${PORTAL_API_BACKEND_URL:=https://demo-apim-feb.management.azure-api.net}"
export APIM_MANAGEMENT_URL="${PORTAL_API_BACKEND_URL}"
```
- Exported `APIM_MANAGEMENT_URL` which the BFF no longer reads
- Did not export the ARM env vars that `supervisord` needs via `%(ENV_...)s`

**Fix:**
```sh
# AFTER (correct)
: "${USE_MOCK_MODE:=false}"
: "${AZURE_SUBSCRIPTION_ID:=}"
: "${AZURE_RESOURCE_GROUP:=}"
: "${APIM_SERVICE_NAME:=}"
: "${APIM_API_VERSION:=2022-08-01}"
: "${MANAGED_IDENTITY_CLIENT_ID:=}"

export USE_MOCK_MODE AZURE_SUBSCRIPTION_ID AZURE_RESOURCE_GROUP APIM_SERVICE_NAME APIM_API_VERSION MANAGED_IDENTITY_CLIENT_ID
```

---

### 3. `bff/.env.example` — Outdated documentation

**Problem:**
```dotenv
# BEFORE
APIM_MANAGEMENT_URL=https://your-apim.management.azure-api.net
APIM_API_VERSION=2021-08-01
```

**Fix:**
```dotenv
# AFTER
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
APIM_SERVICE_NAME=your-apim-service-name
APIM_API_VERSION=2022-08-01
```

---

### 4. `deploy-to-azure.ps1` — Step 6 overwrites Bicep env vars

**Problem:**
```powershell
# BEFORE — injects stale env vars on every deployment
az containerapp update ... --set-env-vars `
    "PORTAL_API_BACKEND_URL=$env:PORTAL_API_BACKEND_URL" `
    "NODE_ENV=production"
```
- `PORTAL_API_BACKEND_URL` is no longer used
- Could override env vars already set correctly by the Bicep template

**Fix:**
```powershell
# AFTER — only updates the image, Bicep manages all env vars
az containerapp update ... --image $AcrImageName
```

---

### 5. `supervisord.conf` — CRITICAL: nginx user causes permission error

**Problem:**
```ini
# BEFORE (broken)
[program:nginx]
user=nginx
```
- Supervisord starts nginx as `nginx` user
- But nginx needs root to open `/var/log/nginx/error.log` on startup
- nginx then drops to the `nginx` user via its own `user nginx;` directive in nginx.conf
- Result: nginx crashes immediately → port 8080 never listens → health probes fail → revision stuck in "Activating"

**Fix:**
```ini
# AFTER (correct)
[program:nginx]
user=root
```
nginx is now started as root (standard behavior), allowing it to open log files and then drop privileges to the `nginx` user for worker processes.

---

### 6. `Dockerfile` — BuildKit `--mount=type=secret` incompatible with ACR Build

**Problem:**
```dockerfile
# BEFORE — fails on ACR Build (no BuildKit support)
RUN --mount=type=secret,id=buildenv,required=false \
    if [ -f /run/secrets/buildenv ]; then ...
```

**Fix:**
```dockerfile
# AFTER — works everywhere
RUN npx vite build --mode production
```
The BuildKit secret mount was optional and unused — `.env.production` already provides all VITE_* vars at build time.

---

## Verified Correct (No Changes Needed)

| File | Status | Notes |
|------|--------|-------|
| `Dockerfile` | ✅ OK | Multi-stage build, BFF deps installed correctly |
| `nginx.conf` | ✅ OK | `/api/` → `localhost:3001` proxy, SPA fallback, security headers |
| `container-app.bicep` | ✅ OK | All ARM env vars injected: `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `APIM_SERVICE_NAME`, `APIM_API_VERSION=2022-08-01`, `MANAGED_IDENTITY_CLIENT_ID`, `USE_MOCK_MODE=false` |
| `parameters.dev.json` | ✅ OK | Dev values match environment |
| `.env.production` | ✅ OK | `VITE_PORTAL_API_BASE=/api` (correct for nginx proxy) |
| `bff/server.js` | ✅ OK | Reads ARM env vars with correct defaults |
| `bff/package.json` | ✅ OK | `type: "module"`, all deps present |

---

## Environment Variable Flow (Production)

```
Bicep template (container-app.bicep)
  ↓ sets container env vars
Container App runtime
  ↓ passes to
docker-entrypoint.sh
  ↓ exports for supervisord
supervisord.conf → %(ENV_...)s
  ↓ passes to BFF process
bff/server.js → process.env.*
  ↓ constructs
ARM URL: https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{name}
```

| Variable | Source (Bicep) | Default in server.js | Used For |
|----------|---------------|---------------------|----------|
| `AZURE_SUBSCRIPTION_ID` | `121789fa-2321-4e44-8aee-c6f1cd5d7045` | same | ARM URL path |
| `AZURE_RESOURCE_GROUP` | `kac_apimarketplace_eus_dev_rg` | same | ARM URL path |
| `APIM_SERVICE_NAME` | `demo-apim-feb` | same | ARM URL path + docs link |
| `APIM_API_VERSION` | `2022-08-01` | same | ARM query param |
| `MANAGED_IDENTITY_CLIENT_ID` | `2c46c615-a962-4ce7-a2f9-cc0610ff2043` | — | `DefaultAzureCredential` opts |
| `USE_MOCK_MODE` | `false` | `false` | Skip real auth in dev |
| `BFF_PORT` | `3001` | `3001` | Express listen port |
| `NODE_ENV` | `production` | `development` | Express mode |

---

## Recent Feature Changes (also in this build)

### Landing page: Real stats instead of hardcoded mock data
- **BFF**: Added `GET /stats` endpoint (both mock and real mode)
- **Real mode**: Fetches APIs, products, subscriptions, users counts from ARM in parallel
- **Frontend**: `src/pages/home/index.tsx` now calls `/stats` API instead of using `DEFAULT_STATS`
- Stats shown: Available APIs (3), Products (3), Subscriptions (4), Uptime (99.9%)

### View Documentation button fix
- **BFF**: `documentationUrl` now points to APIM developer portal (`https://{service}.developer.azure-api.net/api-details#api={id}`)
- **BFF**: Added `openApiUrl` field and `GET /apis/:apiId/openapi` route (exports spec via ARM, redirects to blob)
- **Frontend**: Two buttons — "View documentation" (portal link) + "Export OpenAPI spec" (download)
- **Types**: Added `openApiUrl?: string` to `ApiDetails` type

---

## Rebuild & Deploy Commands

```powershell
# 1. Build container image
docker build -t komatsu-apim-portal:dev -f Dockerfile .

# 2. Tag for ACR
docker tag komatsu-apim-portal:dev kapimdevacr.azurecr.io/komatsu-apim-portal:dev

# 3. Login to ACR
az acr login --name kapimdevacr

# 4. Push to ACR
docker push kapimdevacr.azurecr.io/komatsu-apim-portal:dev

# 5. Update Container App (triggers new revision)
az containerapp update `
    --name komatsu-apim-portal-dev-ca `
    --resource-group kac_apimarketplace_eus_dev_rg `
    --image kapimdevacr.azurecr.io/komatsu-apim-portal:dev

# 6. Verify logs
az containerapp logs show `
    --name komatsu-apim-portal-dev-ca `
    --resource-group kac_apimarketplace_eus_dev_rg `
    --follow
```

---

## Post-Deploy Verification Checklist

- [ ] Container app revision is active and healthy
- [ ] BFF logs show: `✅ Azure Managed Identity credential initialized (User-Assigned: 2c46c615-...)`
- [ ] BFF logs show: `✅ Transformed 3 APIs from ARM response`
- [ ] Landing page shows real stats (3 APIs, 3 Products, 4 Subscriptions)
- [ ] API Catalog loads 3 APIs (Echo API, Swagger Petstore, Swagger Petstore v1)
- [ ] API Details page loads with operations table
- [ ] "View documentation" button opens APIM developer portal
- [ ] "Export OpenAPI spec" button downloads the spec JSON
- [ ] Health check responds at `/health`
