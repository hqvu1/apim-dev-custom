import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SectionCard from "./SectionCard";

describe("SectionCard", () => {
  it("renders the title", () => {
    render(<SectionCard title="Card Title">Content</SectionCard>);
    expect(screen.getByText("Card Title")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(<SectionCard title="T">Hello World</SectionCard>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("wraps content in a Card", () => {
    const { container } = render(<SectionCard title="T">Inside</SectionCard>);
    expect(container.querySelector(".MuiCard-root")).toBeInTheDocument();
  });
});
