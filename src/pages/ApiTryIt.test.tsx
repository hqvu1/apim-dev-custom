import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import ApiTryIt from "./ApiTryIt";
import * as apiClient from "../api/client";

// Mock react-router-dom useParams
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ apiId: "test-api" })
  };
});

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn()
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

describe("ApiTryIt", () => {
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
          <ApiTryIt />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Try-It Console")).toBeInTheDocument();
  });

  it("renders default operations list", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("GET /claims")).toBeInTheDocument();
    expect(screen.getByText("POST /claims")).toBeInTheDocument();
  });

  it("renders request builder form", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Request Builder")).toBeInTheDocument();
    expect(screen.getByText("Send Request")).toBeInTheDocument();
    expect(screen.getByText("Response")).toBeInTheDocument();
  });

  it("loads operations from API", async () => {
    mockGet.mockResolvedValue({
      data: { operations: ["GET /users", "POST /users", "DELETE /users/{id}"] },
      error: null
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("GET /users")).toBeInTheDocument();
      expect(screen.getByText("POST /users")).toBeInTheDocument();
      expect(screen.getByText("DELETE /users/{id}")).toBeInTheDocument();
    });
  });

  it("fetches try-config on mount with apiId", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/apis/test-api/try-config");
  });

  it("renders Operations section title", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Operations")).toBeInTheDocument();
  });
});
