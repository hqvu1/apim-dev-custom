/**
 * Tests for msalConfig.ts — logger callback execution & edge cases.
 * Supplements the existing msalConfig.test.ts with coverage for
 * logger callback switch cases (lines 56-73).
 */
import { describe, it, expect, vi } from "vitest";
import { LogLevel } from "@azure/msal-browser";

// Mock appConfig
vi.mock("../config", () => ({
  appConfig: {
    entra: {
      clientId: "test-client-id",
      externalTenantId: "ext-tenant-123",
      workforceTenantId: "wf-tenant-456",
      ciamHost: "custom.ciamlogin.com",
      portalApiScope: "api://test/.default",
    },
  },
}));

import { getMsalConfig } from "./msalConfig";

describe("msalConfig logger callback", () => {
  const getLogger = () => {
    const config = getMsalConfig("wf-tenant-456");
    return config.system!.loggerOptions!.loggerCallback!;
  };

  it("logs Error level to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = getLogger();
    logger(LogLevel.Error, "test error", false);
    expect(spy).toHaveBeenCalledWith("test error");
    spy.mockRestore();
  });

  it("logs Warning level to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = getLogger();
    logger(LogLevel.Warning, "test warning", false);
    expect(spy).toHaveBeenCalledWith("test warning");
    spy.mockRestore();
  });

  it("logs Info level to console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = getLogger();
    logger(LogLevel.Info, "test info", false);
    expect(spy).toHaveBeenCalledWith("test info");
    spy.mockRestore();
  });

  it("logs Verbose level to console.debug", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = getLogger();
    logger(LogLevel.Verbose, "test verbose", false);
    expect(spy).toHaveBeenCalledWith("test verbose");
    spy.mockRestore();
  });

  it("does not log when containsPii is true", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const logger = getLogger();
    logger(LogLevel.Error, "pii data", true);
    logger(LogLevel.Warning, "pii data", true);
    logger(LogLevel.Info, "pii data", true);
    logger(LogLevel.Verbose, "pii data", true);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it("handles unknown log level without error", () => {
    const logger = getLogger();
    // LogLevel.Trace or any other level should hit the default case
    expect(() => logger(99 as LogLevel, "unknown", false)).not.toThrow();
  });
});
