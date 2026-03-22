// ---------------------------------------------------------------------------
// LegacySubscriptionService — Manages subscriptions to legacy APIs.
//
// Handles subscription lifecycle for legacy APIs:
//   • Create subscriptions (calls legacy API)
//   • Retrieve credentials (in legacy format)
//   • Revoke subscriptions
//   • Track user subscriptions
//
// Features:
//   ✅ Legacy API call for subscription creation
//   ✅ Credential extraction and caching
//   ✅ Subscription revocation
//   ✅ Error handling and logging
//
// Note: Subscriptions are cached in memory for this phase.
// Production should use a persistent database or Redis.
// ---------------------------------------------------------------------------

using Komatsu.ApimMarketplace.Bff.Models;
using Microsoft.Extensions.Caching.Memory;

namespace Komatsu.ApimMarketplace.Bff.Services.Legacy;

/// <summary>
/// Interface for managing legacy API subscriptions.
/// </summary>
public interface ILegacySubscriptionService
{
    /// <summary>
    /// Create a new subscription to a legacy API.
    /// </summary>
    Task<LegacySubscription> CreateSubscriptionAsync(
        string apiId,
        string userId,
        string plan);

    /// <summary>
    /// Get all active subscriptions for a user.
    /// </summary>
    Task<List<LegacySubscription>> GetUserSubscriptionsAsync(string userId);

    /// <summary>
    /// Get a specific subscription by ID.
    /// </summary>
    Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId);

    /// <summary>
    /// Revoke a subscription and cleanup credentials.
    /// </summary>
    Task RevokeSubscriptionAsync(string subscriptionId);
}

