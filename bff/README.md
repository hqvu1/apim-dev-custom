# APIM Portal Backend-for-Frontend (BFF)

## Overview

This Node.js Express service acts as a Backend-for-Frontend (BFF) that:
- Runs alongside the React frontend in the same container
- Uses the **APIM Data API** (same data source as the portal's `DataApiClient`)
- Authenticates via **Azure Managed Identity → ARM → SAS Token**
- Proxies all `/api/*` requests from the React app to the APIM Data API
- Eliminates the need for client-side authentication to APIM

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Container (Port 8080)                                  │
│                                                         │
│  ┌────────────┐    /api/*    ┌──────────────┐         │
│  │   Nginx    │─────────────▶│  BFF Node.js │         │
│  │  (Port 80) │              │ (Port 3001)  │         │
│  └────────────┘              └──────────────┘         │
│       │                             │                  │
│       │ static files                │ MI → ARM → SAS   │
│       │                             │                  │
│       ▼                             ▼                  │
│  React App                  APIM Data API             │
│                      <svc>.developer.azure-api.net    │
└─────────────────────────────────────────────────────────┘
```

## How It Works

1. **Browser** requests data from React app
2. **React app** calls `/api/apis` (or other APIM endpoints)
3. **Nginx** proxies request to `localhost:3001` (BFF)
4. **BFF** uses Managed Identity to get ARM Bearer token
5. **BFF** discovers Data API URL from ARM service description (cached)
6. **BFF** generates SAS token via ARM `/users/1/token` (cached ~55 min)
7. **BFF** calls APIM Data API with SAS token (flat contracts, no `.properties` wrapper)
8. **BFF** transforms and returns response to React app

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BFF_PORT` | `3001` | Port the BFF listens on (internal) |
| `AZURE_SUBSCRIPTION_ID` | (required) | Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | (required) | Resource group containing APIM |
| `APIM_SERVICE_NAME` | (required) | APIM service instance name |
| `APIM_API_VERSION` | `2022-08-01` | ARM API version (for discovery + SAS) |
| `APIM_DATA_API_VERSION` | `2022-04-01-preview` | Data API version |
| `APIM_DATA_API_URL` | (auto-discovered) | Override Data API URL (optional) |
| `USE_MOCK_MODE` | `false` | Use mock data for local dev |
| `AZURE_CLIENT_ID` | (optional) | User-assigned Managed Identity client ID |
| `NODE_ENV` | `production` | Node environment |

## Managed Identity Setup

The Container App must have:
1. **System-assigned Managed Identity enabled**
2. **API Management Service Reader Role** assigned to the managed identity

```bash
# Enable managed identity
az containerapp identity assign \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --system-assigned

# Grant APIM read permissions (requires Owner/User Access Administrator)
az role assignment create \
  --role "API Management Service Reader Role" \
  --assignee <principal-id> \
  --scope <apim-resource-id>
```

## Local Development

```bash
# Install dependencies
cd bff
npm install

# Run locally (requires Azure authentication)
npm start

# Or with watch mode
npm run dev
```

For local development, the BFF will use `DefaultAzureCredential` which tries:
1. Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, etc.)
2. Managed Identity (when running in Azure)
3. Azure CLI credentials
4. Visual Studio Code credentials

## Dependencies

- **@azure/identity** - Azure Managed Identity authentication
- **express** - Web framework
- **helmet** - Security headers
- **cors** - CORS handling
- **node-fetch** - HTTP client for APIM calls

## Security

- Runs as non-root user (`nginx`)
- Uses helmet for security headers
- Token caching with automatic refresh
- All errors sanitized in production

## Monitoring

- Structured console logging
- Health check endpoint: `GET /health`
- Request/response logging
- Token acquisition logging

## Deployment

Built and deployed as part of the main Dockerfile. See root `Dockerfile` for details.
