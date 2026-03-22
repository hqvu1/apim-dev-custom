using System.Text.Json;
using Komatsu.ApimMarketplace.Bff.Models;

namespace Komatsu.ApimMarketplace.Bff.Services;

public interface IArmApiService
{
    // APIs
    Task<PagedResult<ApiContract>> ListApisAsync(int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default);
    Task<ApiContract?> GetApiAsync(string apiId, string? revision = null, CancellationToken ct = default);
    Task<PagedResult<OperationContract>> ListOperationsAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default);
    Task<OperationContract?> GetOperationAsync(string apiId, string operationId, CancellationToken ct = default);
    Task<PagedResult<ProductContract>> ListProductsForApiAsync(string apiId, CancellationToken ct = default);
    Task<PagedResult<ProductContract>> ListProductsForApiPageAsync(string apiId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default);
    Task<JsonElement?> ExportOpenApiSpecAsync(string apiId, string format = "swagger-link", CancellationToken ct = default);

    // APIs — tag grouping (from apiService.ts: getApisByTags, getOperationsByTags)
    Task<PagedResult<TagGroup<ApiContract>>> GetApisByTagsAsync(int? top = null, int? skip = null, string[]? tags = null, string? pattern = null, CancellationToken ct = default);
    Task<PagedResult<TagGroup<OperationContract>>> GetOperationsByTagsAsync(string apiId, int? top = null, int? skip = null, string[]? tags = null, string? pattern = null, CancellationToken ct = default);
    Task<IReadOnlyList<TagContract>> GetOperationTagsAsync(string apiId, string operationId, CancellationToken ct = default);

    // APIs — version sets (from apiService.ts: getApiVersionSet, getApisInVersionSet)
    Task<VersionSetContract?> GetApiVersionSetAsync(string versionSetId, CancellationToken ct = default);
    Task<IReadOnlyList<ApiContract>> GetApisInVersionSetAsync(string versionSetId, CancellationToken ct = default);

    // APIs — schema & changelog (from apiService.ts: getApiSchema, getApiChangeLog)
    Task<PagedResult<SchemaContract>> GetApiSchemasAsync(string apiId, CancellationToken ct = default);
    Task<PagedResult<ChangeLogContract>> GetApiChangeLogAsync(string apiId, int? top = null, int? skip = null, CancellationToken ct = default);

    // APIs — hostnames (from apiService.ts: getApiHostnames)
    Task<IReadOnlyList<string>> GetApiHostnamesAsync(string apiId, CancellationToken ct = default);

    // APIs — product APIs (from apiService.ts: getProductApis)
    Task<PagedResult<ApiContract>> GetProductApisAsync(string productId, int? top = null, int? skip = null, string? filter = null, CancellationToken ct = default);

    // Tags
    Task<PagedResult<TagContract>> ListTagsAsync(string? scope = null, string? filter = null, CancellationToken ct = default);

    // Products
    Task<PagedResult<ProductContract>> ListProductsAsync(int? top = null, int? skip = null, CancellationToken ct = default);
    Task<ProductContract?> GetProductAsync(string productId, CancellationToken ct = default);

    // Subscriptions
    Task<PagedResult<SubscriptionContract>> ListSubscriptionsAsync(int? top = null, int? skip = null, CancellationToken ct = default);
    Task<SubscriptionContract?> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default);
    Task<SubscriptionContract?> CreateSubscriptionAsync(CreateSubscriptionRequest request, CancellationToken ct = default);
    Task<SubscriptionContract?> UpdateSubscriptionAsync(string subscriptionId, object patchBody, CancellationToken ct = default);
    Task<bool> DeleteSubscriptionAsync(string subscriptionId, CancellationToken ct = default);
    Task<SubscriptionContract?> ListSubscriptionSecretsAsync(string subscriptionId, CancellationToken ct = default);
    Task<SubscriptionContract?> RegeneratePrimaryKeyAsync(string subscriptionId, CancellationToken ct = default);
    Task<SubscriptionContract?> RegenerateSecondaryKeyAsync(string subscriptionId, CancellationToken ct = default);

    // Stats
    Task<PlatformStats> GetStatsAsync(CancellationToken ct = default);
}