/// <summary>
/// Implementation of legacy subscription management.
/// </summary>
public class LegacySubscriptionService(
    ILegacyApiService legacyApi,
    IMemoryCache cache,
    ILogger<LegacySubscriptionService> logger) : ILegacySubscriptionService
{
    private const string SubscriptionCacheKeyPrefix = "legacy-subscription:";
    private const string UserSubscriptionsCacheKeyPrefix = "legacy-user-subscriptions:";

    public async Task<LegacySubscription> CreateSubscriptionAsync(
        string apiId,
        string userId,
        string plan)
    {
        logger.LogInformation(
            "Creating subscription to legacy API {ApiId} for user {UserId} with plan {Plan}",
            apiId, userId, plan);

        try
        {
            // Call legacy API to create subscription
            var request = new ExecuteApiRequest
            {
                Payload = new
                {
                    userId = userId,
                    apiId = apiId.Replace("legacy-soap-", ""),
                    plan = plan
                }
            };

            var response = await legacyApi.ExecuteOperationAsync(
                apiId,
                "CreateSubscription",
                request);

            if (response.StatusCode != 200)
            {
                logger.LogError(
                    "Legacy subscription creation failed: {Status} | {Body}",
                    response.StatusCode, response.Body);
                throw new InvalidOperationException(
                    $"Legacy subscription creation failed with status {response.StatusCode}");
            }

            // Extract credentials from response
            var credentials = ExtractCredentialsFromResponse(response.Body);

            // Create subscription record
            var subscription = new LegacySubscription
            {
                Id = Guid.NewGuid().ToString(),
                ApiId = apiId,
                UserId = userId,
                Plan = plan,
                CreatedAt = DateTime.UtcNow,
                Credentials = credentials
            };

            // Cache subscription
            var cacheKey = $"{SubscriptionCacheKeyPrefix}{subscription.Id}";
            cache.Set(cacheKey, subscription,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
                });

            // Invalidate user subscriptions cache
            cache.Remove($"{UserSubscriptionsCacheKeyPrefix}{userId}");

            logger.LogInformation(
                "Successfully created legacy subscription {SubscriptionId} for user {UserId}",
                subscription.Id, userId);

            return subscription;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating legacy subscription");
            throw;
        }
    }

    public async Task<List<LegacySubscription>> GetUserSubscriptionsAsync(string userId)
    {
        logger.LogInformation("Fetching legacy subscriptions for user {UserId}", userId);

        // Check cache first
        var cacheKey = $"{UserSubscriptionsCacheKeyPrefix}{userId}";
        if (cache.TryGetValue(cacheKey, out List<LegacySubscription>? cachedSubs))
        {
            logger.LogDebug("Returning cached subscriptions for {UserId}", userId);
            return cachedSubs ?? [];
        }

        try
        {
            // Query legacy API for user's subscriptions
            var request = new ExecuteApiRequest
            {
                Payload = new { userId = userId }
            };

            // Note: This assumes legacy API has a GetUserSubscriptions operation
            // Adjust operation name based on actual legacy API
            var response = await legacyApi.ExecuteOperationAsync(
                "legacy-soap", // placeholder
                "GetUserSubscriptions",
                request);

            var subscriptions = new List<LegacySubscription>();

            if (response.StatusCode == 200 && response.Body is not null)
            {
                // Parse response and convert to LegacySubscription list
                // Implementation depends on actual legacy API response format
                subscriptions = ParseSubscriptionsFromResponse(response.Body, userId);
            }

            // Cache the result
            cache.Set(cacheKey, subscriptions,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
                });

            return subscriptions;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching legacy subscriptions for {UserId}", userId);
            return [];
        }
    }

    public async Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId)
    {
        var cacheKey = $"{SubscriptionCacheKeyPrefix}{subscriptionId}";

        if (cache.TryGetValue(cacheKey, out LegacySubscription? cached))
        {
            logger.LogDebug("Found cached subscription {SubscriptionId}", subscriptionId);
            return cached;
        }

        logger.LogInformation("Subscription {SubscriptionId} not found in cache", subscriptionId);
        return null;
    }

    public async Task RevokeSubscriptionAsync(string subscriptionId)
    {
        logger.LogInformation("Revoking legacy subscription: {SubscriptionId}", subscriptionId);

        try
        {
            var subscription = await GetSubscriptionAsync(subscriptionId);
            if (subscription is null)
            {
                logger.LogError("Subscription not found: {SubscriptionId}", subscriptionId);
                throw new InvalidOperationException($"Subscription not found: {subscriptionId}");
            }

            // Call legacy API to revoke
            var request = new ExecuteApiRequest
            {
                Payload = new { subscriptionId = subscriptionId }
            };

            var response = await legacyApi.ExecuteOperationAsync(
                subscription.ApiId,
                "RevokeSubscription",
                request);

            if (response.StatusCode != 200)
            {
                logger.LogError(
                    "Legacy subscription revocation failed: {Status}",
                    response.StatusCode);
                throw new InvalidOperationException(
                    $"Legacy subscription revocation failed with status {response.StatusCode}");
            }

            // Clear cache
            cache.Remove($"{SubscriptionCacheKeyPrefix}{subscriptionId}");
            cache.Remove($"{UserSubscriptionsCacheKeyPrefix}{subscription.UserId}");

            logger.LogInformation(
                "Successfully revoked legacy subscription {SubscriptionId}",
                subscriptionId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error revoking legacy subscription");
            throw;
        }
    }

    /// <summary>
    /// Extract credentials from legacy API subscription response.
    /// </summary>
    private LegacyCredentials ExtractCredentialsFromResponse(object? body)
    {
        try
        {
            if (body is null)
            {
                return new LegacyCredentials { ExpiryDate = DateTime.UtcNow.AddYears(1) };
            }

            // If response is a JsonElement (from System.Text.Json)
            if (body is System.Text.Json.JsonElement json)
            {
                return new LegacyCredentials
                {
                    ApiKey = GetJsonProperty(json, "apiKey"),
                    SessionToken = GetJsonProperty(json, "sessionToken"),
                    Certificate = GetJsonProperty(json, "certificate"),
                    CustomToken = GetJsonProperty(json, "customToken"),
                    ExpiryDate = DateTime.UtcNow.AddYears(1)
                };
            }

            // If response is already a dictionary
            if (body is Dictionary<string, object> dict)
            {
                return new LegacyCredentials
                {
                    ApiKey = dict.TryGetValue("apiKey", out var ak) ? ak?.ToString() : null,
                    SessionToken = dict.TryGetValue("sessionToken", out var st) ? st?.ToString() : null,
                    Certificate = dict.TryGetValue("certificate", out var cert) ? cert?.ToString() : null,
                    CustomToken = dict.TryGetValue("customToken", out var ct) ? ct?.ToString() : null,
                    ExpiryDate = DateTime.UtcNow.AddYears(1)
                };
            }

            logger.LogWarning("Unknown response type for credential extraction: {Type}", body.GetType().Name);
            return new LegacyCredentials { ExpiryDate = DateTime.UtcNow.AddYears(1) };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error extracting credentials from response");
            return new LegacyCredentials { ExpiryDate = DateTime.UtcNow.AddYears(1) };
        }
    }

    /// <summary>
    /// Parse subscriptions from legacy API response.
    /// </summary>
    private List<LegacySubscription> ParseSubscriptionsFromResponse(object body, string userId)
    {
        // This is a placeholder implementation.
        // Adjust based on actual legacy API response format.
        return [];
    }

    /// <summary>
    /// Helper to safely get property from JsonElement.
    /// </summary>
    private static string? GetJsonProperty(System.Text.Json.JsonElement json, string propertyName)
    {
        if (json.TryGetProperty(propertyName, out var value))
        {
            return value.GetString();
        }
        return null;
    }
}
