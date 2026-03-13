# APIM Management API Integration

This directory contains the ported APIM Management API integration from `api-management-developer-portal`.

## Overview

The integration provides comprehensive access to Azure API Management features through the Management API, including:

- **API Catalog**: Browse, search, and filter APIs
- **Operations**: View API operations with parameters and responses
- **Products**: Manage subscription products
- **Subscriptions**: Create, manage, and regenerate subscription keys
- **Users**: User profile and subscription management
- **Schemas**: API schema definitions (OpenAPI, Swagger, etc.)
- **Version Sets**: API versioning support

## Architecture

### 1. Management API Client (`mapiClient.ts`)

Base client for Azure APIM Management API requests. Constructs URLs following Azure Resource Manager (ARM) pattern:

```
https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ApiManagement/service/{serviceName}
```

**Configuration Required** (in `.env`):
```env
VITE_AZURE_SUBSCRIPTION_ID=your-subscription-id
VITE_AZURE_RESOURCE_GROUP=your-resource-group
VITE_AZURE_APIM_SERVICE_NAME=your-apim-service
VITE_AZURE_APIM_API_VERSION=2022-08-01
```

**Authentication**: Uses Azure AD tokens from `useAuth()` hook. User needs proper RBAC permissions (API Management Service Contributor or higher).

### 2. Services

Each service is a React hook that uses `useMapiClient()`:

- **`useApiService()`** - API catalog and operations management
- **`useProductService()`** - Products and subscriptions management
- **`useUserService()`** - User profile and subscriptions

### 3. Contracts (`contracts.ts`)

TypeScript type definitions matching Azure APIM Management API response schemas.

## Usage

### Basic Example

```typescript
import { useApiService } from '@/api/services';

function ApiCatalog() {
  const apiService = useApiService();
  const [apis, setApis] = React.useState([]);

  React.useEffect(() => {
    const fetchApis = async () => {
      const result = await apiService.getApis();
      setApis(result.value);
    };
    fetchApis();
  }, []);

  return (
    <div>
      {apis.map(api => (
        <div key={api.id}>{api.name}</div>
      ))}
    </div>
  );
}
```

### API Service Examples

```typescript
const apiService = useApiService();

// Get all APIs with pagination
const apis = await apiService.getApis({ skip: 0, take: 20 });

// Search APIs by pattern
const searchResults = await apiService.getApis({
  pattern: 'customer',
  skip: 0,
  take: 20
});

// Get single API
const api = await apiService.getApi('my-api-id');

// Get API operations
const operations = await apiService.getOperations('my-api-id');

// Get operations grouped by tags
const operationsByTags = await apiService.getOperationsByTags('my-api-id');

// Export API definition
const openApiSpec = await apiService.exportApi('my-api-id', 'openapi+json');

// Get API version set
const versionSet = await apiService.getApiVersionSet('version-set-id');
```

### Product Service Examples

```typescript
const productService = useProductService();

// Get all products
const products = await productService.getProducts();

// Get paginated products with search
const productPage = await productService.getProductsPage({
  pattern: 'premium',
  skip: 0,
  take: 20
});

// Get single product
const product = await productService.getProduct('product-id');

// Get user subscriptions
const subscriptions = await productService.getSubscriptions('user-id');

// Get subscriptions with product names resolved
const subsWithNames = await productService.getUserSubscriptionsWithProductName('user-id');

// Create subscription
await productService.createSubscription(
  'sub-id',
  'user-id',
  '/products/starter',
  'My Subscription'
);

// Regenerate keys
await productService.regeneratePrimaryKey('subscription-id');
await productService.regenerateSecondaryKey('subscription-id');

// Cancel subscription
await productService.cancelSubscription('subscription-id');
```

### User Service Examples

