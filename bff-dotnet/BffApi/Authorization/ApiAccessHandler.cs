// ---------------------------------------------------------------------------
// ApiAccessHandler — IAuthorizationHandler that enforces RBAC for API access.
//
// For every protected request, this handler:
//   1. Extracts user-id (oid or sub claim) from the validated JWT token
//   2. Calls IRoleProvider to fetch business roles from Global Admin API
//      (Distributor, Vendor, Customer — cached per user for 30 min)
//   3. Extracts the apiId from the route (if present)
//   4. Checks the RbacPolicyProvider for permission
//
// Admin role always has full access (fast path).
//
// See docs/BFF_MIGRATION_DECISION.md §3 — RBAC Authorization Handler
// ---------------------------------------------------------------------------

using BffApi.Services;
using Microsoft.AspNetCore.Authorization;

namespace BffApi.Authorization;

public sealed class ApiAccessHandler(
    RbacPolicyProvider rbac,
    IRoleProvider roleProvider,
    ILogger<ApiAccessHandler> logger,
    IHostEnvironment env)
    : AuthorizationHandler<ApiAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ApiAccessRequirement requirement)
    {
        var identity = context.User.Identity;

        // Extract user ID from JWT claims (oid preferred, fall back to sub)
        var userId = context.User.Claims
            .FirstOrDefault(c => c.Type is "oid"
                or "http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value
            ?? context.User.Claims
                .FirstOrDefault(c => c.Type is "sub")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            // Development fast path: when no user ID is available, grant full
            // access to any authenticated user so devs can test without tokens.
            if (env.IsDevelopment() && identity?.IsAuthenticated == true)
            {
                logger.LogWarning("RBAC: No user ID in token — granting full access (Development mode).");
                context.Succeed(requirement);
                return;
            }

            logger.LogWarning("RBAC denied: no user ID (oid/sub) in token");
            return;
        }

        // Development fast path: synthetic dev identity ("dev-user") — skip
        // the Global Admin API call entirely and grant full access.
        if (env.IsDevelopment() && userId == "dev-user")
        {
            logger.LogWarning("RBAC: Synthetic dev identity detected — granting full access (Development mode).");
            context.Succeed(requirement);
            return;
        }

        // Fetch business roles from Global Admin API (cached per user)
        var roles = await roleProvider.GetUserRolesAsync(userId);

        logger.LogDebug(
            "RBAC check: IsAuthenticated={IsAuth}, UserId={UserId}, " +
            "Roles=[{Roles}], Permission={Perm}",
            identity?.IsAuthenticated, userId,
            string.Join(",", roles), requirement.Permission);

        if (roles.Count == 0 && env.IsDevelopment() && identity?.IsAuthenticated == true)
        {
            logger.LogWarning("RBAC: No roles from Global Admin — granting full access (Development mode). " +
                              "Ensure Global Admin API is configured before deploying to production.");
            context.Succeed(requirement);
            return;
        }

        // Fast path: Admin always has full access
        if (roles.Any(r => r.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
        {
            context.Succeed(requirement);
            return;
        }

        // Extract apiId from the route (if present)
        var httpContext = context.Resource as HttpContext;
        var apiId = httpContext?.GetRouteValue("apiId")?.ToString();

        if (apiId is null)
        {
            // Non-API-specific routes (e.g., GET /apis list) — check general permission
            if (rbac.HasGeneralPermission(roles, requirement.Permission))
            {
                context.Succeed(requirement);
            }
            else
            {
                logger.LogWarning("RBAC denied general {Permission} for roles [{Roles}]",
                    requirement.Permission, string.Join(",", roles));
            }
        }
        else
        {
            // API-specific routes — check role-to-API permission
            if (rbac.HasApiPermission(roles, apiId, requirement.Permission))
            {
                context.Succeed(requirement);
            }
            else
            {
                logger.LogWarning("RBAC denied {Permission} on {ApiId} for roles [{Roles}]",
                    requirement.Permission, apiId, string.Join(",", roles));
            }
        }
    }
}
