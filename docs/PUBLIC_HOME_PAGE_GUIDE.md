# PUBLIC_HOME_PAGE Configuration Guide

## Overview

The public home page feature can be controlled **differently** in local development vs production:

- **Local Development** (npm run dev): Uses `VITE_PUBLIC_HOME_PAGE` from `.env` file (build-time)
- **Production Docker**: Uses `PUBLIC_HOME_PAGE` runtime environment variable (can change without rebuild)

## Local Development Setup

### Enable Public Home Page

1. **Edit `.env` file**:
```bash
VITE_PUBLIC_HOME_PAGE=true
```

2. **Restart dev server**:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

3. **Verify**:
   - Navigate to http://localhost:5173
   - Home page should load WITHOUT prompting for login
   - You can browse the home page anonymously

### Disable Public Home Page (Require Login)

1. **Edit `.env` file**:
```bash
VITE_PUBLIC_HOME_PAGE=false
```

2. **Restart dev server**:
```bash
npm run dev
```

3. **Verify**:
   - Navigate to http://localhost:5173
   - Should redirect to login immediately
   - Cannot access home page without authentication

## Production (Docker/Container Apps) Setup

### Enable Public Home Page

```bash
az containerapp update \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --set-env-vars "PUBLIC_HOME_PAGE=true"
```

### Disable Public Home Page

```bash
az containerapp update \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --set-env-vars "PUBLIC_HOME_PAGE=false"
```

**No rebuild required!** Container restart applies the change immediately.

## How It Works

### In App.tsx

```typescript
// Runtime config helper (only available in Docker)
const getRuntimeConfig = () => {
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__;
  }
  return {};
};

// Check runtime config first (Docker), fallback to build-time (local dev)
const runtimeConfig = getRuntimeConfig();
const isPublicHomePage = 
  runtimeConfig.PUBLIC_HOME_PAGE === 'true' ||  // Docker/production
  import.meta.env.VITE_PUBLIC_HOME_PAGE === "true";  // Local dev
```

### Local Development Flow

```
.env file (VITE_PUBLIC_HOME_PAGE=true)
  ↓
Vite dev server reads at startup
  ↓
import.meta.env.VITE_PUBLIC_HOME_PAGE === "true"
  ↓
Public home page enabled
```

**Important**: Changes to `.env` require dev server restart!

### Production Docker Flow

```
Container App env var (PUBLIC_HOME_PAGE=true)
  ↓
docker-entrypoint.sh generates runtime-config.js at startup
  ↓
window.__RUNTIME_CONFIG__.PUBLIC_HOME_PAGE === 'true'
  ↓
Public home page enabled
```

**Important**: Changes apply on container restart (no rebuild needed)!

## Troubleshooting

### "Public home page not working in local dev"

✅ **Solution**:
1. Check `.env` file has `VITE_PUBLIC_HOME_PAGE=true`
2. Restart dev server: `npm run dev`
3. Clear browser cache and reload

### "Public home page not working in production"

✅ **Solution**:
1. Check Container App environment variable:
```bash
az containerapp show \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --query "properties.template.containers[0].env" \
  --output table
```

2. Should show `PUBLIC_HOME_PAGE=true`

3. If missing or wrong, update:
```bash
az containerapp update \
  --name komatsu-apim-portal-dev-ca \
  --resource-group kac_apimarketplace_eus_dev_rg \
  --set-env-vars "PUBLIC_HOME_PAGE=true"
```

### "Still redirecting to login even with PUBLIC_HOME_PAGE=true"

Check the authentication configuration:

**Local Dev**: `.env` should have:
```bash
VITE_USE_MOCK_AUTH=true  # Enables mock auth (no real login)
VITE_PUBLIC_HOME_PAGE=true  # Makes home page public
```

**Production**: `.env.production` should have:
```bash
VITE_USE_MOCK_AUTH=false  # Real authentication
VITE_PUBLIC_HOME_PAGE=true  # Makes home page public (fallback)
```

And Container App should have:
```bash
PUBLIC_HOME_PAGE=true  # Runtime override (preferred in production)
```

## Summary

| Environment | Variable | File/Location | Requires Restart/Rebuild |
|-------------|----------|---------------|--------------------------|
| Local Dev | `VITE_PUBLIC_HOME_PAGE` | `.env` | Dev server restart ✅ |
| Production Build | `VITE_PUBLIC_HOME_PAGE` | `.env.production` | Docker rebuild ✅ |
| **Production Runtime** | `PUBLIC_HOME_PAGE` | Container App env vars | **Container restart only** ⚡ |

**Best Practice**: Use runtime env var (`PUBLIC_HOME_PAGE`) in production for easy toggling without rebuilds!
