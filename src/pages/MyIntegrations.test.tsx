import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import MyIntegrations from "./MyIntegrations";
import * as apiClient from "../api/client";

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn(),
  unwrapArray: vi.fn((data: unknown) => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && "value" in (data as any)) return (data as any).value;
    return null;
  })
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

describe("MyIntegrations", () => {
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
          <MyIntegrations />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("My Integrations")).toBeInTheDocument();
  });

  it("shows empty state when no subscriptions", async () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("No subscriptions yet.")).toBeInTheDocument();
    });
  });

  it("renders subscription cards when data available", async () => {
    mockGet.mockResolvedValue({
      data: [
        { apiName: "Fleet API", environment: "Production", status: "Active", quota: "1000/day" },
        { apiName: "Parts API", environment: "Sandbox", status: "Pending", quota: "500/day" }
      ],
      error: null
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fleet API")).toBeInTheDocument();
      expect(screen.getByText("Production | Active")).toBeInTheDocument();
      expect(screen.getByText("Quota: 1000/day")).toBeInTheDocument();
      expect(screen.getByText("Parts API")).toBeInTheDocument();
    });
  });

  it("renders Manage buttons for each subscription", async () => {
    mockGet.mockResolvedValue({
      data: [{ apiName: "Test API", environment: "Prod", status: "Active", quota: "100/day" }],
      error: null
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Manage")).toBeInTheDocument();
    });
  });

  it("handles null data gracefully", async () => {
    mockGet.mockResolvedValue({ data: null, error: { message: "error" } });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("No subscriptions yet.")).toBeInTheDocument();
    });
  });

  it("calls GET /users/me/subscriptions on mount", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/users/me/subscriptions");
  });
});
