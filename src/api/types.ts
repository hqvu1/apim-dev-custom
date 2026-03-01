/**
 * APIM REST API — raw contract shapes returned by the Azure API Management data plane.
 * Modelled after the APIM portal's src/contracts/api.ts (api-management-developer-portal).
 */

// ─── APIM data-plane contract types ──────────────────────────────────────────

export type ApimApiContract = {
  id: string;
  name: string;
  description?: string;
  path?: string;
  protocols?: string[];
  apiVersion?: string;
  apiRevision?: string;
  type?: "http" | "soap" | "websocket" | "graphql";
  subscriptionRequired?: boolean;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name?: string;
    url?: string;
  };
  termsOfServiceUrl?: string;
  /** Custom property injected by the portal BFF/tag for owner */
  tags?: string[];
};

export type ApimPageContract<T> = {
  value: T[];
  nextLink?: string;
  count?: number;
};

export type ApimOperationContract = {
  id: string;
  name: string;
  method: string;
  urlTemplate: string;
  description?: string;
  displayName?: string;
};

export type ApimProductContract = {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  state?: "published" | "notPublished";
  subscriptionRequired?: boolean;
  approvalRequired?: boolean;
};

export type ApimSubscriptionContract = {
  id: string;
  name: string;
  displayName?: string;
  scope?: string;
  state?: "active" | "suspended" | "expired" | "cancelled" | "submitted";
  primaryKey?: string;
  secondaryKey?: string;
};

// ─── Internal domain types used across apim-dev-custom ───────────────────────

/**
 * Indicates whether the API is sourced from APIM Data API or an external
 * (non-APIM) backend. The BFF's Backend Router pattern uses the api-registry
 * to dispatch to the correct upstream.
 *
 * @see docs/BFF_EVOLUTION_ANALYSIS.md §2 — Backend Router Pattern
 */
export type ApiSource = "apim" | "external";

export type ApiSummary = {
  id: string;
  name: string;
  description: string;
  status: "Sandbox" | "Production" | "Deprecated";
  owner: string;
  tags: string[];
  category: string;
  plan: "Free" | "Paid" | "Internal";
  path?: string;
  protocols?: string[];
  apiVersion?: string;
  type?: string;
  subscriptionRequired?: boolean;
  /** Backend source — APIM Data API or external adapter. Defaults to "apim". */
  source?: ApiSource;
};

export type ApiDetails = ApiSummary & {
  overview: string;
  documentationUrl: string;
  openApiUrl?: string;
  plans: Array<{ name: string; quota: string; notes: string }>;
  operations?: ApiOperation[];
  contact?: { name?: string; url?: string; email?: string };
  license?: { name?: string; url?: string };
  termsOfServiceUrl?: string;
};

export type ApiOperation = {
  id: string;
  name: string;
  method: string;
  urlTemplate: string;
  description?: string;
  displayName?: string;
};

export type ApiProduct = {
  id: string;
  name: string;
  description?: string;
  plan: "Free" | "Paid" | "Internal";
  subscriptionRequired?: boolean;
};

export type ApiSubscription = {
  id: string;
  name: string;
  scope?: string;
  state: string;
  primaryKey?: string;
  secondaryKey?: string;
};

// ─── Mapper: APIM contract → internal domain type ────────────────────────────

/**
 * Maps a raw APIM data-plane ApiContract to the internal ApiSummary shape.
 * Logic mirrors api-management-developer-portal/src/models/api.ts constructor.
 */
export function mapApimApiToSummary(contract: ApimApiContract): ApiSummary {
  // Derive a human-readable status from apiRevision / type hints.
  // APIM has no native "status" field; we default to Production unless the
  // path/name contains sandbox/test hints.
  const lowerName = (contract.name || "").toLowerCase();
  const lowerPath = (contract.path || "").toLowerCase();
  let status: ApiSummary["status"] = "Production";
  if (lowerName.includes("sandbox") || lowerPath.includes("sandbox") || lowerName.includes("test")) {
    status = "Sandbox";
  }

  // Derive category from the first tag if available.
  const tags = Array.isArray(contract.tags) ? contract.tags : [];
  const category = tags.length > 0 ? tags[0] : "General";

  // Derive plan — default to Free; override based on subscriptionRequired flag.
  const plan: ApiSummary["plan"] = contract.subscriptionRequired ? "Paid" : "Free";

  return {
    id: contract.id,
    name: contract.name,
    description: contract.description ?? "",
    status,
    owner: contract.contact?.name ?? "Komatsu",
    tags,
    category,
    plan,
    path: contract.path,
    protocols: contract.protocols,
    apiVersion: contract.apiVersion,
    type: contract.type,
    subscriptionRequired: contract.subscriptionRequired,
    source: "apim", // APIM-sourced by default; external adapters override this
  };
}

export function mapApimOperationToApiOperation(op: ApimOperationContract): ApiOperation {
  return {
    id: op.id,
    name: op.name,
    method: op.method,
    urlTemplate: op.urlTemplate,
    description: op.description,
    displayName: op.displayName ?? op.name,
  };
}

export function mapApimProductToApiProduct(p: ApimProductContract): ApiProduct {
  const plan: ApiProduct["plan"] = p.subscriptionRequired ? "Paid" : "Free";
  return {
    id: p.id,
    name: p.displayName ?? p.name,
    description: p.description,
    plan,
    subscriptionRequired: p.subscriptionRequired,
  };
}