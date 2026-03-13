/**
 * APIM Management API Contracts
 * 
 * TypeScript type definitions for Azure APIM Management API responses.
 * Ported from api-management-developer-portal contracts.
 */

// ============================================
// API Contracts
// ============================================

export interface ApiContract {
  /** API identifier. e.g. "/apis/echo-api" */
  id: string;

  /** API name. Must be 1 to 300 characters long. */
  name?: string;

  /** Description of the API. May include HTML formatting tags. */
  description?: string;

  /** Specifies whether an API or Product subscription is required for accessing the API. */
  subscriptionRequired: boolean;

  /** Relative URL uniquely identifying this API */
  path?: string;

  /** Describes on which protocols the operations in this API can be invoked. */
  protocols?: string[];

  /** API Authentication Settings. */
  authenticationSettings?: AuthenticationSettings;

  /** Subscription key parameter names details. */
  subscriptionKeyParameterNames?: SubscriptionKeyParameterName;

  /** Indicates the Version identifier of the API if the API is versioned. */
  apiVersion?: string;

  /** A resource identifier for the related API version set. */
  apiVersionSetId?: string;

  /** Version set details. */
  apiVersionSet?: {
    name: string;
    description: string;
    versioningScheme: string;
    versionQueryName: string;
    versionHeaderName: string;
  };

  /** Describes the Revision of the Api. */
  apiRevision?: string;

  /** Description of the Api Revision. */
  apiRevisionDescription?: string;

  /** Indicates if API revision is current api revision. */
  isCurrent?: boolean;

  /** Indicates if API revision is accessible via the gateway. */
  isOnline?: boolean;

  /** Absolute URL of the backend service implementing this API. */
  serviceUrl?: string;

  /** Type of API. */
  type?: "http" | "soap" | "websocket" | "graphql";

  /** Contact information for the API. */
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };

  /** License information for the API. */
  license?: {
    name?: string;
    url?: string;
  };

  /** URL to the Terms of Service for the API. */
  termsOfServiceUrl?: string;
}

export interface AuthenticationSettings {
  oAuth2?: {
    authorizationServerId?: string;
    scope?: string;
  };
  openid?: {
    openidProviderId?: string;
    bearerTokenSendingMethods?: string[];
  };
  subscriptionRequired?: boolean;
}

export interface SubscriptionKeyParameterName {
  header?: string;
  query?: string;
}

// ============================================
// Operation Contracts
// ============================================

export interface OperationContract {
  /** Operation identifier. e.g. "/apis/echo-api/operations/create-resource" */
  id: string;

  /** Operation name. Must be 1 to 300 characters long. */
  name: string;

  /** Operation description. */
  description?: string;

  /** Operation method. */
  method: string;

  /** Operation URI template. Cannot be more than 400 characters long. */
  urlTemplate: string;

  /** Collection of URL template parameters. */
  templateParameters?: ParameterContract[];

  /** Operation version. */
  version?: string;

  /** Containing request details. */
  request?: RequestContract;

  /** Array of Operation responses. */
  responses?: ResponseContract[];
}

export interface ParameterContract {
  /** Parameter name. */
  name: string;

  /** Parameter description. */
  description?: string;

  /** Parameter type. */
  type: string;

  /** Default parameter value. */
  defaultValue?: string;

  /** Specifies whether parameter is required or not. */
  required?: boolean;

  /** Parameter values. */
  values?: string[];

  /** Schema ID. */
  schemaId?: string;

  /** Type name. */
  typeName?: string;
}

export interface RequestContract {
  /** Operation request description. */
  description?: string;

  /** Collection of operation request query parameters. */
  queryParameters?: ParameterContract[];

  /** Collection of operation request headers. */
  headers?: ParameterContract[];

  /** Collection of operation request representations. */
  representations?: RepresentationContract[];
}

export interface ResponseContract {
  /** Operation response HTTP status code. */
  statusCode: number;

  /** Operation response description. */
  description?: string;

  /** Collection of operation response representations. */
  representations?: RepresentationContract[];

  /** Collection of operation response headers. */
  headers?: ParameterContract[];
}

export interface RepresentationContract {
  /** Specifies a registered or custom content type for this representation, e.g. application/xml. */
  contentType: string;

  /** Example of the representation. */
  sample?: string;

  /** Schema identifier. */
  schemaId?: string;

  /** Type name defined by the schema. */
  typeName?: string;

  /** Collection of form parameters. */
  formParameters?: ParameterContract[];
}

// ============================================
// Product Contracts
// ============================================

export interface ProductContract {
  /** Product identifier. */
  id: string;

  /** Product name. Must be 1 to 300 characters long. */
  name: string;

  /** Product description. May be 1 to 500 characters long. */
  description?: string;

  /** Specifies whether subscription approval is required. */
  approvalRequired?: boolean;

  /** Specifies whether a product subscription is required for accessing APIs. */
  subscriptionRequired?: boolean;

  /** Specifies the number of subscriptions a user can have to this product at the same time. */
  subscriptionsLimit?: number;

  /** Product terms and conditions. */
  terms?: string;

  /** Product state. */
  state?: "published" | "notPublished";
}

// ============================================
// Subscription Contracts
// ============================================

export interface SubscriptionContract {
  /** Subscription identifier. */
  id: string;

  /** Subscription name. */
  name: string;

  /** Subscription creation date. */
  createdDate?: string;

