/**
 * useApiData — Generic data-fetching hook with loading/error state and
 * automatic cleanup via AbortController.
 *
 * Encapsulates the "fetch on mount, cancel on unmount" pattern used across
 * ApiCatalog, ApiDetails, News, MyIntegrations, etc.
 *
 * @example
 *   const { data, loading, error, refetch } = useApiData<ApiSummary[]>("/apis");
 *
 * @see docs/ARCHITECTURE_DESIGN.md §2 — Frontend Architecture
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePortalApi, type ApiResult, type ApiError } from "../api/client";

export type UseApiDataResult<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** Re-fetch the data (e.g., after a mutation). */
  refetch: () => void;
};

export function useApiData<T>(
  path: string | null,
  options?: { /** Skip initial fetch (useful for conditional loading). */ skip?: boolean }
): UseApiDataResult<T> {
  const { get } = usePortalApi();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const [error, setError] = useState<ApiError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(() => {
    if (!path || options?.skip) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    get<T>(path, controller.signal).then((result: ApiResult<T>) => {
      if (controller.signal.aborted) return;
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
      }
      setLoading(false);
    });
  }, [path, get, options?.skip]);

  useEffect(() => {
    doFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}
