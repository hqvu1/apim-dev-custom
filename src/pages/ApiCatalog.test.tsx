import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import ApiCatalog from "./ApiCatalog";
import * as apiClient from "../api/client";
import { ApiSummary } from "../api/types";

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn(),
  unwrapArray: vi.fn((data: unknown) => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && "value" in (data as any)) return (data as any).value;
    return null;
  })
}));

const stableToast = { notify: vi.fn() };
vi.mock("../components/useToast", () => ({
  useToast: () => stableToast
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

vi.mock("../components/ApiCard", () => ({
  default: ({ api }: { api: ApiSummary }) => <div data-testid="api-card">{api.name}</div>
}));

vi.mock("../api/mockData", () => ({
  apiCatalog: [
    { id: "mock-1", name: "Mock API", description: "Fallback", status: "Production", owner: "Test", tags: [], category: "General", plan: "Free" }
  ]
}));

describe("ApiCatalog", () => {
  const mockGet = vi.fn();

  const mockApis: ApiSummary[] = [
    { id: "1", name: "Fleet API", displayName: "Fleet API", description: "Fleet management", status: "Production", owner: "Team A", tags: ["fleet"], category: "Integration", plan: "Paid" },
    { id: "2", name: "Parts API", displayName: "Parts API", description: "Parts catalog service", status: "Sandbox", owner: "Team B", tags: ["parts"], category: "Public", plan: "Free" },
    { id: "3", name: "Claims API", displayName: "Claims API", description: "Warranty claims", status: "Production", owner: "Team C", tags: ["claims"], category: "Integration", plan: "Internal" }
  ];

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
          <ApiCatalog />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    expect(screen.getByText("API Catalog")).toBeInTheDocument();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {})); // Never resolves
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders API cards after data loads", async () => {
    mockGet.mockResolvedValue({ data: mockApis, error: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fleet API")).toBeInTheDocument();
      expect(screen.getByText("Parts API")).toBeInTheDocument();
      expect(screen.getByText("Claims API")).toBeInTheDocument();
    });
  });

  it("shows API count after loading", async () => {
    mockGet.mockResolvedValue({ data: mockApis, error: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("3 APIs available")).toBeInTheDocument();
    });
  });

  it("shows singular count for 1 API", async () => {
    mockGet.mockResolvedValue({ data: [mockApis[0]], error: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("1 API available")).toBeInTheDocument();
    });
  });

  it("shows empty state when no APIs match filters", async () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No APIs found")).toBeInTheDocument();
      expect(screen.getByText("No APIs are currently published.")).toBeInTheDocument();
    });
  });

  it("filters APIs by search text", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: mockApis, error: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fleet API")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await user.type(searchInput, "Fleet");

    expect(screen.getByText("Fleet API")).toBeInTheDocument();
    expect(screen.queryByText("Parts API")).not.toBeInTheDocument();
  });

  it("shows filter-specific empty message", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: mockApis, error: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fleet API")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No APIs found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your search or filter criteria.")).toBeInTheDocument();
  });

  it("falls back to mock data on error", async () => {
    mockGet.mockResolvedValue({ data: null, error: { message: "Server error" } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Mock API")).toBeInTheDocument();
    });
  });

  it("calls GET /apis on mount", () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/apis");
  });

  it("renders search field", () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    renderComponent();
    expect(screen.getByPlaceholderText(/Search by name/i)).toBeInTheDocument();
  });
});
