// ---------------------------------------------------------------------------
// MockApiService — returns static mock data when running in Development mode.
//
// Mirrors the mock data from bff/server.js so local dev works identically.
// Updated to implement the enhanced IArmApiService with pagination, tags,
// subscription details, and secrets.
// ---------------------------------------------------------------------------

using Komatsu.ApimMarketplace.Bff.Models;
using System.Text.Json;

namespace Komatsu.ApimMarketplace.Bff.Services;

/// <summary>
/// Implements <see cref="IArmApiService"/> with in-memory mock data.
/// Registered when <c>ASPNETCORE_ENVIRONMENT=Development</c> and <c>UseMockMode=true</c>.
/// </summary>
public sealed class MockApiService : IArmApiService
{
    private readonly ILogger<MockApiService> _logger;

    public MockApiService(ILogger<MockApiService> logger) => _logger = logger;

    // ─── Static mock APIs ────────────────────────────────────────────────────

    private static readonly ApiContract[] MockApis =
    [
        new()
        {
            Id = "warranty-api",
            Name = "Warranty API",
            Description = "Warranty claims and coverage validation.",
            Path = "/warranty",
            Protocols = ["https"],
            Type = "http",
            SubscriptionRequired = true,
            Contact = new ContactInfo { Name = "Komatsu Warranty" },
            Tags = ["claims", "coverage", "warranty"],
        },
        new()
        {
            Id = "punchout-api",
            Name = "Punchout API",
            Description = "Dealer commerce and parts ordering.",
            Path = "/punchout",
            Protocols = ["https"],
            Type = "http",
            SubscriptionRequired = false,
            Contact = new ContactInfo { Name = "Commerce Platform" },
            Tags = ["commerce", "orders", "punchout"],
        },
        new()
        {
            Id = "equipment-api",
            Name = "Equipment API",
            Description = "Fleet data, telemetry, and lifecycle info.",
            Path = "/equipment",
            Protocols = ["https"],
            Type = "http",
            SubscriptionRequired = true,
            Contact = new ContactInfo { Name = "Equipment Insights" },
            Tags = ["fleet", "telemetry", "equipment"],
        },
    ];

    private static readonly Dictionary<string, OperationContract[]> MockOperations = new()
    {
        ["warranty-api"] =
        [
            new() { Id = "get-warranty", Name = "getWarranty", Method = "GET", UrlTemplate = "/warranty/{serialNumber}", DisplayName = "Get Warranty", Description = "Returns warranty coverage for a given serial number." },
            new() { Id = "submit-claim", Name = "submitClaim", Method = "POST", UrlTemplate = "/warranty/claims", DisplayName = "Submit Claim", Description = "Creates a new warranty claim." },
        ],
        ["punchout-api"] =
        [
            new() { Id = "create-session", Name = "createSession", Method = "POST", UrlTemplate = "/punchout/session", DisplayName = "Create Session", Description = "Initiates a new punchout session." },
            new() { Id = "get-catalog", Name = "getCatalog", Method = "GET", UrlTemplate = "/punchout/catalog", DisplayName = "Get Catalog", Description = "Retrieves the parts catalog." },
        ],
        ["equipment-api"] =
        [
            new() { Id = "get-fleet", Name = "getFleet", Method = "GET", UrlTemplate = "/equipment/fleet", DisplayName = "Get Fleet", Description = "Returns fleet information for authorized accounts." },
            new() { Id = "get-telemetry", Name = "getTelemetry", Method = "GET", UrlTemplate = "/equipment/{serialNumber}/telemetry", DisplayName = "Get Telemetry", Description = "Retrieves real-time telemetry data." },
        ],
    };

    private static readonly ProductContract[] MockProducts =
    [
        new() { Id = "starter", Name = "starter", DisplayName = "Starter", Description = "Free tier for evaluation.", State = "published", SubscriptionRequired = false, ApprovalRequired = false },
        new() { Id = "enterprise", Name = "enterprise", DisplayName = "Enterprise", Description = "Full access with SLA.", State = "published", SubscriptionRequired = true, ApprovalRequired = true },
    ];

    private static readonly SubscriptionContract[] MockSubscriptions =
    [
        new() { Id = "sub-warranty-1", Name = "sub-warranty-1", DisplayName = "Warranty Prod", Scope = "/products/enterprise", State = "active" },
        new() { Id = "sub-equipment-1", Name = "sub-equipment-1", DisplayName = "Equipment Prod", Scope = "/products/enterprise", State = "active" },
        new() { Id = "sub-punchout-1", Name = "sub-punchout-1", DisplayName = "Punchout Sandbox", Scope = "/products/starter", State = "active" },
    ];

