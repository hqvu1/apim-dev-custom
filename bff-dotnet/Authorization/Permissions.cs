// ---------------------------------------------------------------------------
// Permissions — enum for the RBAC permission types.
//
// These map to the "permissions" array in rbac-policies.json.
// The BFF checks these before proxying requests to APIM or external APIs.
// ---------------------------------------------------------------------------

namespace BffApi.Authorization;

/// <summary>
/// Permissions that can be granted to roles for specific APIs.
/// Matches the permission strings in <c>rbac-policies.json</c>.
/// </summary>
public enum Permission
{
    /// <summary>Browse API catalog, view details and operations.</summary>
    Read,

    /// <summary>Access the "Try It" sandbox console with real API calls.</summary>
    TryIt,

    /// <summary>Create and manage subscriptions to API products.</summary>
    Subscribe,

    /// <summary>Full administrative access — RBAC management, analytics, etc.</summary>
    Manage,
}

public static class PermissionExtensions
{
    /// <summary>
    /// Parse a permission string (from JSON config) to the enum value.
    /// Case-insensitive matching.
    /// </summary>
    public static Permission? FromString(string value) => value.ToLowerInvariant() switch
    {
        "read" => Permission.Read,
        "tryit" => Permission.TryIt,
        "subscribe" => Permission.Subscribe,
        "manage" => Permission.Manage,
        _ => null,
    };
}
