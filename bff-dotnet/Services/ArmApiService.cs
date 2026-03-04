// ---------------------------------------------------------------------------
// ArmApiService — proxies requests to Azure ARM Management API for APIM.
//
// Auth chain:  DefaultAzureCredential  →  ARM bearer token  →  ARM REST API
//
// The SPA expects APIM Data API-shaped responses (ApimApiContract, etc.).
// This service fetches from ARM and transforms the ARM envelope
// (id, name, properties.{...}) into the flat contract shapes.
//
// Enhanced for POC:
//   ✅ $top/$skip pagination passthrough (P0)
//   ✅ Tags endpoint (P0)
//   ✅ Subscription detail + secrets (P0)
//   ✅ Response caching via IMemoryCache (P1)
//   ✅ x-ms-apim-client portal header (via PortalTelemetryHandler)
// ---------------------------------------------------------------------------

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;
using BffApi.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace BffApi.Services;

// ─── Configuration ───────────────────────────────────────────────────────────

public sealed class ApimSettings
{
    public const string SectionName = "Apim";

    public string SubscriptionId { get; set; } = "";
    public string ResourceGroup { get; set; } = "";
    public string ServiceName { get; set; } = "";
    public string ApiVersion { get; set; } = "2022-08-01";
    public string? ManagedIdentityClientId { get; set; }
}

// ─── Interface ───────────────────────────────────────────────────────────────

public interface IArmApiService
{
    // APIs
    Task<PagedResult<ApiContract>> ListApisAsync(int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default);
    Task<ApiContract?> GetApiAsync(string apiId, CancellationToken ct = default);
    Task<PagedResult<OperationContract>> ListOperationsAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default);
    Task<PagedResult<ProductContract>> ListProductsForApiAsync(string apiId, CancellationToken ct = default);
    Task<JsonElement?> ExportOpenApiSpecAsync(string apiId, string format = "swagger-link", CancellationToken ct = default);

    // Tags
    Task<PagedResult<TagContract>> ListTagsAsync(string? scope = null, string? filter = null, CancellationToken ct = default);

    // Products
    Task<PagedResult<ProductContract>> ListProductsAsync(int? top = null, int? skip = null, CancellationToken ct = default);

    // Subscriptions
    Task<PagedResult<SubscriptionContract>> ListSubscriptionsAsync(int? top = null, int? skip = null, CancellationToken ct = default);
    Task<SubscriptionContract?> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default);
    Task<SubscriptionContract?> CreateSubscriptionAsync(CreateSubscriptionRequest request, CancellationToken ct = default);
    Task<SubscriptionContract?> UpdateSubscriptionAsync(string subscriptionId, object patchBody, CancellationToken ct = default);
    Task<bool> DeleteSubscriptionAsync(string subscriptionId, CancellationToken ct = default);
    Task<SubscriptionContract?> ListSubscriptionSecretsAsync(string subscriptionId, CancellationToken ct = default);

    // Stats
    Task<PlatformStats> GetStatsAsync(CancellationToken ct = default);
}

// ─── Implementation ──────────────────────────────────────────────────────────

public sealed class ArmApiService : IArmApiService
{
    private readonly HttpClient _http;
    private readonly ApimSettings _settings;
    private readonly ILogger<ArmApiService> _logger;
    private readonly IMemoryCache _cache;
    private readonly TokenCredential _credential;

    // Token cache
    private AccessToken? _cachedToken;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    public ArmApiService(
        IHttpClientFactory httpFactory,
        IOptions<ApimSettings> settings,
        ILogger<ArmApiService> logger,
        IMemoryCache cache)
    {
        _http = httpFactory.CreateClient("ArmApi");
        _settings = settings.Value;
        _logger = logger;
        _cache = cache;

        // Build credential — prefer user-assigned Managed Identity if configured
        _credential = string.IsNullOrWhiteSpace(_settings.ManagedIdentityClientId)
            ? new DefaultAzureCredential()
            : new DefaultAzureCredential(new DefaultAzureCredentialOptions
            {
                ManagedIdentityClientId = _settings.ManagedIdentityClientId
            });
    }

    // ── ARM base URL ──────────────────────────────────────────────────────────

    private string ArmBase =>
        $"https://management.azure.com/subscriptions/{_settings.SubscriptionId}" +
        $"/resourceGroups/{_settings.ResourceGroup}" +
        $"/providers/Microsoft.ApiManagement/service/{_settings.ServiceName}";

