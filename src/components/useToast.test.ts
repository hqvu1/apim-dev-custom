import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { useToast } from "./useToast";

describe("useToast", () => {
  it("returns the context value", () => {
    // Without a provider, useToast returns undefined / default context
    const { result } = renderHook(() => useToast());
    // The default context provides notify
    expect(result.current).toBeDefined();
  });
});
