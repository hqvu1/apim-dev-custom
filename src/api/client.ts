import { useCallback, useMemo } from "react";
import { useAuth } from "../auth/useAuth";
import { appConfig } from "../config";
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
 * Resolved from centralized config (runtime → build-time → default).
 *
 * The BFF is expected to forward requests to the APIM data-plane URL:
 *   https://<apim-instance>.azure-api.net
 * and inject the Ocp-Apim-Subscription-Key header server-side, so the SPA
 * never holds the management key.
 *
 * @see docs/ARCHITECTURE_DESIGN.md §4 — BFF Architecture
 */
const API_BASE = appConfig.apiBase;

// ─── Retry / resilience config ────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Structured error returned by the API client.
 * Gives callers enough context to display user-friendly messages or
 * retry / redirect logic.
 */
export type ApiError = {
  message: string;
  status?: number;
  code?: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "NETWORK" | "ABORTED" | "SERVER";
};

export type ApiResult<T> = {
  data: T | null;
  error: ApiError | null;
};

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Exponential backoff delay for retry logic. */
const retryDelay = (attempt: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)));

/** Map well-known HTTP status codes to structured ApiError. Returns null for retryable/success. */
function mapStatusToError(response: Response): ApiError | null {
  if (response.status === 401)
    return { message: "Unauthorized – token may have expired.", status: 401, code: "UNAUTHORIZED" };
  if (response.status === 403)
    return { message: "Forbidden – insufficient permissions.", status: 403, code: "FORBIDDEN" };
  if (response.status === 404)
    return { message: "Resource not found.", status: 404, code: "NOT_FOUND" };
  return null;
}

/** Parse the response body based on content-type. */
async function parseResponseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? response.json()
    : ((await response.text()) as unknown as T);
}

// ─── Low-level fetch with retry & AbortController ─────────────────────────────

type AttemptResult<T> = { done: true; result: ApiResult<T> } | { done: false };

/** Single fetch attempt. Returns `{ done: true, result }` or `{ done: false }` to retry. */
async function singleAttempt<T>(
  url: string,
  token: string | null,
  options?: RequestInit & { signal?: AbortSignal },
  canRetry = false
): Promise<AttemptResult<T>> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const clientError = mapStatusToError(response);
  if (clientError) return { done: true, result: { data: null, error: clientError } };

  if (!response.ok) {
    if (RETRYABLE_STATUS_CODES.has(response.status) && canRetry) return { done: false };
    return {
      done: true,
      result: {
        data: null,
        error: { message: `Request failed (${response.status} ${response.statusText})`, status: response.status, code: "SERVER" },
      },
    };
  }

  return { done: true, result: { data: await parseResponseBody<T>(response), error: null } };
}

/** Classify a caught error into an ApiResult or null if retryable. */
function classifyCatchError(err: unknown, canRetry: boolean): ApiError | null {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { message: "Request was cancelled.", code: "ABORTED" };
  }
  if (canRetry) return null; // signal caller to retry
  return { message: err instanceof Error ? err.message : "Unknown network error", code: "NETWORK" };
}

/**
 * Generic authenticated fetch wrapper.
 * - Attaches the MSAL access token as a Bearer header.
 * - Supports AbortController for request cancellation (e.g., unmounting).
 * - Retries on 429 / 5xx with exponential backoff (mirrors Polly on BFF).
 *
 * @see docs/BFF_MIGRATION_DECISION.md — Polly retry policies on the BFF side
 */
async function request<T>(
  getAccessToken: () => Promise<string | null>,
  path: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<ApiResult<T>> {
  const url = `${API_BASE}${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = await getAccessToken();
      const outcome = await singleAttempt<T>(url, token, options, attempt < MAX_RETRIES);
      if (outcome.done) return outcome.result;
    } catch (err) {
      const error = classifyCatchError(err, attempt < MAX_RETRIES);
      if (error) return { data: null, error };
    }
    await retryDelay(attempt);
  }

  return { data: null, error: { message: "Max retries exceeded.", code: "SERVER" } };
}

// ─── Low-level hook ───────────────────────────────────────────────────────────

/**
 * Returns raw authenticated GET / POST / PATCH / DELETE helpers.
 * Use `useApimCatalog` instead for typed catalog operations.
 *
 * All methods accept an optional `AbortSignal` for cancellation.
 * Callers should pass a signal from `AbortController` in `useEffect` cleanup
 * to prevent state updates after unmount.
 */
export const usePortalApi = () => {
  const { getAccessToken } = useAuth();

  const get = useCallback(
    <T,>(path: string, signal?: AbortSignal) =>
      request<T>(getAccessToken, path, { signal }),
    [getAccessToken]
  );

  const post = useCallback(
    <T,>(path: string, body: unknown, signal?: AbortSignal) =>
      request<T>(getAccessToken, path, {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      }),
    [getAccessToken]
  );

  const patch = useCallback(
    <T,>(path: string, body: unknown, signal?: AbortSignal) =>
      request<T>(getAccessToken, path, {
        method: "PATCH",
        body: JSON.stringify(body),
        signal,
      }),
    [getAccessToken]
  );

  const del = useCallback(
    <T,>(path: string, signal?: AbortSignal) =>
      request<T>(getAccessToken, path, { method: "DELETE", signal }),
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