    // ── Token management ──────────────────────────────────────────────────────

    private async Task<string> GetTokenAsync(CancellationToken ct)
    {
        // Return cached token if valid (5 min buffer)
        if (_cachedToken is { } t && t.ExpiresOn > DateTimeOffset.UtcNow.AddMinutes(5))
            return t.Token;

        var token = await _credential.GetTokenAsync(
            new TokenRequestContext(["https://management.azure.com/.default"]), ct);

        _cachedToken = token;
        _logger.LogInformation("ARM access token acquired, expires {Expiry}", token.ExpiresOn);
        return token.Token;
    }

    // ── Generic ARM fetch ─────────────────────────────────────────────────────

    private async Task<JsonElement> FetchArmAsync(string path, CancellationToken ct,
        HttpMethod? method = null, string? body = null)
    {
        var uri = BuildUri(path);
        _logger.LogDebug("ARM {Method} {Uri}", method?.Method ?? "GET", uri);

        using var req = new HttpRequestMessage(method ?? HttpMethod.Get, uri);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await GetTokenAsync(ct));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (body is not null)
        {
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        using var res = await _http.SendAsync(req, ct);

        if (!res.IsSuccessStatusCode)
        {
            var errBody = await res.Content.ReadAsStringAsync(ct);
            _logger.LogError("ARM API error {Status}: {Body}", (int)res.StatusCode, errBody);
            throw new HttpRequestException($"ARM API returned {(int)res.StatusCode}", null, res.StatusCode);
        }

        var json = await res.Content.ReadAsStringAsync(ct);
        return JsonDocument.Parse(json).RootElement.Clone();
    }

    /// <summary>
    /// Cached ARM fetch for GET requests — deduplicates identical requests within 1 minute.
    /// </summary>
    private async Task<JsonElement> FetchArmCachedAsync(string path, CancellationToken ct)
    {
        var cacheKey = $"arm:{path}";
        if (_cache.TryGetValue(cacheKey, out JsonElement cached))
        {
            _logger.LogDebug("Cache hit: {Path}", path);
            return cached;
        }

        var result = await FetchArmAsync(path, ct);
        _cache.Set(cacheKey, result, CacheDuration);
        return result;
    }

    private string BuildUri(string path)
    {
        var separator = path.Contains('?') ? '&' : '?';
        return $"{ArmBase}/{path}{separator}api-version={_settings.ApiVersion}";
    }

    private static string BuildPaginationQuery(string basePath, int? top, int? skip, string? filter = null)
    {
        var parts = new List<string>();
        if (top.HasValue) parts.Add($"$top={top.Value}");
        if (skip.HasValue) parts.Add($"$skip={skip.Value}");
        if (!string.IsNullOrWhiteSpace(filter)) parts.Add($"$filter={filter}");

        return parts.Count > 0 ? $"{basePath}?{string.Join('&', parts)}" : basePath;
    }

    // ─── List APIs ────────────────────────────────────────────────────────────

