# Migration Guide: Updating Pages to Use APIM Management API Services

This guide shows how to update existing pages to use the new APIM Management API services.

## ApiCatalog Page

### Before (using `apimClient.ts`)
```typescript
import { useApimClient } from "@/api/apimClient";

export function ApiCatalog() {
  const { getApis } = useApimClient();
  const [apis, setApis] = useState<ApiSummary[]>([]);

  useEffect(() => {
    getApis().then(setApis);
  }, []);

  return (
    <div>
      {apis.map(api => (
        <ApiCard key={api.id} api={api} />
      ))}
    </div>
  );
}
```

### After (using `apiService.ts`)
```typescript
import { useApiService } from "@/api/services";
import type { ApiContract } from "@/api/services";

export function ApiCatalog() {
  const apiService = useApiService();
  const [apis, setApis] = useState<ApiContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApis = async () => {
      setLoading(true);
      const result = await apiService.getApis({ skip: 0, take: 20 });
      if (result) {
        setApis(result.value);
      }
      setLoading(false);
    };
    fetchApis();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div>
      {apis.map(api => (
        <ApiCard 
          key={api.id} 
          id={api.name}
          name={api.name}
          displayName={api.properties?.displayName || api.name}
          description={api.properties?.description}
          protocols={api.properties?.protocols}
        />
      ))}
    </div>
  );
}
```

**Note**: `ApiContract` from Management API has a different structure. Properties are nested under `api.properties.*`.

## ApiDetails Page

### Before
```typescript
const { getApiById } = useApimClient();
const [api, setApi] = useState<ApiDetails | null>(null);

useEffect(() => {
  getApiById(apiId).then(setApi);
}, [apiId]);
```

### After
```typescript
import { useApiService } from "@/api/services";
import type { ApiContract, OperationContract } from "@/api/services";

const apiService = useApiService();
const [api, setApi] = useState<ApiContract | null>(null);
const [operations, setOperations] = useState<OperationContract[]>([]);

useEffect(() => {
  const fetchApiDetails = async () => {
    const [apiData, opsData] = await Promise.all([
      apiService.getApi(apiId),
      apiService.getOperations(apiId)
    ]);
    
    setApi(apiData);
    setOperations(opsData?.value || []);
  };
  
  fetchApiDetails();
}, [apiId]);
```

## MyIntegrations Page (User Subscriptions)

### New Implementation
```typescript
import { useProductService, useUserService } from "@/api/services";
import type { SubscriptionWithProduct } from "@/api/services";

export function MyIntegrations() {
  const productService = useProductService();
  const userService = useUserService();
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithProduct[]>([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Get current user
      const currentUser = await userService.getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        // Get subscriptions with product names
        const subs = await productService.getUserSubscriptionsWithProductName(
          currentUser.id
        );
        setSubscriptions(subs.value);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, []);

  const handleRegenerateKey = async (subscriptionId: string, keyType: 'primary' | 'secondary') => {
    if (keyType === 'primary') {
      await productService.regeneratePrimaryKey(subscriptionId);
    } else {
      await productService.regenerateSecondaryKey(subscriptionId);
    }
    
    // Refresh subscriptions
    const subs = await productService.getUserSubscriptionsWithProductName(user.id);
    setSubscriptions(subs.value);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div>
      <h1>My Subscriptions</h1>
      {subscriptions.map(sub => (
        <SubscriptionCard
          key={sub.id}
          subscription={sub}
          onRegenerateKey={handleRegenerateKey}
        />
      ))}
    </div>
  );
}
```

## Subscribe to API/Product Page

### New Implementation
```typescript
import { useProductService, useUserService } from "@/api/services";
import type { ProductContract } from "@/api/services";

export function Register() {
  const productService = useProductService();
  const userService = useUserService();
  const [products, setProducts] = useState<ProductContract[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [subscriptionName, setSubscriptionName] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const allProducts = await productService.getProducts();
      setProducts(allProducts);
    };
    fetchProducts();
  }, []);

  const handleSubscribe = async () => {
    const user = await userService.getCurrentUser();
    if (!user) {
      console.error("User not authenticated");
      return;
    }

    const subscriptionId = `sub-${Date.now()}`;
    
    await productService.createSubscription(
      subscriptionId,
      user.id,
      selectedProduct,
      subscriptionName
    );
    
    // Show success message or redirect
    console.log("Subscription created successfully!");
  };

  return (
    <div>
      <h1>Subscribe to a Product</h1>
      <select 
        value={selectedProduct} 
        onChange={(e) => setSelectedProduct(e.target.value)}
      >
        <option value="">Select a product</option>
        {products.map(product => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      
      <input
        type="text"
        placeholder="Subscription name"
        value={subscriptionName}
        onChange={(e) => setSubscriptionName(e.target.value)}
      />
      
      <button onClick={handleSubscribe}>Subscribe</button>
    </div>
  );
}
```

