import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell";

vi.mock("./Header", () => ({
  default: (props: any) => <div data-testid="header">{props.showMenuButton ? "menu" : "no-menu"}</div>
}));

vi.mock("./SideNav", () => ({
  default: () => <div data-testid="sidenav">SideNav</div>
}));

vi.mock("./Footer", () => ({
  default: () => <div data-testid="footer">Footer</div>
}));

describe("AppShell", () => {
  it("renders header, sidenav, and footer", () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    // SideNav appears in the drawer
    expect(screen.getByTestId("sidenav")).toBeInTheDocument();
  });

  it("renders the main content area", () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
  });
});
