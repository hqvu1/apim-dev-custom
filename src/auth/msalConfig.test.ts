import { describe, it, expect, vi } from "vitest";

// Mock appConfig
vi.mock("../config", () => ({
  appConfig: {
    entra: {
      clientId: "test-client-id",
      externalTenantId: "ext-tenant-123",
      workforceTenantId: "wf-tenant-456",
      ciamHost: "custom.ciamlogin.com",
      portalApiScope: "api://test/.default"
    }
  }
}));

import { getMsalConfig, loginRequest } from "./msalConfig";

describe("msalConfig", () => {
  describe("getMsalConfig", () => {
    it("returns config for external tenant", () => {
      const config = getMsalConfig("ext-tenant-123");
      expect(config.auth.clientId).toBe("test-client-id");
      expect(config.auth.authority).toContain("custom.ciamlogin.com");
      expect(config.auth.authority).toContain("ext-tenant-123");
    });

    it("returns config for workforce tenant", () => {
      const config = getMsalConfig("wf-tenant-456");
      expect(config.auth.clientId).toBe("test-client-id");
      expect(config.auth.authority).toContain("login.microsoftonline.com");
      expect(config.auth.authority).toContain("wf-tenant-456");
    });

    it("returns fallback config for unknown tenant", () => {
      const config = getMsalConfig("unknown-tenant");
      expect(config.auth.clientId).toBe("test-client-id");
      expect(config.auth.authority).toContain("login.microsoftonline.com");
    });

    it("sets cache to localStorage", () => {
      const config = getMsalConfig("wf-tenant-456");
      expect(config.cache?.cacheLocation).toBe("localStorage");
      expect(config.cache?.storeAuthStateInCookie).toBe(false);
    });

    it("enables allowRedirectInIframe", () => {
      const config = getMsalConfig("wf-tenant-456");
      expect(config.system?.allowRedirectInIframe).toBe(true);
    });

    it("sets iframeHashTimeout to 6000", () => {
      const config = getMsalConfig("wf-tenant-456");
      expect(config.system?.iframeHashTimeout).toBe(6000);
    });

    it("configures logger callback", () => {
      const config = getMsalConfig("wf-tenant-456");
      expect(config.system?.loggerOptions?.loggerCallback).toBeDefined();
    });

    it("sets redirect URI to origin", () => {
      const config = getMsalConfig("ext-tenant-123");
      expect(config.auth.redirectUri).toBe(globalThis.location.origin);
    });

    it("sets postLogoutRedirectUri", () => {
      const config = getMsalConfig("ext-tenant-123");
      expect(config.auth.postLogoutRedirectUri).toContain("/");
    });
  });

  describe("loginRequest", () => {
    it("contains portalApiScope", () => {
      expect(loginRequest.scopes).toContain("api://test/.default");
    });
  });
});
