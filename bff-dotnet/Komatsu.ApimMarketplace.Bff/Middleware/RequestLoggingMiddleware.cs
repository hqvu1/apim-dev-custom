// ---------------------------------------------------------------------------
// RequestLoggingMiddleware — structured request/response logging.
//
// Logs method, path, status code, and elapsed time for every request.
// Integrates with Application Insights via ILogger.
// ---------------------------------------------------------------------------

using System.Diagnostics;

namespace Komatsu.ApimMarketplace.Bff.Middleware;

public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        var method = context.Request.Method;
        var path = context.Request.Path;

        try
        {
            await next(context);
            sw.Stop();

            logger.LogInformation(
                "{Method} {Path} → {StatusCode} ({Elapsed:F0}ms)",
                method, path, context.Response.StatusCode, sw.Elapsed.TotalMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            logger.LogError(ex,
                "{Method} {Path} → EXCEPTION ({Elapsed:F0}ms): {Message}",
                method, path, sw.Elapsed.TotalMilliseconds, ex.Message);
            throw;
        }
    }
}

/// <summary>
/// Security headers middleware — mirrors nginx.conf headers when running standalone.
/// In production, Nginx adds these; this ensures they exist during local dev.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
        return next(context);
    }
}
