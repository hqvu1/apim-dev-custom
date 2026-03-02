import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

// Mock the AuthContext
vi.mock("./AuthProvider", () => ({
  AuthContext: React.createContext({
    account: null,
    roles: [],
    isAuthenticated: false,
    getAccessToken: async () => null
  })
}));

import { useAuth } from "./useAuth";

describe("useAuth", () => {
  it("returns the auth context default value", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.account).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it("provides getAccessToken function", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.getAccessToken).toBe("function");
  });
});
