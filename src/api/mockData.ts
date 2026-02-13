import { ApiDetails, ApiSummary } from "./types";

export const apiHighlights: ApiSummary[] = [
  {
    id: "warranty",
    name: "Warranty API",
    description: "Warranty claims and coverage validation.",
    status: "Production",
    owner: "Komatsu Warranty",
    tags: ["claims", "coverage"],
    category: "Warranty",
    plan: "Paid"
  },
  {
    id: "punchout",
    name: "Punchout API",
    description: "Dealer commerce and parts ordering.",
    status: "Sandbox",
    owner: "Commerce Platform",
    tags: ["commerce", "orders"],
    category: "Commerce",
    plan: "Free"
  },
  {
    id: "equipment",
    name: "Equipment API",
    description: "Fleet data, telemetry, and lifecycle info.",
    status: "Production",
    owner: "Equipment Insights",
    tags: ["fleet", "telemetry"],
    category: "Equipment",
    plan: "Internal"
  }
];

export const apiCatalog: ApiSummary[] = [
  ...apiHighlights,
  {
    id: "parts",
    name: "Parts API",
    description: "Inventory, pricing, and dealer parts fulfillment.",
    status: "Sandbox",
    owner: "Parts Operations",
    tags: ["parts", "inventory"],
    category: "Commerce",
    plan: "Paid"
  }
];

export const apiDetail: ApiDetails = {
  ...apiHighlights[0],
  overview:
    "Accelerate warranty processing with trusted warranty coverage data, claim lifecycle events, and entitlement validation.",
  documentationUrl: "/docs/warranty",
  plans: [
    { name: "Sandbox", quota: "1k calls/day", notes: "Testing only" },
    { name: "Production", quota: "50k calls/day", notes: "SLA backed" }
  ]
};