```typescript
const userService = useUserService();

// Get current user
const currentUser = await userService.getCurrentUser();

// Get user by ID
const user = await userService.getUser('user-id');

// Update current user
await userService.updateCurrentUser('John', 'Doe', 'john.doe@example.com');

// Get user display name
const displayName = userService.getUserDisplayName(user);
```

### Advanced Search with Tags

```typescript
// Search APIs by tags
const taggedApis = await apiService.getApisByTags({
  tags: [{ id: 'tag-id', name: 'public' }],
  pattern: 'customer',
  skip: 0,
  take: 20
});

// Search operations by tags
const taggedOps = await apiService.getOperationsByTags('api-id', {
  tags: [{ id: 'tag-id', name: 'core' }]
});
```

## Migration from Existing `apimClient.ts`

The existing `apimClient.ts` uses direct APIM REST API calls. The new services use Azure Management API for more comprehensive features.

### Old Approach (REST API)
```typescript
const { getApis } = useApimClient();
const apis = await getApis(); // Direct REST API call
```

### New Approach (Management API)
```typescript
const apiService = useApiService();
const apis = await apiService.getApis(); // Management API call
```

**Benefits of Management API:**
- Complete CRUD operations
- Subscription management
- User management
- Product management
- Richer metadata
- Tag-based filtering
- Version set support

**When to use REST API vs Management API:**
- **REST API** (`apimClient.ts`): Public-facing operations, anonymous access, lightweight queries
- **Management API** (new services): Admin operations, subscription management, full catalog features

## Setup Checklist

- [ ] Set Azure Resource Manager configuration in `.env`:
  - `VITE_AZURE_SUBSCRIPTION_ID`
  - `VITE_AZURE_RESOURCE_GROUP`
  - `VITE_AZURE_APIM_SERVICE_NAME`
  - `VITE_AZURE_APIM_API_VERSION`

- [ ] Ensure Azure AD authentication is configured:
  - User has "API Management Service Contributor" role or higher
  - Access token includes scope: `https://management.azure.com/.default`

- [ ] Update MSAL configuration if needed:
  - Add management.azure.com to scopes in `msalConfig.ts`

## Error Handling

All services return `null` or empty results on errors and log errors to console. Wrap calls in try-catch for custom error handling:

```typescript
try {
  const apis = await apiService.getApis();
  if (!apis || apis.value.length === 0) {
    // Handle empty result
  }
} catch (error) {
  // Handle error
  console.error('Failed to fetch APIs:', error);
}
```

## Type Safety

All contracts are fully typed. Use TypeScript's type inference:

```typescript
import type { ApiContract, OperationContract } from '@/api/services';

const api: ApiContract = await apiService.getApi('api-id');
const operations: OperationContract[] = (await apiService.getOperations('api-id')).value;
```

## Performance Considerations

1. **Pagination**: Always use pagination for large datasets
2. **Caching**: Consider implementing client-side caching for frequently accessed data
3. **Parallel Requests**: Use `Promise.all()` for independent requests:

```typescript
const [apis, products, user] = await Promise.all([
  apiService.getApis(),
  productService.getProducts(),
  userService.getCurrentUser()
]);
```

## Troubleshooting

### "APIM Management API base URL not configured"
- Check that all Azure Resource Manager environment variables are set
- Verify `.env` file is properly loaded

### 401 Unauthorized
- Ensure user has proper RBAC permissions on APIM service
- Check that access token includes `https://management.azure.com/.default` scope
- Verify Azure AD authentication is working

### 404 Not Found
- Verify resource IDs are correct (some APIs expect full ARM paths like `/apis/my-api`)
- Check that APIM service name, resource group, and subscription ID are correct

## References

- [Azure APIM Management API Documentation](https://docs.microsoft.com/en-us/rest/api/apimanagement/)
- [Azure APIM REST API Reference](https://docs.microsoft.com/en-us/rest/api/apimanagement/current-ga/apis)
- [RBAC Permissions for APIM](https://docs.microsoft.com/en-us/azure/api-management/api-management-role-based-access-control)
