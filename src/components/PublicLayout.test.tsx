import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicLayout from "./PublicLayout";

vi.mock("./Header", () => ({
  default: ({ isPublic }: { isPublic?: boolean }) => (
    <div data-testid="header" data-public={isPublic}>Header</div>
  )
}));

vi.mock("./Footer", () => ({
  default: () => <div data-testid="footer">Footer</div>
}));

describe("PublicLayout", () => {
  it("renders header with isPublic flag", () => {
    render(
      <MemoryRouter>
        <PublicLayout />
      </MemoryRouter>
    );
    const header = screen.getByTestId("header");
    expect(header).toBeInTheDocument();
    expect(header.getAttribute("data-public")).toBe("true");
  });

  it("renders footer", () => {
    render(
      <MemoryRouter>
        <PublicLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });
});