    private static readonly TagContract[] MockTags =
    [
        new() { Id = "claims", Name = "claims", DisplayName = "Claims" },
        new() { Id = "coverage", Name = "coverage", DisplayName = "Coverage" },
        new() { Id = "warranty", Name = "warranty", DisplayName = "Warranty" },
        new() { Id = "commerce", Name = "commerce", DisplayName = "Commerce" },
        new() { Id = "orders", Name = "orders", DisplayName = "Orders" },
        new() { Id = "punchout", Name = "punchout", DisplayName = "Punchout" },
        new() { Id = "fleet", Name = "fleet", DisplayName = "Fleet" },
        new() { Id = "telemetry", Name = "telemetry", DisplayName = "Telemetry" },
        new() { Id = "equipment", Name = "equipment", DisplayName = "Equipment" },
    ];

    // ─── IArmApiService ──────────────────────────────────────────────────────

    public Task<PagedResult<ApiContract>> ListApisAsync(int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        var items = MockApis.AsEnumerable();
        if (skip.HasValue) items = items.Skip(skip.Value);
        if (top.HasValue) items = items.Take(top.Value);
        var list = items.ToList();

        _logger.LogDebug("Mock: returning {Count} APIs (top={Top}, skip={Skip})", list.Count, top, skip);
        return Task.FromResult(new PagedResult<ApiContract> { Value = list, Count = MockApis.Length });
    }

    public Task<ApiContract?> GetApiAsync(string apiId, string? revision = null, CancellationToken ct = default)
    {
        var api = MockApis.FirstOrDefault(a => a.Id == apiId);
        _logger.LogDebug("Mock: GetApi({ApiId}) → {Found}", apiId, api is not null);
        return Task.FromResult(api);
    }

