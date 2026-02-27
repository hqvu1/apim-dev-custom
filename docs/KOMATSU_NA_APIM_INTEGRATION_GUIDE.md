# Komatsu NA APIM Customization Framework - Integration Preparation Guide

## Overview

This guide outlines all necessary preparations to integrate the Komatsu API Marketplace Portal with the **Komatsu NA APIM Customization Framework** for Azure API Management.

## Current State Analysis

### ✅ What's Already in Place
- **Frontend application** (React + TypeScript + Material-UI)
- **Authentication framework** (MSAL with Entra ID integration)
- **API client structure** (`src/api/client.ts`) with Bearer token support
- **Mock data layer** ready to be replaced with real API calls
- **Container deployment** setup (Azure Container Apps)
- **Role-based access control** (RBAC) components
- **Environment variable configuration** system

### ❌ What's Missing
- **Backend API service** to interface with Komatsu NA APIM
- **API subscription key management** UI/logic
- **APIM-specific headers** (Ocp-Apim-Subscription-Key, etc.)
- **APIM webhook handlers** for notifications
- **APIM-specific error handling** and retry logic

---

## 1. Backend Service Requirements

### Option A: Node.js/Express BFF (Recommended)
Create a Backend-for-Frontend service that interfaces with the Komatsu NA APIM Customization Framework.

**Required Endpoints:**

```typescript
// API Catalog & Discovery
GET  /api/apis                    // List all APIs
GET  /api/apis/:apiId             // Get API details
GET  /api/apis/:apiId/operations  // Get API operations/endpoints
GET  /api/apis/:apiId/swagger     // Get OpenAPI spec

// Subscriptions & Keys
GET  /api/subscriptions           // User's subscriptions
POST /api/subscriptions           // Request new subscription
GET  /api/subscriptions/:id/keys  // Get subscription keys
POST /api/subscriptions/:id/regenerate-key  // Regenerate key
DELETE /api/subscriptions/:id     // Cancel subscription

// Products & Plans
GET  /api/products                // Available products
GET  /api/products/:id            // Product details with APIs

// User Management
GET  /api/users/me                // Current user profile
PUT  /api/users/me                // Update profile
POST /api/users/signup            // Developer signup

// Testing & Try-It Console
POST /api/try-it                  // Proxy for API testing

// Analytics (if supported)
GET  /api/analytics/usage         // User's API usage stats
GET  /api/admin/analytics         // Admin analytics

// Content Management (via AEM)
GET  /api/news                    // News & announcements
GET  /api/content/:slug           // Dynamic content pages
```

**File Structure:**
```
server/
├── src/
│   ├── index.ts                 # Express app entry
│   ├── config/
│   │   ├── apim.config.ts       # APIM connection settings
│   │   └── auth.config.ts       # Authentication config
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT validation
│   │   ├── apim.middleware.ts   # APIM request interceptor
│   │   └── error.middleware.ts  # Error handling
│   ├── routes/
│   │   ├── apis.routes.ts       # API catalog routes
│   │   ├── subscriptions.routes.ts
│   │   ├── products.routes.ts
│   │   ├── users.routes.ts
│   │   └── analytics.routes.ts
│   ├── services/
│   │   ├── apim.service.ts      # Komatsu NA APIM client
│   │   ├── cache.service.ts     # Redis caching
│   │   └── analytics.service.ts
│   └── types/
│       └── apim.types.ts
├── package.json
├── tsconfig.json
└── .env.example
```

### Option B: Use Komatsu NA APIM REST APIs Directly

If the Komatsu NA framework provides direct REST APIs, you can call them from the frontend with proper CORS configuration.

