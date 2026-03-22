// ---------------------------------------------------------------------------
// LegacyModels — Models for legacy API integration.
//
// Defines contracts for legacy API catalog, credentials, and operations.
// These models bridge the gap between legacy systems (SOAP, binary, etc.)
// and the modern unified API catalog.
// ---------------------------------------------------------------------------

using System.Text.Json.Serialization;

namespace Komatsu.ApimMarketplace.Bff.Models;

/// <summary>
/// Represents an API from either cloud (APIM) or legacy system.
/// Used for the unified catalog that shows both API types.
/// </summary>
public class ApiDetail
{
    /// <summary>
    /// Unique identifier for the API.
    /// Convention: "legacy-soap-{id}" for legacy SOAP, "api-{id}" for cloud.
    /// </summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>
    /// Human-readable API name.
    /// </summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>
    /// API description.
    /// </summary>
    [JsonPropertyName("description")]
    public required string Description { get; init; }

    /// <summary>
    /// Source type: "cloud" (APIM) or "legacy" (SOAP/binary/custom).
    /// </summary>
    [JsonPropertyName("source")]
    public required string Source { get; init; }

    /// <summary>
    /// Protocol: REST, SOAP, CUSTOM, etc.
    /// </summary>
    [JsonPropertyName("protocol")]
    public required string Protocol { get; init; }

    /// <summary>
    /// Authentication method: OAuth2, NTLM, CustomToken, SoapSessionToken, etc.
    /// </summary>
    [JsonPropertyName("authentication")]
    public required string Authentication { get; init; }

