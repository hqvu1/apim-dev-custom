// ---------------------------------------------------------------------------
// ApiAccessRequirement — IAuthorizationRequirement for per-API RBAC.
//
// Wraps a Permission (Read, TryIt, Subscribe, Manage) that the caller
// must have for the target API resource.
// ---------------------------------------------------------------------------

using Microsoft.AspNetCore.Authorization;

namespace BffApi.Authorization;

/// <summary>
/// Authorization requirement that checks whether the user's Entra ID role(s)
/// grant the specified <see cref="Permission"/> for the requested API.
/// </summary>
public sealed class ApiAccessRequirement(Permission permission) : IAuthorizationRequirement
{
    public Permission Permission { get; } = permission;
}
