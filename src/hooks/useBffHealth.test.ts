/**
 * Unit tests for useBffHealth hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { useBffHealth } from "./useBffHealth";

describe("useBffHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with 'checking' status", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { result, unmount } = renderHook(() => useBffHealth(600_000));
    expect(result.current).toBe("checking");
    unmount();
  });

  it("returns 'healthy' when health endpoint returns 200", async () => {
    mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));

    const { result, unmount } = renderHook(() => useBffHealth(600_000));

    await waitFor(() => {
      expect(result.current).toBe("healthy");
    });
    unmount();
  });

  it("returns 'unhealthy' when health endpoint returns 503", async () => {
    mockFetch.mockResolvedValue(
      new Response("Service Unavailable", { status: 503 })
    );

    const { result, unmount } = renderHook(() => useBffHealth(600_000));

    await waitFor(() => {
      expect(result.current).toBe("unhealthy");
    });
    unmount();
  });

  it("returns 'unhealthy' when fetch throws a network error", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result, unmount } = renderHook(() => useBffHealth(600_000));

    await waitFor(() => {
      expect(result.current).toBe("unhealthy");
    });
    unmount();
  });

  it("calls the /health endpoint on mount", async () => {
    mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));

    const { unmount } = renderHook(() => useBffHealth(600_000));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    unmount();
  });

  it("clears interval on unmount (no extra calls after unmount)", async () => {
    mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));

    const { result, unmount } = renderHook(() => useBffHealth(600_000));

    await waitFor(() => {
      expect(result.current).toBe("healthy");
    });

    const callCountBeforeUnmount = mockFetch.mock.calls.length;
    unmount();

    // After unmount, abort controller is aborted and interval cleared
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch.mock.calls.length).toBe(callCountBeforeUnmount);
  });
});