**Required Configuration:**
```typescript
// src/api/apimClient.ts
const APIM_BASE_URL = import.meta.env.VITE_APIM_BASE_URL;
const APIM_SUBSCRIPTION_KEY = import.meta.env.VITE_APIM_SUBSCRIPTION_KEY;

export const apimRequest = async (path: string, options = {}) => {
  const response = await fetch(`${APIM_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Ocp-Apim-Subscription-Key': APIM_SUBSCRIPTION_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return response.json();
};
```

---

## 2. Environment Variables Updates

### Current `.env` Variables
```env
# Authentication
VITE_ENTRA_CLIENT_ID=...
VITE_EXTERNAL_TENANT_ID=...
VITE_WORKFORCE_TENANT_ID=...
VITE_CIAM_HOST=...
VITE_KPS_URL=...
VITE_LOGIN_SCOPES=...

# API Configuration
VITE_PORTAL_API_BASE=/api
VITE_PORTAL_API_SCOPE=
```

### **ADD: APIM-Specific Variables**
```env
# Komatsu NA APIM Configuration
VITE_APIM_GATEWAY_URL=https://komatsu-apim-dev.azure-api.net
VITE_APIM_PORTAL_API_URL=https://komatsu-apim-portal-api-dev.azurewebsites.net
VITE_APIM_MANAGEMENT_API_URL=https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{apimName}
VITE_APIM_DEVELOPER_PORTAL_URL=https://komatsu-apim-dev.developer.azure-api.net

# APIM Subscription Keys (for portal backend)
APIM_MASTER_SUBSCRIPTION_KEY=<secret>
APIM_MANAGEMENT_API_KEY=<secret>

# Database (if needed for custom metadata)
DATABASE_URL=postgresql://...

# Redis Cache (for API catalog caching)
REDIS_URL=redis://...

# AEM Integration
AEM_BASE_URL=https://komatsu-aem.com
AEM_API_KEY=<secret>

# ServiceNow/ASK Integration
SERVICENOW_INSTANCE_URL=https://komatsu.service-now.com
SERVICENOW_CLIENT_ID=<secret>
SERVICENOW_CLIENT_SECRET=<secret>
```

---

## 3. Code Changes Required

### A. Update API Client for APIM Headers

**File: `src/api/client.ts`**
```typescript
import { useAuth } from "../auth/useAuth";

const apiBase = import.meta.env.VITE_PORTAL_API_BASE || "/api";
const apimSubscriptionKey = import.meta.env.VITE_APIM_SUBSCRIPTION_KEY;

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  headers?: Headers;
};

const request = async <T>(
  getAccessToken: () => Promise<string | null>,
  path: string,
  options?: RequestInit & { useApimKey?: boolean }
): Promise<ApiResult<T>> => {
  try {
    const token = await getAccessToken();
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.useApimKey && apimSubscriptionKey 
        ? { "Ocp-Apim-Subscription-Key": apimSubscriptionKey } 
        : {}
      ),
      ...(options?.headers || {})
    };

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      // Handle APIM-specific errors
      const errorBody = await response.text();
      let errorMessage = `Request failed (${response.status})`;
      
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorBody || errorMessage;
      }

      return { data: null, error: errorMessage };
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : ((await response.text()) as T);

    return { data, error: null, headers: response.headers };
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

export const usePortalApi = () => {
  const { getAccessToken } = useAuth();

  return {
    get: <T,>(path: string, useApimKey = false) => 
      request<T>(getAccessToken, path, { useApimKey }),
    post: <T,>(path: string, body: unknown, useApimKey = false) =>
      request<T>(getAccessToken, path, {
        method: "POST",
        body: JSON.stringify(body),
        useApimKey
      }),
    put: <T,>(path: string, body: unknown, useApimKey = false) =>
      request<T>(getAccessToken, path, {
        method: "PUT",
        body: JSON.stringify(body),
        useApimKey
      }),
    delete: <T,>(path: string, useApimKey = false) =>
      request<T>(getAccessToken, path, { 
        method: "DELETE",
        useApimKey
      })
  };
};
```

### B. Create APIM-Specific Types

**File: `src/api/apimTypes.ts`**
```typescript
// APIM-specific API models
export interface ApimApiSummary {
  id: string;
  name: string;
  description: string;
  serviceUrl: string;
  path: string;
  protocols: string[];
  apiVersion?: string;
  apiVersionSetId?: string;
  subscriptionRequired: boolean;
  isCurrent: boolean;
  type: 'http' | 'soap' | 'websocket';
}

