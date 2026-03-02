/**
 * Unit tests for ApiCard component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme";
import ApiCard from "./ApiCard";
import type { ApiSummary } from "../api/types";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ApiCard", () => {
  const baseApi: ApiSummary = {
    id: "warranty-api",
    name: "Warranty API",
    description: "Manage warranty claims and registrations.",
    status: "Production",
    plan: "Premium",
    owner: "Warranty Team",
    tags: ["warranty", "claims"],
    category: "Enterprise",
  };

  const renderCard = (api: ApiSummary = baseApi) =>
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <ApiCard api={api} />
        </ThemeProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      renderCard();
      expect(screen.getByText("Warranty API")).toBeInTheDocument();
    });

    it("displays the API name", () => {
      renderCard();
      expect(screen.getByText("Warranty API")).toBeInTheDocument();
    });

    it("displays the API description", () => {
      renderCard();
      expect(
        screen.getByText("Manage warranty claims and registrations.")
      ).toBeInTheDocument();
    });

    it("displays 'No description available.' when description is empty", () => {
      renderCard({ ...baseApi, description: "" });
      expect(
        screen.getByText("No description available.")
      ).toBeInTheDocument();
    });

    it("displays the status chip", () => {
      renderCard();
      expect(screen.getByText("Production")).toBeInTheDocument();
    });

    it("displays the plan chip", () => {
      renderCard();
      expect(screen.getByText("Premium")).toBeInTheDocument();
    });

    it("displays Sandbox status for sandbox APIs", () => {
      renderCard({ ...baseApi, status: "Sandbox" });
      expect(screen.getByText("Sandbox")).toBeInTheDocument();
    });

    it("displays API version when available", () => {
      renderCard({ ...baseApi, apiVersion: "v2.1" });
      expect(screen.getByText("v2.1")).toBeInTheDocument();
    });

    it("does not display version chip when apiVersion is undefined", () => {
      renderCard();
      // No version chip should be present
      expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
    });

    it("displays path when available", () => {
      renderCard({ ...baseApi, path: "warranty/v2" });
      expect(screen.getByText("/warranty/v2")).toBeInTheDocument();
    });

    it("displays 'Key required' chip when subscription required", () => {
      renderCard({ ...baseApi, subscriptionRequired: true });
      expect(screen.getByText("Key required")).toBeInTheDocument();
    });

    it("displays 'Open' chip when subscription not required", () => {
      renderCard({ ...baseApi, subscriptionRequired: false });
      expect(screen.getByText("Open")).toBeInTheDocument();
    });

    it("displays protocols when available", () => {
      renderCard({ ...baseApi, protocols: ["https", "wss"] });
      expect(screen.getByText("HTTPS, WSS")).toBeInTheDocument();
    });
  });

  describe("External API badge", () => {
    it("shows External chip for external APIs", () => {
      renderCard({ ...baseApi, source: "external" });
      expect(screen.getByText("External")).toBeInTheDocument();
    });

    it("does not show External chip for APIM APIs", () => {
      renderCard({ ...baseApi, source: "apim" });
      expect(screen.queryByText("External")).not.toBeInTheDocument();
    });

    it("does not show External chip when source is undefined", () => {
      renderCard(baseApi);
      expect(screen.queryByText("External")).not.toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("navigates to API details when card is clicked", async () => {
      const user = userEvent.setup();
      renderCard();

      const clickArea = screen.getByText("Warranty API").closest("button");
      expect(clickArea).toBeDefined();
      await user.click(clickArea!);

      expect(mockNavigate).toHaveBeenCalledWith("/apis/warranty-api");
    });

    it("navigates to the correct API based on id", async () => {
      const user = userEvent.setup();
      renderCard({ ...baseApi, id: "punchout-api", name: "Punchout API" });

      const clickArea = screen.getByText("Punchout API").closest("button");
      await user.click(clickArea!);

      expect(mockNavigate).toHaveBeenCalledWith("/apis/punchout-api");
    });
  });
});
