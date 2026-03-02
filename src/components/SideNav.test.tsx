/**
 * Unit tests for SideNav component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import SideNav from "./SideNav";

// Mock useAuth
vi.mock("../auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.home": "Home",
        "nav.apis": "API Catalog",
        "nav.integrations": "My Integrations",
        "nav.support": "Support",
        "nav.news": "News",
        "nav.admin": "Admin",
      };
      return translations[key] ?? key;
    },
  }),
}));

import { useAuth } from "../auth/useAuth";

describe("SideNav", () => {
  const renderSideNav = (roles: string[] = []) => {
    vi.mocked(useAuth).mockReturnValue({
      roles,
      account: null,
      isAuthenticated: true,
      getAccessToken: vi.fn(),
    });

    return render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <SideNav />
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it("renders the NAVIGATION heading", () => {
    renderSideNav();
    expect(screen.getByText("NAVIGATION")).toBeInTheDocument();
  });

  it("renders common navigation items for all users", () => {
    renderSideNav();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("API Catalog")).toBeInTheDocument();
    expect(screen.getByText("My Integrations")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("does not show Admin link for non-admin users", () => {
    renderSideNav(["Viewer"]);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin link for Admin role", () => {
    renderSideNav(["Admin"]);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows Admin link for GlobalAdmin role", () => {
    renderSideNav(["GlobalAdmin"]);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows all 6 items when user is admin", () => {
    renderSideNav(["Admin"]);
    const items = screen.getAllByRole("link");
    expect(items).toHaveLength(6);
  });

  it("shows 5 items when user is not admin", () => {
    renderSideNav(["Developer"]);
    const items = screen.getAllByRole("link");
    expect(items).toHaveLength(5);
  });

  it("navigation items use NavLink components", () => {
    renderSideNav();
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveAttribute("href");
    });
  });

  it("Home link points to /", () => {
    renderSideNav();
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("API Catalog link points to /apis", () => {
    renderSideNav();
    const apisLink = screen.getByText("API Catalog").closest("a");
    expect(apisLink).toHaveAttribute("href", "/apis");
  });
});
