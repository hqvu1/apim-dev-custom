// ---------------------------------------------------------------------------
// PortalContracts — models for portal-specific endpoints (Support, Registration,
// Admin) that are NOT backed by APIM ARM/Data API but required by the SPA.
//
// These endpoints return mock data in all modes for the POC. In production they
// would integrate with ServiceNow (support), Logic Apps (registration), or a
// portal database.
//
// See docs/STORY_MAPPING_GAP_ANALYSIS.md §"Critical Misalignment"
// ---------------------------------------------------------------------------

using System.Text.Json.Serialization;

namespace BffApi.Models;

// ─── Support ─────────────────────────────────────────────────────────────────

public sealed class SupportTicket
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("subject")]
    public required string Subject { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; } = "Open";

    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Category { get; init; }

    [JsonPropertyName("api")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Api { get; init; }

    [JsonPropertyName("impact")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Impact { get; init; }

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("createdDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CreatedDate { get; init; }
}

public sealed class CreateTicketRequest
{
    [JsonPropertyName("category")]
    public string? Category { get; init; }

    [JsonPropertyName("api")]
    public string? Api { get; init; }

    [JsonPropertyName("impact")]
    public string? Impact { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }
}

// ─── Registration ────────────────────────────────────────────────────────────

public sealed class RegistrationConfig
{
    [JsonPropertyName("fields")]
    public required string[] Fields { get; init; }
}

public sealed class RegistrationRequest
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("company")]
    public required string Company { get; init; }

    [JsonPropertyName("region")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Region { get; init; }

    [JsonPropertyName("contact")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Contact { get; init; }

    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Role { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; } = "Submitted";

    [JsonPropertyName("createdDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CreatedDate { get; init; }
}

public sealed class RegistrationStatus
{
    [JsonPropertyName("status")]
    public required string Status { get; init; }
}

public sealed class CreateRegistrationRequest
{
    [JsonPropertyName("company")]
    public string? Company { get; init; }

    [JsonPropertyName("contact")]
    public string? Contact { get; init; }

    [JsonPropertyName("role")]
    public string? Role { get; init; }

    [JsonPropertyName("intendedApis")]
    public string? IntendedApis { get; init; }

    [JsonPropertyName("dataUsageDetails")]
    public string? DataUsageDetails { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

public sealed class AdminMetric
{
    [JsonPropertyName("label")]
    public required string Label { get; init; }

    [JsonPropertyName("value")]
    public required string Value { get; init; }
}

// ─── Try-It Config ───────────────────────────────────────────────────────────

public sealed class TryItConfig
{
    [JsonPropertyName("operations")]
    public required string[] Operations { get; init; }
}
