// ---------------------------------------------------------------------------
// RoleDefinition.cs — Models for role hierarchy, permissions, and resource scoping.
//
// Enables:
//   • Role inheritance (role A extends role B)
//   • Permission composition (multiple permissions per role)
//   • Resource-level constraints (which APIs, products, subscriptions)
//   • Hot-reload from rbac-config.json
// ---------------------------------------------------------------------------

namespace Komatsu.ApimMarketplace.Bff.Authorization;

/// <summary>
/// Represents a single role with its permissions and resource scopes.
/// </summary>
public record RoleDefinition
{
    /// <summary>Unique role identifier (e.g., "Admin", "Distributor", "BasicUser")</summary>
    public required string Name { get; init; }

    /// <summary>Human-readable description of the role</summary>
    public string Description { get; init; } = string.Empty;

    /// <summary>Parent roles from which this role inherits permissions</summary>
    public List<string> InheritsFrom { get; init; } = new();

    /// <summary>Direct permissions granted to this role (Read, TryIt, Subscribe, Manage)</summary>
    public List<string> Permissions { get; init; } = new();

    /// <summary>
    /// Resource-level constraints.
    /// Key: "APIs", "Products", "Subscriptions"
    /// Value: List of resource IDs the role can access (empty = global access)
    /// </summary>
    public Dictionary<string, List<string>> ResourceScopes { get; init; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Check if this role has a specific permission (including inherited permissions).
    /// </summary>
    public bool HasPermission(string permission, Dictionary<string, RoleDefinition> allRoles)
    {
        // Direct permission check
        if (Permissions.Contains(permission, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        // Check inherited permissions recursively
        foreach (var parentName in InheritsFrom)
        {
            if (allRoles.TryGetValue(parentName, out var parentRole))
            {
                if (parentRole.HasPermission(permission, allRoles))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Check if this role can access a specific resource.
    /// </summary>
    public bool CanAccessResource(string resourceType, string resourceId, Dictionary<string, RoleDefinition> allRoles)
    {
        // Check direct scopes
        if (CanAccessResourceDirect(resourceType, resourceId))
        {
            return true;
        }

        // Check inherited scopes recursively
        foreach (var parentName in InheritsFrom)
        {
            if (allRoles.TryGetValue(parentName, out var parentRole))
            {
                if (parentRole.CanAccessResource(resourceType, resourceId, allRoles))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Check if this role directly (non-inherited) can access a resource.
    /// </summary>
    private bool CanAccessResourceDirect(string resourceType, string resourceId)
    {
        // If no scopes defined for this resource type, access is global
        if (!ResourceScopes.TryGetValue(resourceType, out var allowedResources))
        {
            return true;
        }

        // If scope list is empty, access is global
        if (allowedResources.Count == 0)
        {
            return true;
        }

        // Check if resource is in the allowed list
        return allowedResources.Contains(resourceId, StringComparer.OrdinalIgnoreCase);
    }
}

/// <summary>
/// Permission level with metadata.
/// </summary>
public record PermissionDefinition
{
    public required string Name { get; init; }
    public string Description { get; init; } = string.Empty;
    public string SeverityLevel { get; init; } = "Normal"; // Low, Normal, High, Critical
}

/// <summary>
/// Policy definition — maps to an ASP.NET Core [Authorize(Policy = "...")] attribute.
/// </summary>
public record PolicyDefinition
{
    public required string Name { get; init; }
    public string Description { get; init; } = string.Empty;
    public required string RequiredPermission { get; init; }
    public List<string> ApplicableRoles { get; init; } = new();
}

/// <summary>
/// Root RBAC configuration (loaded from rbac-config.json).
/// </summary>
public class RbacConfig
{
    public const string SectionName = "Rbac";

    /// <summary>All role definitions</summary>
    public Dictionary<string, RoleDefinition> Roles { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>All policy definitions</summary>
    public Dictionary<string, PolicyDefinition> Policies { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Caching configuration</summary>
    public CachingConfig Caching { get; set; } = new();

    /// <summary>Feature flags for RBAC behavior</summary>
    public FeatureFlags Features { get; set; } = new();
}

/// <summary>
/// Caching configuration for RBAC operations.
/// </summary>
public class CachingConfig
{
    /// <summary>Duration to cache user roles from Global Admin API (default: 30 min)</summary>
    public int RoleCacheDurationMinutes { get; set; } = 30;

    /// <summary>Duration to cache policy definitions (default: 60 min)</summary>
    public int PolicyCacheDurationMinutes { get; set; } = 60;

    /// <summary>Duration to cache authorization decisions (default: 5 min)</summary>
    public int DecisionCacheDurationMinutes { get; set; } = 5;

    /// <summary>Enable sliding expiration for role cache (extend TTL on access)</summary>
    public bool EnableSlidingExpiration { get; set; } = true;

    /// <summary>Sliding expiration window (default: 5 min)</summary>
    public int SlidingExpirationMinutes { get; set; } = 5;
}

/// <summary>
/// RBAC feature flags.
/// </summary>
public class FeatureFlags
{
    /// <summary>Enable role hierarchy (inheritance)</summary>
    public bool EnableRoleInheritance { get; set; } = true;

    /// <summary>Enable resource-level access control</summary>
    public bool EnableResourceScoping { get; set; } = true;

    /// <summary>Enable audit logging of authorization decisions</summary>
    public bool EnableAuditLogging { get; set; } = true;

    /// <summary>Enable claims enrichment from Global Admin API</summary>
    public bool EnableClaimsEnrichment { get; set; } = true;

    /// <summary>Fail closed on Global Admin API errors (true) or fail open (false, dev only)</summary>
    public bool FailClosedOnRoleProviderError { get; set; } = true;
}
