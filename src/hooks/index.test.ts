/**
 * Tests for hooks/index.ts barrel export.
 */
import { describe, it, expect } from "vitest";

// These tests verify barrel exports work correctly
import { useApiData, useBffHealth } from "./index";

describe("hooks barrel export", () => {
  it("exports useApiData", () => {
    expect(useApiData).toBeDefined();
    expect(typeof useApiData).toBe("function");
  });

  it("exports useBffHealth", () => {
    expect(useBffHealth).toBeDefined();
    expect(typeof useBffHealth).toBe("function");
  });
});
