import { useAuth } from "../auth/useAuth";

const apiBase = import.meta.env.VITE_PORTAL_API_BASE || "/api";

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

const request = async <T>(
  getAccessToken: () => Promise<string | null>,
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> => {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers || {})
      }
    });

    if (!response.ok) {
      return { data: null, error: `Request failed (${response.status})` };
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : ((await response.text()) as T);

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

export const usePortalApi = () => {
  const { getAccessToken } = useAuth();

  return {
    get: <T,>(path: string) => request<T>(getAccessToken, path),
    post: <T,>(path: string, body: unknown) =>
      request<T>(getAccessToken, path, {
        method: "POST",
        body: JSON.stringify(body)
      })
  };
};
