/**
 * Unit tests for LoadingScreen component
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingScreen from "./LoadingScreen";

describe("LoadingScreen", () => {
  it("renders without crashing", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("displays default 'Loading...' message when no message prop", () => {
    render(<LoadingScreen />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays custom message when provided", () => {
    render(<LoadingScreen message="Signing you in..." />);
    expect(screen.getByText("Signing you in...")).toBeInTheDocument();
  });

  it("displays a circular progress indicator", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders different messages correctly", () => {
    const { rerender } = render(
      <LoadingScreen message="Loading page..." />
    );
    expect(screen.getByText("Loading page...")).toBeInTheDocument();

    rerender(<LoadingScreen message="Redirecting to Entra ID..." />);
    expect(
      screen.getByText("Redirecting to Entra ID...")
    ).toBeInTheDocument();
  });
});
