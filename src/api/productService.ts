/**
 * APIM Product Service
 * 
 * Service for managing products and subscriptions.
 * Ported from api-management-developer-portal with adaptations for React hooks.
 */

import { useMapiClient, type Page } from "./mapiClient";
import type {
  ProductContract,
  SubscriptionContract,
  ApiContract,
  SubscriptionSecrets,
} from "./contracts";
import { SubscriptionState } from "./contracts";
import type { SearchQuery } from "./apiService";

const DEFAULT_PAGE_SIZE = 20;

// Encode special characters for OData queries
const encodeForOData = (value: string): string => {
  return encodeURIComponent(value)
    .replace(/'/g, "''")
    .replace(/%20/g, " ");
};

// Add query parameter to URL
const addQueryParam = (url: string, param: string): string => {
  return url + (url.includes("?") ? "&" : "?") + param;
};

// Extract resource name from scope/resourceId
const getResourceName = (resourceType: string, resourceId: string): string => {
  const pattern = new RegExp(`/${resourceType}/([^/]+)`);
  const match = pattern.exec(resourceId);
  return match ? match[1] : "";
};

/**
 * Extended subscription with product name
 */
export interface SubscriptionWithProduct extends SubscriptionContract {
  productName?: string;
}

/**
 * React hook for APIM Product Service
 */
export const useProductService = () => {
  const mapiClient = useMapiClient();

  /**
   * Check if a subscription scope is valid for given API and products
   */
  const isScopeValid = (
    scope: string,
    apiName?: string,
    products?: ProductContract[]
  ): boolean => {
    if (!scope) return false;

    // Check if scope matches "all APIs"
    if (scope.endsWith("/apis")) return true;

    // Check if scope matches specific API
    if (apiName && scope.includes(`/apis/${apiName}`)) return true;

    // Check if scope matches any of the provided products
    if (products && products.length > 0) {
      return products.some((product) => scope.includes(product.id));
    }

    return true;
  };

  /**
   * Get user subscriptions with optional product filter
   */
  const getSubscriptions = async (
    userId: string,
    productId?: string,
    searchQuery?: SearchQuery
  ): Promise<Page<SubscriptionContract>> => {
    if (!userId) {
      throw new Error('Parameter "userId" not specified.');
    }

    const skip = searchQuery?.skip || 0;
    const take = searchQuery?.take || DEFAULT_PAGE_SIZE;
    const odataFilters: string[] = [];

    let path = `${userId}/subscriptions?$top=${take}&$skip=${skip}`;

    // Filter by product
    if (productId) {
      const formattedProductId = productId.startsWith("/products/")
        ? productId
        : `/products/${productId}`;
      odataFilters.push(`(endswith(scope,'${formattedProductId}'))`);
    }

    // Filter by pattern
    if (searchQuery?.pattern) {
      const pattern = encodeForOData(searchQuery.pattern);
      odataFilters.push(`(contains(name,'${pattern}'))`);
    }

    if (odataFilters.length > 0) {
      path = addQueryParam(path, `$filter=${odataFilters.join(" and ")}`);
    }

    try {
      const result = await mapiClient.get<Page<SubscriptionContract>>(path);
      if (!result) {
        return { value: [], count: 0 };
      }

      // Filter active subscriptions
      const activeSubscriptions = result.value.filter(
        (sub) => sub.state === SubscriptionState.active
      );

      return {
        value: activeSubscriptions,
        count: result.count,
        nextLink: result.nextLink,
      };
    } catch (error) {
      console.error(`Unable to retrieve subscriptions for user ${userId}:`, error);
      return { value: [], count: 0 };
    }
  };

  /**
   * Get all user subscriptions (across all pages)
   */
  const getProductsAllSubscriptions = async (
    apiName: string,
    products: ProductContract[],
    userId: string,
    searchQuery?: SearchQuery
  ): Promise<SubscriptionContract[]> => {
    if (!userId) {
      throw new Error('Parameter "userId" not specified.');
    }

    const odataFilters: string[] = [];

    if (searchQuery?.pattern) {
      const pattern = encodeForOData(searchQuery.pattern);
      odataFilters.push(`(contains(name,'${pattern}'))`);
    }

    let path = `${userId}/subscriptions?$top=100&$skip=0`;

    if (odataFilters.length > 0) {
      path = addQueryParam(path, `$filter=${odataFilters.join(" and ")}`);
    }

    try {
      const allContracts = await mapiClient.getAll<SubscriptionContract>(path);
      
      // Filter subscriptions
      const filteredSubscriptions: SubscriptionContract[] = [];

      for (const subscription of allContracts) {
        // Only keep active subscriptions
        if (subscription.state !== SubscriptionState.active) {
          continue;
        }

        // Check scope validity
        if ((products?.length > 0 || apiName) && !isScopeValid(subscription.scope, apiName, products)) {
          continue;
        }

        filteredSubscriptions.push(subscription);

        // Limit to default page size
        if (filteredSubscriptions.length >= DEFAULT_PAGE_SIZE) {
          break;
        }
      }

      return filteredSubscriptions;
    } catch (error) {
      console.error(`Unable to retrieve subscriptions for user ${userId}:`, error);
      return [];
    }
  };

  /**
   * Get user subscriptions with product names resolved
   */
  const getUserSubscriptionsWithProductName = async (
    userId: string,
    searchQuery?: SearchQuery
  ): Promise<Page<SubscriptionWithProduct>> => {
    if (!userId) {
      throw new Error('Parameter "userId" not specified.');
    }

    const skip = searchQuery?.skip || 0;
    const take = searchQuery?.take || DEFAULT_PAGE_SIZE;
    const path = `${userId}/subscriptions?$top=${take}&$skip=${skip}`;

    try {
      const result = await mapiClient.get<Page<SubscriptionContract>>(path);
      if (!result?.value) {
        return { value: [], count: 0 };
      }

      const subscriptionsWithProducts: SubscriptionWithProduct[] = [];
      const promises: Promise<void>[] = [];

      for (const subscription of result.value) {
        const subscriptionWithProduct: SubscriptionWithProduct = { ...subscription };

        // Resolve product name from scope
        if (subscription.scope.endsWith("/apis")) {
          subscriptionWithProduct.productName = "All APIs";
        } else if (subscription.scope.includes("/apis/")) {
          const apiName = getResourceName("apis", subscription.scope);
          const apiPromise = mapiClient
            .get<ApiContract>(`/apis/${apiName}`)
            .then((api) => {
              if (api) {
                subscriptionWithProduct.productName = `API: ${api.name}`;
              }
            })
            .catch((error) => console.error(`Get API error: ${error}`));
          promises.push(apiPromise);
        } else {
          const productName = getResourceName("products", subscription.scope);
          const productPromise = mapiClient
            .get<ProductContract>(`/products/${productName}`)
            .then((product) => {
              if (product) {
                subscriptionWithProduct.productName = product.name;
              }
            })
            .catch((error) => console.error(`Get product error: ${error}`));
          promises.push(productPromise);
        }

        subscriptionsWithProducts.push(subscriptionWithProduct);
      }

      // Wait for all product names to be resolved
      await Promise.all(promises);

      return {
        value: subscriptionsWithProducts,
        count: result.count,
        nextLink: result.nextLink,
      };
    } catch (error) {
      console.error(`Unable to retrieve subscriptions for user ${userId}:`, error);
      return { value: [], count: 0 };
    }
  };

  /**
   * Get single subscription by ID
   */
  const getSubscription = async (subscriptionId: string): Promise<SubscriptionContract | null> => {
    if (!subscriptionId) {
      throw new Error('Parameter "subscriptionId" not specified.');
    }

    const formattedId = subscriptionId.startsWith("/subscriptions/")
      ? subscriptionId
      : `/subscriptions/${subscriptionId}`;

    return mapiClient.get<SubscriptionContract>(formattedId);
  };

  /**
   * Get all products
   */
  const getProducts = async (getAll = false): Promise<ProductContract[]> => {
    const result = await mapiClient.get<Page<ProductContract>>("/products");
    if (!result?.value) {
      return [];
    }

    if (getAll) {
      return result.value;
    }

    // Filter to only subscription-required products
    return result.value.filter((product) => product.subscriptionRequired === true);
  };

  /**
   * Get paginated products with search
   */
  const getProductsPage = async (searchQuery: SearchQuery): Promise<Page<ProductContract>> => {
    const skip = searchQuery.skip || 0;
    const take = searchQuery.take || DEFAULT_PAGE_SIZE;

    let path = `/products?$top=${take}&$skip=${skip}`;

    if (searchQuery.pattern) {
      const pattern = encodeURIComponent(searchQuery.pattern);
      path = addQueryParam(path, `$filter=(contains(name,'${pattern}'))`);
    }

    path = addQueryParam(path, "skipWorkspaces=true");

    const result = await mapiClient.get<Page<ProductContract>>(path);
    return result || { value: [], count: 0 };
  };

  /**
   * Get single product by ID
   */
  const getProduct = async (productId: string): Promise<ProductContract | null> => {
    if (!productId) {
      throw new Error('Parameter "productId" not specified.');
    }

    const formattedId = productId.startsWith("/products/")
      ? productId
      : `/products/${productId}`;

    return mapiClient.get<ProductContract>(formattedId);
  };

  /**
   * Create new subscription
   */
  const createSubscription = async (
    subscriptionId: string,
    userId: string,
    scope: string,
    subscriptionName: string
  ): Promise<SubscriptionContract | null> => {
    if (!subscriptionId || !userId || !scope || !subscriptionName) {
      throw new Error("Missing required parameters for creating subscription.");
    }

    const path = `${userId}/subscriptions/${subscriptionId}`;
    const payload = {
      properties: {
        scope,
        displayName: subscriptionName,
      },
    };

    return mapiClient.put<SubscriptionContract>(path, payload);
  };

  /**
   * Cancel subscription
   */
  const cancelSubscription = async (subscriptionId: string): Promise<SubscriptionContract | null> => {
    if (!subscriptionId) {
      throw new Error('Parameter "subscriptionId" not specified.');
    }

    const formattedId = subscriptionId.startsWith("/subscriptions/")
      ? subscriptionId
      : `/subscriptions/${subscriptionId}`;

    const payload = {
      properties: {
        state: SubscriptionState.cancelled,
      },
    };

    await mapiClient.patch<SubscriptionContract>(formattedId, payload, {
      "If-Match": "*",
    });

    return getSubscription(subscriptionId);
  };

  /**
   * Regenerate subscription primary key
   */
  const regeneratePrimaryKey = async (subscriptionId: string): Promise<SubscriptionContract | null> => {
    if (!subscriptionId) {
      throw new Error('Parameter "subscriptionId" not specified.');
    }

    const formattedId = subscriptionId.startsWith("/subscriptions/")
      ? subscriptionId
      : `/subscriptions/${subscriptionId}`;

    await mapiClient.post(`${formattedId}/regeneratePrimaryKey`, {});
    return getSubscription(subscriptionId);
  };

  /**
   * Regenerate subscription secondary key
   */
  const regenerateSecondaryKey = async (subscriptionId: string): Promise<SubscriptionContract | null> => {
    if (!subscriptionId) {
      throw new Error('Parameter "subscriptionId" not specified.');
    }

    const formattedId = subscriptionId.startsWith("/subscriptions/")
      ? subscriptionId
      : `/subscriptions/${subscriptionId}`;

    await mapiClient.post(`${formattedId}/regenerateSecondaryKey`, {});
    return getSubscription(subscriptionId);
  };

  /**
   * Get subscription secrets (keys)
   */
  const getSubscriptionSecrets = async (subscriptionId: string): Promise<SubscriptionSecrets | null> => {
    if (!subscriptionId) {
      throw new Error('Parameter "subscriptionId" not specified.');
    }

    const formattedId = subscriptionId.startsWith("/subscriptions/")
      ? subscriptionId
      : `/subscriptions/${subscriptionId}`;

    return mapiClient.post<SubscriptionSecrets>(`${formattedId}/listSecrets`, {});
  };

  return {
    getSubscriptions,
    getProductsAllSubscriptions,
    getUserSubscriptionsWithProductName,
    getSubscription,
    getProducts,
    getProductsPage,
    getProduct,
    createSubscription,
    cancelSubscription,
    regeneratePrimaryKey,
    regenerateSecondaryKey,
    getSubscriptionSecrets,
  };
};