    /// <summary>
    /// OpenAPI spec URL (cloud) or WSDL URL (legacy SOAP).
    /// </summary>
    [JsonPropertyName("specUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SpecUrl { get; init; }

    /// <summary>
    /// Available operations/methods in this API.
    /// </summary>
    [JsonPropertyName("operations")]
    public List<OperationDetail> Operations { get; init; } = [];

    /// <summary>
    /// Deprecation metadata. Present only if API is being sunset.
    /// </summary>
    [JsonPropertyName("deprecation")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DeprecationInfo? Deprecation { get; init; }
}

/// <summary>
/// Represents a single operation/method in an API.
/// </summary>
public class OperationDetail
{
    /// <summary>
    /// Operation ID (method name for SOAP, operation ID for REST).
    /// </summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>
    /// Human-readable operation name.
    /// </summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>
    /// HTTP method (GET, POST, etc.) or SOAP action name.
    /// </summary>
    [JsonPropertyName("method")]
    public required string Method { get; init; }

    /// <summary>
    /// API path or endpoint name.
    /// </summary>
    [JsonPropertyName("path")]
    public required string Path { get; init; }

    /// <summary>
    /// Operation description.
    /// </summary>
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    /// <summary>
    /// Input parameters for this operation.
    /// </summary>
    [JsonPropertyName("parameters")]
    public List<ParameterDetail> Parameters { get; init; } = [];
}

/// <summary>
/// Describes a single input parameter for an operation.
/// </summary>
public class ParameterDetail
{
    /// <summary>
    /// Parameter name.
    /// </summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>
    /// Parameter type (string, int, bool, etc.).
    /// </summary>
    [JsonPropertyName("type")]
    public required string Type { get; init; }

    /// <summary>
    /// Whether this parameter is required.
    /// </summary>
    [JsonPropertyName("required")]
    public bool Required { get; init; }

    /// <summary>
    /// Parameter description.
    /// </summary>
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }
}

/// <summary>
/// Request payload for executing an API operation.
/// </summary>
public class ExecuteApiRequest
{
    /// <summary>
    /// Request body (JSON object for REST, SOAP struct for SOAP, etc.).
    /// </summary>
    [JsonPropertyName("payload")]
    public required object Payload { get; init; }

    /// <summary>
    /// Optional custom headers (usually not needed; auth is handled separately).
    /// </summary>
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, string>? Headers { get; init; }
}

/// <summary>
/// Response from executing an API operation.
/// </summary>
public class ApiResponse
{
    /// <summary>
    /// HTTP status code (or equivalent for legacy protocols).
    /// </summary>
    [JsonPropertyName("statusCode")]
    public required int StatusCode { get; init; }

    /// <summary>
    /// Response body (deserialized to JSON object/array).
    /// </summary>
    [JsonPropertyName("body")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Body { get; init; }

    /// <summary>
    /// Response headers.
    /// </summary>
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, string>? Headers { get; init; }
}

/// <summary>
/// Authentication token in legacy system format.
/// Produced by LegacyAuthenticationBridge from Entra ID JWT.
/// </summary>
public class LegacyAuthToken
{
    /// <summary>
    /// Token type: SoapSessionToken, ApiKey, KerberosTicket, CustomToken, etc.
    /// </summary>
    [JsonPropertyName("type")]
    public required string Type { get; init; }

    /// <summary>
    /// Token value (raw session ID, API key, Kerberos ticket, etc.).
    /// </summary>
    [JsonPropertyName("value")]
    public required string Value { get; init; }

    /// <summary>
    /// When this token expires (UTC).
    /// </summary>
    [JsonPropertyName("expiresAt")]
    public DateTime ExpiresAt { get; init; }
}

/// <summary>
/// Subscription record for a legacy API.
/// </summary>
public class LegacySubscription
{
    /// <summary>
    /// Unique subscription ID.
    /// </summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>
    /// API ID being subscribed to.
    /// </summary>
    [JsonPropertyName("apiId")]
    public required string ApiId { get; init; }

    /// <summary>
    /// User ID (Entra ID OID or email).
    /// </summary>
    [JsonPropertyName("userId")]
    public required string UserId { get; init; }

    /// <summary>
    /// Subscription plan/tier.
    /// </summary>
    [JsonPropertyName("plan")]
    public required string Plan { get; init; }

    /// <summary>
    /// When the subscription was created.
    /// </summary>
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; init; }

    /// <summary>
    /// Credentials in legacy format (not standard APIM key format).
    /// </summary>
    [JsonPropertyName("credentials")]
    public required LegacyCredentials Credentials { get; init; }
}

/// <summary>
/// Credentials for accessing a legacy API.
/// Format depends on legacy system (API key, session token, certificate, etc.).
/// </summary>
public class LegacyCredentials
{
    /// <summary>
    /// API key (if legacy system uses API keys).
    /// </summary>
    [JsonPropertyName("apiKey")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ApiKey { get; set; }

    /// <summary>
    /// Session token (if legacy system uses sessions, e.g., SOAP).
    /// </summary>
    [JsonPropertyName("sessionToken")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SessionToken { get; set; }

    /// <summary>
    /// Certificate (if legacy system uses mTLS).
    /// </summary>
    [JsonPropertyName("certificate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Certificate { get; set; }

    /// <summary>
    /// Custom token for proprietary auth schemes.
    /// </summary>
    [JsonPropertyName("customToken")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CustomToken { get; set; }

    /// <summary>
    /// When these credentials expire.
    /// </summary>
    [JsonPropertyName("expiryDate")]
    public DateTime ExpiryDate { get; set; }
}

/// <summary>
/// Metadata about API deprecation and retirement.
/// </summary>
public class DeprecationInfo
{
    /// <summary>
    /// Status: "active", "deprecated", or "legacy".
    /// </summary>
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    /// <summary>
    /// Planned retirement date (if applicable).
    /// </summary>
    [JsonPropertyName("plannedRetirement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? PlannedRetirement { get; init; }

    /// <summary>
    /// ID of the modern API that replaces this one.
    /// </summary>
    [JsonPropertyName("modernAlternativeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ModernAlternativeId { get; init; }

    /// <summary>
    /// URL or reference to migration guide.
    /// </summary>
    [JsonPropertyName("migrationGuide")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? MigrationGuide { get; init; }
}
