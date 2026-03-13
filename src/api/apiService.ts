/**
 * APIM API Service
 * 
 * Service for managing API catalog, operations, and metadata.
 * Ported from api-management-developer-portal with adaptations for React hooks.
 */

import { useMapiClient, type Page } from "./mapiClient";
import type {
  ApiContract,
  OperationContract,
  TagContract,
  ApiTagResourceContract,
  VersionSetContract,
  SchemaContract,
  ChangeLogContract,
} from "./contracts";

const DEFAULT_PAGE_SIZE = 20;

// Encode special characters for OData queries
const encodeForOData = (value: string): string => {
  return encodeURIComponent(value)
    .replace(/'/g, "''")
    .replace(/%20/g, " ");
};

// Add query parameter to URL
const addQueryParam = (url: string, param: string): string => {
  return url + (url.includes("?") ? "&" : "?") + param;
};

export interface SearchQuery {
  skip?: number;
  take?: number;
  pattern?: string;
  propertyName?: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface TagGroup<T> {
  tag: string;
  items: T[];
}

/**
 * React hook for APIM API Service
 */
export const useApiService = () => {
  const mapiClient = useMapiClient();

  /**
   * Get APIs with optional search/filtering
   */
  const getApis = async (searchQuery?: SearchQuery): Promise<Page<ApiContract>> => {
    const skip = searchQuery?.skip || 0;
    const take = searchQuery?.take || DEFAULT_PAGE_SIZE;
    const odataFilters: string[] = [];

    let path = `/apis?$top=${take}&$skip=${skip}`;

    // Add tag filters
    if (searchQuery?.tags && searchQuery.tags.length > 0) {
      searchQuery.tags.forEach((tag, index) => {
        path = addQueryParam(path, `tags[${index}]=${tag.name}`);
      });
    }

    // Add pattern filter
    if (searchQuery?.pattern) {
      const pattern = encodeForOData(searchQuery.pattern);
      odataFilters.push(`(contains(name,'${pattern}'))`);
    }

    if (odataFilters.length > 0) {
      path = addQueryParam(path, `$filter=${odataFilters.join(" and ")}`);
    }

    // Skip workspace APIs
    path = addQueryParam(path, "skipWorkspaces=true");

    const result = await mapiClient.get<Page<ApiContract>>(path);
    return result || { value: [], count: 0 };
  };

  /**
   * Get single API by ID
   */
  const getApi = async (apiId: string, revision?: string): Promise<ApiContract | null> => {
    if (!apiId) {
      throw new Error('Parameter "apiId" not specified.');
    }

    let path = `/apis/${apiId}`;

    if (revision) {
      path += `;rev=${revision}`;
    }

    path = addQueryParam(path, "expandApiVersionSet=true");

    return mapiClient.get<ApiContract>(path);
  };

  /**
   * Get APIs in specified version set
   */
  const getApisInVersionSet = async (versionSetId: string): Promise<ApiContract[]> => {
    if (!versionSetId) {
      return [];
    }

    const path = `/apiVersionSets/${versionSetId}/apis`;
    const result = await mapiClient.get<Page<ApiContract>>(path);
    return result?.value || [];
  };

  /**
   * Get operations for an API
   */
  const getOperations = async (apiId: string, searchQuery?: SearchQuery): Promise<Page<OperationContract>> => {
    if (!apiId) {
      throw new Error('Parameter "apiId" not specified.');
    }

    const skip = searchQuery?.skip || 0;
    const take = searchQuery?.take || DEFAULT_PAGE_SIZE;
    const odataFilters: string[] = [];

    let path = `/apis/${apiId}/operations?$top=${take}&$skip=${skip}`;

    // Add tag filters
    if (searchQuery?.tags && searchQuery.tags.length > 0) {
      searchQuery.tags.forEach((tag, index) => {
        path = addQueryParam(path, `tags[${index}]=${tag.name}`);
      });
    }

    // Add pattern filter
    if (searchQuery?.pattern) {
      const pattern = encodeForOData(searchQuery.pattern);
      const propertyName = searchQuery.propertyName || "name";
      odataFilters.push(`(contains(${propertyName},'${pattern}'))`);
    }

    if (odataFilters.length > 0) {
      path = addQueryParam(path, `$filter=${odataFilters.join(" and ")}`);
    }

    const result = await mapiClient.get<Page<OperationContract>>(path);
    return result || { value: [], count: 0 };
  };

  /**
   * Get single operation
   */
  const getOperation = async (apiId: string, operationId: string): Promise<OperationContract | null> => {
    if (!apiId) {
      throw new Error('Parameter "apiId" not specified.');
    }
    if (!operationId) {
      throw new Error('Parameter "operationId" not specified.');
    }

    const path = `/apis/${apiId}/operations/${operationId}`;
    return mapiClient.get<OperationContract>(path);
  };

  /**
   * Get operations grouped by tags
   */
  const getOperationsByTags = async (apiId: string, searchQuery?: SearchQuery): Promise<Page<TagGroup<OperationContract>>> => {
    if (!apiId) {
      throw new Error('Parameter "apiId" not specified.');
    }

    const skip = searchQuery?.skip || 0;
    const take = searchQuery?.take || DEFAULT_PAGE_SIZE;
    const odataFilters: string[] = [];

    let path = `/apis/${apiId}/operationsByTags?includeNotTaggedOperations=true&$top=${take}&$skip=${skip}`;

    // Add tag filters
    if (searchQuery?.tags && searchQuery.tags.length > 0) {
      const tagFilterEntries = searchQuery.tags.map((tag) => `tag/id eq '${tag.id}'`);
      odataFilters.push(`(${tagFilterEntries.join(" or ")})`);
    }

    // Add pattern filter
    if (searchQuery?.pattern) {
      const pattern = encodeForOData(searchQuery.pattern);
      const propertyName = searchQuery.propertyName || "name";
      odataFilters.push(`(contains(operation/${propertyName},'${pattern}'))`);
    }

    if (odataFilters.length > 0) {
      path = addQueryParam(path, `$filter=${odataFilters.join(" and ")}`);
    }

    const result = await mapiClient.get<Page<ApiTagResourceContract>>(path);
    if (!result) {
      return { value: [], count: 0 };
    }

    // Group operations by tag
    const tagGroups: Record<string, TagGroup<OperationContract>> = {};

    result.value.forEach((item) => {
      const tagName = item.tag?.name || "Untagged";

      if (!tagGroups[tagName]) {
        tagGroups[tagName] = {
          tag: tagName,
          items: [],
        };
      }

      if (item.operation) {
        tagGroups[tagName].items.push(item.operation);
      }
    });

    return {
      value: Object.values(tagGroups),
      count: result.count,
      nextLink: result.nextLink,
    };
  };

  /**
   * Get APIs grouped by tags
   */
  const getApisByTags = async (searchQuery?: SearchQuery): Promise<Page<TagGroup<ApiContract>>> => {
    const skip = searchQuery?.skip || 0;
    const take = searchQuery?.take || DEFAULT_PAGE_SIZE;
    const odataFilters: string[] = [];

    let path = `/apisByTags?$top=${take}&$skip=${skip}`;

    // Add tag filters
    if (searchQuery?.tags && searchQuery.tags.length > 0) {
      const tagFilterEntries = searchQuery.tags.map((tag) => `tag/id eq '${tag.id}'`);
      odataFilters.push(`(${tagFilterEntries.join(" or ")})`);
    }

    // Add pattern filter
    if (searchQuery?.pattern) {
      const pattern = encodeForOData(searchQuery.pattern);
      odataFilters.push(`(contains(api/name,'${pattern}'))`);
    }

    if (odataFilters.length > 0) {
      path = addQueryParam(path, `$filter=${odataFilters.join(" and ")}`);
    }

    const result = await mapiClient.get<Page<ApiTagResourceContract>>(path);
    if (!result) {
      return { value: [], count: 0 };
    }

    // Group APIs by tag
    const tagGroups: Record<string, TagGroup<ApiContract>> = {};

    result.value.forEach((item) => {
      const tagName = item.tag?.name || "Untagged";

      if (!tagGroups[tagName]) {
        tagGroups[tagName] = {
          tag: tagName,
          items: [],
        };
      }

      if (item.api) {
        tagGroups[tagName].items.push(item.api);
      }
    });

    return {
      value: Object.values(tagGroups),
      count: result.count,
      nextLink: result.nextLink,
    };
  };

  /**
   * Get tags for an operation
   */
  const getOperationTags = async (operationId: string): Promise<TagContract[]> => {
    if (!operationId) {
      throw new Error('Parameter "operationId" not specified.');
    }

    const result = await mapiClient.get<Page<TagContract>>(`${operationId}/tags`);
    return result?.value || [];
  };

  /**
   * Export API in specified format
   */
  const exportApi = async (apiId: string, format: "swagger" | "openapi" | "openapi+json" | "wadl" | "wsdl"): Promise<string | null> => {
    if (!apiId) {
      throw new Error('Parameter "apiId" not specified.');
    }

    const acceptHeaders: Record<string, string> = {
      swagger: "application/vnd.swagger.doc+json",
      openapi: "application/vnd.oai.openapi",
      "openapi+json": "application/vnd.oai.openapi+json",
      wadl: "application/vnd.sun.wadl+xml",
      wsdl: "application/wsdl+xml",
    };

    const path = `/apis/${apiId}?export=true`;
    return mapiClient.get<string>(path, {
      Accept: acceptHeaders[format] || acceptHeaders.swagger,
      "Cache-Control": "no-cache",
    });
  };

  /**
   * Get API changelog/releases
   */
  const getApiChangeLog = async (apiId: string, skip = 0): Promise<Page<ChangeLogContract>> => {
    if (!apiId) {
      throw new Error('Parameter "apiId" not specified.');
    }

    const path = `/apis/${apiId}/releases?$top=${DEFAULT_PAGE_SIZE}&$skip=${skip}`;
    const result = await mapiClient.get<Page<ChangeLogContract>>(path);
    return result || { value: [], count: 0 };
  };

  /**
   * Get API version set
   */
  const getApiVersionSet = async (versionSetId: string): Promise<VersionSetContract | null> => {
    if (!versionSetId) {
      return null;
    }

    return mapiClient.get<VersionSetContract>(`/apiVersionSets/${versionSetId}`);
  };

  /**
   * Get API schema
   */
  const getApiSchema = async (schemaId: string): Promise<SchemaContract | null> => {
    if (!schemaId) {
      return null;
    }

    const result = await mapiClient.get<SchemaContract>(schemaId);
    if (!result) return null;

    // Handle MAPI response format
    if ("properties" in result && typeof result.properties === "object") {
      return result.properties as SchemaContract;
    }

    return result;
  };

  return {
    getApis,
    getApi,
    getApisInVersionSet,
    getOperations,
    getOperation,
    getOperationsByTags,
    getApisByTags,
    getOperationTags,
    exportApi,
    getApiChangeLog,
    getApiVersionSet,
    getApiSchema,
  };
};
