// ---------------------------------------------------------------------------
// UnifiedApiService — Aggregates cloud (APIM) and legacy APIs.
//
// Provides a single interface for the portal to query both cloud and legacy APIs.
// Routes requests to the appropriate service based on API ID prefix.
//
// Features:
//   ✅ Parallel fetch from both sources (cloud + legacy)
//   ✅ Smart routing based on API source
//   ✅ Combined caching strategy
//   ✅ Transparent protocol handling
//
// See LEGACY_API_INTEGRATION.md §2 for architecture
// ---------------------------------------------------------------------------

using Komatsu.ApimMarketplace.Bff.Models;
using Komatsu.ApimMarketplace.Bff.Services.Legacy;
using Microsoft.Extensions.Caching.Memory;

namespace Komatsu.ApimMarketplace.Bff.Services;

/// <summary>
/// Unified service that aggregates cloud APIM and legacy APIs.
/// </summary>
public interface IUnifiedApiService
{
    /// <summary>
    /// Get all APIs from both cloud and legacy sources.
    /// </summary>
    Task<List<ApiDetail>> GetAllApisAsync();

    /// <summary>
    /// Get specific API (cloud or legacy) by ID.
    /// </summary>
    Task<ApiDetail?> GetApiAsync(string apiId);

    /// <summary>
    /// Execute operation on a legacy API.
    /// For cloud APIs, use the existing APIM endpoints directly.
    /// </summary>
    Task<ApiResponse> ExecuteLegacyOperationAsync(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        LegacyAuthToken? authToken = null);
}

/// <summary>
/// Implementation of unified API service.
/// </summary>
public class UnifiedApiService(
    IArmApiService cloudApi,
    ILegacyApiService legacyApi,
    IMemoryCache cache,
    ILogger<UnifiedApiService> logger) : IUnifiedApiService
{
    private const string CloudApisCacheKey = "unified:cloud-apis";
    private const string LegacyApisCacheKey = "unified:legacy-apis";
    private const int CacheTTLMinutes = 60;

    public async Task<List<ApiDetail>> GetAllApisAsync()
    {
        logger.LogInformation("Fetching all APIs (cloud + legacy)");

        // Fetch from both sources in parallel
        var cloudTask = GetCloudApisAsync();
        var legacyTask = GetLegacyApisAsync();

        await Task.WhenAll(cloudTask, legacyTask);

        var cloudApis = await cloudTask;
        var legacyApis = await legacyTask;

        // Merge results
        var all = cloudApis.Concat(legacyApis)
            .OrderBy(a => a.Name)
            .ToList();

        logger.LogInformation(
            "Found {CloudCount} cloud APIs and {LegacyCount} legacy APIs",
            cloudApis.Count, legacyApis.Count);

        return all;
    }

    public async Task<ApiDetail?> GetApiAsync(string apiId)
    {
        var all = await GetAllApisAsync();
        return all.FirstOrDefault(a => a.Id == apiId);
    }

    public async Task<ApiResponse> ExecuteLegacyOperationAsync(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        LegacyAuthToken? authToken = null)
    {
        logger.LogInformation(
            "Executing legacy operation: {ApiId}/{OperationId}",
            apiId, operationId);

        // Route to legacy API service
        if (!apiId.StartsWith("legacy-"))
        {
            throw new InvalidOperationException(
                $"API {apiId} is not a legacy API. Use cloud APIM endpoints for cloud APIs.");
        }

        return await legacyApi.ExecuteOperationAsync(apiId, operationId, request, authToken);
    }

    /// <summary>
    /// Helper: Get cloud APIs with caching.
    /// </summary>
    private async Task<List<ApiDetail>> GetCloudApisAsync()
    {
        if (cache.TryGetValue(CloudApisCacheKey, out List<ApiDetail>? cachedApis))
        {
            logger.LogDebug("Returning cached cloud APIs");
            return cachedApis ?? [];
        }

        try
        {
            // Convert APIM contracts to unified ApiDetail format
            var apimApis = await cloudApi.ListApisAsync(null, null, null, CancellationToken.None);
            var apis = apimApis.Value
                .Select(a => new ApiDetail
                {
                    Id = a.Id,
                    Name = a.Name,
                    Description = a.Description ?? "",
                    Source = "cloud",
                    Protocol = "REST",
                    Authentication = "OAuth2",
                    SpecUrl = $"/api/apis/{a.Id}/openapi"
                    // Operations would be fetched separately if needed
                })
                .ToList();

            cache.Set(CloudApisCacheKey, apis,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheTTLMinutes)
                });

            return apis;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching cloud APIs");
            return [];
        }
    }

    /// <summary>
    /// Helper: Get legacy APIs with caching.
    /// </summary>
    private async Task<List<ApiDetail>> GetLegacyApisAsync()
    {
        if (cache.TryGetValue(LegacyApisCacheKey, out List<ApiDetail>? cachedApis))
        {
            logger.LogDebug("Returning cached legacy APIs");
            return cachedApis ?? [];
        }

        try
        {
            var apis = await legacyApi.GetApisAsync();

            cache.Set(LegacyApisCacheKey, apis,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheTTLMinutes)
                });

            return apis;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching legacy APIs");
            return [];
        }
    }
}
