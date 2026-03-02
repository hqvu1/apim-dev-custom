/**
 * Unit tests for useApimCatalog hook (api/client.ts)
 *
 * Tests the high-level APIM catalog operations: listApis, getApi,
 * listProducts, listSubscriptions, createSubscription, cancelSubscription.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---- Mocks ----------------------------------------------------------------

vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    getAccessToken: vi.fn().mockResolvedValue("mock-token"),
  }),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ---- Import after mocks ---------------------------------------------------

import { useApimCatalog } from "./client";

// ---- Helpers ---------------------------------------------------------------

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (status: number, statusText = "Error") =>
  new Response(JSON.stringify({ error: statusText }), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });

// ---- Mock data--------------------------------------------------------------

const mockApimApi = {
  id: "api-1",
  name: "Fleet API",
  description: "Fleet management API",
  path: "fleet/v1",
  protocols: ["https"],
  apiVersion: "v1",
  subscriptionRequired: true,
  tags: ["Integration"],
  contact: { name: "Fleet Team", email: "fleet@komatsu.com" },
  license: { name: "MIT", url: "https://mit-license.org" },
  termsOfServiceUrl: "https://komatsu.com/terms",
};

const mockApimOperation = {
  id: "op-1",
  name: "GetFleet",
  method: "GET",
  urlTemplate: "/fleet/{id}",
  description: "Get a fleet by ID",
  displayName: "Get Fleet",
};

const mockApimProduct = {
  id: "prod-1",
  name: "Gold Plan",
  displayName: "Gold Plan",
  description: "Premium access",
  state: "published" as const,
  subscriptionRequired: true,
  approvalRequired: false,
};

const mockApimSubscription = {
  id: "sub-1",
  name: "my-sub",
  displayName: "My Subscription",
  scope: "/products/prod-1",
  state: "active" as const,
  primaryKey: "pk-123",
  secondaryKey: "sk-456",
};

describe("useApimCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all catalog methods", () => {
    mockFetch.mockResolvedValue(jsonResponse({ value: [] }));
    const { result } = renderHook(() => useApimCatalog());

    expect(typeof result.current.listApis).toBe("function");
    expect(typeof result.current.getApi).toBe("function");
    expect(typeof result.current.listProducts).toBe("function");
    expect(typeof result.current.listSubscriptions).toBe("function");
    expect(typeof result.current.createSubscription).toBe("function");
    expect(typeof result.current.cancelSubscription).toBe("function");
  });

  describe("listApis", () => {
    it("fetches and maps APIs with default pagination", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ value: [mockApimApi], count: 1 })
      );

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listApis();

      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data![0].id).toBe("api-1");
      expect(res.data![0].name).toBe("Fleet API");
      expect(res.data![0].plan).toBe("Paid"); // subscriptionRequired = true
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/apis?$top=50&$skip=0&skipWorkspaces=true"),
        expect.any(Object)
      );
    });

    it("passes custom skip, take, and pattern parameters", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      const { result } = renderHook(() => useApimCatalog());
      await result.current.listApis({ skip: 10, take: 25, pattern: "fleet" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("$top=25&$skip=10"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("$filter=contains(name,'fleet')"),
        expect.any(Object)
      );
    });

    it("passes tag filters in URL", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      const { result } = renderHook(() => useApimCatalog());
      await result.current.listApis({ tags: ["tag1", "tag2"] });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/tags\[0\]=tag1.*tags\[1\]=tag2/),
        expect.any(Object)
      );
    });

    it("returns error when fetch fails", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, "Server Error"));

      const { result } = renderHook(() => useApimCatalog());
      // Need to exhaust retries: 500 is retryable, so need 3 failures
      mockFetch.mockResolvedValueOnce(errorResponse(500, "Server Error"));
      mockFetch.mockResolvedValueOnce(errorResponse(500, "Server Error"));

      const res = await result.current.listApis();

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });

    it("returns error when data is null", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listApis();

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });
  });

  describe("getApi", () => {
    it("fetches API details with operations and products", async () => {
      // Main API call
      mockFetch.mockResolvedValueOnce(jsonResponse(mockApimApi));
      // Operations call
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [mockApimOperation] }));
      // Products call
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [mockApimProduct] }));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.getApi("api-1");

      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data!.id).toBe("api-1");
      expect(res.data!.operations).toHaveLength(1);
      expect(res.data!.operations![0].method).toBe("GET");
      expect(res.data!.plans).toHaveLength(1);
      expect(res.data!.plans[0].name).toBe("Gold Plan");
      expect(res.data!.contact).toEqual({ name: "Fleet Team", email: "fleet@komatsu.com" });
      expect(res.data!.license).toEqual({ name: "MIT", url: "https://mit-license.org" });
    });

    it("uses expandApiVersionSet in URL", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockApimApi));
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      const { result } = renderHook(() => useApimCatalog());
      await result.current.getApi("api-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/apis/api-1?expandApiVersionSet=true"),
        expect.any(Object)
      );
    });

    it("returns error when API not found", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.getApi("missing-api");

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });

    it("handles empty operations and products gracefully", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockApimApi));
      // Operations returns error
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      // Products returns error — retries exhausted  
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      mockFetch.mockResolvedValueOnce(errorResponse(500));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.getApi("api-1");

      expect(res.data).toBeDefined();
      expect(res.data!.operations).toEqual([]);
      expect(res.data!.plans).toEqual([]);
    });

    it("sets documentationUrl correctly", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockApimApi));
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.getApi("api-1");

      expect(res.data!.documentationUrl).toBe("/api-docs/api-1");
    });

    it("maps product plans correctly", async () => {
      const freeProduct = { ...mockApimProduct, subscriptionRequired: false };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockApimApi));
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [mockApimProduct, freeProduct] }));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.getApi("api-1");

      expect(res.data!.plans).toHaveLength(2);
      expect(res.data!.plans[0].quota).toBe("Subscription required");
      expect(res.data!.plans[1].quota).toBe("Open");
    });
  });

  describe("listProducts", () => {
    it("fetches and maps products with default pagination", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ value: [mockApimProduct] })
      );

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listProducts();

      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data![0].id).toBe("prod-1");
      expect(res.data![0].name).toBe("Gold Plan");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/products?$top=50&$skip=0"),
        expect.any(Object)
      );
    });

    it("passes custom pagination", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      const { result } = renderHook(() => useApimCatalog());
      await result.current.listProducts({ skip: 5, take: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("$top=10&$skip=5"),
        expect.any(Object)
      );
    });

    it("returns error on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listProducts();

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });
  });

  describe("listSubscriptions", () => {
    it("fetches and maps subscriptions", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ value: [mockApimSubscription] })
      );

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listSubscriptions();

      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data![0].id).toBe("sub-1");
      expect(res.data![0].name).toBe("My Subscription");
      expect(res.data![0].state).toBe("active");
      expect(res.data![0].primaryKey).toBe("pk-123");
      expect(res.data![0].secondaryKey).toBe("sk-456");
    });

    it("uses displayName when available, falls back to name", async () => {
      const subNoDisplayName = { ...mockApimSubscription, displayName: undefined };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ value: [mockApimSubscription, subNoDisplayName] })
      );

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listSubscriptions();

      expect(res.data![0].name).toBe("My Subscription"); // displayName
      expect(res.data![1].name).toBe("my-sub"); // falls back to name
    });

    it("defaults state to active when missing", async () => {
      const subNoState = { ...mockApimSubscription, state: undefined };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ value: [subNoState] })
      );

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listSubscriptions();

      expect(res.data![0].state).toBe("active");
    });

    it("returns error on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, "Forbidden"));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.listSubscriptions();

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });
  });

  describe("createSubscription", () => {
    it("posts subscription and returns mapped result", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockApimSubscription));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.createSubscription("prod-1", "My Sub");

      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data!.id).toBe("sub-1");
      expect(res.data!.name).toBe("My Subscription");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/subscriptions"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            scope: "/products/prod-1",
            displayName: "My Sub",
            state: "submitted",
          }),
        })
      );
    });

    it("defaults state to submitted when not set", async () => {
      const subNoState = { ...mockApimSubscription, state: undefined };
      mockFetch.mockResolvedValueOnce(jsonResponse(subNoState));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.createSubscription("prod-1", "Test");

      expect(res.data!.state).toBe("submitted");
    });

    it("returns error on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, "Bad Request"));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.createSubscription("prod-1", "Fail");

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });
  });

  describe("cancelSubscription", () => {
    it("sends DELETE request for the subscription", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(null, 200));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.cancelSubscription("sub-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/subscriptions/sub-1"),
        expect.objectContaining({ method: "DELETE" })
      );
      // 204 with null body returns data as null
      expect(res.error).toBeNull();
    });

    it("returns error on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

      const { result } = renderHook(() => useApimCatalog());
      const res = await result.current.cancelSubscription("missing-sub");

      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
    });
  });
});
