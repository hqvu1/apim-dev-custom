import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import Admin from "./Admin";
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

describe("Admin", () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
          <Admin />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
  });

  it("renders pending registrations heading", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Pending registrations")).toBeInTheDocument();
  });

  it("renders metrics cards when data available", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/admin/metrics")) {
        return Promise.resolve({
          data: [
            { label: "Users", value: "42" },
            { label: "APIs", value: "15" }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Users")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("APIs")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });

  it("renders pending registration requests", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/admin/registrations")) {
        return Promise.resolve({
          data: [
            { id: "1", company: "Acme Corp", region: "North America" },
            { id: "2", company: "Global Inc", region: "Europe" }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("Region: North America")).toBeInTheDocument();
      expect(screen.getByText("Global Inc")).toBeInTheDocument();
    });
  });

  it("calls approve endpoint when Approve clicked", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/admin/registrations")) {
        return Promise.resolve({
          data: [{ id: "1", company: "Acme Corp", region: "NA" }],
          error: null
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
    mockPost.mockResolvedValue({ data: {}, error: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Approve"));
    expect(mockPost).toHaveBeenCalledWith("/admin/registrations/1/approve", {});
  });

  it("calls reject endpoint when Reject clicked", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/admin/registrations")) {
        return Promise.resolve({
          data: [{ id: "1", company: "Acme Corp", region: "NA" }],
          error: null
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
    mockPost.mockResolvedValue({ data: {}, error: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Reject"));
    expect(mockPost).toHaveBeenCalledWith("/admin/registrations/1/reject", {});
  });

  it("fetches registrations and metrics on mount", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/admin/registrations?status=pending");
    expect(mockGet).toHaveBeenCalledWith("/admin/metrics");
  });
});
