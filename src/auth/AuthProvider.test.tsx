import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { AuthProvider, AuthContext, type AuthContextValue } from "./AuthProvider";

// Mock MSAL
const mockAcquireTokenSilent = vi.fn();
const mockAcquireTokenRedirect = vi.fn();
const mockGetActiveAccount = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      getActiveAccount: mockGetActiveAccount,
      acquireTokenSilent: mockAcquireTokenSilent,
      acquireTokenRedirect: mockAcquireTokenRedirect
    },
    accounts: mockGetActiveAccount() ? [mockGetActiveAccount()] : []
  })
}));

vi.mock("./msalConfig", () => ({
  loginRequest: { scopes: ["api://test/.default"] }
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveAccount.mockReturnValue(null);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  const useAuthContext = () => React.useContext(AuthContext);

  it("provides default unauthenticated state when no account", () => {
    mockGetActiveAccount.mockReturnValue(null);
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.account).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it("provides authenticated state when account is active", () => {
    const mockAccount = {
      username: "user@test.com",
      idTokenClaims: {
        roles: ["admin", "reader"],
        groups: ["group-1"]
      }
    };
    mockGetActiveAccount.mockReturnValue(mockAccount);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.account).toBe(mockAccount);
    expect(result.current.roles).toContain("admin");
    expect(result.current.roles).toContain("reader");
    expect(result.current.roles).toContain("group-1");
  });

  it("deduplicates roles and groups", () => {
    const mockAccount = {
      username: "user@test.com",
      idTokenClaims: {
        roles: ["admin", "viewer"],
        groups: ["admin"] // duplicate
      }
    };
    mockGetActiveAccount.mockReturnValue(mockAccount);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    const adminCount = result.current.roles.filter((r) => r === "admin").length;
    expect(adminCount).toBe(1);
  });

  it("getAccessToken returns token on successful silent acquisition", async () => {
    const mockAccount = { username: "user@test.com", idTokenClaims: {} };
    mockGetActiveAccount.mockReturnValue(mockAccount);
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: "test-token-123" });

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getAccessToken();
    });

    expect(token).toBe("test-token-123");
  });

  it("getAccessToken returns null when no account", async () => {
    mockGetActiveAccount.mockReturnValue(null);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getAccessToken();
    });

    expect(token).toBeNull();
  });

  it("getAccessToken falls back to redirect on InteractionRequiredAuthError", async () => {
    const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
    const mockAccount = { username: "user@test.com", idTokenClaims: {} };
    mockGetActiveAccount.mockReturnValue(mockAccount);
    mockAcquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError("interaction_required")
    );
    mockAcquireTokenRedirect.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getAccessToken();
    });

    expect(mockAcquireTokenRedirect).toHaveBeenCalled();
    expect(token).toBeNull();
  });

  it("renders children correctly", () => {
    const { getByText } = renderHook(() => useAuthContext(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>
          <span>Child content</span>
          {children}
        </AuthProvider>
      )
    });
  });
});
