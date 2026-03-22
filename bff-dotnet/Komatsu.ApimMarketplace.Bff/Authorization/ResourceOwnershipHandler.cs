// ---------------------------------------------------------------------------
// ResourceOwnershipHandler.cs — Authorization handler for resource ownership.
//
// Checks if the authenticated user owns a specific resource (e.g., subscription)
// before allowing modifications.
//
// Usage:
//   [Authorize(Policy = "SubscriptionOwner")]
//   app.MapPut("/api/subscriptions/{subId}", UpdateSubscription);
//
// Pattern:
//   1. Extract resource owner ID from database or claims
//   2. Compare with current user ID from JWT
//   3. Allow only if user ID == resource owner ID
// ---------------------------------------------------------------------------

using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Komatsu.ApimMarketplace.Bff.Authorization;

/// <summary>
/// Requirement that checks if the current user owns a specific resource.
/// </summary>
public record ResourceOwnershipRequirement(string ResourceType) : IAuthorizationRequirement;

/// <summary>
/// Handler that verifies resource ownership before allowing modifications.
/// </summary>
public sealed class ResourceOwnershipHandler(
    ILogger<ResourceOwnershipHandler> logger)
    : AuthorizationHandler<ResourceOwnershipRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ResourceOwnershipRequirement requirement)
    {
        var httpContext = context.Resource as HttpContext;
        if (httpContext == null)
        {
            logger.LogWarning("ResourceOwnershipHandler: No HttpContext available");
            return Task.CompletedTask;
        }

        // Extract current user ID from JWT claims (oid preferred, fall back to sub)
        var currentUserId = context.User.FindFirstValue("oid") 
                            ?? context.User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(currentUserId))
        {
            logger.LogWarning("ResourceOwnershipHandler: No user ID in claims");
            return Task.CompletedTask;
        }

        // Extract resource owner ID from HttpContext.Items
        // This should be populated by the endpoint before authorization runs
        if (!httpContext.Items.TryGetValue($"{requirement.ResourceType}:OwnerId", out var ownerObj))
        {
            logger.LogWarning(
                "ResourceOwnershipHandler: No owner ID found in context for {ResourceType}",
                requirement.ResourceType);
            return Task.CompletedTask;
        }

        var resourceOwnerId = ownerObj?.ToString();
        if (string.IsNullOrEmpty(resourceOwnerId))
        {
            logger.LogWarning(
                "ResourceOwnershipHandler: Owner ID is empty for {ResourceType}",
                requirement.ResourceType);
            return Task.CompletedTask;
        }

        if (currentUserId == resourceOwnerId)
        {
            logger.LogDebug(
                "ResourceOwnershipHandler: Access granted — {UserId} owns {ResourceType}",
                currentUserId, requirement.ResourceType);
            context.Succeed(requirement);
        }
        else
        {
            logger.LogWarning(
                "ResourceOwnershipHandler: Access denied — {UserId} does not own {ResourceType} (owner: {Owner})",
                currentUserId, requirement.ResourceType, resourceOwnerId);
        }

        return Task.CompletedTask;
    }
}

/// <summary>
/// Helper to set resource owner ID in HttpContext for authorization check.
/// Usage in endpoint:
///   app.MapPut("/api/subscriptions/{subId}", (string subId, HttpContext http) =>
///   {
///       var subscription = GetSubscription(subId);
///       http.Items["subscription:OwnerId"] = subscription.CreatedBy;
///       return UpdateSubscription(subId);
///   });
/// </summary>
public static class ResourceOwnershipExtensions
{
    public static void SetResourceOwner(this HttpContext context, string resourceType, string ownerId)
    {
        context.Items[$"{resourceType}:OwnerId"] = ownerId;
    }

    public static string? GetResourceOwner(this HttpContext context, string resourceType)
    {
        return context.Items.TryGetValue($"{resourceType}:OwnerId", out var owner)
            ? owner?.ToString()
            : null;
    }
}
