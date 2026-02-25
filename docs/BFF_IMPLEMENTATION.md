# Managed Identity Implementation Summary

## What We Built

We've implemented a **Backend-for-Frontend (BFF)** architecture with Azure Managed Identity authentication to solve the authorization issue with APIM Management API.

## Architecture Changes

### Before (Direct APIM Access - ❌ Unauthorized)
```
Browser → Nginx → APIM Management API ❌
                  (no authentication)
```

### After (BFF with Managed Identity - ✅ Authenticated)
```
Browser → Nginx → Node.js BFF → APIM Management API ✅
          (8080)   (3001)        (Managed Identity auth)
```

## New Components

### 1. Node.js BFF Service (`bff/`)
- **Location**: `/app/bff/` in container
- **Port**: 3001 (internal only)
- **Purpose**: Authenticate to APIM using Managed Identity
- **Dependencies**:
  - `@azure/identity` - Managed Identity SDK
  - `express` - Web server
  - `helmet` - Security headers
  - `cors` - CORS support
  - `node-fetch` - HTTP client

### 2. Process Management
- **Supervisor** manages both nginx and BFF
- Both services run as `nginx` user (non-root)
- Health checks on port 8080
- Graceful shutdown handling

### 3. Updated Files

| File | Changes |
|------|---------|
| `Dockerfile` | Added Node.js, BFF build, supervisor setup |
| `nginx.conf` | Proxy `/api/*` to `localhost:3001` instead of external APIM |
| `docker-entrypoint.sh` | Set `APIM_MANAGEMENT_URL` env var for BFF |
| `supervisord.conf` | NEW - Manages nginx + BFF processes |
| `bff/package.json` | NEW - BFF dependencies |
| `bff/server.js` | NEW - Express server with Managed Identity |
| `bff/README.md` | NEW - BFF documentation |

## Environment Variables

### Container App Environment Variables
```bash
PUBLIC_HOME_PAGE=true              # Enable/disable public home page
PORTAL_API_BACKEND_URL=https://demo-apim-feb.management.azure-api.net  # APIM URL for BFF
```

### Internal BFF Variables
```bash
BFF_PORT=3001                      # BFF listens on this port
APIM_MANAGEMENT_URL=${PORTAL_API_BACKEND_URL}  # Set by entrypoint
APIM_API_VERSION=2021-08-01        # APIM API version
NODE_ENV=production                # Node environment
```

## Required Azure Configuration

### Step 1: Managed Identity (✅ COMPLETED)
```bash
az containerapp identity assign \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --system-assigned
```

**Result**: 
- Principal ID: `01d35a0d-f8d2-4f6e-90b1-730c2235e2b8`
- Tenant ID: `58be8688-6625-4e52-80d8-c17f3a9ae08a`

### Step 2: Grant APIM Permissions (⏳ NEEDS ADMIN)

**You need an Azure admin to run**:
```bash
az role assignment create \
  --role "API Management Service Reader Role" \
  --assignee "01d35a0d-f8d2-4f6e-90b1-730c2235e2b8" \
  --scope "/subscriptions/121789fa-2321-4e44-8aee-c6f1cd5d7045/resourceGroups/kac_apimarketplace_eus_dev_rg/providers/Microsoft.ApiManagement/service/demo-apim-feb"
```

**Or via Azure Portal**:
1. Go to APIM instance: `demo-apim-feb`
2. Click "Access control (IAM)"
3. Add role assignment: "API Management Service Reader Role"
4. Assign to: `komatsu-apim-portal-dev-ca` (Managed Identity)

## Deployment Steps

### 1. Build Image
```bash
docker build -t kapimdevacr.azurecr.io/komatsu-apim-portal:bff .
```

### 2. Push to ACR
```bash
docker push kapimdevacr.azurecr.io/komatsu-apim-portal:bff
```

### 3. Update Container App
```bash
# Update image
az containerapp update \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --image kapimdevacr.azurecr.io/komatsu-apim-portal:bff

# Set environment variables
az containerapp update \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --set-env-vars \
    "PUBLIC_HOME_PAGE=true" \
    "PORTAL_API_BACKEND_URL=https://demo-apim-feb.management.azure-api.net"
```

## How It Works

1. **Container starts**:
   - `docker-entrypoint.sh` exports `APIM_MANAGEMENT_URL`
   - Supervisor starts nginx (port 8080) and BFF (port 3001)

2. **User visits site**:
   - Nginx serves React static files
   - React app loads in browser

3. **React calls API**:
   - `fetch('/api/apis')` 
   - Nginx proxies to BFF: `http://localhost:3001/apis`

4. **BFF authenticates**:
   - Uses `DefaultAzureCredential` to get Managed Identity token
   - Adds `Authorization: Bearer <token>` header
   - Calls `https://demo-apim-feb.management.azure-api.net/apis?api-version=2021-08-01`

5. **Response flows back**:
   - APIM → BFF → Nginx → Browser → React app

## Security Benefits

✅ No APIM credentials in frontend code  
✅ No user authentication required for catalog browsing  
✅ Managed Identity tokens auto-rotate  
✅ Least-privilege access (read-only APIM role)  
✅ Services run as non-root user  
✅ Token caching reduces authentication calls  

## Testing

### Local Testing (with Azure CLI auth)
```bash
# Login to Azure CLI
az login

# Run BFF locally
cd bff
npm start

# In another terminal, test BFF
curl http://localhost:3001/apis?api-version=2021-08-01
```

### Container Testing
```bash
# Run container locally
docker run -p 8080:8080 \
  -e PORTAL_API_BACKEND_URL=https://demo-apim-feb.management.azure-api.net \
  -e PUBLIC_HOME_PAGE=true \
  komatsu-apim-portal:bff

# Visit http://localhost:8080
```

## Troubleshooting

### BFF won't start
- Check supervisor logs: `docker exec <container> cat /var/log/supervisor/bff-stderr*.log`
- Verify Node.js installed: `docker exec <container> node --version`

### 401/403 errors
- Ensure Managed Identity is enabled
- Verify APIM role assignment (admin must grant this)
- Check APIM URL is correct

### Can't reach BFF from nginx
- Verify BFF is listening on port 3001
- Check supervisor status
- Ensure nginx.conf proxies to localhost:3001

## Next Steps

1. **Get admin to grant APIM permissions** (see Step 2 above)
2. **Build and push image** with BFF
3. **Deploy to Container App**
4. **Test** that API catalog loads without authentication errors
5. **Monitor** BFF logs for Managed Identity token acquisition

## Files to Commit

```bash
git add bff/
git add Dockerfile
git add nginx.conf
git add docker-entrypoint.sh
git add supervisord.conf
git add .env
git add BFF_IMPLEMENTATION.md
git commit -m "feat: Add BFF with Managed Identity for APIM authentication"
git push
```

---

**🎉 Benefits**: No more authorization errors! The Container App authenticates to APIM using its own identity, not user credentials.
