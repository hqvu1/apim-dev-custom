import { useCallback, useMemo } from "react";
import { useAuth } from "../auth/useAuth";
import {
  ApimApiContract,
  ApimOperationContract,
  ApimPageContract,
  ApimProductContract,
  ApimSubscriptionContract,
  ApiDetails,
  ApiOperation,
  ApiProduct,
  ApiSubscription,
  ApiSummary,
  mapApimApiToSummary,
  mapApimOperationToApiOperation,
  mapApimProductToApiProduct,
} from "./types";

// ─── Environment config ───────────────────────────────────────────────────────

/**
 * Base URL of the portal backend-for-frontend (BFF).
 * In local dev: /api (proxied by Vite to the BFF or APIM data plane).
 * In container: nginx proxies /api → VITE_PORTAL_API_BASE at build time.
 *
 * The BFF uses the APIM Data API (same source as the portal's DataApiClient):
 *   https://<apim-instance>.developer.azure-api.net/developer
 * Auth: Azure Managed Identity → ARM token → SAS token injected server-side.
 * Data API returns flat contracts (no ARM .properties wrapper), matching the
 * ApimApiContract / ApimPageContract<T> types in types.ts.
 */
const API_BASE = import.meta.env.VITE_PORTAL_API_BASE ?? "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

// ─── Low-level fetch helper ───────────────────────────────────────────────────

/**
 * Generic authenticated fetch wrapper.
 * Attaches the MSAL access token as a Bearer token.
 * Mirrors the pattern used in api-management-developer-portal's DataApiClient.
 */
async function request<T>(
  getAccessToken: () => Promise<string | null>,
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const token = await getAccessToken();

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });

    if (response.status === 401) {
      return { data: null, error: "Unauthorized – token may have expired." };
    }
    if (response.status === 403) {
      return { data: null, error: "Forbidden – insufficient permissions." };
    }
    if (!response.ok) {
      return { data: null, error: `Request failed (${response.status} ${response.statusText})` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const data: T = contentType.includes("application/json")
      ? await response.json()
      : ((await response.text()) as unknown as T);

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown network error",
    };
  }
}

// ─── Low-level hook ───────────────────────────────────────────────────────────

/**
 * Returns raw authenticated GET / POST helpers.
 * Use `useApimCatalog` instead for typed catalog operations.
 */
