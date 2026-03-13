import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAccessToken } from "./getAccessToken";

describe("getAccessToken", () => {
  const mockAcquireTokenSilent = vi.fn();
  const mockInstance = { acquireTokenSilent: mockAcquireTokenSilent } as any;
  const mockAccount = { username: "user@test.com" } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns access token on successful silent acquisition", async () => {
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: "token-123" });

    const result = await getAccessToken(mockInstance, mockAccount, ["User.Read"]);
    expect(result).toBe("token-123");
  });

  it("passes account and scopes in the request", async () => {
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: "token" });

    await getAccessToken(mockInstance, mockAccount, ["scope1", "scope2"]);
    expect(mockAcquireTokenSilent).toHaveBeenCalledWith({
      account: mockAccount,
      scopes: ["scope1", "scope2"]
    });
  });

  it("returns null when silent acquisition fails", async () => {
    mockAcquireTokenSilent.mockRejectedValue(new Error("Token expired"));

    const result = await getAccessToken(mockInstance, mockAccount, ["User.Read"]);
    expect(result).toBeNull();
  });

  it("handles null account by passing undefined", async () => {
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: "token" });

    await getAccessToken(mockInstance, null, ["User.Read"]);
    expect(mockAcquireTokenSilent).toHaveBeenCalledWith({
      account: undefined,
      scopes: ["User.Read"]
    });
  });

  it("handles undefined scopes", async () => {
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: "token" });

    await getAccessToken(mockInstance, mockAccount, undefined);
    expect(mockAcquireTokenSilent).toHaveBeenCalledWith({
      account: mockAccount,
      scopes: []
    });
  });
});
