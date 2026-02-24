/**
 * mockData.ts — static fixtures for local development and unit tests.
 *
 * These are intentionally kept as a fallback for:
 *   1. `VITE_USE_MOCK_AUTH=true` local dev sessions (no real APIM instance needed).
 *   2. Vitest unit / component tests that don't want to hit a live endpoint.
 *
 * Production code should use `useApimCatalog()` from ./client.ts instead.
 */
import { ApiDetails, ApiSummary } from "./types";

export const apiHighlights: ApiSummary[] = [
  {
    id: "warranty-api",
    name: "Warranty API",
    description: "Warranty claims and coverage validation.",
    status: "Production",
    owner: "Komatsu Warranty",
    tags: ["claims", "coverage", "warranty"],
    category: "Warranty",
    plan: "Paid",
    path: "/warranty",
    protocols: ["https"],
    subscriptionRequired: true,
  },
  {
    id: "punchout-api",
    name: "Punchout API",
    description: "Dealer commerce and parts ordering.",
    status: "Sandbox",
    owner: "Commerce Platform",
    tags: ["commerce", "orders", "punchout"],
    category: "Commerce",
    plan: "Free",
    path: "/punchout",
    protocols: ["https"],
    subscriptionRequired: false,
  },
  {
    id: "equipment-api",
    name: "Equipment API",
    description: "Fleet data, telemetry, and lifecycle info.",
    status: "Production",
    owner: "Equipment Insights",
    tags: ["fleet", "telemetry", "equipment"],
    category: "Equipment",
    plan: "Internal",
    path: "/equipment",
    protocols: ["https"],
    subscriptionRequired: true,
  },
];

export const apiCatalog: ApiSummary[] = [
  ...apiHighlights,
  {
    id: "parts-api",
    name: "Parts API",
    description: "Inventory, pricing, and dealer parts fulfillment.",
    status: "Sandbox",
    owner: "Parts Operations",
    tags: ["parts", "inventory"],
    category: "Commerce",
    plan: "Paid",
    path: "/parts",
    protocols: ["https"],
    subscriptionRequired: true,
  },
];

export const apiDetail: ApiDetails = {
  ...apiHighlights[0],
  overview:
    "Accelerate warranty processing with trusted warranty coverage data, claim lifecycle events, and entitlement validation.",
  documentationUrl: "/docs/warranty",
  plans: [
    { name: "Sandbox", quota: "1k calls/day", notes: "Testing only" },
    { name: "Production", quota: "50k calls/day", notes: "SLA backed" },
  ],
  operations: [
    {
      id: "get-warranty",
      name: "getWarranty",
      method: "GET",
      urlTemplate: "/warranty/{serialNumber}",
      displayName: "Get Warranty",
      description: "Returns warranty coverage for a given serial number.",
    },
    {
      id: "submit-claim",
      name: "submitClaim",
      method: "POST",
      urlTemplate: "/warranty/claims",
      displayName: "Submit Claim",
      description: "Creates a new warranty claim.",
    },
  ],
};