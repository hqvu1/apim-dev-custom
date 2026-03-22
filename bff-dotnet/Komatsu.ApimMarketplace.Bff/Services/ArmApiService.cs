// ---------------------------------------------------------------------------
// ArmApiService — proxies requests to Azure ARM Management API for APIM.
//
// Auth chain:  App Registration (ClientSecretCredential)  →  ARM bearer token  →  ARM REST API
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
using Komatsu.ApimMarketplace.Bff.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Komatsu.ApimMarketplace.Bff.Services;

// ─── Implementation ──────────────────────────────────────────────────────────

public sealed class ArmApiService : IArmApiService
{
    private readonly HttpClient _http;
    private readonly ApimSettings _settings;
    private readonly ILogger<ArmApiService> _logger;
    private readonly IMemoryCache _cache;
    private readonly ITokenProvider _tokenProvider;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    public ArmApiService(
        IHttpClientFactory httpFactory,
        IOptions<ApimSettings> settings,
        ILogger<ArmApiService> logger,
        IMemoryCache cache,
        ITokenProvider tokenProvider)
    {
        _http = httpFactory.CreateClient("ArmApi");
        _settings = settings.Value;
        _logger = logger;
        _cache = cache;
        _tokenProvider = tokenProvider;
    }

    // ── ARM base URL ──────────────────────────────────────────────────────────

    private string ArmBase =>
        $"https://management.azure.com/subscriptions/{_settings.SubscriptionId}" +
        $"/resourceGroups/{_settings.ResourceGroup}" +
        $"/providers/Microsoft.ApiManagement/service/{_settings.ServiceName}";

    // ── Token management ──────────────────────────────────────────────────────

    private Task<string> GetTokenAsync(CancellationToken ct)
        => _tokenProvider.GetTokenAsync(_settings.ArmScope, ct);

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

            // On 403 AuthorizationFailed, invalidate the current credential and
            // retry once with the fallback (DefaultAzureCredential / managed identity).
            if (res.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _tokenProvider.InvalidateCredential();

                _logger.LogInformation("Retrying ARM {Method} {Uri} with fallback credential",
                    method?.Method ?? "GET", uri);

                using var retryReq = new HttpRequestMessage(method ?? HttpMethod.Get, uri);
                retryReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await GetTokenAsync(ct));
                retryReq.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                if (body is not null)
                {
                    retryReq.Content = new StringContent(body, Encoding.UTF8, "application/json");
                }

                using var retryRes = await _http.SendAsync(retryReq, ct);

                if (retryRes.IsSuccessStatusCode)
                {
                    var retryJson = await retryRes.Content.ReadAsStringAsync(ct);
                    return JsonDocument.Parse(retryJson).RootElement.Clone();
                }

