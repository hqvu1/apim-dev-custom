// ---------------------------------------------------------------------------
// Middleware — ClaimsEnrichmentMiddleware and AuthorizationAuditMiddleware
//
// ClaimsEnrichmentMiddleware:
//   • Runs after JWT bearer authentication
//   • Calls IClaimsEnricher to augment claims from Global Admin API
//   • Adds business roles and permission claims to user identity
//
// AuthorizationAuditMiddleware:
//   • Runs after authorization checks
//   • Logs all authorization decisions for compliance/debugging
//   • Includes user ID, method, path, status code, and duration
// ---------------------------------------------------------------------------

using System.Diagnostics;

namespace BffApi.Middleware;

/// <summary>
/// Middleware that enriches JWT claims with business roles and permissions
/// from Global Admin API before policy evaluation.
/// </summary>
public class ClaimsEnrichmentMiddleware(
    RequestDelegate next,
    ILogger<ClaimsEnrichmentMiddleware> logger)
{
    public async Task InvokeAsync(
        HttpContext context,
        BffApi.Authorization.IClaimsEnricher enricher)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            try
            {
                var enrichedClaims = await enricher.EnrichClaimsAsync(context.User);
                var identity = context.User.Identity as System.Security.Claims.ClaimsIdentity;

                if (identity != null && enrichedClaims.Count > 0)
                {
                    foreach (var claim in enrichedClaims)
                    {
                        identity.AddClaim(claim);
                    }

                    var userId = identity.FindFirst("oid")?.Value ?? "unknown";
                    logger.LogDebug(
                        "Claims enriched for user {UserId}: added {ClaimCount} claims",
                        userId, enrichedClaims.Count);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to enrich claims; proceeding without enrichment");

                // In production, non-enriched request should still proceed (fail open)
                // In development, fail closed to catch configuration issues
                if (context.RequestServices.GetRequiredService<IHostEnvironment>().IsProduction())
                {
                    // Don't throw — let the request proceed; authorization will use claims from JWT only
                }
                else
                {
                    throw;
                }
            }
        }

        await next(context);
    }
}

/// <summary>
/// Authorization decision record for audit logging.
/// </summary>
public record AuthorizationDecision
{
    public required string UserId { get; init; }
    public required string Method { get; init; }
    public required string Path { get; init; }
    public required int StatusCode { get; init; }
    public required DateTime Timestamp { get; init; }
    public required double DurationMs { get; init; }
    public required bool Authorized { get; init; }
}

/// <summary>
/// Middleware that logs all authorization decisions for audit and compliance.
/// </summary>
public class AuthorizationAuditMiddleware(
    RequestDelegate next,
    ILogger<AuthorizationAuditMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            // Skip audit logging for unauthenticated requests
            await next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        var startTime = DateTime.UtcNow;

        try
        {
            await next(context);
        }
        finally
        {
            stopwatch.Stop();

            var userId = context.User.FindFirstValue("oid")
                         ?? context.User.FindFirstValue("sub")
                         ?? "unknown";

            var decision = new AuthorizationDecision
            {
                UserId = userId,
                Method = context.Request.Method,
                Path = context.Request.Path.Value ?? "/",
                StatusCode = context.Response.StatusCode,
                Timestamp = startTime,
                DurationMs = stopwatch.Elapsed.TotalMilliseconds,
                Authorized = context.Response.StatusCode != 403
            };

            if (decision.Authorized)
            {
                logger.LogInformation(
                    "Authorization decision [ALLOWED]: {UserId} {Method} {Path} → {Status} ({Duration}ms)",
                    decision.UserId, decision.Method, decision.Path,
                    decision.StatusCode, decision.DurationMs);
            }
            else
            {
                logger.LogWarning(
                    "Authorization decision [DENIED]: {UserId} {Method} {Path} → {Status} ({Duration}ms)",
                    decision.UserId, decision.Method, decision.Path,
                    decision.StatusCode, decision.DurationMs);
            }
        }
    }
}

/// <summary>
/// Helper extension methods for finding claims by value.
/// </summary>
internal static class ClaimExtensions
{
    public static string? FindFirstValue(this System.Security.Claims.ClaimsPrincipal principal, string claimType)
    {
        return principal.FindFirst(claimType)?.Value;
    }
}
