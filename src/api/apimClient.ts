/**
 * APIM REST API client
 * Calls the Azure APIM REST API using the portal backend or APIM Management API.
 * 
 * VITE_PORTAL_API_BASE should proxy to your APIM instance backend.
 * Alternatively, VITE_APIM_GATEWAY_URL is used for direct calls.
 */
import { useAuth } from "../auth/useAuth";
import {
  ApimApiContract,
  ApimOperationContract,
  ApimPageContract,
  ApiSummary,
  ApiDetails,
  ApiOperation,
} from "./types";

const apimBase = import.meta.env.VITE_APIM_GATEWAY_URL || import.meta.env.VITE_PORTAL_API_BASE || "/api";

// Map APIM REST contract → your internal ApiSummary type
function mapApimApi(contract: ApimApiContract, tags: string[] = []): ApiSummary {
  return {
    id: contract.id ?? contract.name,
    name: contract.name,
    displayName: contract.name,
    description: contract.description ?? "",
    apiVersion: contract.apiVersion,
    apiRevision: contract.apiRevision,
    path: contract.path,
    protocols: contract.protocols,
    type: (contract.type as ApiSummary["type"]) ?? "http",
    subscriptionRequired: contract.subscriptionRequired ?? true,
    status: "Production",
    owner: contract.contact?.name ?? "Komatsu",
    tags,
    category: tags[0] ?? "General",
    plan: contract.subscriptionRequired ? "Paid" : "Free",
  };
}

function mapOperation(contract: ApimOperationContract): ApiOperation {
  return {
    id: contract.id ?? contract.name,
    name: contract.name,
    displayName: contract.displayName ?? contract.name,
    method: contract.method,
    urlTemplate: contract.urlTemplate,
    description: contract.description,
  };
}

export const useApimClient = () => {
  const { getAccessToken } = useAuth();

  const apimFetch = async <T>(path: string): Promise<T | null> => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${apimBase}${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      return null;
    }
  };

  const getApis = async (): Promise<ApiSummary[]> => {
    const result = await apimFetch<ApimPageContract<ApimApiContract>>("/apis?api-version=2022-08-01");
    if (!result) return [];
    return result.value.map((c: ApimApiContract) => mapApimApi(c));
  };

  const getApiById = async (apiId: string): Promise<ApiDetails | null> => {
    const [apiResult, opsResult] = await Promise.all([
      apimFetch<ApimApiContract>(`/apis/${apiId}?api-version=2022-08-01`),
      apimFetch<ApimPageContract<ApimOperationContract>>(`/apis/${apiId}/operations?api-version=2022-08-01`),
    ]);
    if (!apiResult) return null;
    const base = mapApimApi(apiResult);
    const operations = opsResult ? opsResult.value.map((op: ApimOperationContract) => mapOperation(op)) : [];
    return {
      ...base,
      overview: base.description ?? "",
      documentationUrl: `/apis/${apiId}/docs`,
      openApiUrl: `${apimBase}/apis/${apiId}/export?format=openapi&api-version=2022-08-01`,
      plans: [
        { name: "Sandbox", quota: "1k calls/day", notes: "Testing only" },
        { name: "Production", quota: "50k calls/day", notes: "SLA backed" },
      ],
      operations,
      contact: apiResult.contact,
      license: apiResult.license,
      termsOfServiceUrl: apiResult.termsOfServiceUrl,
    };
  };

  return { getApis, getApiById };
};