/**
 * Unit tests for centralized configuration (config.ts)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to dynamically import config.ts after setting up env/runtime mocks
describe("config", () => {
  describe("buildPath", () => {
    it("replaces a single parameter", async () => {
      const { buildPath } = await import("./config");
      expect(buildPath("/apis/:apiId", { apiId: "warranty-api" })).toBe(
        "/apis/warranty-api"
      );
    });

    it("replaces multiple parameters", async () => {
      const { buildPath } = await import("./config");
      expect(
        buildPath("/apis/:apiId/ops/:opId", {
          apiId: "warranty-api",
          opId: "get-claims",
        })
      ).toBe("/apis/warranty-api/ops/get-claims");
    });

    it("encodes special characters in parameter values", async () => {
      const { buildPath } = await import("./config");
      expect(buildPath("/apis/:apiId", { apiId: "api/with spaces" })).toBe(
        "/apis/api%2Fwith%20spaces"
      );
    });

    it("returns the route unchanged when no params are provided", async () => {
      const { buildPath } = await import("./config");
      expect(buildPath("/apis")).toBe("/apis");
    });

    it("returns the route unchanged when params object is empty", async () => {
      const { buildPath } = await import("./config");
      expect(buildPath("/apis/:apiId", {})).toBe("/apis/:apiId");
    });
  });

  describe("ROUTES", () => {
    it("exports expected route constants", async () => {
      const { ROUTES } = await import("./config");

      expect(ROUTES.HOME).toBe("/");
      expect(ROUTES.API_CATALOG).toBe("/apis");
      expect(ROUTES.API_DETAILS).toBe("/apis/:apiId");
      expect(ROUTES.API_TRY_IT).toBe("/apis/:apiId/try");
      expect(ROUTES.REGISTER).toBe("/register");
      expect(ROUTES.ONBOARDING).toBe("/profile/onboarding");
      expect(ROUTES.MY_INTEGRATIONS).toBe("/my/integrations");
      expect(ROUTES.SUPPORT).toBe("/support");
      expect(ROUTES.NEWS).toBe("/news");
      expect(ROUTES.ADMIN).toBe("/admin");
      expect(ROUTES.ACCESS_DENIED).toBe("/access-denied");
      expect(ROUTES.SSO_LOGOUT).toBe("/sso-logout");
    });

    it("all route values start with /", async () => {
      const { ROUTES } = await import("./config");
      for (const [, path] of Object.entries(ROUTES)) {
        expect(path).toMatch(/^\//);
      }
    });
  });

  describe("appConfig", () => {
    it("exports an appConfig object with expected keys", async () => {
      const { appConfig } = await import("./config");

      expect(appConfig).toHaveProperty("appName");
      expect(appConfig).toHaveProperty("apiBase");
      expect(appConfig).toHaveProperty("publicHomePage");
      expect(appConfig).toHaveProperty("useMockAuth");
      expect(appConfig).toHaveProperty("defaultLocale");
      expect(appConfig).toHaveProperty("entra");
    });

    it("appName is Komatsu API Marketplace", async () => {
      const { appConfig } = await import("./config");
      expect(appConfig.appName).toBe("Komatsu API Marketplace");
    });

    it("apiBase defaults to /api when no env vars set", async () => {
      const { appConfig } = await import("./config");
      expect(appConfig.apiBase).toBe("/api");
    });

    it("defaultLocale defaults to en", async () => {
      const { appConfig } = await import("./config");
      expect(appConfig.defaultLocale).toBe("en");
    });

    it("entra has expected sub-properties", async () => {
      const { appConfig } = await import("./config");
      expect(appConfig.entra).toHaveProperty("clientId");
      expect(appConfig.entra).toHaveProperty("externalTenantId");
      expect(appConfig.entra).toHaveProperty("workforceTenantId");
      expect(appConfig.entra).toHaveProperty("ciamHost");
      expect(appConfig.entra).toHaveProperty("portalApiScope");
    });

    it("publicHomePage is a boolean", async () => {
      const { appConfig } = await import("./config");
      expect(typeof appConfig.publicHomePage).toBe("boolean");
    });

    it("useMockAuth is a boolean", async () => {
      const { appConfig } = await import("./config");
      expect(typeof appConfig.useMockAuth).toBe("boolean");
    });
  });
});