export interface ApimProduct {
  id: string;
  name: string;
  description: string;
  terms?: string;
  subscriptionRequired: boolean;
  approvalRequired: boolean;
  subscriptionsLimit?: number;
  state: 'published' | 'notPublished';
  displayName: string;
}

export interface ApimSubscription {
  id: string;
  ownerId: string;
  scope: string;
  displayName: string;
  state: 'active' | 'suspended' | 'cancelled' | 'submitted';
  createdDate: string;
  startDate?: string;
  expirationDate?: string;
  endDate?: string;
  notificationDate?: string;
  primaryKey: string;
  secondaryKey: string;
  stateComment?: string;
  allowTracing?: boolean;
}

export interface ApimOperation {
  id: string;
  name: string;
  displayName: string;
  method: string;
  urlTemplate: string;
  description?: string;
  request?: {
    queryParameters?: ApimParameter[];
    headers?: ApimParameter[];
    representations?: ApimRepresentation[];
  };
  responses?: ApimResponse[];
}

export interface ApimParameter {
  name: string;
  description?: string;
  type: string;
  required: boolean;
  values?: string[];
}

export interface ApimRepresentation {
  contentType: string;
  sample?: string;
  schemaId?: string;
  typeName?: string;
}

export interface ApimResponse {
  statusCode: number;
  description?: string;
  representations?: ApimRepresentation[];
}

export interface ApimUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  state: 'active' | 'blocked' | 'pending';
  registrationDate: string;
  note?: string;
  identities?: ApimUserIdentity[];
}

export interface ApimUserIdentity {
  provider: string;
  id: string;
}
```

### C. Add Subscription Management UI

**File: `src/pages/MySubscriptions.tsx`**
```typescript
import { Box, Button, Card, CardContent, Grid, IconButton, Stack, Typography } from "@mui/material";
import { ContentCopy, Visibility, VisibilityOff } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { usePortalApi } from "../api/client";
import { ApimSubscription } from "../api/apimTypes";
import PageHeader from "../components/PageHeader";
import { useToast } from "../components/useToast";

