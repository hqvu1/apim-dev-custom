/**
 * Unit tests for usePermissions hook
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { Permission } from "./permissions";

// Mock useAuth
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "./useAuth";
import { usePermissions } from "./usePermissions";

describe("usePermissions", () => {
  const mockUseAuth = (roles: string[]) => {
    vi.mocked(useAuth).mockReturnValue({
      roles,
      account: null,
      isAuthenticated: true,
      getAccessToken: vi.fn(),
    });
  };

  describe("Admin role", () => {
    it("has all permissions globally", () => {
      mockUseAuth(["Admin"]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canRead).toBe(true);
      expect(result.current.canTryIt).toBe(true);
      expect(result.current.canSubscribe).toBe(true);
      expect(result.current.canManage).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });

    it("has all permissions on any API", () => {
      mockUseAuth(["Admin"]);
      const { result } = renderHook(() => usePermissions("warranty-api"));

      expect(result.current.canRead).toBe(true);
      expect(result.current.canTryIt).toBe(true);
      expect(result.current.canSubscribe).toBe(true);
      expect(result.current.canManage).toBe(true);
    });
  });

  describe("GlobalAdmin role", () => {
    it("has all permissions and isAdmin", () => {
      mockUseAuth(["GlobalAdmin"]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canManage).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });
  });

  describe("Developer role", () => {
    it("can read, tryIt, subscribe on listed APIs", () => {
      mockUseAuth(["Developer"]);
      const { result } = renderHook(() => usePermissions("warranty-api"));

      expect(result.current.canRead).toBe(true);
      expect(result.current.canTryIt).toBe(true);
      expect(result.current.canSubscribe).toBe(true);
      expect(result.current.canManage).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });

    it("cannot manage any API", () => {
      mockUseAuth(["Developer"]);
      const { result } = renderHook(() => usePermissions("warranty-api"));

      expect(result.current.canManage).toBe(false);
    });
  });

  describe("Tester role", () => {
    it("can read and tryIt but not subscribe or manage", () => {
      mockUseAuth(["Tester"]);
      const { result } = renderHook(() => usePermissions("warranty-api"));

      expect(result.current.canRead).toBe(true);
      expect(result.current.canTryIt).toBe(true);
      expect(result.current.canSubscribe).toBe(false);
      expect(result.current.canManage).toBe(false);
    });
  });

  describe("Viewer role", () => {
    it("can only read", () => {
      mockUseAuth(["Viewer"]);
      const { result } = renderHook(() => usePermissions("any-api"));

      expect(result.current.canRead).toBe(true);
      expect(result.current.canTryIt).toBe(false);
      expect(result.current.canSubscribe).toBe(false);
      expect(result.current.canManage).toBe(false);
    });
  });

  describe("permissions array", () => {
    it("returns all 4 permissions for Admin", () => {
      mockUseAuth(["Admin"]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.permissions).toContain(Permission.Read);
      expect(result.current.permissions).toContain(Permission.TryIt);
      expect(result.current.permissions).toContain(Permission.Subscribe);
      expect(result.current.permissions).toContain(Permission.Manage);
    });

    it("returns empty for unknown role", () => {
      mockUseAuth(["Unknown"]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.permissions).toEqual([]);
    });
  });

  describe("has() method", () => {
    it("checks specific permission for current apiId", () => {
      mockUseAuth(["Developer"]);
      const { result } = renderHook(() => usePermissions("warranty-api"));

      expect(result.current.has(Permission.Read)).toBe(true);
      expect(result.current.has(Permission.Subscribe)).toBe(true);
      expect(result.current.has(Permission.Manage)).toBe(false);
    });

    it("allows overriding apiId", () => {
      mockUseAuth(["Developer"]);
      // Hook scoped to warranty-api
      const { result } = renderHook(() => usePermissions("warranty-api"));

      // Override to check a different API
      expect(result.current.has(Permission.Read, "punchout-api")).toBe(true);
      expect(result.current.has(Permission.Read, "unknown-api")).toBe(false);
    });
  });

  describe("Multiple roles", () => {
    it("combines permissions from Viewer + Developer", () => {
      mockUseAuth(["Viewer", "Developer"]);
      const { result } = renderHook(() => usePermissions("warranty-api"));

      expect(result.current.canRead).toBe(true);
      expect(result.current.canTryIt).toBe(true);
      expect(result.current.canSubscribe).toBe(true);
    });
  });

  describe("No roles", () => {
    it("has no permissions", () => {
      mockUseAuth([]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canRead).toBe(false);
      expect(result.current.canTryIt).toBe(false);
      expect(result.current.canSubscribe).toBe(false);
      expect(result.current.canManage).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });
  });
});
