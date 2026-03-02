import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import Support from "./Support";
import * as apiClient from "../api/client";

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn()
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

describe("Support", () => {
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
          <Support />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
  });

  it("renders three tabs", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("FAQs")).toBeInTheDocument();
    expect(screen.getByText("Create Ticket")).toBeInTheDocument();
    expect(screen.getByText("My Tickets")).toBeInTheDocument();
  });

  it("shows FAQ tab content by default with empty state", async () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("No FAQs loaded.")).toBeInTheDocument();
    });
  });

  it("renders FAQ data when available", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/support/faqs") return Promise.resolve({ data: ["How to get started?", "What is an API key?"], error: null });
      return Promise.resolve({ data: [], error: null });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("How to get started?")).toBeInTheDocument();
      expect(screen.getByText("What is an API key?")).toBeInTheDocument();
    });
  });

  it("switches to Create Ticket tab", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();

    await user.click(screen.getByText("Create Ticket"));
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("switches to My Tickets tab with empty state", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();

    await user.click(screen.getByText("My Tickets"));
    await waitFor(() => {
      expect(screen.getByText("No tickets yet.")).toBeInTheDocument();
    });
  });

  it("renders tickets when available", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((url: string) => {
      if (url === "/support/my-tickets") {
        return Promise.resolve({
          data: [{ id: "1", subject: "Login issue", status: "Open" }],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderComponent();

    await user.click(screen.getByText("My Tickets"));
    await waitFor(() => {
      expect(screen.getByText("Login issue")).toBeInTheDocument();
      expect(screen.getByText("Open")).toBeInTheDocument();
    });
  });

  it("submits a ticket via post", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: null, error: null });
    mockPost.mockResolvedValue({ data: {}, error: null });
    renderComponent();

    await user.click(screen.getByText("Create Ticket"));
    await user.click(screen.getByText("Submit ticket"));
    expect(mockPost).toHaveBeenCalledWith("/support/tickets", {});
  });

  it("fetches faqs and tickets on mount", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/support/faqs");
    expect(mockGet).toHaveBeenCalledWith("/support/my-tickets");
  });
});