const MySubscriptions = () => {
  const { get, post } = usePortalApi();
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<ApimSubscription[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    const result = await get<ApimSubscription[]>("/subscriptions");
    if (result.data) {
      setSubscriptions(result.data);
    } else if (result.error) {
      toast.notify(`Failed to load subscriptions: ${result.error}`, "error");
    }
  };

  const toggleKeyVisibility = (subId: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.notify(`${label} copied to clipboard`, "success");
  };

  const regenerateKey = async (subId: string, keyType: 'primary' | 'secondary') => {
    const result = await post<ApimSubscription>(
      `/subscriptions/${subId}/regenerate-key`,
      { keyType }
    );
    
    if (result.data) {
      toast.notify(`${keyType} key regenerated successfully`, "success");
      loadSubscriptions();
    } else {
      toast.notify(`Failed to regenerate key: ${result.error}`, "error");
    }
  };

  return (
    <Box>
      <PageHeader 
        title="My Subscriptions" 
        subtitle="Manage your API subscriptions and access keys"
      />
      
      <Grid container spacing={3}>
        {subscriptions.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary">
              No active subscriptions. Browse the API catalog to get started.
            </Typography>
          </Grid>
        )}
        
        {subscriptions.map((sub) => (
          <Grid item xs={12} key={sub.id}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">{sub.displayName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Status: {sub.state} | Created: {new Date(sub.createdDate).toLocaleDateString()}
                    </Typography>
                  </Box>

                  {/* Primary Key */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Primary Key</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography 
                        variant="body2" 
                        fontFamily="monospace"
                        sx={{ flex: 1 }}
                      >
                        {visibleKeys.has(sub.id) 
                          ? sub.primaryKey 
                          : '••••••••••••••••••••••••••••••••'}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => toggleKeyVisibility(sub.id)}
                      >
                        {visibleKeys.has(sub.id) ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => copyToClipboard(sub.primaryKey, 'Primary key')}
                      >
                        <ContentCopy />
                      </IconButton>
                      <Button 
                        size="small" 
                        onClick={() => regenerateKey(sub.id, 'primary')}
                      >
                        Regenerate
                      </Button>
                    </Stack>
                  </Box>

                  {/* Secondary Key */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Secondary Key</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography 
                        variant="body2" 
                        fontFamily="monospace"
                        sx={{ flex: 1 }}
                      >
                        {visibleKeys.has(sub.id) 
                          ? sub.secondaryKey 
                          : '••••••••••••••••••••••••••••••••'}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => toggleKeyVisibility(sub.id)}
                      >
                        {visibleKeys.has(sub.id) ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => copyToClipboard(sub.secondaryKey, 'Secondary key')}
                      >
                        <ContentCopy />
                      </IconButton>
                      <Button 
                        size="small" 
                        onClick={() => regenerateKey(sub.id, 'secondary')}
                      >
                        Regenerate
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default MySubscriptions;
```

### D. Update API Details Page with Subscription

**File: `src/pages/ApiDetails.tsx` - Add subscription section:**
```typescript
// Add to existing component
const [subscription, setSubscription] = useState<ApimSubscription | null>(null);
const [products, setProducts] = useState<ApimProduct[]>([]);

const requestSubscription = async (productId: string) => {
  const result = await post<ApimSubscription>('/subscriptions', {
    scope: `/products/${productId}`,
    displayName: `Subscription to ${details.name}`
  });
  
  if (result.data) {
    toast.notify('Subscription request submitted successfully', 'success');
    // Reload subscription status
    loadSubscription();
  } else {
    toast.notify(`Failed to create subscription: ${result.error}`, 'error');
  }
};
```

---

## 4. Azure Infrastructure Updates

### A. Update Bicep Template

**File: `azure/container-app.bicep`**

Add APIM integration parameters:
```bicep
@description('APIM Gateway URL')
param apimGatewayUrl string

@description('APIM Management API URL')  
param apimManagementUrl string

@description('APIM Developer Portal URL')
param apimDeveloperPortalUrl string

@secure()
@description('APIM Master Subscription Key')
param apimMasterKey string

// Add to container environment variables
{
  name: 'APIM_GATEWAY_URL'
  value: apimGatewayUrl
}
{
  name: 'APIM_MANAGEMENT_URL'
  value: apimManagementUrl
}
{
  name: 'APIM_MASTER_KEY'
  secretRef: 'apim-master-key'
}
```

### B. Add Azure Key Vault Integration

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: '${resourcePrefix}-kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: containerApp.identity.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
  }
}

resource apimKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'apim-master-key'
  properties: {
    value: apimMasterKey
  }
}
```

---

## 5. Komatsu NA APIM Framework Integration Points

### Required Documentation from Komatsu NA

Request the following from your Komatsu NA team:

1. **API Endpoints Documentation**
   - RESTful API endpoints for developer portal operations
   - Authentication mechanism (OAuth, API keys, mTLS?)
   - Request/response schemas (OpenAPI spec?)
   - Rate limiting and throttling policies

2. **Authentication & Authorization**
   - How to validate user tokens
   - How to map Entra ID users to APIM users
   - Group/role mapping for RBAC
   - API subscription approval workflow

3. **Webhook Configuration**
   - Webhook URLs for subscription events
   - User registration events
   - API update notifications
   - Deprecation warnings

4. **Customization Options**
   - Custom fields in user profile
   - Custom metadata for APIs
   - Branding and theme customization
   - Email template customization

5. **Analytics & Monitoring**
   - Analytics API endpoints
   - Metrics available (requests, errors, latency)
   - Export formats (CSV, JSON)
   - Real-time vs. batch data

### Sample Integration Questions for Komatsu NA

```
1. What is the base URL for the APIM Customization Framework REST API?
2. Does the framework support SSO integration with Entra ID?
3. How are API subscription keys managed and rotated?
4. What is the approval workflow for new subscriptions?
5. Are there sandbox vs. production environment separations?
6. How do we integrate custom content (use cases, tutorials)?
7. What analytics/telemetry data is available?
8. How are API deprecations and breaking changes communicated?
9. What is the SLA for the APIM framework endpoints?
10. Are there rate limits on the management APIs?
```

---

## 6. Testing Strategy

### A. Create Mock APIM Service (Development)

**File: `server/src/mocks/apimMock.ts`**
```typescript
import express from 'express';

export const createApimMockRouter = () => {
  const router = express.Router();

  // Mock API catalog
  router.get('/apis', (req, res) => {
    res.json([
      {
        id: 'warranty-api',
        name: 'Warranty API',
        description: 'Manage warranty claims and coverage',
        path: '/warranty/v1',
        subscriptionRequired: true,
        protocols: ['https']
      },
      // ... more mock APIs
    ]);
  });

  // Mock subscriptions
  router.get('/subscriptions', (req, res) => {
    res.json([
      {
        id: 'sub-1',
        displayName: 'Warranty API Subscription',
        state: 'active',
        primaryKey: 'mock-primary-key-12345',
        secondaryKey: 'mock-secondary-key-67890',
        createdDate: new Date().toISOString()
      }
    ]);
  });

  // Mock subscription creation
  router.post('/subscriptions', (req, res) => {
    res.status(201).json({
      id: `sub-${Date.now()}`,
      displayName: req.body.displayName,
      state: 'submitted',
      primaryKey: `pk_${Math.random().toString(36).substr(2, 32)}`,
      secondaryKey: `sk_${Math.random().toString(36).substr(2, 32)}`,
      createdDate: new Date().toISOString()
    });
  });

  return router;
};
```

### B. Integration Test Suite

```typescript
// tests/integration/apim.test.ts
import { describe, it, expect } from 'vitest';
import { apimClient } from '../src/services/apimClient';

describe('APIM Integration Tests', () => {
  it('should fetch API catalog', async () => {
    const apis = await apimClient.getApis();
    expect(apis).toBeDefined();
    expect(Array.isArray(apis)).toBe(true);
  });

  it('should create subscription', async () => {
    const subscription = await apimClient.createSubscription({
      scope: '/products/warranty-api',
      displayName: 'Test Subscription'
    });
    expect(subscription.id).toBeDefined();
    expect(subscription.primaryKey).toBeDefined();
  });

  it('should regenerate subscription keys', async () => {
    const newKey = await apimClient.regenerateKey('sub-1', 'primary');
    expect(newKey).toBeDefined();
    expect(newKey.length).toBeGreaterThan(20);
  });
});
```

---

## 7. Deployment Checklist

### Pre-Deployment
- [ ] Obtain Komatsu NA APIM framework documentation
- [ ] Set up APIM instance in Azure
- [ ] Configure Entra ID app registration with APIM permissions
- [ ] Create service principal for backend API
- [ ] Set up Azure Key Vault for secrets
- [ ] Configure CORS policies in APIM
- [ ] Create database for custom metadata (if needed)
- [ ] Set up Redis cache for API catalog
- [ ] Configure AEM integration (if applicable)

### Backend Deployment
- [ ] Deploy backend API service (App Service or Container Apps)
- [ ] Configure environment variables with APIM credentials
- [ ] Set up managed identity for Key Vault access
- [ ] Configure Application Insights
- [ ] Set up health check endpoints
- [ ] Configure auto-scaling rules
- [ ] Test APIM connectivity

### Frontend Deployment
- [ ] Update environment variables with backend API URL
- [ ] Build production bundle
- [ ] Deploy to Azure Container Apps
- [ ] Configure custom domain
- [ ] Set up CDN (Azure Front Door/CDN)
- [ ] Configure SSL/TLS certificates
- [ ] Test authentication flow
- [ ] Test API subscription workflow

### Post-Deployment
- [ ] Run integration tests
- [ ] Perform UAT testing
- [ ] Load testing with expected traffic
- [ ] Security scanning (SAST/DAST)
- [ ] Monitor Application Insights for errors
- [ ] Document known issues
- [ ] Create runbook for operations team

---

## 8. Security Considerations

### API Keys Storage
- **Never expose APIM subscription keys in frontend code**
- Store master keys in Azure Key Vault
- Use managed identities for backend-to-APIM communication
- Implement key rotation policies

### Authentication Flow
```
User → Frontend (MSAL) → Entra ID → Token
  ↓
Backend API → Validate Token → Call APIM API
  ↓
APIM → Validate Subscription Key → Call Backend Service
```

### CORS Configuration
```json
{
  "allowedOrigins": [
    "https://apimarketplace.komatsu.com",
    "https://apimarketplace-dev.komatsu.com"
  ],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["Authorization", "Content-Type"],
  "exposedHeaders": ["X-RateLimit-Remaining"],
  "maxAge": 3600
}
```

---

## 9. Monitoring & Observability

### Application Insights Custom Events
```typescript
// Track API subscription events
appInsights.trackEvent({
  name: 'SubscriptionCreated',
  properties: {
    apiId: 'warranty-api',
    userId: user.id,
    productId: 'premium-plan'
  }
});

// Track API calls
appInsights.trackDependency({
  name: 'APIM API Call',
  data: '/apis',
  duration: responseTime,
  success: response.ok,
  resultCode: response.status
});
```

### Health Check Endpoints
```typescript
// Backend health check
GET /health
{
  "status": "healthy",
  "apim": {
    "status": "connected",
    "latency": 45
  },
  "database": {
    "status": "connected"
  },
  "cache": {
    "status": "connected"
  }
}
```

---

## 10. Migration Path

### Phase 1: Preparation (Week 1-2)
1. Set up backend service skeleton
2. Integrate with mock APIM service
3. Update frontend to call backend APIs
4. Implement authentication flow
5. Create basic subscription management

### Phase 2: APIM Integration (Week 3-4)
1. Connect backend to Komatsu NA APIM framework
2. Implement API catalog synchronization
3. Add subscription key management
4. Integrate analytics endpoints
5. Set up webhook handlers

### Phase 3: Testing & Refinement (Week 5-6)
1. Integration testing with real APIM
2. Performance testing and optimization
3. Security audit and penetration testing
4. UAT with key stakeholders
5. Documentation updates

### Phase 4: Production Deployment (Week 7-8)
1. Production environment setup
2. Data migration (if needed)
3. Phased rollout to users
4. Monitoring and incident response
5. Hypercare support

---

## 11. Next Steps

1. **Schedule meeting with Komatsu NA team** to review their APIM Customization Framework
2. **Request API documentation** and authentication details
3. **Set up development APIM instance** for testing
4. **Create backend service** (Node.js/Express recommended)
5. **Update frontend code** per this guide
6. **Configure Azure infrastructure** (Key Vault, managed identities)
7. **Implement and test** one API flow end-to-end
8. **Iterate and expand** to all required features

---

## Resources

- [Azure APIM Documentation](https://learn.microsoft.com/en-us/azure/api-management/)
- [APIM Developer Portal](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-developer-portal)
- [APIM REST API Reference](https://learn.microsoft.com/en-us/rest/api/apimanagement/)
- [Managed Identity for Azure Resources](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-17  
**Author:** Komatsu IT Team
