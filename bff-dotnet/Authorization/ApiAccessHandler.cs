// ---------------------------------------------------------------------------
// ApiAccessHandler — IAuthorizationHandler that enforces RBAC for API access.
//
// For every protected request, this handler:
//   1. Extracts user roles from the validated JWT token claims
//   2. Extracts the apiId from the route (if present)
//   3. Checks the RbacPolicyProvider for permission
//
// Admin & GlobalAdmin roles always have full access (fast path).
//
// See docs/BFF_MIGRATION_DECISION.md §3 — RBAC Authorization Handler
// ---------------------------------------------------------------------------

using Microsoft.AspNetCore.Authorization;

namespace BffApi.Authorization;

public sealed class ApiAccessHandler(
    RbacPolicyProvider rbac,
    ILogger<ApiAccessHandler> logger,
    IHostEnvironment env)
    : AuthorizationHandler<ApiAccessRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ApiAccessRequirement requirement)
    {
        // Extract roles from the validated JWT token
        var roles = context.User.Claims
            .Where(c => c.Type is "roles" or "role"
                        or "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
            .Select(c => c.Value)
            .ToList();

        var identity = context.User.Identity;
        logger.LogDebug(
            "RBAC check: IsAuthenticated={IsAuth}, AuthType={AuthType}, Name={Name}, " +
            "Roles=[{Roles}], ClaimCount={ClaimCount}, Permission={Perm}",
            identity?.IsAuthenticated, identity?.AuthenticationType, identity?.Name,
            string.Join(",", roles), context.User.Claims.Count(), requirement.Permission);

        // Development fast path: when no App Roles are configured in Entra ID,
        // grant full access to any authenticated user so devs can test with real data.
        // In production, App Roles must be assigned — empty roles = denied.
        if (roles.Count == 0 && env.IsDevelopment() && identity?.IsAuthenticated == true)
        {
            logger.LogWarning("RBAC: No roles in token — granting full access (Development mode). " +
                              "Configure App Roles in Entra ID before deploying to production.");
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // Fast path: Admin / GlobalAdmin always have full access
        if (roles.Exists(r => r.Equals("Admin", StringComparison.OrdinalIgnoreCase)
                            || r.Equals("GlobalAdmin", StringComparison.OrdinalIgnoreCase)))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
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

        return Task.CompletedTask;
    }
}
