import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";

// Mock config
vi.mock("../config", () => ({
  appConfig: { useMockAuth: false, apiBase: "/api", entra: { clientId: "test" } }
}));

// Mock useMsalLogin
vi.mock("../utils/loginUtils/customHooks/useMsalLogin", () => ({
  default: vi.fn()
}));

// Mock MSAL
const mockUseMsal = vi.fn();
vi.mock("@azure/msal-react", () => ({
  useMsal: () => mockUseMsal()
}));

// Mock LoadingScreen to simplify
vi.mock("./LoadingScreen", () => ({
  default: ({ message }: { message: string }) => <div data-testid="loading">{message}</div>
}));

describe("PrivateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows signing-in loading screen when interaction is in progress", () => {
    mockUseMsal.mockReturnValue({
      instance: { getActiveAccount: vi.fn().mockReturnValue(null) },
      inProgress: "login",
      accounts: []
    });

    render(
      <MemoryRouter>
        <PrivateRoute />
      </MemoryRouter>
    );
    expect(screen.getByText("Signing you in...")).toBeInTheDocument();
  });

  it("shows redirect loading screen when no accounts", () => {
    mockUseMsal.mockReturnValue({
      instance: { getActiveAccount: vi.fn().mockReturnValue(null) },
      inProgress: "none",
      accounts: []
    });

    render(
      <MemoryRouter>
        <PrivateRoute />
      </MemoryRouter>
    );
    expect(screen.getByText("Redirecting to Entra ID...")).toBeInTheDocument();
  });

  it("renders outlet when authenticated", () => {
    const mockAccount = { username: "user@test.com" };
    mockUseMsal.mockReturnValue({
      instance: { getActiveAccount: vi.fn().mockReturnValue(mockAccount) },
      inProgress: "none",
      accounts: [mockAccount]
    });

    render(
      <MemoryRouter>
        <PrivateRoute />
      </MemoryRouter>
    );
    // Outlet renders nothing by default when no nested routes
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });

  it("bypasses auth when useMockAuth is true", async () => {
    // Override config mock for this test
    const config = await import("../config");
    (config.appConfig as any).useMockAuth = true;

    mockUseMsal.mockReturnValue({
      instance: { getActiveAccount: vi.fn().mockReturnValue(null) },
      inProgress: "none",
      accounts: []
    });

    render(
      <MemoryRouter>
        <PrivateRoute />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();

    // Reset
    (config.appConfig as any).useMockAuth = false;
  });
});