    public Task<PagedResult<OperationContract>> ListOperationsAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default)
    {
        var ops = MockOperations.GetValueOrDefault(apiId, []);
        return Task.FromResult(new PagedResult<OperationContract> { Value = ops, Count = ops.Length });
    }

    public Task<OperationContract?> GetOperationAsync(string apiId, string operationId, CancellationToken ct = default)
    {
        var ops = MockOperations.GetValueOrDefault(apiId, []);
        var op = ops.FirstOrDefault(o => o.Id == operationId);
        return Task.FromResult(op);
    }

    public Task<PagedResult<ProductContract>> ListProductsForApiAsync(string apiId, CancellationToken ct = default)
    {
        return Task.FromResult(new PagedResult<ProductContract> { Value = MockProducts });
    }

    public Task<PagedResult<ProductContract>> ListProductsForApiPageAsync(string apiId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        IEnumerable<ProductContract> items = MockProducts;
        if (skip.HasValue) items = items.Skip(skip.Value);
        if (top.HasValue) items = items.Take(top.Value);
        var list = items.ToList();
        return Task.FromResult(new PagedResult<ProductContract> { Value = list, Count = MockProducts.Length });
    }

    public Task<PagedResult<TagGroup<ApiContract>>> GetApisByTagsAsync(int? top = null, int? skip = null, string[]? tags = null, string? pattern = null, CancellationToken ct = default)
    {
        var groups = MockApis
            .SelectMany(api => (api.Tags ?? []).Select(tag => (Tag: tag, Api: api)))
            .GroupBy(x => x.Tag)
            .Select(g => new TagGroup<ApiContract> { Tag = g.Key, Items = g.Select(x => x.Api).ToList() })
            .ToList();
        return Task.FromResult(new PagedResult<TagGroup<ApiContract>> { Value = groups, Count = groups.Count });
    }

    public Task<PagedResult<TagGroup<OperationContract>>> GetOperationsByTagsAsync(string apiId, int? top = null, int? skip = null, string[]? tags = null, string? pattern = null, CancellationToken ct = default)
    {
        var ops = MockOperations.GetValueOrDefault(apiId, []);
        var group = new TagGroup<OperationContract> { Tag = "Untagged", Items = ops };
        return Task.FromResult(new PagedResult<TagGroup<OperationContract>> { Value = [group], Count = 1 });
    }

    public Task<IReadOnlyList<TagContract>> GetOperationTagsAsync(string apiId, string operationId, CancellationToken ct = default)
    {
        return Task.FromResult<IReadOnlyList<TagContract>>([]);
    }

    public Task<VersionSetContract?> GetApiVersionSetAsync(string versionSetId, CancellationToken ct = default)
    {
        return Task.FromResult<VersionSetContract?>(new VersionSetContract
        {
            Id = versionSetId,
            Name = $"Mock Version Set {versionSetId}",
            VersioningScheme = "Segment",
        });
    }

    public Task<IReadOnlyList<ApiContract>> GetApisInVersionSetAsync(string versionSetId, CancellationToken ct = default)
    {
        return Task.FromResult<IReadOnlyList<ApiContract>>([]);
    }

    public Task<PagedResult<SchemaContract>> GetApiSchemasAsync(string apiId, CancellationToken ct = default)
    {
        return Task.FromResult(new PagedResult<SchemaContract> { Value = [], Count = 0 });
    }

    public Task<PagedResult<ChangeLogContract>> GetApiChangeLogAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default)
    {
        return Task.FromResult(new PagedResult<ChangeLogContract> { Value = [], Count = 0 });
    }

    public Task<IReadOnlyList<string>> GetApiHostnamesAsync(string apiId, CancellationToken ct = default)
    {
        return Task.FromResult<IReadOnlyList<string>>(["api.mock.example.com"]);
    }

    public Task<PagedResult<ApiContract>> GetProductApisAsync(string productId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default)
    {
        return Task.FromResult(new PagedResult<ApiContract> { Value = MockApis, Count = MockApis.Length });
    }

    public Task<PagedResult<TagContract>> ListTagsAsync(string? scope = null, string? filter = null, CancellationToken ct = default)
    {
        _logger.LogDebug("Mock: returning {Count} tags", MockTags.Length);
        return Task.FromResult(new PagedResult<TagContract> { Value = MockTags, Count = MockTags.Length });
    }

    public Task<PagedResult<ProductContract>> ListProductsAsync(int? top = null, int? skip = null, CancellationToken ct = default)
    {
        return Task.FromResult(new PagedResult<ProductContract> { Value = MockProducts, Count = MockProducts.Length });
    }

    public Task<ProductContract?> GetProductAsync(string productId, CancellationToken ct = default)
    {
        var product = MockProducts.FirstOrDefault(p => p.Id == productId);
        return Task.FromResult(product);
    }

    public Task<PagedResult<SubscriptionContract>> ListSubscriptionsAsync(int? top = null, int? skip = null, CancellationToken ct = default)
    {
        return Task.FromResult(new PagedResult<SubscriptionContract> { Value = MockSubscriptions, Count = MockSubscriptions.Length });
    }

    public Task<SubscriptionContract?> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
    {
        var sub = MockSubscriptions.FirstOrDefault(s => s.Id == subscriptionId);
        return Task.FromResult(sub);
    }

    public Task<SubscriptionContract?> CreateSubscriptionAsync(CreateSubscriptionRequest request, CancellationToken ct = default)
    {
        var sub = new SubscriptionContract
        {
            Id = $"sub-mock-{Guid.NewGuid():N}"[..20],
            Name = request.DisplayName,
            DisplayName = request.DisplayName,
            Scope = request.Scope,
            State = "submitted",
        };
        _logger.LogDebug("Mock: Created subscription {Id}", sub.Id);
        return Task.FromResult<SubscriptionContract?>(sub);
    }

    public Task<SubscriptionContract?> UpdateSubscriptionAsync(string subscriptionId, object patchBody, CancellationToken ct = default)
    {
        var existing = MockSubscriptions.FirstOrDefault(s => s.Id == subscriptionId);
        if (existing is null) return Task.FromResult<SubscriptionContract?>(null);

        _logger.LogDebug("Mock: Updated subscription {Id}", subscriptionId);
        return Task.FromResult<SubscriptionContract?>(existing);
    }

    public Task<bool> DeleteSubscriptionAsync(string subscriptionId, CancellationToken ct = default)
    {
        _logger.LogDebug("Mock: Deleted subscription {Id}", subscriptionId);
        return Task.FromResult(true);
    }

    public Task<SubscriptionContract?> ListSubscriptionSecretsAsync(string subscriptionId, CancellationToken ct = default)
    {
        var sub = MockSubscriptions.FirstOrDefault(s => s.Id == subscriptionId);
        if (sub is null) return Task.FromResult<SubscriptionContract?>(null);

        return Task.FromResult<SubscriptionContract?>(new SubscriptionContract
        {
            Id = sub.Id,
            Name = sub.Name,
            PrimaryKey = $"mock-primary-key-{sub.Id}",
            SecondaryKey = $"mock-secondary-key-{sub.Id}",
        });
    }

    public Task<SubscriptionContract?> RegeneratePrimaryKeyAsync(string subscriptionId, CancellationToken ct = default)
    {
        var sub = MockSubscriptions.FirstOrDefault(s => s.Id == subscriptionId);
        if (sub is null) return Task.FromResult<SubscriptionContract?>(null);
        _logger.LogDebug("Mock: Regenerated primary key for {Id}", subscriptionId);
        return Task.FromResult<SubscriptionContract?>(sub);
    }

    public Task<SubscriptionContract?> RegenerateSecondaryKeyAsync(string subscriptionId, CancellationToken ct = default)
    {
        var sub = MockSubscriptions.FirstOrDefault(s => s.Id == subscriptionId);
        if (sub is null) return Task.FromResult<SubscriptionContract?>(null);
        _logger.LogDebug("Mock: Regenerated secondary key for {Id}", subscriptionId);
        return Task.FromResult<SubscriptionContract?>(sub);
    }

    public Task<PlatformStats> GetStatsAsync(CancellationToken ct = default)
    {
        return Task.FromResult(new PlatformStats
        {
            AvailableApis = MockApis.Length,
            Products = MockProducts.Length,
            Subscriptions = MockSubscriptions.Length,
            Users = 3
        });
    }

    public Task<JsonElement?> ExportOpenApiSpecAsync(string apiId, string format = "swagger-link", CancellationToken ct = default)
    {
        _logger.LogDebug("Mock: ExportOpenApiSpec for {ApiId} not available in mock mode", apiId);
        return Task.FromResult<JsonElement?>(null);
    }
}
