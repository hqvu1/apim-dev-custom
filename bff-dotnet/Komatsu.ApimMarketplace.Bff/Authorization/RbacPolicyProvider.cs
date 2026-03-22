// ---------------------------------------------------------------------------
// RbacPolicyProvider — loads role-to-API permission mappings from
// rbac-policies.json and exposes lookup methods.
//
// Supports hot-reload via IOptionsMonitor so the admin can update
// policies without restarting the BFF.
// ---------------------------------------------------------------------------

using Microsoft.Extensions.Options;

namespace Komatsu.ApimMarketplace.Bff.Authorization;

// ─── Config models ───────────────────────────────────────────────────────────

public sealed class RbacPoliciesConfig
{
    public List<RbacPolicyEntry> Policies { get; set; } = [];
}

public sealed class RbacPolicyEntry
{
    public string Role { get; set; } = "";
    public List<string> Apis { get; set; } = [];
    public List<string> Permissions { get; set; } = [];
}

// ─── Provider ────────────────────────────────────────────────────────────────

/// <summary>
/// Interface for RBAC policy provider.
/// </summary>
public interface IRbacPolicyProvider
{
    /// <summary>
    /// Check if any of the user's roles grant a general (non-API-specific) permission.
    /// </summary>
    bool HasGeneralPermission(IEnumerable<string> roles, Permission permission);

    /// <summary>
    /// Check if any of the user's roles grant the specified permission for a specific API.
    /// </summary>
    bool HasApiPermission(IEnumerable<string> roles, string apiId, Permission permission);

    /// <summary>
    /// Get all API IDs that the given roles can access with the specified permission.
    /// </summary>
    HashSet<string>? GetAccessibleApis(IEnumerable<string> roles, Permission permission);
}

public sealed class RbacPolicyProvider : IRbacPolicyProvider
{
    private readonly IOptionsMonitor<RbacPoliciesConfig> _config;
    private readonly ILogger<RbacPolicyProvider> _logger;

    public RbacPolicyProvider(IOptionsMonitor<RbacPoliciesConfig> config, ILogger<RbacPolicyProvider> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Check if any of the user's roles grant a general (non-API-specific) permission.
    /// Used for list endpoints (GET /apis) where no specific apiId is in the route.
    /// </summary>
    public bool HasGeneralPermission(IEnumerable<string> roles, Permission permission)
    {
        var permStr = permission.ToString().ToLowerInvariant();
        foreach (var policy in _config.CurrentValue.Policies)
        {
            if (roles.Contains(policy.Role, StringComparer.OrdinalIgnoreCase)
                && policy.Permissions.Contains(permStr, StringComparer.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// Check if any of the user's roles grant the specified permission for a specific API.
    /// Wildcard "*" in the apis list grants access to all APIs.
    /// </summary>
    public bool HasApiPermission(IEnumerable<string> roles, string apiId, Permission permission)
    {
        var permStr = permission.ToString().ToLowerInvariant();
        foreach (var policy in _config.CurrentValue.Policies)
        {
            if (!roles.Contains(policy.Role, StringComparer.OrdinalIgnoreCase))
                continue;

            if (!policy.Permissions.Contains(permStr, StringComparer.OrdinalIgnoreCase))
                continue;

            // Wildcard → access all APIs
            if (policy.Apis.Contains("*"))
                return true;

            // Specific API match
            if (policy.Apis.Contains(apiId, StringComparer.OrdinalIgnoreCase))
                return true;
        }

        _logger.LogDebug("RBAC denied: roles=[{Roles}] apiId={ApiId} permission={Perm}",
            string.Join(",", roles), apiId, permStr);
        return false;
    }

    /// <summary>
    /// Get all API IDs that the given roles can access with the specified permission.
    /// Returns null if wildcard access is granted (meaning "all APIs").
    /// </summary>
    public HashSet<string>? GetAccessibleApis(IEnumerable<string> roles, Permission permission)
    {
        var permStr = permission.ToString().ToLowerInvariant();
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var policy in _config.CurrentValue.Policies)
        {
            if (!roles.Contains(policy.Role, StringComparer.OrdinalIgnoreCase))
                continue;
            if (!policy.Permissions.Contains(permStr, StringComparer.OrdinalIgnoreCase))
                continue;

            if (policy.Apis.Contains("*"))
                return null; // Wildcard — caller should not filter

            foreach (var api in policy.Apis)
                result.Add(api);
        }

        return result;
    }
}
