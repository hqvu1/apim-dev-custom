// ---------------------------------------------------------------------------
// Komatsu.ApimMarketplace.Bff.Models — APIM data-plane contract shapes
//
// These mirror the TypeScript types in src/api/types.ts so the SPA's
// useApimCatalog mappers (mapApimApiToSummary, etc.) work unchanged.
// The BFF transforms ARM Management API responses into these shapes.
//
// See docs/ARCHITECTURE_DESIGN.md §4, docs/BFF_MIGRATION_DECISION.md §3
// ---------------------------------------------------------------------------

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Komatsu.ApimMarketplace.Bff.Models;

// ─── Paged wrapper (APIM convention) ─────────────────────────────────────────

/// <summary>
/// Generic paged response envelope — matches <c>ApimPageContract&lt;T&gt;</c> in the SPA.
/// Supports <c>$top/$skip</c> pagination and <c>nextLink</c> continuation.
/// </summary>
public sealed class PagedResult<T>
{
    [JsonPropertyName("value")]
    public required IReadOnlyList<T> Value { get; init; }

    [JsonPropertyName("nextLink")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? NextLink { get; init; }

    [JsonPropertyName("count")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Count { get; init; }
}

// ─── API contract ────────────────────────────────────────────────────────────

/// <summary>
/// Matches the SPA's <c>ApimApiContract</c> type.
/// Returned by <c>GET /apis</c> (inside PagedResult) and <c>GET /apis/{id}</c>.
/// </summary>
public sealed class ApiContract
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("path")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Path { get; init; }

    [JsonPropertyName("protocols")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string[]? Protocols { get; init; }

    [JsonPropertyName("apiVersion")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ApiVersion { get; init; }

    [JsonPropertyName("apiRevision")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ApiRevision { get; init; }

    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Type { get; init; }

    [JsonPropertyName("isCurrent")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? IsCurrent { get; init; }

    [JsonPropertyName("apiVersionSetId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ApiVersionSetId { get; init; }

    [JsonPropertyName("apiVersionSet")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public VersionSetContract? ApiVersionSet { get; init; }

    [JsonPropertyName("apiRevisionDescription")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ApiRevisionDescription { get; init; }

    [JsonPropertyName("authenticationSettings")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public AuthenticationSettingsContract? AuthenticationSettings { get; init; }

    [JsonPropertyName("subscriptionKeyParameterNames")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public SubscriptionKeyParameterName? SubscriptionKeyParameterNames { get; init; }

    [JsonPropertyName("subscriptionRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? SubscriptionRequired { get; init; }

    [JsonPropertyName("contact")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ContactInfo? Contact { get; init; }

    [JsonPropertyName("license")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public LicenseInfo? License { get; init; }

    [JsonPropertyName("termsOfServiceUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TermsOfServiceUrl { get; init; }

    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string[]? Tags { get; init; }
}

public sealed class ContactInfo
{
    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; init; }

    [JsonPropertyName("url")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Url { get; init; }

    [JsonPropertyName("email")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Email { get; init; }
}

public sealed class LicenseInfo
{
    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; init; }

    [JsonPropertyName("url")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Url { get; init; }
}

// ─── Authentication settings ─────────────────────────────────────────────────

public sealed class AuthenticationSettingsContract
{
    [JsonPropertyName("oAuth2")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public OAuth2SettingsContract? OAuth2 { get; init; }

    [JsonPropertyName("openid")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public OpenIdSettingsContract? OpenId { get; init; }
}

public sealed class OAuth2SettingsContract
{
    [JsonPropertyName("authorizationServerId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AuthorizationServerId { get; init; }

    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Scope { get; init; }
}

public sealed class OpenIdSettingsContract
{
    [JsonPropertyName("openidProviderId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? OpenIdProviderId { get; init; }
}

// ─── Subscription key parameter names ────────────────────────────────────────

public sealed class SubscriptionKeyParameterName
{
    [JsonPropertyName("header")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Header { get; init; }

    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Query { get; init; }
}

// ─── Operation contract ──────────────────────────────────────────────────────

/// <summary>
/// Matches the SPA's <c>ApimOperationContract</c>.
/// </summary>
public sealed class OperationContract
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("method")]
    public required string Method { get; init; }

    [JsonPropertyName("urlTemplate")]
    public required string UrlTemplate { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("displayName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DisplayName { get; init; }

    [JsonPropertyName("version")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Version { get; init; }

    [JsonPropertyName("templateParameters")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ParameterContract[]? TemplateParameters { get; init; }

    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RequestContract? Request { get; init; }

    [JsonPropertyName("responses")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ResponseContract[]? Responses { get; init; }
}

// ─── Product contract ────────────────────────────────────────────────────────

/// <summary>
/// Matches the SPA's <c>ApimProductContract</c>.
/// </summary>
public sealed class ProductContract
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("displayName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DisplayName { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("state")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? State { get; init; }

    [JsonPropertyName("subscriptionRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? SubscriptionRequired { get; init; }

    [JsonPropertyName("approvalRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ApprovalRequired { get; init; }

    [JsonPropertyName("subscriptionsLimit")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? SubscriptionsLimit { get; init; }

    [JsonPropertyName("terms")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Terms { get; init; }
}

// ─── Subscription contract ───────────────────────────────────────────────────

/// <summary>
/// Matches the SPA's <c>ApimSubscriptionContract</c>.
/// </summary>
public sealed class SubscriptionContract
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("displayName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DisplayName { get; init; }

    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Scope { get; init; }

    [JsonPropertyName("state")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? State { get; init; }

    [JsonPropertyName("primaryKey")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PrimaryKey { get; init; }

    [JsonPropertyName("secondaryKey")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SecondaryKey { get; init; }

    [JsonPropertyName("createdDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CreatedDate { get; init; }

    [JsonPropertyName("endDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? EndDate { get; init; }

    [JsonPropertyName("expirationDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ExpirationDate { get; init; }

    [JsonPropertyName("notificationDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? NotificationDate { get; init; }

    [JsonPropertyName("startDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? StartDate { get; init; }

    [JsonPropertyName("stateComment")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? StateComment { get; init; }

    [JsonPropertyName("ownerId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? OwnerId { get; init; }

    [JsonPropertyName("productName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ProductName { get; init; }
}

// ─── Subscription state enum ─────────────────────────────────────────────────

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SubscriptionState
{
    Suspended,
    Active,
    Expired,
    Submitted,
    Rejected,
    Cancelled
}

// ─── Subscription secrets ────────────────────────────────────────────────────

public sealed class SubscriptionSecrets
{
    [JsonPropertyName("primaryKey")]
    public required string PrimaryKey { get; init; }

    [JsonPropertyName("secondaryKey")]
    public required string SecondaryKey { get; init; }
}

// ─── Subscription create request

public sealed class CreateSubscriptionRequest
{
    [JsonPropertyName("scope")]
    public required string Scope { get; init; }

    [JsonPropertyName("displayName")]
    public required string DisplayName { get; init; }

    [JsonPropertyName("state")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? State { get; init; }
}

// ─── Tag contract ────────────────────────────────────────────────────────────

/// <summary>
/// APIM tag — used for filter dropdowns in the API catalog.
/// See docs/APIM_DATA_API_COMPARISON.md §4.3 — Tags Endpoint (P0).
/// </summary>
public sealed class TagContract
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("displayName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DisplayName { get; init; }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

public sealed class PlatformStats
{
    [JsonPropertyName("availableApis")]
    public int AvailableApis { get; init; }

    [JsonPropertyName("products")]
    public int Products { get; init; }

    [JsonPropertyName("subscriptions")]
    public int Subscriptions { get; init; }

    [JsonPropertyName("users")]
    public int Users { get; init; }

    [JsonPropertyName("uptime")]
    public string Uptime { get; init; } = "99.9%";
}

// ─── News ────────────────────────────────────────────────────────────────────

public sealed class NewsItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("title")]
    public required string Title { get; init; }

    [JsonPropertyName("excerpt")]
    public required string Excerpt { get; init; }

    [JsonPropertyName("date")]
    public required string Date { get; init; }

    [JsonPropertyName("content")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Content { get; init; }

    [JsonPropertyName("author")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Author { get; init; }

    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Category { get; init; }
}

// ─── User profile (from MSAL token claims) ───────────────────────────────────

/// <summary>
/// User identity derived from the validated MSAL JWT token.
/// Not from APIM's user store — Global Admin (Entra ID) is the single identity source.
/// See docs/APIM_DATA_API_COMPARISON.md §4.6
/// </summary>
public sealed class UserProfile
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("displayName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DisplayName { get; init; }

    [JsonPropertyName("email")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Email { get; init; }

    [JsonPropertyName("roles")]
    public required string[] Roles { get; init; }
}

// ─── API Registry (configuration-driven backend routing) ─────────────────────

/// <summary>
/// API registry configuration — maps API IDs to their source (APIM or external).
/// See docs/BFF_EVOLUTION_ANALYSIS.md §2 — Backend Router Pattern
/// </summary>
public sealed class ApiRegistryConfig
{
    public Dictionary<string, ApiRegistryEntry> Apis { get; set; } = [];
}

public sealed class ApiRegistryEntry
{
    public string Source { get; set; } = "apim";
    public string? ApimApiId { get; set; }
    public string? BaseUrl { get; set; }
    public ApiRegistryAuth? Auth { get; set; }
    public ApiRegistryMetadata? Metadata { get; set; }
}

public sealed class ApiRegistryAuth
{
    public string Type { get; set; } = "";
    public string? TokenUrl { get; set; }
    public string? ClientIdEnv { get; set; }
    public string? ClientSecretEnv { get; set; }
    public string? Scope { get; set; }
}

public sealed class ApiRegistryMetadata
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? Owner { get; set; }
    public string? DocumentationUrl { get; set; }
    public string[]? Tags { get; set; }
}

// ─── ARM response shapes (internal, not exposed to SPA) ─────────────────────

// ─── Parameter contract ──────────────────────────────────────────────────────

public sealed class ParameterContract
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Type { get; init; }

    [JsonPropertyName("required")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? Required { get; init; }

    [JsonPropertyName("defaultValue")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DefaultValue { get; init; }

    [JsonPropertyName("values")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string[]? Values { get; init; }
}

// ─── Request / Response contracts ────────────────────────────────────────────

public sealed class RequestContract
{
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("queryParameters")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ParameterContract[]? QueryParameters { get; init; }

    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ParameterContract[]? Headers { get; init; }

    [JsonPropertyName("representations")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RepresentationContract[]? Representations { get; init; }
}

public sealed class ResponseContract
{
    [JsonPropertyName("statusCode")]
    public int StatusCode { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ParameterContract[]? Headers { get; init; }

    [JsonPropertyName("representations")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RepresentationContract[]? Representations { get; init; }
}

public sealed class RepresentationContract
{
    [JsonPropertyName("contentType")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ContentType { get; init; }

    [JsonPropertyName("schemaId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SchemaId { get; init; }

    [JsonPropertyName("typeName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TypeName { get; init; }
}

// ─── Version set contract ────────────────────────────────────────────────────

public sealed class VersionSetContract
{
    [JsonPropertyName("id")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Id { get; init; }

    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("versioningScheme")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? VersioningScheme { get; init; }

    [JsonPropertyName("versionQueryName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? VersionQueryName { get; init; }

    [JsonPropertyName("versionHeaderName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? VersionHeaderName { get; init; }
}

// ─── Schema contract ─────────────────────────────────────────────────────────

public sealed class SchemaContract
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("contentType")]
    public required string ContentType { get; init; }

    [JsonPropertyName("document")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public JsonElement? Document { get; init; }
}

public static class SchemaType
{
    public const string Swagger = "application/vnd.ms-azure-apim.swagger.definitions+json";
    public const string OpenApi = "application/vnd.oai.openapi.components+json";
    public const string Xsd = "application/vnd.ms-azure-apim.xsd+xml";
    public const string GraphQL = "application/vnd.ms-azure-apim.graphql.schema";
}

// ─── Change log contract ─────────────────────────────────────────────────────

public sealed class ChangeLogContract
{
    [JsonPropertyName("createdDateTime")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CreatedDateTime { get; init; }

    [JsonPropertyName("updatedDateTime")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? UpdatedDateTime { get; init; }

    [JsonPropertyName("notes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Notes { get; init; }
}

// ─── Tag resource contract (for apisByTags / operationsByTags) ───────────────

public sealed class ApiTagResourceContract
{
    [JsonPropertyName("api")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ApiContract? Api { get; init; }

    [JsonPropertyName("operation")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public OperationContract? Operation { get; init; }

    [JsonPropertyName("tag")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public TagContract? Tag { get; init; }
}

// ─── Tag group (grouped results by tag) ──────────────────────────────────────

public sealed class TagGroup<T>
{
    [JsonPropertyName("tag")]
    public required string Tag { get; init; }

    [JsonPropertyName("items")]
    public required IReadOnlyList<T> Items { get; init; }
}

// ─── Search query ────────────────────────────────────────────────────────────

/// <summary>
/// Rich search query matching the SPA's <c>SearchQuery</c> contract.
/// Supports pattern search, tag filtering, pagination, and grouping.
/// </summary>
public sealed class SearchQuery
{
    [JsonPropertyName("propertyName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PropertyName { get; init; }

    [JsonPropertyName("pattern")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Pattern { get; init; }

    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string[]? Tags { get; init; }

    [JsonPropertyName("skip")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Skip { get; init; }

    [JsonPropertyName("take")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Take { get; init; }

    [JsonPropertyName("grouping")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Grouping { get; init; }
}

// ─── API hostname contract ───────────────────────────────────────────────────

public sealed class ApiHostnameContract
{
    [JsonPropertyName("value")]
    public required string Value { get; init; }
}

// ─── ARM response shapes (internal, not exposed to SPA) ─────────────────────

/// <summary>
/// Represents a raw ARM Management API list response: <c>{ value: [...] }</c>.
/// </summary>
public sealed class ArmListResponse
{
    [JsonPropertyName("value")]
    public JsonElement[]? Value { get; init; }

    [JsonPropertyName("nextLink")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? NextLink { get; init; }
}

/// <summary>
/// Represents a single ARM resource with the common id/name/properties envelope.
/// </summary>
public sealed class ArmResource
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("properties")]
    public JsonElement Properties { get; init; }
}
