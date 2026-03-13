/**
 * Unit tests for API client (api/client.ts)
 *
 * Tests the low-level helpers, retry logic, structured error types,
 * and AbortController support.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---- Mocks ----------------------------------------------------------------

// Mock useAuth
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    getAccessToken: vi.fn().mockResolvedValue("mock-token"),
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ---- Import after mocks ---------------------------------------------------

import { usePortalApi, type ApiError } from "./client";

describe("API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create a Response-like object
  const jsonResponse = (data: unknown, status = 200, statusText = "OK") =>
    new Response(JSON.stringify(data), {
      status,
      statusText,
      headers: { "Content-Type": "application/json" },
    });

  const errorResponse = (status: number, statusText = "Error") =>
    new Response(JSON.stringify({ error: statusText }), {
      status,
      statusText,
      headers: { "Content-Type": "application/json" },
    });

  describe("usePortalApi", () => {
    it("returns get, post, patch, delete methods", () => {
      const { result } = renderHook(() => usePortalApi());

      expect(result.current).toHaveProperty("get");
      expect(result.current).toHaveProperty("post");
      expect(result.current).toHaveProperty("patch");
      expect(result.current).toHaveProperty("delete");
      expect(typeof result.current.get).toBe("function");
      expect(typeof result.current.post).toBe("function");
      expect(typeof result.current.patch).toBe("function");
      expect(typeof result.current.delete).toBe("function");
    });
  });

  describe("GET requests", () => {
    it("returns parsed JSON data on success", async () => {
      const payload = { id: "1", name: "Test API" };
      mockFetch.mockResolvedValueOnce(jsonResponse(payload));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get<typeof payload>("/apis");

      expect(res.data).toEqual(payload);
      expect(res.error).toBeNull();
    });

    it("sends Authorization header with the access token", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      const { result } = renderHook(() => usePortalApi());
      await result.current.get("/apis");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/apis"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        })
      );
    });

    it("sends Content-Type: application/json header", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      const { result } = renderHook(() => usePortalApi());
      await result.current.get("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("Structured error handling", () => {
    it("returns UNAUTHORIZED error for 401", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/protected");

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe("UNAUTHORIZED");
      expect(res.error!.status).toBe(401);
    });

    it("returns FORBIDDEN error for 403", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, "Forbidden"));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/admin");

      expect(res.data).toBeNull();
      expect(res.error!.code).toBe("FORBIDDEN");
      expect(res.error!.status).toBe(403);
    });

    it("returns NOT_FOUND error for 404", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/apis/missing");

      expect(res.data).toBeNull();
      expect(res.error!.code).toBe("NOT_FOUND");
      expect(res.error!.status).toBe(404);
    });

    it("returns SERVER error for non-retryable 4xx", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, "Bad Request"));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/bad");

      expect(res.data).toBeNull();
      expect(res.error!.code).toBe("SERVER");
      expect(res.error!.status).toBe(400);
    });

    it("returns NETWORK error on fetch failure", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/offline");

      expect(res.data).toBeNull();
      expect(res.error!.code).toBe("NETWORK");
      expect(res.error!.message).toContain("Failed to fetch");
    });
  });

  describe("Retry logic", () => {
    it("retries on 500 and succeeds on second attempt", async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, "Internal Server Error"))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/flaky");

      expect(res.data).toEqual({ ok: true });
      expect(res.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 503 and succeeds on third attempt", async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(errorResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(jsonResponse({ recovered: true }));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/recovering");

      expect(res.data).toEqual({ recovered: true });
      expect(res.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("returns SERVER error after max retries exceeded", async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, "Error"))
        .mockResolvedValueOnce(errorResponse(500, "Error"))
        .mockResolvedValueOnce(errorResponse(500, "Error"));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/always-broken");

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      // After 3 attempts (0, 1, 2) all fail → returns error
      expect(res.error!.code).toBe("SERVER");
    });

    it("does not retry on 401", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

      const { result } = renderHook(() => usePortalApi());
      await result.current.get("/protected");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry on 403", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, "Forbidden"));

      const { result } = renderHook(() => usePortalApi());
      await result.current.get("/forbidden");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry on 404", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

      const { result } = renderHook(() => usePortalApi());
      await result.current.get("/missing");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("AbortController support", () => {
    it("returns ABORTED error when request is cancelled", async () => {
      const abortError = new DOMException("The operation was aborted.", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => usePortalApi());
      const controller = new AbortController();
      controller.abort();

      const res = await result.current.get("/cancellable", controller.signal);

      expect(res.data).toBeNull();
      expect(res.error!.code).toBe("ABORTED");
    });

    it("passes the signal to fetch", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      const { result } = renderHook(() => usePortalApi());
      const controller = new AbortController();

      await result.current.get("/test", controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe("POST requests", () => {
    it("sends body as JSON", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "new-1" }));

      const { result } = renderHook(() => usePortalApi());
      const body = { name: "New Subscription" };
      const res = await result.current.post("/subscriptions", body);

      expect(res.data).toEqual({ id: "new-1" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/subscriptions"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        })
      );
    });
  });

  describe("ApiError type", () => {
    it("error objects have message and code fields", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401));

      const { result } = renderHook(() => usePortalApi());
      const res = await result.current.get("/test");

      const error = res.error as ApiError;
      expect(error).toHaveProperty("message");
      expect(error).toHaveProperty("code");
      expect(typeof error.message).toBe("string");
    });
  });
});
