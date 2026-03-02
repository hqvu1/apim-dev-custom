import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import Register from "./Register";
import * as apiClient from "../api/client";

vi.mock("../api/client", () => ({
  usePortalApi: vi.fn()
}));

vi.mock("../components/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>
}));

describe("Register", () => {
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
          <Register />
        </ThemeProvider>
      </MemoryRouter>
    );

  it("renders the page header", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText("Registration")).toBeInTheDocument();
  });

  it("renders default form fields", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByLabelText("Company")).toBeInTheDocument();
    expect(screen.getByLabelText("Contact")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.getByLabelText("Intended APIs")).toBeInTheDocument();
    expect(screen.getByLabelText("Data usage details")).toBeInTheDocument();
  });

  it("loads dynamic fields from API", async () => {
    mockGet.mockResolvedValue({
      data: { fields: ["Organization", "Department", "Phone"] },
      error: null
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText("Organization")).toBeInTheDocument();
      expect(screen.getByLabelText("Department")).toBeInTheDocument();
      expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    });
  });

  it("submits registration via post", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: null, error: null });
    mockPost.mockResolvedValue({ data: {}, error: null });
    renderComponent();

    await user.click(screen.getByText("Submit registration"));
    expect(mockPost).toHaveBeenCalledWith("/registration", { status: "submitted" });
  });

  it("shows Logic Apps workflow note", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(screen.getByText(/Logic Apps workflow/i)).toBeInTheDocument();
  });

  it("fetches registration config on mount", () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    renderComponent();
    expect(mockGet).toHaveBeenCalledWith("/registration/config");
  });
});
