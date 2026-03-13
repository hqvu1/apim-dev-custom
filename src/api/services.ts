/**
 * APIM Services Index
 * 
 * Central export for all APIM Management API services.
 * Import services from this file for cleaner imports.
 * 
 * @example
 * import { useApiService, useProductService } from '@/api/services';
 */

// Management API Client
export { useMapiClient } from "./mapiClient";
export type { Page, MapiRequestOptions } from "./mapiClient";

// Services
export { useApiService } from "./apiService";
export { useProductService } from "./productService";
export { useUserService } from "./userService";
export type { SearchQuery, TagGroup } from "./apiService";
export type { SubscriptionWithProduct } from "./productService";

// Contracts (Type Definitions)
export type {
  ApiContract,
  OperationContract,
  ProductContract,
  SubscriptionContract,
  UserContract,
  TagContract,
  SchemaContract,
  VersionSetContract,
  ChangeLogContract,
  AuthenticationSettings,
  ParameterContract,
  RequestContract,
  ResponseContract,
  RepresentationContract,
  ApiTagResourceContract,
  SubscriptionSecrets,
  SchemaObjectContract,
  IdentityContract,
} from "./contracts";

export { SubscriptionState } from "./contracts";