    public async Task<PagedResult<ApiContract>> ListApisAsync(int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery("apis", top, skip, filter);
        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformApiContract);
        _logger.LogInformation("Transformed {Count} APIs from ARM", items.Count);
        return new PagedResult<ApiContract> { Value = items, Count = items.Count };
    }

    // ─── Get single API ──────────────────────────────────────────────────────

    public async Task<ApiContract?> GetApiAsync(string apiId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmCachedAsync($"apis/{apiId}", ct);
            return TransformApiContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    // ─── Operations ──────────────────────────────────────────────────────────

    public async Task<PagedResult<OperationContract>> ListOperationsAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery($"apis/{apiId}/operations", top, skip);
        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformOperationContract);
        return new PagedResult<OperationContract> { Value = items, Count = items.Count };
    }

    // ─── Products for API ────────────────────────────────────────────────────

    public async Task<PagedResult<ProductContract>> ListProductsForApiAsync(string apiId, CancellationToken ct = default)
    {
        var root = await FetchArmCachedAsync($"apis/{apiId}/products", ct);
        var items = ParseArmList(root, TransformProductContract);
        return new PagedResult<ProductContract> { Value = items };
    }

    // ─── Tags (P0 — enables category filter in API catalog) ──────────────────

    public async Task<PagedResult<TagContract>> ListTagsAsync(string? scope = null, string? filter = null, CancellationToken ct = default)
    {
        var path = "tags";
        var queryParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(scope)) queryParts.Add($"scope={scope}");
        if (!string.IsNullOrWhiteSpace(filter)) queryParts.Add($"$filter={filter}");
        if (queryParts.Count > 0) path += $"?{string.Join('&', queryParts)}";

        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformTagContract);
        return new PagedResult<TagContract> { Value = items, Count = items.Count };
    }

    // ─── All products ────────────────────────────────────────────────────────

    public async Task<PagedResult<ProductContract>> ListProductsAsync(int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery("products", top, skip);
        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformProductContract);
        return new PagedResult<ProductContract> { Value = items, Count = items.Count };
    }

    // ─── Subscriptions ───────────────────────────────────────────────────────

    public async Task<PagedResult<SubscriptionContract>> ListSubscriptionsAsync(int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery("subscriptions", top, skip);
        var root = await FetchArmAsync(path, ct);
        var items = ParseArmList(root, TransformSubscriptionContract);
        return new PagedResult<SubscriptionContract> { Value = items, Count = items.Count };
    }

    public async Task<SubscriptionContract?> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmAsync($"subscriptions/{subscriptionId}", ct);
            return TransformSubscriptionContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<SubscriptionContract?> CreateSubscriptionAsync(CreateSubscriptionRequest request, CancellationToken ct = default)
    {
        // ARM PUT: subscriptions/{sid}?api-version=...
        var sid = $"sub-{Guid.NewGuid():N}"[..24];
        var body = JsonSerializer.Serialize(new
        {
            properties = new
            {
                scope = $"{ArmBase}/{request.Scope.TrimStart('/')}",
                displayName = request.DisplayName,
                state = request.State ?? "submitted"
            }
        });

        var root = await FetchArmAsync($"subscriptions/{sid}", ct, HttpMethod.Put, body);
        return TransformSubscriptionContract(root);
    }

    public async Task<SubscriptionContract?> UpdateSubscriptionAsync(string subscriptionId, object patchBody, CancellationToken ct = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { properties = patchBody });
            var root = await FetchArmAsync($"subscriptions/{subscriptionId}", ct, HttpMethod.Patch, body);
            return TransformSubscriptionContract(root);
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    public async Task<bool> DeleteSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            await FetchArmAsync($"subscriptions/{subscriptionId}", ct, HttpMethod.Delete);
            return true;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }

    public async Task<SubscriptionContract?> ListSubscriptionSecretsAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmAsync($"subscriptions/{subscriptionId}/listSecrets", ct, HttpMethod.Post);
            // ARM returns { primaryKey, secondaryKey } directly
            return new SubscriptionContract
            {
                Id = subscriptionId,
                Name = subscriptionId,
                PrimaryKey = root.Str("primaryKey"),
                SecondaryKey = root.Str("secondaryKey"),
            };
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    // ─── Stats ───────────────────────────────────────────────────────────────

    public async Task<PlatformStats> GetStatsAsync(CancellationToken ct = default)
    {
        var tasks = await Task.WhenAll(
            SafeCountAsync("apis", ct),
            SafeCountAsync("products", ct),
            SafeCountAsync("subscriptions", ct),
            SafeCountAsync("users", ct));

        return new PlatformStats
        {
            AvailableApis = tasks[0],
            Products = tasks[1],
            Subscriptions = tasks[2],
            Users = tasks[3],
        };
    }

    private async Task<int> SafeCountAsync(string resource, CancellationToken ct)
    {
        try
        {
            var root = await FetchArmCachedAsync(resource, ct);
            return root.TryGetProperty("value", out var arr) ? arr.GetArrayLength() : 0;
        }
        catch
        {
            return 0;
        }
    }

    // ─── OpenAPI export ──────────────────────────────────────────────────────

    public async Task<JsonElement?> ExportOpenApiSpecAsync(string apiId, string format = "swagger-link", CancellationToken ct = default)
    {
        try
        {
            var uri = $"{ArmBase}/apis/{apiId}?format={format}&export=true&api-version={_settings.ApiVersion}";
            _logger.LogDebug("OpenAPI export: GET {Uri}", uri);

            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await GetTokenAsync(ct));
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;

            var json = await res.Content.ReadAsStringAsync(ct);
            return JsonDocument.Parse(json).RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    // ─── ARM → contract transformers ─────────────────────────────────────────

    private static IReadOnlyList<T> ParseArmList<T>(JsonElement root, Func<JsonElement, T> transform)
    {
        if (!root.TryGetProperty("value", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];

        return arr.EnumerateArray().Select(transform).ToList();
    }

    /// <summary>
    /// ARM API item → <see cref="ApiContract"/> matching the SPA's ApimApiContract.
    /// </summary>
    private static ApiContract TransformApiContract(JsonElement el)
    {
        var name = el.Str("name") ?? el.Str("id")?.Split('/').LastOrDefault() ?? "unknown";
        var props = el.Prop("properties");

        return new ApiContract
        {
            Id = name,
            Name = props.Str("displayName") ?? name,
            Description = props.Str("description"),
            Path = props.Str("path"),
            Protocols = props.StrArray("protocols"),
            ApiVersion = props.Str("apiVersion"),
            ApiRevision = props.Str("apiRevision"),
            Type = props.Str("type") ?? "http",
            SubscriptionRequired = props.Bool("subscriptionRequired"),
            Contact = TransformContact(props),
            License = TransformLicense(props),
            TermsOfServiceUrl = props.Str("termsOfServiceUrl"),
            Tags = [],  // ARM doesn't return inline tags; fetched separately via /tags
        };
    }

    private static OperationContract TransformOperationContract(JsonElement el)
    {
        var name = el.Str("name") ?? "unknown";
        var props = el.Prop("properties");

        return new OperationContract
        {
            Id = name,
            Name = name,
            Method = props.Str("method") ?? "GET",
            UrlTemplate = props.Str("urlTemplate") ?? "",
            Description = props.Str("description"),
            DisplayName = props.Str("displayName") ?? name,
        };
    }

    private static ProductContract TransformProductContract(JsonElement el)
    {
        var name = el.Str("name") ?? "unknown";
        var props = el.Prop("properties");

        return new ProductContract
        {
            Id = name,
            Name = name,
            DisplayName = props.Str("displayName"),
            Description = props.Str("description"),
            State = props.Str("state"),
            SubscriptionRequired = props.Bool("subscriptionRequired"),
            ApprovalRequired = props.Bool("approvalRequired"),
        };
    }

    private static SubscriptionContract TransformSubscriptionContract(JsonElement el)
    {
        var name = el.Str("name") ?? "unknown";
        var props = el.Prop("properties");

        return new SubscriptionContract
        {
            Id = name,
            Name = name,
            DisplayName = props.Str("displayName"),
            Scope = props.Str("scope"),
            State = props.Str("state"),
            PrimaryKey = props.Str("primaryKey"),
            SecondaryKey = props.Str("secondaryKey"),
        };
    }

    private static TagContract TransformTagContract(JsonElement el)
    {
        var name = el.Str("name") ?? "unknown";
        var props = el.Prop("properties");

        return new TagContract
        {
            Id = name,
            Name = name,
            DisplayName = props.Str("displayName") ?? name,
        };
    }

    private static ContactInfo? TransformContact(JsonElement props)
    {
        if (!props.TryGetProperty("contact", out var c) || c.ValueKind != JsonValueKind.Object)
            return null;
        return new ContactInfo { Name = c.Str("name"), Url = c.Str("url"), Email = c.Str("email") };
    }

    private static LicenseInfo? TransformLicense(JsonElement props)
    {
        if (!props.TryGetProperty("license", out var l) || l.ValueKind != JsonValueKind.Object)
            return null;
        return new LicenseInfo { Name = l.Str("name"), Url = l.Str("url") };
    }
}

// ─── JsonElement helpers ─────────────────────────────────────────────────────

internal static class JsonElementExtensions
{
    public static string? Str(this JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    public static bool? Bool(this JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) &&
        (v.ValueKind == JsonValueKind.True || v.ValueKind == JsonValueKind.False)
            ? v.GetBoolean()
            : null;

    public static string[]? StrArray(this JsonElement el, string prop)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(prop, out var v) || v.ValueKind != JsonValueKind.Array)
            return null;
        return v.EnumerateArray()
            .Where(x => x.ValueKind == JsonValueKind.String)
            .Select(x => x.GetString()!)
            .ToArray();
    }

    public static JsonElement Prop(this JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v)
            ? v
            : default;
}
