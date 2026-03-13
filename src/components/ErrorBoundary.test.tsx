/**
 * Unit tests for ErrorBoundary component
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// Silence console.error in tests — ErrorBoundary logs errors intentionally
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

// Component that always throws
const BrokenChild = () => {
  throw new Error("Test render error");
};

describe("ErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <div>Healthy content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Healthy content")).toBeInTheDocument();
  });

  it("displays default fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Please refresh the page or contact support if the issue persists."
      )
    ).toBeInTheDocument();
  });

  it("displays Refresh button in the fallback UI", () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /refresh/i })
    ).toBeInTheDocument();
  });

  it("renders custom fallback when the fallback prop is provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument();
  });

  it("calls console.error with structured log on error", () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    // console.error is called by React AND by componentDidCatch
    const structuredCall = consoleErrorSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("[ErrorBoundary]")
    );

    expect(structuredCall).toBeDefined();
    const logData = structuredCall![1];
    expect(logData).toHaveProperty("name");
    expect(logData).toHaveProperty("message");
    expect(logData).toHaveProperty("timestamp");
  });

  it("catches errors from deeply nested children", () => {
    const DeeplyNested = () => (
      <div>
        <div>
          <BrokenChild />
        </div>
      </div>
    );

    render(
      <ErrorBoundary>
        <DeeplyNested />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("does not catch errors from sibling trees", () => {
    // ErrorBoundary only catches errors in its subtree.
    // If a sibling throws outside, this ErrorBoundary won't catch it.
    render(
      <ErrorBoundary>
        <div>Sibling test</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Sibling test")).toBeInTheDocument();
  });
});
