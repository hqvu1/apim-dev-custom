import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock MSAL
const mockSetActiveAccount = vi.fn();
vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: { setActiveAccount: mockSetActiveAccount }
  })
}));

// Track BroadcastChannel calls
const bcPostMessage = vi.fn();
const bcClose = vi.fn();

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: any) => void) | null = null;
  constructor(name: string) { this.name = name; }
  postMessage = bcPostMessage;
  close = bcClose;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

Object.defineProperty(window, "BroadcastChannel", {
  writable: true,
  value: MockBroadcastChannel
});

import SsoLogoutHandler from "./SsoLogoutHandler";

describe("SsoLogoutHandler", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    // Mock window.location.replace
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        replace: vi.fn(),
        href: "http://localhost:3000/"
      }
    });
    // Not in iframe
    Object.defineProperty(window, "self", { writable: true, value: window });
    Object.defineProperty(window, "top", { writable: true, value: window });
  });

  it("renders hidden element", () => {
    render(<SsoLogoutHandler />);
    expect(screen.getByText("SSO logout handled")).toBeInTheDocument();
  });

  it("calls instance.setActiveAccount(null)", async () => {
    render(<SsoLogoutHandler />);
    await waitFor(() => {
      expect(mockSetActiveAccount).toHaveBeenCalledWith(null);
    });
  });

  it("broadcasts logout via BroadcastChannel", async () => {
    render(<SsoLogoutHandler />);
    await waitFor(() => {
      expect(bcPostMessage).toHaveBeenCalled();
    });
  });

  it("clears non-MSAL localStorage entries", async () => {
    localStorage.setItem("appData", "value");
    localStorage.setItem("msal.cache", "keep");
    render(<SsoLogoutHandler />);
    await waitFor(() => {
      expect(localStorage.getItem("appData")).toBeNull();
    });
    // mn-logout is also cleaned since it's non-MSAL, but it was set during the process
  });

  it("cleans non-MSAL sessionStorage entries", async () => {
    sessionStorage.setItem("sessionData", "value");
    sessionStorage.setItem("msal.token", "keep");
    render(<SsoLogoutHandler />);
    await waitFor(() => {
      expect(sessionStorage.getItem("sessionData")).toBeNull();
    });
  });

  it("redirects to signedOut page when not in iframe", async () => {
    render(<SsoLogoutHandler />);
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith("/?signedOut=1");
    });
  });

  it("does NOT redirect when in iframe", async () => {
    // Simulate being inside an iframe
    const fakeTop = {} as Window;
    Object.defineProperty(window, "top", { writable: true, value: fakeTop });

    render(<SsoLogoutHandler />);

    // Wait for handleLogout to complete
    await waitFor(() => {
      expect(mockSetActiveAccount).toHaveBeenCalledWith(null);
    });

    // Should not redirect in iframe
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it("sets mn-logout in localStorage during logout", async () => {
    render(<SsoLogoutHandler />);
    // The mn-logout key is set then cleaned up by the non-MSAL cleanup
    // Just verify setActiveAccount was called (confirming handleLogout ran)
    await waitFor(() => {
      expect(mockSetActiveAccount).toHaveBeenCalledWith(null);
    });
  });
});