## API Try-It Console

### New Implementation (with subscription keys)
```typescript
import { useApiService, useProductService } from "@/api/services";
import type { OperationContract } from "@/api/services";

export function ApiTryIt() {
  const apiService = useApiService();
  const productService = useProductService();
  const [operation, setOperation] = useState<OperationContract | null>(null);
  const [subscriptionKey, setSubscriptionKey] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      // Get operation details
      const op = await apiService.getOperation(apiId, operationId);
      setOperation(op);
      
      // Get user's subscription key
      const user = await userService.getCurrentUser();
      if (user) {
        const subs = await productService.getSubscriptions(user.id);
        if (subs.value.length > 0) {
          setSubscriptionKey(subs.value[0].primaryKey || "");
        }
      }
    };
    
    fetchData();
  }, [apiId, operationId]);

  const executeRequest = async () => {
    if (!operation) return;
    
    const response = await fetch(
      `${APIM_GATEWAY_URL}${operation.properties.urlTemplate}`,
      {
        method: operation.properties.method,
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Handle response...
  };

  return (
    <div>
      <h1>Try {operation?.properties.displayName}</h1>
      <input
        type="text"
        placeholder="Subscription Key"
        value={subscriptionKey}
        onChange={(e) => setSubscriptionKey(e.target.value)}
      />
      <button onClick={executeRequest}>Execute</button>
    </div>
  );
}
```

## Search and Filtering

### Search APIs by name
```typescript
const [searchTerm, setSearchTerm] = useState("");

const handleSearch = async () => {
  const result = await apiService.getApis({
    pattern: searchTerm,
    skip: 0,
    take: 20
  });
  setApis(result.value);
};
```

### Filter by tags
```typescript
const [selectedTags, setSelectedTags] = useState([]);

const handleFilterByTags = async () => {
  const result = await apiService.getApisByTags({
    tags: selectedTags.map(tag => ({ id: tag.id, name: tag.name })),
    skip: 0,
    take: 20
  });
  
  // Result is grouped by tags
  const allApis = result.value.flatMap(group => group.items);
  setApis(allApis);
};
```

## Key Differences to Remember

### 1. Response Structure
Management API responses are wrapped in a `Page` structure:
```typescript
{
  value: [...],    // Array of items
  count: 100,      // Total count
  nextLink: "..."  // Link to next page
}
```

### 2. Property Nesting
REST API:
```typescript
api.displayName
api.description
```

Management API:
```typescript
api.properties.displayName
api.properties.description
```

### 3. Resource IDs
Management API uses full ARM resource IDs:
```typescript
// REST API
"echo-api"

// Management API
"/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{service}/apis/echo-api"
```

For convenience, the services accept short IDs and handle formatting internally.

### 4. Pagination
Always handle pagination:
```typescript
const fetchAllApis = async () => {
  let allApis = [];
  let skip = 0;
  const take = 20;
  
  while (true) {
    const result = await apiService.getApis({ skip, take });
    if (!result || result.value.length === 0) break;
    
    allApis.push(...result.value);
    skip += take;
    
    if (!result.nextLink) break;
  }
  
  return allApis;
};
```

## Update MSAL Configuration

To use Management API, ensure your MSAL config includes the proper scope:

**msalConfig.ts**:
```typescript
export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "https://management.azure.com/.default"  // Add this for Management API
  ]
};
```

## Testing

After migration, test these scenarios:

- [ ] Can browse API catalog
- [ ] Can view API details and operations
- [ ] Can search APIs by name
- [ ] Can filter APIs by tags
- [ ] Can view user subscriptions
- [ ] Can create new subscriptions
- [ ] Can regenerate subscription keys
- [ ] Can cancel subscriptions
- [ ] Can export API definitions (OpenAPI, Swagger)
- [ ] Can view API version sets
- [ ] Can view API changelog

## Rollback Plan

If migration causes issues, the old `apimClient.ts` can still be used alongside the new services:

```typescript
// Use both simultaneously during transition
import { useApimClient } from "@/api/apimClient";  // Old REST API
import { useApiService } from "@/api/services";     // New Management API

// Fall back to REST API if Management API fails
const apis = await apiService.getApis() || await apimClient.getApis();
```
