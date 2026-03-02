import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import ApiDetails from "./ApiDetails";
import * as apiClient from "../api/client";
import { ApiDetails as ApiDetailsType } from "../api/types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ apiId: "test-api-1" }),
    useNavigate: () => mockNavigate
  };
});

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn()
}));

// Return a STABLE object reference to avoid re-triggering effects that depend on toast
const stableToast = { notify: vi.fn() };
vi.mock("../components/useToast", () => ({
  useToast: () => stableToast
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="page-header">{title}{subtitle && <span>{subtitle}</span>}</div>
  )
}));

vi.mock("../components/SectionCard", () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="section-card"><h3>{title}</h3>{children}</div>
  )
}));

describe("ApiDetails", () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();

  const fullDetails: ApiDetailsType = {
    id: "test-api-1",
    name: "Fleet Management API",
    description: "API for fleet management",
    status: "Production",
    owner: "Fleet Team",
    tags: ["fleet"],
    category: "Integration",
    plan: "Paid",
    overview: "Full fleet management overview",
    documentationUrl: "/api-docs/test-api-1",
    openApiUrl: "/export/test-api-1",
    path: "fleet/v1",
    protocols: ["https"],
    apiVersion: "1.0",
    subscriptionRequired: true,
    plans: [
      { name: "Basic", quota: "100/day", notes: "Starter plan" },
      { name: "Premium", quota: "Unlimited", notes: "Enterprise" }
    ],
    operations: [
      { id: "op-1", name: "getVehicles", method: "GET", urlTemplate: "/vehicles", description: "List all vehicles", displayName: "Get Vehicles" },
      { id: "op-2", name: "createVehicle", method: "POST", urlTemplate: "/vehicles", description: "Create a vehicle" },
      { id: "op-3", name: "deleteVehicle", method: "DELETE", urlTemplate: "/vehicles/{id}", description: "" }
    ],
    contact: { name: "Fleet Team", email: "fleet@komatsu.com", url: "https://komatsu.com/fleet" },
    license: { name: "MIT", url: "https://mit-license.org" },
    termsOfServiceUrl: "https://komatsu.com/tos"
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    vi.mocked(apiClient.usePortalApi).mockReturnValue({
      get: mockGet,
      post: mockPost,
      patch: vi.fn(),
      delete: vi.fn()
    } as any);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <ApiDetails />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders API details after loading", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: { status: "Active" }, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fleet Management API")).toBeInTheDocument();
    });
  });

  it("renders operations table", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.getByText("Fleet Management API")).toBeInTheDocument();
    });

    // Now check operations 
    expect(screen.getByText("Operations (3)")).toBeInTheDocument();
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("DELETE")).toBeInTheDocument();
  });

  it("renders subscription status", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: { status: "Active" }, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Active/)).toBeInTheDocument();
    });
  });

  it("renders plans section", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Basic")).toBeInTheDocument();
      expect(screen.getByText("Premium")).toBeInTheDocument();
      expect(screen.getByText("Quota: 100/day")).toBeInTheDocument();
    });
  });

  it("renders contact and license info", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    // First wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Fleet Management API")).toBeInTheDocument();
    });

    // Then assert contact and license synchronously
    expect(screen.getByText(/Fleet Team/)).toBeInTheDocument();
    expect(screen.getByText(/fleet@komatsu.com/)).toBeInTheDocument();
    expect(screen.getByText(/MIT/)).toBeInTheDocument();
  });

  it("renders error state when API not found", async () => {
    mockGet.mockResolvedValue({ data: null, error: { message: "Not found" } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("API not found.")).toBeInTheDocument();
    });
  });

  it("renders back to catalog button on error", async () => {
    mockGet.mockResolvedValue({ data: null, error: { message: "Not found" } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Back to catalog")).toBeInTheDocument();
    });
  });

  it("navigates back to catalog when back button clicked on error", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: null, error: { message: "error" } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Back to catalog")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Back to catalog"));
    expect(mockNavigate).toHaveBeenCalledWith("/apis");
  });

  it("shows request access button", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Request access")).toBeInTheDocument();
    });
  });

  it("submits subscription request when Request access clicked", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });
    mockPost.mockResolvedValue({ data: {}, error: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Request access")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Request access"));
    expect(mockPost).toHaveBeenCalledWith("/apis/test-api-1/subscriptions", { action: "request" });
  });

  it("shows Try-It link", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Open Try-It Console")).toBeInTheDocument();
    });
  });

  it("shows documentation link", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("View documentation")).toBeInTheDocument();
    });
  });

  it("shows Export OpenAPI spec link when openApiUrl present", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Export OpenAPI spec")).toBeInTheDocument();
    });
  });

  it("renders metadata chips", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Production")).toBeInTheDocument();
      expect(screen.getByText("Paid")).toBeInTheDocument();
      expect(screen.getByText("Integration")).toBeInTheDocument();
      expect(screen.getByText(/fleet\/v1/)).toBeInTheDocument();
    });
  });

  it("handles fetch exception gracefully", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Failed to load API details.")).toBeInTheDocument();
    });
  });

  it("fetches API details and subscription on mount", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/apis/test-api-1");
    expect(mockGet).toHaveBeenCalledWith("/apis/test-api-1/subscription");
  });

  it("renders back button on details view", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/subscription")) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: fullDetails, error: null });
    });

    renderComponent();

    await waitFor(() => {
      // There are two "Back to catalog" buttons but at least one should be present
      const backButtons = screen.getAllByText("Back to catalog");
      expect(backButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