  /** Date when subscription was cancelled or expired. */
  endDate?: string;

  /** Subscription expiration date. */
  expirationDate?: string;

  /** Upcoming subscription expiration notification date. */
  notificationDate?: string;

  /** Subscription primary key. */
  primaryKey?: string;

  /** Scope like /products/{productId} or /apis or /apis/{apiId} */
  scope: string;

  /** Subscription secondary key. */
  secondaryKey?: string;

  /** Subscription activation date. */
  startDate?: string;

  /** Subscription state. */
  state: SubscriptionState;

  /** Subscription State Comment. */
  stateComment?: string;

  /** User identifier. */
  ownerId?: string;

  /** Display name of the user. */
  ownerDisplayName?: string;

  /** Allow tracing for requests made with this subscription. */
  allowTracing?: boolean;
}

export enum SubscriptionState {
  suspended = "suspended",
  active = "active",
  expired = "expired",
  submitted = "submitted",
  rejected = "rejected",
  cancelled = "cancelled",
}

export interface SubscriptionSecrets {
  /** Subscription primary key. */
  primaryKey?: string;

  /** Subscription secondary key. */
  secondaryKey?: string;
}

// ============================================
// Tag Contracts
// ============================================

export interface TagContract {
  /** Tag identifier. */
  id: string;

  /** Tag name. Must be 1 to 160 characters long. */
  name: string;

  /** Tag description. */
  description?: string;
}

export interface ApiTagResourceContract {
  /** API contract. */
  api?: ApiContract;

  /** Operation contract. */
  operation?: OperationContract;

  /** Tag contract. */
  tag?: TagContract;
}

// ============================================
// Schema Contracts
// ============================================

export interface SchemaContract {
  /** Schema identifier. */
  id?: string;

  /** Schema type (e.g., "openapi"). */
  contentType?: string;

  /** Schema document. */
  document?: SchemaDocumentContract;

  /** Schema definitions. */
  definitions?: Record<string, SchemaObjectContract>;

  /** Schema components (OpenAPI 3.0). */
  components?: {
    schemas?: Record<string, SchemaObjectContract>;
  };
}

export interface SchemaDocumentContract {
  /** Schema value. */
  value?: string;

  /** Schema definitions. */
  definitions?: Record<string, SchemaObjectContract>;

  /** Schema components (OpenAPI 3.0). */
  components?: {
    schemas?: Record<string, SchemaObjectContract>;
  };
}

export interface SchemaObjectContract {
  /** Reference to another schema. */
  $ref?: string;

  /** Schema type (e.g., "integer", "string", "object"). */
  type?: string;

  /** Format qualifier for the type (e.g., "int64", "date-time"). */
  format?: string;

  /** Schema description. */
  description?: string;

  /** Required properties. */
  required?: string[];

  /** Example value. */
  example?: unknown;

  /** Indicates if property is read-only. */
  readOnly?: boolean;

  /** Schema properties. */
  properties?: Record<string, SchemaObjectContract>;

  /** Items schema (for array types). */
  items?: SchemaObjectContract;

  /** AllOf schemas. */
  allOf?: SchemaObjectContract[];

  /** AnyOf schemas. */
  anyOf?: SchemaObjectContract[];

  /** OneOf schemas. */
  oneOf?: SchemaObjectContract[];

  /** Not schema. */
  not?: SchemaObjectContract;

  /** Minimum value. */
  minimum?: number;

  /** Maximum value. */
  maximum?: number;

  /** Enum values. */
  enum?: unknown[];

  /** Schema title. */
  title?: string;

  /** Multiple of value. */
  multipleOf?: number;

  /** Exclusive maximum. */
  exclusiveMaximum?: boolean | number;

  /** Exclusive minimum. */
  exclusiveMinimum?: boolean | number;

  /** Default value. */
  default?: unknown;
}

export type SchemaType = "openapi" | "swagger" | "graphql" | "wadl" | "wsdl";

// ============================================
// Version Set Contracts
// ============================================

export interface VersionSetContract {
  /** API Version Set identifier. */
  id?: string;

  /** API Version Set name. Must be 1 to 100 characters long. */
  name?: string;

  /** API Version Set description. */
  description?: string;

  /** Versioning scheme. */
  versioningScheme?: "Segment" | "Query" | "Header";

  /** Version query name. Must be 1 to 100 characters long. */
  versionQueryName?: string;

  /** Version header name. Must be 1 to 100 characters long. */
  versionHeaderName?: string;
}

// ============================================
// Changelog Contracts
// ============================================

export interface ChangeLogContract {
  /** The date when this API change log is created. */
  createdDateTime?: string;

  /** The date when this API change log is edited and updated. */
  updatedDateTime?: string;

  /** The notes of this API change. */
  notes?: string;
}

// ============================================
// User Contracts
// ============================================

export interface UserContract {
  /** User identifier. */
  id: string;

  /** First name. */
  firstName?: string;

  /** Last name. */
  lastName?: string;

  /** Email address. */
  email?: string;

  /** Account state. */
  state?: "active" | "blocked" | "pending" | "deleted";

  /** Date when user was registered. */
  registrationDate?: string;

  /** Collection of user identities. */
  identities?: IdentityContract[];

  /** Collection of groups user is part of. */
  groups?: string[];

  /** User note. */
  note?: string;
}

export interface IdentityContract {
  /** Identity provider name. */
  provider?: string;

  /** Identity ID. */
  id?: string;
}
