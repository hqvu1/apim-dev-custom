/**
 * Azure API Management - Management API Client
 * 
 * Calls Azure APIM Management APIs via Azure Resource Manager (ARM).
 * Requires Azure AD authentication with proper RBAC permissions.
 * 
 * Base URL pattern:
 * https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ApiManagement/service/{serviceName}
 */

import { useAuth } from "../auth/useAuth";

// Configuration from environment
const getManagementApiConfig = () => {
  const subscriptionId = import.meta.env.VITE_AZURE_SUBSCRIPTION_ID;
  const resourceGroupName = import.meta.env.VITE_AZURE_RESOURCE_GROUP;
  const serviceName = import.meta.env.VITE_AZURE_APIM_SERVICE_NAME;
  const apiVersion = import.meta.env.VITE_AZURE_APIM_API_VERSION || "2022-08-01";

  if (!subscriptionId || !resourceGroupName || !serviceName) {
    console.warn(
      "Azure APIM Management API configuration incomplete. Set VITE_AZURE_SUBSCRIPTION_ID, VITE_AZURE_RESOURCE_GROUP, and VITE_AZURE_APIM_SERVICE_NAME in .env"
    );
  }

  return {
    subscriptionId,
    resourceGroupName,
    serviceName,
    apiVersion,
    baseUrl: subscriptionId && resourceGroupName && serviceName
      ? `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.ApiManagement/service/${serviceName}`
      : null,
  };
};

export interface MapiRequestOptions {
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export interface Page<T> {
  value: T[];
  count?: number;
  nextLink?: string;
}

/**
 * React hook for Azure APIM Management API client
 */
export const useMapiClient = () => {
  const { getAccessToken } = useAuth();
  const config = getManagementApiConfig();

  /**
   * Make a request to the APIM Management API
   */
  const request = async <T>(
    path: string,
    options: MapiRequestOptions = {}
  ): Promise<T | null> => {
    if (!config.baseUrl) {
      console.error("APIM Management API base URL not configured");
      return null;
    }

    try {
      const token = await getAccessToken();
      
      // Ensure path starts with /
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      
      // Add api-version if not present
      let url: string;
      if (normalizedPath.includes("api-version")) {
        url = `${config.baseUrl}${normalizedPath}`;
      } else {
        const separator = normalizedPath.includes("?") ? "&" : "?";
        url = `${config.baseUrl}${normalizedPath}${separator}api-version=${config.apiVersion}`;
      }

      const fetchOptions: RequestInit = {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      };

      if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        console.error(`APIM Management API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as T;
      }

      return (await response.text()) as T;
    } catch (error) {
      console.error("APIM Management API request failed:", error);
      return null;
    }
  };

  /**
   * GET request
   */
  const get = async <T>(path: string, headers?: Record<string, string>): Promise<T | null> => {
    return request<T>(path, { headers });
  };

  /**
   * POST request
   */
  const post = async <T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T | null> => {
    return request<T>(path, { method: "POST", body, headers });
  };

  /**
   * PUT request
   */
  const put = async <T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T | null> => {
    return request<T>(path, { method: "PUT", body, headers });
  };

  /**
   * PATCH request
   */
  const patch = async <T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T | null> => {
    return request<T>(path, { method: "PATCH", body, headers });
  };

  /**
   * DELETE request
   */
  const del = async <T>(path: string, headers?: Record<string, string>): Promise<T | null> => {
    return request<T>(path, { method: "DELETE", headers });
  };

  /**
   * Get all items from a paginated endpoint
   * Follows nextLink to fetch all pages
   */
  const getAll = async <T>(path: string, headers?: Record<string, string>): Promise<T[]> => {
    const items: T[] = [];
    let nextPath: string | null = path;

    while (nextPath) {
      const page: Page<T> | null = await get<Page<T>>(nextPath, headers);
      if (!page) break;

      items.push(...page.value);

      // Extract nextLink if present
      nextPath = page.nextLink
        ? page.nextLink.replace(config.baseUrl || "", "")
        : null;
    }

    return items;
  };

  return {
    get,
    post,
    put,
    patch,
    delete: del,
    getAll,
    config,
  };
};
