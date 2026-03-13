// ---------------------------------------------------------------------------
// IClaimsEnricher.cs — Interface for augmenting JWT claims with derived roles
// and permissions from Global Admin API.
//
// Implementation:
//   ClaimsEnricher → Calls IRoleProvider → Caches enriched claims in HttpContext.Items
//
// Usage:
//   Called from ClaimsEnrichmentMiddleware to add business roles and permission
//   claims to the user identity before routing to policy evaluation.
// ---------------------------------------------------------------------------

using System.Security.Claims;
using BffApi.Services;

namespace BffApi.Authorization;

/// <summary>
/// Augments JWT claims with derived business roles and permissions.
/// </summary>
public interface IClaimsEnricher
{
    /// <summary>
    /// Enrich claims from the JWT token with business roles and permissions.
    /// Results should be cached at the request level.
    /// </summary>
    /// <param name="user">User principal from the JWT token</param>
    /// <returns>List of additional claims to add to the user identity</returns>
    Task<IReadOnlyCollection<Claim>> EnrichClaimsAsync(ClaimsPrincipal user);
}

/// <summary>
/// Default implementation of IClaimsEnricher.
/// Fetches roles from Global Admin API and derives permission claims.
/// </summary>
public sealed class ClaimsEnricher(
    IRoleProvider roleProvider,
    IRbacPolicyProvider policyProvider,
    ILogger<ClaimsEnricher> logger) : IClaimsEnricher
{
    public async Task<IReadOnlyCollection<Claim>> EnrichClaimsAsync(ClaimsPrincipal user)
    {
        var enrichedClaims = new List<Claim>();

        // Extract user ID from JWT claims (oid preferred, fall back to sub)
        var userId = user.FindFirstValue("oid") ?? user.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            logger.LogWarning("Cannot enrich claims: no user ID (oid/sub) found in token");
            return enrichedClaims;
        }

        try
        {
            // Fetch roles from Global Admin API (cached)
            var roles = await roleProvider.GetUserRolesAsync(userId);
            logger.LogDebug("Enriched user {UserId} with roles: {Roles}",
                userId, string.Join(",", roles));

            // Add role claims
            foreach (var role in roles)
            {
                enrichedClaims.Add(new Claim("roles", role));
            }

            // Add derived permission claims based on roles
            // This allows policies to check claims directly without calling RoleProvider again
            if (policyProvider.HasGeneralPermission(roles, Permission.Read))
            {
                enrichedClaims.Add(new Claim("permissions", Permission.Read.ToString()));
            }
            if (policyProvider.HasGeneralPermission(roles, Permission.TryIt))
            {
                enrichedClaims.Add(new Claim("permissions", Permission.TryIt.ToString()));
            }
            if (policyProvider.HasGeneralPermission(roles, Permission.Subscribe))
            {
                enrichedClaims.Add(new Claim("permissions", Permission.Subscribe.ToString()));
            }
            if (policyProvider.HasGeneralPermission(roles, Permission.Manage))
            {
                enrichedClaims.Add(new Claim("permissions", Permission.Manage.ToString()));
            }

            return enrichedClaims;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to enrich claims for user {UserId}", userId);
            throw;
        }
    }
}