                var retryErrBody = await retryRes.Content.ReadAsStringAsync(ct);
                _logger.LogError("ARM API fallback error {Status}: {Body}", (int)retryRes.StatusCode, retryErrBody);
                throw new HttpRequestException($"ARM API returned {(int)retryRes.StatusCode}", null, retryRes.StatusCode);
            }

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

    public async Task<ApiContract?> GetApiAsync(string apiId, string? revision = null, CancellationToken ct = default)
    {
        try
        {
            var path = revision is not null
                ? $"apis/{apiId};rev={revision}"
                : $"apis/{apiId}";
            var root = await FetchArmCachedAsync(path, ct);
            var api = TransformApiContract(root);

            // If version set ID is present but inline set is missing, fetch it
            if (api.ApiVersionSetId is not null && api.ApiVersionSet is null)
            {
                var vsId = api.ApiVersionSetId.Contains('/')
                    ? api.ApiVersionSetId.Split('/').Last()
                    : api.ApiVersionSetId;
                var vs = await GetApiVersionSetAsync(vsId, ct);
                if (vs is not null)
                {
                    api = new ApiContract
                    {
                        Id = api.Id,
                        Name = api.Name,
                        Description = api.Description,
                        Path = api.Path,
                        Protocols = api.Protocols,
                        ApiVersion = api.ApiVersion,
                        ApiRevision = api.ApiRevision,
                        ApiRevisionDescription = api.ApiRevisionDescription,
                        Type = api.Type,
                        IsCurrent = api.IsCurrent,
                        ApiVersionSetId = api.ApiVersionSetId,
                        ApiVersionSet = vs,
                        AuthenticationSettings = api.AuthenticationSettings,
                        SubscriptionKeyParameterNames = api.SubscriptionKeyParameterNames,
                        SubscriptionRequired = api.SubscriptionRequired,
                        Contact = api.Contact,
                        License = api.License,
                        TermsOfServiceUrl = api.TermsOfServiceUrl,
                        Tags = api.Tags,
                    };
                }
            }

            return api;
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

    public async Task<PagedResult<ProductContract>> ListProductsForApiPageAsync(string apiId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery($"apis/{apiId}/products", top, skip, filter);
        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformProductContract);
        return new PagedResult<ProductContract> { Value = items, Count = items.Count };
    }

    // ─── Single operation ────────────────────────────────────────────────────

    public async Task<OperationContract?> GetOperationAsync(string apiId, string operationId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmCachedAsync($"apis/{apiId}/operations/{operationId}", ct);
            return TransformOperationContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    // ─── APIs by tags (apisByTags endpoint) ──────────────────────────────────

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
        var root = await FetchArmCachedAsync(query, ct);

        return BuildTagGroupResult(root, el =>
        {
            var tag = el.Prop("tag");
            var api = el.Prop("api");
            var tagName = tag.Str("name") ?? "Untagged";
            return (tagName, TransformApiContract(api));
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
        var root = await FetchArmCachedAsync(query, ct);

        return BuildTagGroupResult(root, el =>
        {
            var tag = el.Prop("tag");
            var op = el.Prop("operation");
            var tagName = tag.Str("name") ?? "Untagged";
            return (tagName, TransformOperationContract(op));
        });
    }

    // ─── Operation tags ──────────────────────────────────────────────────────

    public async Task<IReadOnlyList<TagContract>> GetOperationTagsAsync(string apiId, string operationId, CancellationToken ct = default)
    {
        var root = await FetchArmCachedAsync($"apis/{apiId}/operations/{operationId}/tags", ct);
        return ParseArmList(root, TransformTagContract);
    }

    // ─── Version sets ────────────────────────────────────────────────────────

    public async Task<VersionSetContract?> GetApiVersionSetAsync(string versionSetId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmCachedAsync($"apiVersionSets/{versionSetId}", ct);
            return TransformVersionSetContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<ApiContract>> GetApisInVersionSetAsync(string versionSetId, CancellationToken ct = default)
    {
        var filter = Uri.EscapeDataString($"apiVersionSetId eq '/apiVersionSets/{versionSetId}'");
        var root = await FetchArmCachedAsync($"apis?$filter={filter}", ct);
        return ParseArmList(root, TransformApiContract);
    }

    // ─── API schemas ─────────────────────────────────────────────────────────

    public async Task<PagedResult<SchemaContract>> GetApiSchemasAsync(string apiId, CancellationToken ct = default)
    {
        var root = await FetchArmCachedAsync($"apis/{apiId}/schemas", ct);
        var items = ParseArmList(root, TransformSchemaContract);
        return new PagedResult<SchemaContract> { Value = items, Count = items.Count };
    }

    // ─── API change log ──────────────────────────────────────────────────────

    public async Task<PagedResult<ChangeLogContract>> GetApiChangeLogAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var path = BuildPaginationQuery($"apis/{apiId}/releases", top, skip);
        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformChangeLogContract);
        return new PagedResult<ChangeLogContract> { Value = items, Count = items.Count };
    }

    // ─── API hostnames ───────────────────────────────────────────────────────

    public async Task<IReadOnlyList<string>> GetApiHostnamesAsync(string apiId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmCachedAsync($"apis/{apiId}/hostnames", ct);
            if (root.TryGetProperty("value", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                return arr.EnumerateArray()
                    .Select(el => el.Str("value"))
                    .Where(v => v is not null)
                    .Select(v => v!)
                    .ToList();
            }
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
        var root = await FetchArmCachedAsync(path, ct);
        var items = ParseArmList(root, TransformApiContract);
        return new PagedResult<ApiContract> { Value = items, Count = items.Count };
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

    public async Task<ProductContract?> GetProductAsync(string productId, CancellationToken ct = default)
    {
        try
        {
            var root = await FetchArmCachedAsync($"products/{productId}", ct);
            return TransformProductContract(root);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    // ─── Subscriptions

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

    public async Task<SubscriptionContract?> RegeneratePrimaryKeyAsync(string subscriptionId, CancellationToken ct = default)
    {
        try
        {
            await FetchArmAsync($"subscriptions/{subscriptionId}/regeneratePrimaryKey", ct, HttpMethod.Post);
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
            await FetchArmAsync($"subscriptions/{subscriptionId}/regenerateSecondaryKey", ct, HttpMethod.Post);
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
            ApiRevisionDescription = props.Str("apiRevisionDescription"),
            Type = props.Str("type") ?? "http",
            IsCurrent = props.Bool("isCurrent"),
            ApiVersionSetId = props.Str("apiVersionSetId"),
            ApiVersionSet = TransformInlineVersionSet(props),
            AuthenticationSettings = TransformAuthSettings(props),
            SubscriptionKeyParameterNames = TransformSubscriptionKeyParams(props),
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
            Version = props.Str("version"),
            TemplateParameters = TransformParameters(props, "templateParameters"),
            Request = TransformRequest(props),
            Responses = TransformResponses(props),
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
            SubscriptionsLimit = props.Int("subscriptionsLimit"),
            Terms = props.Str("terms"),
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
            CreatedDate = props.Str("createdDate"),
            EndDate = props.Str("endDate"),
            ExpirationDate = props.Str("expirationDate"),
            NotificationDate = props.Str("notificationDate"),
            StartDate = props.Str("startDate"),
            StateComment = props.Str("stateComment"),
            OwnerId = props.Str("ownerId"),
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

    private static VersionSetContract TransformVersionSetContract(JsonElement el)
    {
        var name = el.Str("name") ?? "unknown";
        var props = el.Prop("properties");

        return new VersionSetContract
        {
            Id = name,
            Name = props.Str("displayName") ?? name,
            Description = props.Str("description"),
            VersioningScheme = props.Str("versioningScheme"),
            VersionQueryName = props.Str("versionQueryName"),
            VersionHeaderName = props.Str("versionHeaderName"),
        };
    }

    private static VersionSetContract? TransformInlineVersionSet(JsonElement props)
    {
        if (!props.TryGetProperty("apiVersionSet", out var vs) || vs.ValueKind != JsonValueKind.Object)
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

    private static SchemaContract TransformSchemaContract(JsonElement el)
    {
        var name = el.Str("name") ?? "unknown";
        var props = el.Prop("properties");

        JsonElement? doc = null;
        if (props.TryGetProperty("document", out var d) && d.ValueKind != JsonValueKind.Null)
            doc = d.Clone();

        return new SchemaContract
        {
            Id = name,
            ContentType = props.Str("contentType") ?? "",
            Document = doc,
        };
    }

    private static ChangeLogContract TransformChangeLogContract(JsonElement el)
    {
        var props = el.Prop("properties");

        return new ChangeLogContract
        {
            CreatedDateTime = props.Str("createdDateTime"),
            UpdatedDateTime = props.Str("updatedDateTime"),
            Notes = props.Str("notes"),
        };
    }

    private static AuthenticationSettingsContract? TransformAuthSettings(JsonElement props)
    {
        if (!props.TryGetProperty("authenticationSettings", out var auth) || auth.ValueKind != JsonValueKind.Object)
            return null;

        OAuth2SettingsContract? oauth2 = null;
        if (auth.TryGetProperty("oAuth2", out var o) && o.ValueKind == JsonValueKind.Object)
            oauth2 = new OAuth2SettingsContract { AuthorizationServerId = o.Str("authorizationServerId"), Scope = o.Str("scope") };

        OpenIdSettingsContract? openId = null;
        if (auth.TryGetProperty("openid", out var oi) && oi.ValueKind == JsonValueKind.Object)
            openId = new OpenIdSettingsContract { OpenIdProviderId = oi.Str("openidProviderId") };

        return new AuthenticationSettingsContract { OAuth2 = oauth2, OpenId = openId };
    }

    private static SubscriptionKeyParameterName? TransformSubscriptionKeyParams(JsonElement props)
    {
        if (!props.TryGetProperty("subscriptionKeyParameterNames", out var sk) || sk.ValueKind != JsonValueKind.Object)
            return null;
        return new SubscriptionKeyParameterName { Header = sk.Str("header"), Query = sk.Str("query") };
    }

    private static ParameterContract[]? TransformParameters(JsonElement props, string propertyName)
    {
        if (!props.TryGetProperty(propertyName, out var arr) || arr.ValueKind != JsonValueKind.Array)
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

    private static RequestContract? TransformRequest(JsonElement props)
    {
        if (!props.TryGetProperty("request", out var r) || r.ValueKind != JsonValueKind.Object)
            return null;
        return new RequestContract
        {
            Description = r.Str("description"),
            QueryParameters = TransformParameters(r, "queryParameters"),
            Headers = TransformParameters(r, "headers"),
            Representations = TransformRepresentations(r),
        };
    }

    private static ResponseContract[]? TransformResponses(JsonElement props)
    {
        if (!props.TryGetProperty("responses", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return null;
        return arr.EnumerateArray().Select(r => new ResponseContract
        {
            StatusCode = r.TryGetProperty("statusCode", out var sc) ? sc.GetInt32() : 0,
            Description = r.Str("description"),
            Headers = TransformParameters(r, "headers"),
            Representations = TransformRepresentations(r),
        }).ToArray();
    }

    private static RepresentationContract[]? TransformRepresentations(JsonElement el)
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

    // ─── Tag group builder ────────────────────────────────────────────────────

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

    public static int? Int(this JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number
            ? v.GetInt32()
            : null;
}
