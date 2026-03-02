/**
 * Unit tests for RoleGate component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RoleGate from "./RoleGate";

// Mock useAuth
vi.mock("../auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../auth/useAuth";

describe("RoleGate", () => {
  const renderWithRouter = (
    userRoles: string[],
    requiredRoles: string[],
    initialEntry = "/protected"
  ) => {
    vi.mocked(useAuth).mockReturnValue({
      roles: userRoles,
      account: null,
      isAuthenticated: true,
      getAccessToken: vi.fn(),
    });

    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RoleGate roles={requiredRoles}>
                <div>Protected content</div>
              </RoleGate>
            }
          />
          <Route path="/access-denied" element={<div>Access Denied Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("renders children when user has a required role", () => {
    renderWithRouter(["Admin"], ["Admin"]);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("renders children when user has one of multiple required roles", () => {
    renderWithRouter(["Developer"], ["Admin", "Developer"]);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /access-denied when user lacks required roles", () => {
    renderWithRouter(["Viewer"], ["Admin"]);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied Page")).toBeInTheDocument();
  });

  it("redirects when user has no roles", () => {
    renderWithRouter([], ["Admin"]);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied Page")).toBeInTheDocument();
  });

  it("renders children when user has GlobalAdmin and Admin is required", () => {
    renderWithRouter(["GlobalAdmin"], ["Admin", "GlobalAdmin"]);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
