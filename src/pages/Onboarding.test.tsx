import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import Onboarding from "./Onboarding";
import * as apiClient from "../api/client";

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn()
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

describe("Onboarding", () => {
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.usePortalApi).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn()
    } as any);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <Onboarding />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Onboarding Status")).toBeInTheDocument();
  });

  it("renders all stepper steps", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Under Review")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Access Enabled")).toBeInTheDocument();
  });

  it("shows default status text when no data", async () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Current status: Under Review/i)).toBeInTheDocument();
    });
  });

  it("updates active step based on API response", async () => {
    mockGet.mockResolvedValue({ data: { status: "Approved" }, error: null });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Current status: Approved")).toBeInTheDocument();
    });
  });

  it("handles unknown status gracefully", async () => {
    mockGet.mockResolvedValue({ data: { status: "Unknown" }, error: null });
    renderComponent();
    await waitFor(() => {
      // Falls back to index 1 ("Under Review") for unknown status
      expect(screen.getByText("Current status: Under Review")).toBeInTheDocument();
    });
  });

  it("calls GET /registration/status on mount", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/registration/status");
  });
});
