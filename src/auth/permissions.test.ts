import { describe, it, expect } from "vitest";
import {
  Permission,
  hasPermission,
  isAdmin,
  getEffectivePermissions,
} from "../auth/permissions";

describe("permissions", () => {
  describe("hasPermission", () => {
    it("Admin has all permissions on any API", () => {
      expect(hasPermission(["Admin"], Permission.Read, "warranty-api")).toBe(true);
      expect(hasPermission(["Admin"], Permission.TryIt, "warranty-api")).toBe(true);
      expect(hasPermission(["Admin"], Permission.Subscribe, "warranty-api")).toBe(true);
      expect(hasPermission(["Admin"], Permission.Manage, "warranty-api")).toBe(true);
    });

    it("GlobalAdmin has all permissions", () => {
      expect(hasPermission(["GlobalAdmin"], Permission.Manage)).toBe(true);
    });

    it("Developer can read, tryit, subscribe on listed APIs", () => {
      expect(hasPermission(["Developer"], Permission.Read, "warranty-api")).toBe(true);
      expect(hasPermission(["Developer"], Permission.TryIt, "punchout-api")).toBe(true);
      expect(hasPermission(["Developer"], Permission.Subscribe, "equipment-api")).toBe(true);
    });

    it("Developer cannot manage", () => {
      expect(hasPermission(["Developer"], Permission.Manage, "warranty-api")).toBe(false);
    });

    it("Tester can read and tryit but not subscribe", () => {
      expect(hasPermission(["Tester"], Permission.Read, "warranty-api")).toBe(true);
      expect(hasPermission(["Tester"], Permission.TryIt, "warranty-api")).toBe(true);
      expect(hasPermission(["Tester"], Permission.Subscribe, "warranty-api")).toBe(false);
    });

    it("Viewer can only read", () => {
      expect(hasPermission(["Viewer"], Permission.Read, "any-api")).toBe(true);
      expect(hasPermission(["Viewer"], Permission.TryIt, "any-api")).toBe(false);
    });

    it("unknown role has no permissions", () => {
      expect(hasPermission(["Unknown"], Permission.Read)).toBe(false);
    });

    it("multiple roles combine permissions", () => {
      // Viewer + Developer combined
      expect(hasPermission(["Viewer", "Developer"], Permission.Subscribe, "warranty-api")).toBe(true);
    });
  });

  describe("isAdmin", () => {
    it("returns true for Admin", () => {
      expect(isAdmin(["Admin"])).toBe(true);
    });

    it("returns true for GlobalAdmin", () => {
      expect(isAdmin(["GlobalAdmin"])).toBe(true);
    });

    it("returns false for Developer", () => {
      expect(isAdmin(["Developer"])).toBe(false);
    });

    it("returns false for empty roles", () => {
      expect(isAdmin([])).toBe(false);
    });
  });

  describe("getEffectivePermissions", () => {
    it("returns all permissions for Admin", () => {
      const perms = getEffectivePermissions(["Admin"]);
      expect(perms).toContain(Permission.Read);
      expect(perms).toContain(Permission.TryIt);
      expect(perms).toContain(Permission.Subscribe);
      expect(perms).toContain(Permission.Manage);
    });

    it("returns limited permissions for Tester on a specific API", () => {
      const perms = getEffectivePermissions(["Tester"], "warranty-api");
      expect(perms).toContain(Permission.Read);
      expect(perms).toContain(Permission.TryIt);
      expect(perms).not.toContain(Permission.Subscribe);
      expect(perms).not.toContain(Permission.Manage);
    });

    it("returns empty for unknown role", () => {
      const perms = getEffectivePermissions(["Unknown"]);
      expect(perms).toEqual([]);
    });
  });
});
