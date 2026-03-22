// ---------------------------------------------------------------------------
// DataApiService — proxies requests to the APIM Data API (runtime endpoint).
//
// Unlike ArmApiService (which calls the ARM Management API and unwraps the
// ARM { id, name, properties: {...} } envelope), the Data API returns flat
// JSON that already matches the contract shapes the SPA expects.
//
// Key differences from ArmApiService:
//   • Base URL: https://<apim>.azure-api.net/developer (or direct data API URL)
//   • API version: 2022-04-01-preview (configurable via ApimSettings.DataApiVersion)
//   • Responses are flat — no "properties" wrapper to unwrap
//   • User-scoped resources are prefixed with /users/{userId}/ (subscriptions)
//   • Auth: App Registration (client credentials) via ITokenProvider
//
// Reference: api-management-developer-portal/src/clients/dataApiClient.ts
// ---------------------------------------------------------------------------

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Komatsu.ApimMarketplace.Bff.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Komatsu.ApimMarketplace.Bff.Services;

public sealed class DataApiService : IArmApiService
{
    private readonly HttpClient _http;
    private readonly ApimSettings _settings;
    private readonly ILogger<DataApiService> _logger;
    private readonly IMemoryCache _cache;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ITokenProvider _tokenProvider;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    public DataApiService(
        IHttpClientFactory httpFactory,
        IOptions<ApimSettings> settings,
        ILogger<DataApiService> logger,
        IMemoryCache cache,
        IHttpContextAccessor httpContextAccessor,
        ITokenProvider tokenProvider)
    {
        _http = httpFactory.CreateClient("DataApi");
        _settings = settings.Value;
        _logger = logger;
        _cache = cache;
        _httpContextAccessor = httpContextAccessor;
        _tokenProvider = tokenProvider;
    }

    // ── Data API base URL ─────────────────────────────────────────────────────

