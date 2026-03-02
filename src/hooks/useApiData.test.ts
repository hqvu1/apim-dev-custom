/**
 * Unit tests for useApiData hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mock usePortalApi
const mockGet = vi.fn();
vi.mock("../api/client", () => ({
  usePortalApi: () => ({
    get: mockGet,
  }),
}));

import { useApiData } from "./useApiData";

describe("useApiData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in loading state", () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApiData("/apis"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns data on successful fetch", async () => {
    const payload = [{ id: "1", name: "API 1" }];
    mockGet.mockResolvedValue({ data: payload, error: null });

    const { result } = renderHook(() => useApiData("/apis"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(payload);
    expect(result.current.error).toBeNull();
  });

  it("returns error on failed fetch", async () => {
    const error = { message: "Not found", code: "NOT_FOUND" as const, status: 404 };
    mockGet.mockResolvedValue({ data: null, error });

    const { result } = renderHook(() => useApiData("/apis/missing"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(error);
  });

  it("skips fetch when skip option is true", () => {
    const { result } = renderHook(() =>
      useApiData("/apis", { skip: true })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips fetch when path is null", async () => {
    const { result } = renderHook(() => useApiData(null));

    // Even though initial loading state is true, the fetch is never called
    expect(result.current.data).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("refetch re-fetches data", async () => {
    const firstPayload = [{ id: "1" }];
    const secondPayload = [{ id: "1" }, { id: "2" }];

    mockGet
      .mockResolvedValueOnce({ data: firstPayload, error: null })
      .mockResolvedValueOnce({ data: secondPayload, error: null });

    const { result } = renderHook(() => useApiData("/apis"));

    await waitFor(() => {
      expect(result.current.data).toEqual(firstPayload);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(secondPayload);
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("passes AbortSignal to the get function", async () => {
    mockGet.mockResolvedValue({ data: [], error: null });

    renderHook(() => useApiData("/apis"));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    const call = mockGet.mock.calls[0];
    expect(call[0]).toBe("/apis");
    // Second argument should be an AbortSignal
    expect(call[1]).toBeInstanceOf(AbortSignal);
  });

  it("provides refetch function in result", async () => {
    mockGet.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useApiData("/apis"));

    expect(typeof result.current.refetch).toBe("function");
  });
});