export const usePortalApi = () => {
  const { getAccessToken } = useAuth();

  const get = useCallback(
    <T,>(path: string) => request<T>(getAccessToken, path),
    [getAccessToken]
  );

  const post = useCallback(
    <T,>(path: string, body: unknown) =>
      request<T>(getAccessToken, path, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    [getAccessToken]
  );

  const patch = useCallback(
    <T,>(path: string, body: unknown) =>
      request<T>(getAccessToken, path, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    [getAccessToken]
  );

  const del = useCallback(
    <T,>(path: string) =>
      request<T>(getAccessToken, path, { method: "DELETE" }),
    [getAccessToken]
  );

  return useMemo(
    () => ({ get, post, patch, delete: del }),
    [get, post, patch, del]
  );
};

// ─── APIM Catalog API ─────────────────────────────────────────────────────────

/**
 * High-level hook for APIM catalog operations.
 *
 * API URL conventions follow the APIM Developer Portal's apiService.ts
 * (api-management-developer-portal/src/services/apiService.ts).
 *
 * The BFF is expected to expose these paths and forward them to the APIM
 * data-plane with the subscription key injected:
 *
 *   GET /api/apis                         → list all APIs
 *   GET /api/apis/:apiId                  → single API
 *   GET /api/apis/:apiId/operations       → operations for an API
 *   GET /api/apis/:apiId/products         → products linked to an API
 *   GET /api/products                     → all products
 *   GET /api/subscriptions                → current user's subscriptions
 *   POST /api/subscriptions               → create subscription
 *   DELETE /api/subscriptions/:subId      → cancel subscription
 */
export const useApimCatalog = () => {
  const { getAccessToken } = useAuth();

  // ── helpers ──
  const get = <T,>(path: string) => request<T>(getAccessToken, path);
  const post = <T,>(path: string, body: unknown) =>
    request<T>(getAccessToken, path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  const del = <T,>(path: string) =>
    request<T>(getAccessToken, path, { method: "DELETE" });

  // ── Catalog ──────────────────────────────────────────────────────────────

  /**
   * List all APIs visible to the current user.
   * Mirrors apiService.getApis() — uses OData $top/$skip for pagination.
   */
  const listApis = async (opts?: {
    skip?: number;
    take?: number;
    pattern?: string;
    tags?: string[];
  }): Promise<ApiResult<ApiSummary[]>> => {
    const skip = opts?.skip ?? 0;
    const take = opts?.take ?? 50;

    let path = `/apis?$top=${take}&$skip=${skip}&skipWorkspaces=true`;

    if (opts?.tags?.length) {
      opts.tags.forEach((t, i) => {
        path += `&tags[${i}]=${encodeURIComponent(t)}`;
      });
    }
    if (opts?.pattern) {
      path += `&$filter=contains(name,'${encodeURIComponent(opts.pattern)}')`;
    }

    const result = await get<ApimPageContract<ApimApiContract>>(path);
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    return {
      data: result.data.value.map(mapApimApiToSummary),
      error: null,
    };
  };

  /**
   * Fetch a single API by its APIM name/id.
   * Mirrors apiService.getApi() + getOperations() + getAllApiProducts().
   */
  const getApi = async (apiId: string): Promise<ApiResult<ApiDetails>> => {
    const result = await get<ApimApiContract>(`/apis/${apiId}?expandApiVersionSet=true`);
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const summary = mapApimApiToSummary(result.data);

    // Fetch operations in parallel
    const opsResult = await get<ApimPageContract<ApimOperationContract>>(
      `/apis/${apiId}/operations?$top=100`
    );
    const operations: ApiOperation[] = opsResult.data?.value.map(
      mapApimOperationToApiOperation
    ) ?? [];

    // Fetch linked products
    const prodsResult = await get<ApimPageContract<ApimProductContract>>(
      `/apis/${apiId}/products?$top=50`
    );
    const products = prodsResult.data?.value.map(mapApimProductToApiProduct) ?? [];

    const details: ApiDetails = {
      ...summary,
      overview: result.data.description ?? summary.description,
      documentationUrl: `/api-docs/${apiId}`,
      plans: products.map((p) => ({
        name: p.name,
        quota: p.subscriptionRequired ? "Subscription required" : "Open",
        notes: p.description ?? "",
      })),
      operations,
      contact: result.data.contact,
      license: result.data.license,
      termsOfServiceUrl: result.data.termsOfServiceUrl,
    };

    return { data: details, error: null };
  };

  // ── Products ──────────────────────────────────────────────────────────────

  /**
   * List all published products.
   */
  const listProducts = async (opts?: {
    skip?: number;
    take?: number;
  }): Promise<ApiResult<ApiProduct[]>> => {
    const skip = opts?.skip ?? 0;
    const take = opts?.take ?? 50;
    const result = await get<ApimPageContract<ApimProductContract>>(
      `/products?$top=${take}&$skip=${skip}&$filter=state eq 'published'`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }
    return {
      data: result.data.value.map(mapApimProductToApiProduct),
      error: null,
    };
  };

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /**
   * Fetch the current user's subscriptions.
   */
  const listSubscriptions = async (): Promise<ApiResult<ApiSubscription[]>> => {
    const result = await get<ApimPageContract<ApimSubscriptionContract>>(
      `/subscriptions?$top=100`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const subs: ApiSubscription[] = result.data.value.map((s) => ({
      id: s.id,
      name: s.displayName ?? s.name,
      scope: s.scope,
      state: s.state ?? "active",
      primaryKey: s.primaryKey,
      secondaryKey: s.secondaryKey,
    }));

    return { data: subs, error: null };
  };

  /**
   * Create (or request) a new subscription to a product.
   */
  const createSubscription = async (
    productId: string,
    displayName: string
  ): Promise<ApiResult<ApiSubscription>> => {
    const result = await post<ApimSubscriptionContract>(`/subscriptions`, {
      scope: `/products/${productId}`,
      displayName,
      state: "submitted",
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }
    const s = result.data;
    return {
      data: {
        id: s.id,
        name: s.displayName ?? s.name,
        scope: s.scope,
        state: s.state ?? "submitted",
      },
      error: null,
    };
  };

  /**
   * Cancel / delete a subscription.
   */
  const cancelSubscription = async (
    subscriptionId: string
  ): Promise<ApiResult<void>> => {
    return del<void>(`/subscriptions/${subscriptionId}`);
  };

  return {
    listApis,
    getApi,
    listProducts,
    listSubscriptions,
    createSubscription,
    cancelSubscription,
  };
};