    private string DataApiBase
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(_settings.DataApiUrl))
                return _settings.DataApiUrl.TrimEnd('/');

            // Fallback: construct from service name
            return $"https://{_settings.ServiceName}.azure-api.net/developer";
        }
    }

    // ── User context ──────────────────────────────────────────────────────────

    /// <summary>
    /// Extracts the current user ID from the HTTP context claims.
    /// In the Data API, user-scoped resources require a /users/{userId} prefix.
    /// This mirrors the reference portal's <c>Utils.ensureUserPrefixed</c>.
    /// </summary>
    private string? GetCurrentUserId()
    {
        var claims = _httpContextAccessor.HttpContext?.User?.Claims;
        if (claims is null) return null;

        return claims.FirstOrDefault(c => c.Type == "oid")?.Value
            ?? claims.FirstOrDefault(c => c.Type == "sub")?.Value;
    }

    /// <summary>
    /// Prefixes a path with /users/{userId} for user-scoped resources,
    /// matching the reference portal's <c>DataApiClient.setUserPrefix</c>.
    /// </summary>
    private string UserPrefix(string path)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId)) return path;
        if (path.StartsWith("/users", StringComparison.OrdinalIgnoreCase)) return path;
        return $"/users/{userId}{(path.StartsWith('/') ? path : $"/{path}")}";
    }

    // ── Auth: acquire token via App Registration (client credentials) ─────────

    /// <summary>
    /// Acquires a bearer token for the Data API using the configured App
    /// Registration (service principal) client credentials.
    /// </summary>
    private Task<string> GetTokenAsync(CancellationToken ct)
        => _tokenProvider.GetTokenAsync(_settings.DataApiScope, ct);

    // ── Generic Data API fetch ────────────────────────────────────────────────

    private async Task<JsonElement> FetchDataApiAsync(string path, CancellationToken ct,
        HttpMethod? method = null, string? body = null)
    {
        var uri = BuildUri(path);
        _logger.LogDebug("DataAPI {Method} {Uri}", method?.Method ?? "GET", uri);

        using var req = new HttpRequestMessage(method ?? HttpMethod.Get, uri);

        var token = await GetTokenAsync(ct);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (body is not null)
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");

        using var res = await _http.SendAsync(req, ct);

        if (!res.IsSuccessStatusCode)
        {
            var errBody = await res.Content.ReadAsStringAsync(ct);
            _logger.LogError("Data API error {Status}: {Body}", (int)res.StatusCode, errBody);
            throw new HttpRequestException($"Data API returned {(int)res.StatusCode}", null, res.StatusCode);
        }

        var json = await res.Content.ReadAsStringAsync(ct);

        // Handle empty responses (DELETE, some POSTs)
        if (string.IsNullOrWhiteSpace(json))
            return default;

        return JsonDocument.Parse(json).RootElement.Clone();
    }

    private async Task<JsonElement> FetchDataApiCachedAsync(string path, CancellationToken ct)
    {
        var cacheKey = $"dataapi:{path}";
        if (_cache.TryGetValue(cacheKey, out JsonElement cached))
        {
            _logger.LogDebug("DataAPI cache hit: {Path}", path);
            return cached;
        }

        var result = await FetchDataApiAsync(path, ct);
        _cache.Set(cacheKey, result, CacheDuration);
        return result;
    }

    private string BuildUri(string path)
    {
        var separator = path.Contains('?') ? '&' : '?';
        return $"{DataApiBase}/{path.TrimStart('/')}{separator}api-version={_settings.DataApiVersion}";
    }

    private static string BuildPaginationQuery(string basePath, int? top, int? skip, string? filter = null)
    {
        var parts = new List<string>();
        if (top.HasValue) parts.Add($"$top={top.Value}");
        if (skip.HasValue) parts.Add($"$skip={skip.Value}");
        if (!string.IsNullOrWhiteSpace(filter)) parts.Add($"$filter={filter}");

        return parts.Count > 0 ? $"{basePath}?{string.Join('&', parts)}" : basePath;
    }

    // ── Flat JSON parsing helpers ─────────────────────────────────────────────
    // The Data API returns flat objects — fields are directly on the object,
    // NOT nested under a "properties" sub-object like ARM responses.

    private static IReadOnlyList<T> ParseFlatList<T>(JsonElement root, Func<JsonElement, T> transform)
    {
        if (!root.TryGetProperty("value", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];
        return arr.EnumerateArray().Select(transform).ToList();
    }

    // ─── List APIs ────────────────────────────────────────────────────────────

    public async Task<PagedResult<ApiContract>> ListApisAsync(int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery("apis", top, skip, filter);
        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapApiContract);
        _logger.LogInformation("DataAPI: Transformed {Count} APIs", items.Count);
        return new PagedResult<ApiContract>
        {
            Value = items,
            Count = root.TryGetProperty("count", out var c) && c.ValueKind == JsonValueKind.Number ? c.GetInt32() : items.Count,
            NextLink = root.Str("nextLink"),
        };
    }

    public async Task<ApiContract?> GetApiAsync(string apiId, string? revision = null, CancellationToken ct = default)
    {
        try
        {
            var path = revision is not null ? $"apis/{apiId};rev={revision}" : $"apis/{apiId}";
            var root = await FetchDataApiCachedAsync(path, ct);
            return MapApiContract(root);
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
        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapOperationContract);
        return new PagedResult<OperationContract> { Value = items, Count = items.Count };
    }

    public async Task<OperationContract?> GetOperationAsync(string apiId, string operationId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchDataApiCachedAsync($"apis/{apiId}/operations/{operationId}", ct);
            return MapOperationContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    // ─── Products for API ────────────────────────────────────────────────────

    public async Task<PagedResult<ProductContract>> ListProductsForApiAsync(string apiId, CancellationToken ct = default)
    {
        var root = await FetchDataApiCachedAsync($"apis/{apiId}/products", ct);
        var items = ParseFlatList(root, MapProductContract);
        return new PagedResult<ProductContract> { Value = items };
    }

    public async Task<PagedResult<ProductContract>> ListProductsForApiPageAsync(string apiId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery($"apis/{apiId}/products", top, skip, filter);
        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapProductContract);
        return new PagedResult<ProductContract> { Value = items, Count = items.Count };
    }

    // ─── APIs by tags ────────────────────────────────────────────────────────

    public async Task<PagedResult<TagGroup<ApiContract>>> GetApisByTagsAsync(
        int? top = null, int? skip = null, string[]? tags = null, string? pattern = null,
        CancellationToken ct = default)
    {
        var parts = new List<string>();
        if (top.HasValue) parts.Add($"$top={top.Value}");
        if (skip.HasValue) parts.Add($"$skip={skip.Value}");

        var filterParts = new List<string>();
        if (tags is { Length: > 0 })
        {
            var tagFilter = string.Join(" or ", tags.Select(t => $"tag/id eq '{t}'"));
            filterParts.Add($"({tagFilter})");
        }
        if (!string.IsNullOrWhiteSpace(pattern))
            filterParts.Add($"(contains(api/name,'{Uri.EscapeDataString(pattern)}'))");
        if (filterParts.Count > 0)
            parts.Add($"$filter={string.Join(" and ", filterParts)}");

        var query = parts.Count > 0 ? $"apisByTags?{string.Join('&', parts)}" : "apisByTags";
        var root = await FetchDataApiCachedAsync(query, ct);

        return BuildTagGroupResult(root, el =>
        {
            var tagName = el.Prop("tag").Str("name") ?? "Untagged";
            var api = el.Prop("api");
            return (tagName, MapApiContract(api));
        });
    }

    // ─── Operations by tags ──────────────────────────────────────────────────

    public async Task<PagedResult<TagGroup<OperationContract>>> GetOperationsByTagsAsync(
        string apiId, int? top = null, int? skip = null, string[]? tags = null, string? pattern = null,
        CancellationToken ct = default)
    {
        var parts = new List<string> { "includeNotTaggedOperations=true" };
        if (top.HasValue) parts.Add($"$top={top.Value}");
        if (skip.HasValue) parts.Add($"$skip={skip.Value}");

        var filterParts = new List<string>();
        if (tags is { Length: > 0 })
        {
            var tagFilter = string.Join(" or ", tags.Select(t => $"tag/id eq '{t}'"));
            filterParts.Add($"({tagFilter})");
        }
        if (!string.IsNullOrWhiteSpace(pattern))
            filterParts.Add($"(contains(operation/name,'{Uri.EscapeDataString(pattern)}'))");
        if (filterParts.Count > 0)
            parts.Add($"$filter={string.Join(" and ", filterParts)}");

        var query = $"apis/{apiId}/operationsByTags?{string.Join('&', parts)}";
        var root = await FetchDataApiCachedAsync(query, ct);

        return BuildTagGroupResult(root, el =>
        {
            var tagName = el.Prop("tag").Str("name") ?? "Untagged";
            var op = el.Prop("operation");
            return (tagName, MapOperationContract(op));
        });
    }

    // ─── Operation tags ──────────────────────────────────────────────────────

    public async Task<IReadOnlyList<TagContract>> GetOperationTagsAsync(string apiId, string operationId, CancellationToken ct = default)
    {
        var root = await FetchDataApiCachedAsync($"apis/{apiId}/operations/{operationId}/tags", ct);
        return ParseFlatList(root, MapTagContract);
    }

    // ─── Version sets ────────────────────────────────────────────────────────

    public async Task<VersionSetContract?> GetApiVersionSetAsync(string versionSetId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchDataApiCachedAsync($"apiVersionSets/{versionSetId}", ct);
            return MapVersionSetContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<ApiContract>> GetApisInVersionSetAsync(string versionSetId, CancellationToken ct = default)
    {
        var filter = Uri.EscapeDataString($"apiVersionSetId eq '/apiVersionSets/{versionSetId}'");
        var root = await FetchDataApiCachedAsync($"apis?$filter={filter}", ct);
        return ParseFlatList(root, MapApiContract);
    }

    // ─── Schemas ─────────────────────────────────────────────────────────────

    public async Task<PagedResult<SchemaContract>> GetApiSchemasAsync(string apiId, CancellationToken ct = default)
    {
        var root = await FetchDataApiCachedAsync($"apis/{apiId}/schemas", ct);
        var items = ParseFlatList(root, MapSchemaContract);
        return new PagedResult<SchemaContract> { Value = items, Count = items.Count };
    }

    // ─── Change log ──────────────────────────────────────────────────────────

    public async Task<PagedResult<ChangeLogContract>> GetApiChangeLogAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery($"apis/{apiId}/releases", top, skip);
        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapChangeLogContract);
        return new PagedResult<ChangeLogContract> { Value = items, Count = items.Count };
    }

    // ─── Hostnames ───────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<string>> GetApiHostnamesAsync(string apiId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchDataApiCachedAsync($"apis/{apiId}/hostnames", ct);
            if (root.TryGetProperty("value", out var arr) && arr.ValueKind == JsonValueKind.Array)
                return arr.EnumerateArray()
                    .Select(el => el.Str("value"))
                    .Where(v => v is not null)
                    .Select(v => v!)
                    .ToList();
            return [];
        }
        catch (HttpRequestException)
        {
            return [];
        }
    }

    // ─── Product APIs ────────────────────────────────────────────────────────

    public async Task<PagedResult<ApiContract>> GetProductApisAsync(string productId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery($"products/{productId}/apis", top, skip, filter);
        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapApiContract);
        return new PagedResult<ApiContract> { Value = items, Count = items.Count };
    }

    // ─── Tags ────────────────────────────────────────────────────────────────

    public async Task<PagedResult<TagContract>> ListTagsAsync(string? scope = null, string? filter = null, CancellationToken ct = default)
    {
        var path = "tags";
        var queryParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(scope)) queryParts.Add($"scope={scope}");
        if (!string.IsNullOrWhiteSpace(filter)) queryParts.Add($"$filter={filter}");
        if (queryParts.Count > 0) path += $"?{string.Join('&', queryParts)}";

        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapTagContract);
        return new PagedResult<TagContract> { Value = items, Count = items.Count };
    }

    // ─── Products ────────────────────────────────────────────────────────────

    public async Task<PagedResult<ProductContract>> ListProductsAsync(int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery("products", top, skip);
        var root = await FetchDataApiCachedAsync(path, ct);
        var items = ParseFlatList(root, MapProductContract);
        return new PagedResult<ProductContract> { Value = items, Count = items.Count };
    }

    public async Task<ProductContract?> GetProductAsync(string productId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchDataApiCachedAsync($"products/{productId}", ct);
            return MapProductContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    // ─── Subscriptions (user-scoped) ─────────────────────────────────────────
    // In runtime Data API mode, subscriptions are fetched under /users/{userId}/
    // matching the reference portal's DataApiClient.setUserPrefix behavior.

    public async Task<PagedResult<SubscriptionContract>> ListSubscriptionsAsync(int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = UserPrefix(BuildPaginationQuery("subscriptions", top, skip));
        var root = await FetchDataApiAsync(path, ct);
        var items = ParseFlatList(root, MapSubscriptionContract);
        return new PagedResult<SubscriptionContract> { Value = items, Count = items.Count };
    }

    public async Task<SubscriptionContract?> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchDataApiAsync($"subscriptions/{subscriptionId}", ct);
            return MapSubscriptionContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<SubscriptionContract?> CreateSubscriptionAsync(CreateSubscriptionRequest request, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        var sid = $"sub-{Guid.NewGuid():N}"[..24];

        // Data API: POST /users/{userId}/subscriptions/{sid}
        var requestBody = JsonSerializer.Serialize(new
        {
            scope = request.Scope.StartsWith('/') ? request.Scope : $"/products/{request.Scope}",
            name = request.DisplayName,
        });

        var path = userId is not null
            ? $"users/{userId}/subscriptions/{sid}"
            : $"subscriptions/{sid}";

        var root = await FetchDataApiAsync(path, ct, HttpMethod.Put, requestBody);
        return MapSubscriptionContract(root);
    }

    public async Task<SubscriptionContract?> UpdateSubscriptionAsync(string subscriptionId, object patchBody, CancellationToken ct = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(patchBody);
            var root = await FetchDataApiAsync($"subscriptions/{subscriptionId}", ct, HttpMethod.Patch, body);
            return MapSubscriptionContract(root);
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
            await FetchDataApiAsync($"subscriptions/{subscriptionId}", ct, HttpMethod.Delete);
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
            var root = await FetchDataApiAsync($"subscriptions/{subscriptionId}/listSecrets", ct, HttpMethod.Post);
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

    public async Task<SubscriptionContract?> RegeneratePrimaryKeyAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            await FetchDataApiAsync($"subscriptions/{subscriptionId}/regeneratePrimaryKey", ct, HttpMethod.Post);
            return await GetSubscriptionAsync(subscriptionId, ct);
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    public async Task<SubscriptionContract?> RegenerateSecondaryKeyAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            await FetchDataApiAsync($"subscriptions/{subscriptionId}/regenerateSecondaryKey", ct, HttpMethod.Post);
            return await GetSubscriptionAsync(subscriptionId, ct);
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
            SafeCountAsync(UserPrefix("subscriptions"), ct),
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
            var root = await FetchDataApiCachedAsync(resource, ct);
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
            var uri = $"{DataApiBase}/apis/{apiId}?format={format}&export=true&api-version={_settings.DataApiVersion}";
            _logger.LogDebug("DataAPI OpenAPI export: GET {Uri}", uri);

            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            var token = await GetTokenAsync(ct);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
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

    // ─── Flat contract mappers ───────────────────────────────────────────────
    // Data API returns flat objects — fields are at the top level, not under
    // "properties". This is the key difference from ArmApiService transformers.

    private static ApiContract MapApiContract(JsonElement el)
    {
        return new ApiContract
        {
            Id = el.Str("id") ?? el.Str("name") ?? "unknown",
            Name = el.Str("name") ?? el.Str("displayName") ?? "unknown",
            Description = el.Str("description"),
            Path = el.Str("path"),
            Protocols = el.StrArray("protocols"),
            ApiVersion = el.Str("apiVersion"),
            ApiRevision = el.Str("apiRevision"),
            ApiRevisionDescription = el.Str("apiRevisionDescription"),
            Type = el.Str("type") ?? "http",
            IsCurrent = el.Bool("isCurrent"),
            ApiVersionSetId = el.Str("apiVersionSetId"),
            ApiVersionSet = MapInlineVersionSet(el),
            AuthenticationSettings = MapAuthSettings(el),
            SubscriptionKeyParameterNames = MapSubscriptionKeyParams(el),
            SubscriptionRequired = el.Bool("subscriptionRequired"),
            Contact = MapContact(el),
            License = MapLicense(el),
            TermsOfServiceUrl = el.Str("termsOfServiceUrl"),
            Tags = [],
        };
    }

    private static OperationContract MapOperationContract(JsonElement el)
    {
        return new OperationContract
        {
            Id = el.Str("id") ?? el.Str("name") ?? "unknown",
            Name = el.Str("name") ?? "unknown",
            Method = el.Str("method") ?? "GET",
            UrlTemplate = el.Str("urlTemplate") ?? "",
            Description = el.Str("description"),
            DisplayName = el.Str("displayName") ?? el.Str("name") ?? "unknown",
            Version = el.Str("version"),
            TemplateParameters = MapParameters(el, "templateParameters"),
            Request = MapRequest(el),
            Responses = MapResponses(el),
        };
    }

    private static ProductContract MapProductContract(JsonElement el)
    {
        return new ProductContract
        {
            Id = el.Str("id") ?? el.Str("name") ?? "unknown",
            Name = el.Str("name") ?? "unknown",
            DisplayName = el.Str("displayName"),
            Description = el.Str("description"),
            State = el.Str("state"),
            SubscriptionRequired = el.Bool("subscriptionRequired"),
            ApprovalRequired = el.Bool("approvalRequired"),
            SubscriptionsLimit = el.Int("subscriptionsLimit"),
            Terms = el.Str("terms"),
        };
    }

    private static SubscriptionContract MapSubscriptionContract(JsonElement el)
    {
        return new SubscriptionContract
        {
            Id = el.Str("id") ?? el.Str("name") ?? "unknown",
            Name = el.Str("name") ?? "unknown",
            DisplayName = el.Str("displayName"),
            Scope = el.Str("scope"),
            State = el.Str("state"),
            PrimaryKey = el.Str("primaryKey"),
            SecondaryKey = el.Str("secondaryKey"),
            CreatedDate = el.Str("createdDate"),
            EndDate = el.Str("endDate"),
            ExpirationDate = el.Str("expirationDate"),
            NotificationDate = el.Str("notificationDate"),
            StartDate = el.Str("startDate"),
            StateComment = el.Str("stateComment"),
            OwnerId = el.Str("ownerId"),
        };
    }

    private static TagContract MapTagContract(JsonElement el)
    {
        return new TagContract
        {
            Id = el.Str("id") ?? el.Str("name") ?? "unknown",
            Name = el.Str("name") ?? "unknown",
            DisplayName = el.Str("displayName") ?? el.Str("name") ?? "unknown",
        };
    }

    private static VersionSetContract MapVersionSetContract(JsonElement el)
    {
        return new VersionSetContract
        {
            Id = el.Str("id"),
            Name = el.Str("name") ?? el.Str("displayName"),
            Description = el.Str("description"),
            VersioningScheme = el.Str("versioningScheme"),
            VersionQueryName = el.Str("versionQueryName"),
            VersionHeaderName = el.Str("versionHeaderName"),
        };
    }

    private static SchemaContract MapSchemaContract(JsonElement el)
    {
        JsonElement? doc = null;
        if (el.TryGetProperty("document", out var d) && d.ValueKind != JsonValueKind.Null)
            doc = d.Clone();

        return new SchemaContract
        {
            Id = el.Str("id") ?? "unknown",
            ContentType = el.Str("contentType") ?? "",
            Document = doc,
        };
    }

    private static ChangeLogContract MapChangeLogContract(JsonElement el)
    {
        return new ChangeLogContract
        {
            CreatedDateTime = el.Str("createdDateTime"),
            UpdatedDateTime = el.Str("updatedDateTime"),
            Notes = el.Str("notes"),
        };
    }

    private static ContactInfo? MapContact(JsonElement el)
    {
        if (!el.TryGetProperty("contact", out var c) || c.ValueKind != JsonValueKind.Object)
            return null;
        return new ContactInfo { Name = c.Str("name"), Url = c.Str("url"), Email = c.Str("email") };
    }

    private static LicenseInfo? MapLicense(JsonElement el)
    {
        if (!el.TryGetProperty("license", out var l) || l.ValueKind != JsonValueKind.Object)
            return null;
        return new LicenseInfo { Name = l.Str("name"), Url = l.Str("url") };
    }

    private static VersionSetContract? MapInlineVersionSet(JsonElement el)
    {
        if (!el.TryGetProperty("apiVersionSet", out var vs) || vs.ValueKind != JsonValueKind.Object)
            return null;
        return new VersionSetContract
        {
            Name = vs.Str("name"),
            Description = vs.Str("description"),
            VersioningScheme = vs.Str("versioningScheme"),
            VersionQueryName = vs.Str("versionQueryName"),
            VersionHeaderName = vs.Str("versionHeaderName"),
        };
    }

    private static AuthenticationSettingsContract? MapAuthSettings(JsonElement el)
    {
        if (!el.TryGetProperty("authenticationSettings", out var auth) || auth.ValueKind != JsonValueKind.Object)
            return null;

        OAuth2SettingsContract? oauth2 = null;
        if (auth.TryGetProperty("oAuth2", out var o) && o.ValueKind == JsonValueKind.Object)
            oauth2 = new OAuth2SettingsContract { AuthorizationServerId = o.Str("authorizationServerId"), Scope = o.Str("scope") };

        OpenIdSettingsContract? openId = null;
        if (auth.TryGetProperty("openid", out var oi) && oi.ValueKind == JsonValueKind.Object)
            openId = new OpenIdSettingsContract { OpenIdProviderId = oi.Str("openidProviderId") };

        return new AuthenticationSettingsContract { OAuth2 = oauth2, OpenId = openId };
    }

    private static SubscriptionKeyParameterName? MapSubscriptionKeyParams(JsonElement el)
    {
        if (!el.TryGetProperty("subscriptionKeyParameterNames", out var sk) || sk.ValueKind != JsonValueKind.Object)
            return null;
        return new SubscriptionKeyParameterName { Header = sk.Str("header"), Query = sk.Str("query") };
    }

    private static ParameterContract[]? MapParameters(JsonElement el, string propertyName)
    {
        if (!el.TryGetProperty(propertyName, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return null;
        return arr.EnumerateArray().Select(p => new ParameterContract
        {
            Name = p.Str("name") ?? "unknown",
            Description = p.Str("description"),
            Type = p.Str("type"),
            Required = p.Bool("required"),
            DefaultValue = p.Str("defaultValue"),
            Values = p.StrArray("values"),
        }).ToArray();
    }

    private static RequestContract? MapRequest(JsonElement el)
    {
        if (!el.TryGetProperty("request", out var r) || r.ValueKind != JsonValueKind.Object)
            return null;
        return new RequestContract
        {
            Description = r.Str("description"),
            QueryParameters = MapParameters(r, "queryParameters"),
            Headers = MapParameters(r, "headers"),
            Representations = MapRepresentations(r),
        };
    }

    private static ResponseContract[]? MapResponses(JsonElement el)
    {
        if (!el.TryGetProperty("responses", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return null;
        return arr.EnumerateArray().Select(r => new ResponseContract
        {
            StatusCode = r.TryGetProperty("statusCode", out var sc) ? sc.GetInt32() : 0,
            Description = r.Str("description"),
            Headers = MapParameters(r, "headers"),
            Representations = MapRepresentations(r),
        }).ToArray();
    }

    private static RepresentationContract[]? MapRepresentations(JsonElement el)
    {
        if (!el.TryGetProperty("representations", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return null;
        return arr.EnumerateArray().Select(r => new RepresentationContract
        {
            ContentType = r.Str("contentType"),
            SchemaId = r.Str("schemaId"),
            TypeName = r.Str("typeName"),
        }).ToArray();
    }

    // ── Tag group builder ────────────────────────────────────────────────────

    private static PagedResult<TagGroup<T>> BuildTagGroupResult<T>(
        JsonElement root, Func<JsonElement, (string TagName, T Item)> extractor)
    {
        if (!root.TryGetProperty("value", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return new PagedResult<TagGroup<T>> { Value = [] };

        var groups = new Dictionary<string, List<T>>();
        foreach (var el in arr.EnumerateArray())
        {
            var (tagName, item) = extractor(el);
            if (!groups.TryGetValue(tagName, out var list))
            {
                list = [];
                groups[tagName] = list;
            }
            list.Add(item);
        }

        var result = groups.Select(kvp => new TagGroup<T>
        {
            Tag = kvp.Key,
            Items = kvp.Value,
        }).ToList();

        var nextLink = root.Str("nextLink");
        int? count = root.TryGetProperty("count", out var c) && c.ValueKind == JsonValueKind.Number
            ? c.GetInt32() : null;

        return new PagedResult<TagGroup<T>> { Value = result, NextLink = nextLink, Count = count };
    }
}
