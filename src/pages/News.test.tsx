import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import News from "./News";
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
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="page-header">{title}{subtitle && <span>{subtitle}</span>}</div>
  )
}));

describe("News", () => {
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
          <News />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
  });

  it("shows empty state when no news items", async () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("No news articles yet.")).toBeInTheDocument();
    });
  });

  it("renders news items when data is returned", async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: "1", title: "First Article", date: "2024-01-01", tags: ["api", "update"] },
        { id: "2", title: "Second Article", date: "2024-01-02" }
      ],
      error: null
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("First Article")).toBeInTheDocument();
      expect(screen.getByText("Second Article")).toBeInTheDocument();
    });
  });

  it("renders tags when present", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: "1", title: "Tagged", date: "2024-01-01", tags: ["api", "update"] }],
      error: null
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Tags: api, update")).toBeInTheDocument();
    });
  });

  it("calls GET /news on mount", () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/news");
  });

  it("handles null data gracefully", async () => {
    mockGet.mockResolvedValue({ data: null, error: { message: "error" } });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("No news articles yet.")).toBeInTheDocument();
    });
  });
});
