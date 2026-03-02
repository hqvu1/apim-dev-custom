import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock all lazy-loaded components to avoid actual imports
vi.mock("./components/AppShell", () => ({ default: () => <div>AppShell</div> }));
vi.mock("./components/PublicLayout", () => ({ default: () => <div>PublicLayout</div> }));
vi.mock("./utils/loginUtils/SsoLogoutHandler", () => ({ default: () => <div>SsoLogoutHandler</div> }));
vi.mock("./pages/AccessDenied", () => ({ default: () => <div>AccessDenied</div> }));
vi.mock("./pages/Admin", () => ({ default: () => <div>Admin</div> }));
vi.mock("./pages/ApiCatalog", () => ({ default: () => <div>ApiCatalog</div> }));
vi.mock("./pages/ApiDetails", () => ({ default: () => <div>ApiDetails</div> }));
vi.mock("./pages/ApiTryIt", () => ({ default: () => <div>ApiTryIt</div> }));
vi.mock("./pages/home", () => ({ default: () => <div>Home</div> }));
vi.mock("./pages/MyIntegrations", () => ({ default: () => <div>MyIntegrations</div> }));
vi.mock("./pages/News", () => ({ default: () => <div>News</div> }));
vi.mock("./pages/NotFound", () => ({ default: () => <div data-testid="not-found">NotFound</div> }));
vi.mock("./pages/Onboarding", () => ({ default: () => <div>Onboarding</div> }));
vi.mock("./pages/Register", () => ({ default: () => <div>Register</div> }));
vi.mock("./pages/Support", () => ({ default: () => <div>Support</div> }));

// Mock PrivateRoute to pass through children
vi.mock("./components/PrivateRoute", () => ({
  default: () => {
    const { Outlet } = require("react-router-dom");
    return <Outlet />;
  }
}));

// Mock RoleGate to pass through children
vi.mock("./components/RoleGate", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock ErrorBoundary
vi.mock("./components/ErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock LoadingScreen
vi.mock("./components/LoadingScreen", () => ({
  default: ({ message }: { message: string }) => <div data-testid="loading">{message}</div>
}));

import App from "./App";

describe("App", () => {
  it("renders without crashing", async () => {
    render(<App />);
    // Should render something (either loading or content)
    await waitFor(() => {
      expect(document.body).toBeDefined();
    });
  });

  it("renders not found page for unknown routes", async () => {
    // Set window location to a non-existent route
    window.history.pushState({}, "", "/nonexistent-route");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("not-found")).toBeInTheDocument();
    });
  });

  it("renders access denied page", async () => {
    window.history.pushState({}, "", "/access-denied");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("AccessDenied")).toBeInTheDocument();
    });
  });
});
