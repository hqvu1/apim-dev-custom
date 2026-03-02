import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToastProvider from "./ToastProvider";
import { useToast } from "./useToast";

// Helper component that triggers a toast
const ToastTrigger = ({ message, severity }: { message: string; severity?: "success" | "error" | "info" | "warning" }) => {
  const toast = useToast();
  return (
    <button onClick={() => toast.notify(message, severity)}>Show Toast</button>
  );
};

describe("ToastProvider", () => {
  it("renders children", () => {
    render(
      <ToastProvider>
        <div>Child Content</div>
      </ToastProvider>
    );
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("shows a toast notification when notify is called", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Hello Toast" severity="success" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Hello Toast")).toBeInTheDocument();
  });

  it("shows info severity toast by default", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Info Message" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Info Message")).toBeInTheDocument();
  });

  it("shows error severity toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Error occurred" severity="error" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });
});
