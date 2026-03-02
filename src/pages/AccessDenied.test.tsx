import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccessDenied from "./AccessDenied";

describe("AccessDenied", () => {
  it("renders the access denied message", () => {
    render(
      <MemoryRouter>
        <AccessDenied />
      </MemoryRouter>
    );
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });
});
