import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockLoginRedirect = vi.fn();
const mockGetActiveAccount = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      getActiveAccount: mockGetActiveAccount,
      loginRedirect: mockLoginRedirect
    },
    accounts: []
  })
}));

vi.mock("@azure/msal-browser", () => ({
  BrowserUtils: {
    isInIframe: vi.fn().mockReturnValue(false)
  }
}));

import useMsalLogin from "./useMsalLogin";

describe("useMsalLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockGetActiveAccount.mockReturnValue(null);
    mockLoginRedirect.mockResolvedValue(undefined);

    // Reset environment
    import.meta.env.VITE_USE_MOCK_AUTH = undefined;
    import.meta.env.VITE_LOGIN_SCOPES = undefined;
  });

  it("does not throw when rendered", () => {
    expect(() => {
      renderHook(() => useMsalLogin());
    }).not.toThrow();
  });

  it("does not login when in mock auth mode", () => {
    import.meta.env.VITE_USE_MOCK_AUTH = "true";
    renderHook(() => useMsalLogin());
    expect(mockLoginRedirect).not.toHaveBeenCalled();
  });

  it("does not login when account already exists", () => {
    mockGetActiveAccount.mockReturnValue({ username: "user@test.com" });
    renderHook(() => useMsalLogin());
    expect(mockLoginRedirect).not.toHaveBeenCalled();
  });

  it("does not login during logout flow", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        href: "http://localhost:3000/?action=userlogout",
        search: "?action=userlogout"
      }
    });

    renderHook(() => useMsalLogin());
    expect(mockLoginRedirect).not.toHaveBeenCalled();
  });

  it("does not login when signedOut param is present", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        href: "http://localhost:3000/?signedOut=1",
        search: "?signedOut=1"
      }
    });

    renderHook(() => useMsalLogin());
    expect(mockLoginRedirect).not.toHaveBeenCalled();
  });
});
