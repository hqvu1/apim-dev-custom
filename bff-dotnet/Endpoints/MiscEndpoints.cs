// ---------------------------------------------------------------------------
// StatsEndpoints  — GET /stats — portal statistics (API/product/subscription counts).
// TagsEndpoints   — GET /tags  — tag listing for catalog filter UI (P0).
// NewsEndpoints   — GET /news  — announcements feed.
// UserEndpoints   — GET /users/me — current user profile from MSAL token (P1).
// HealthEndpoints — GET /health — liveness + readiness probe.
//
// See docs/APIM_DATA_API_COMPARISON.md §4.3 (Tags), §4.6 (User Identity)
// ---------------------------------------------------------------------------

using BffApi.Models;
using BffApi.Services;

namespace BffApi.Endpoints;

// ─── Tags (P0) ───────────────────────────────────────────────────────────────

public static class TagsEndpoints
{
    public static RouteGroupBuilder MapTagsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tags")
            .WithTags("Tags")
            .RequireAuthorization("ApiRead");

        // GET /tags — list all tags (for filter dropdowns in API catalog)
        group.MapGet("/", async (string? scope, string? filter, IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.ListTagsAsync(scope, filter, ct);
            return Results.Ok(result);
        })
        .WithName("ListTags")
        .WithSummary("List all tags for catalog filter UI")
        .Produces<PagedResult<TagContract>>();

        return group;
    }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

public static class StatsEndpoints
{
    public static RouteGroupBuilder MapStatsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/stats")
            .WithTags("Stats")
            .RequireAuthorization("ApiRead");

        group.MapGet("/", async (IArmApiService svc, CancellationToken ct) =>
        {
            var stats = await svc.GetStatsAsync(ct);
            return Results.Ok(stats);
        })
        .WithName("GetStats")
        .WithSummary("Portal statistics (API/product/subscription counts)")
        .Produces<PlatformStats>();

        return group;
    }
}

// ─── News ────────────────────────────────────────────────────────────────────

public static class NewsEndpoints
{
    public static RouteGroupBuilder MapNewsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/news")
            .WithTags("News")
            .RequireAuthorization("ApiRead");

        group.MapGet("/", () =>
        {
            // Static news for POC — future: fetch from AEM Content API or database
            var news = new NewsItem[]
            {
                new()
                {
                    Id = "1",
                    Title = "Welcome to APIM Developer Portal",
                    Excerpt = "Get started with our API catalog and developer resources.",
                    Date = DateTime.UtcNow.ToString("O"),
                    Content = "Welcome to the Komatsu NA APIM Developer Portal. Start exploring our API catalog to integrate with Komatsu services.",
                    Author = "APIM Team",
                    Category = "Announcement",
                },
                new()
                {
                    Id = "2",
                    Title = "New APIs Available",
                    Excerpt = "Check out the latest additions to our API catalog.",
                    Date = DateTime.UtcNow.AddDays(-7).ToString("O"),
                    Content = "We have added new APIs to help you build better integrations.",
                    Author = "Product Team",
                    Category = "Product Update",
                },
                new()
                {
                    Id = "3",
                    Title = "Maintenance Schedule",
                    Excerpt = "Planned maintenance window this weekend.",
                    Date = DateTime.UtcNow.AddDays(-14).ToString("O"),
                    Content = "Scheduled maintenance will occur this weekend. All services will be back online by Monday.",
                    Author = "Operations",
                    Category = "System",
                },
            };
            return Results.Ok(news);
        })
        .WithName("GetNews")
        .WithSummary("News and announcements feed")
        .Produces<NewsItem[]>();

        return group;
    }
}

// ─── User Profile (P1) ──────────────────────────────────────────────────────

public static class UserEndpoints
{
    public static RouteGroupBuilder MapUserEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Users")
            .RequireAuthorization();

        // GET /users/me — return the current user's identity from validated MSAL token
        group.MapGet("/me", (HttpContext ctx) =>
        {
            var claims = ctx.User.Claims.ToList();

            var userId = claims.FirstOrDefault(c => c.Type == "oid")?.Value
                      ?? claims.FirstOrDefault(c => c.Type == "sub")?.Value
                      ?? "unknown";

            var displayName = claims.FirstOrDefault(c => c.Type == "name")?.Value
                           ?? claims.FirstOrDefault(c => c.Type == "preferred_username")?.Value;

            var email = claims.FirstOrDefault(c => c.Type == "email")?.Value
                     ?? claims.FirstOrDefault(c => c.Type == "preferred_username")?.Value;

            var roles = claims
                .Where(c => c.Type is "roles" or "role"
                            or "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                .Select(c => c.Value)
                .ToArray();

            var profile = new UserProfile
            {
                Id = userId,
                DisplayName = displayName,
                Email = email,
                Roles = roles,
            };

            return Results.Ok(profile);
        })
        .WithName("GetCurrentUser")
        .WithSummary("Get current user profile from validated MSAL token")
        .Produces<UserProfile>();

        return group;
    }
}

// ─── Health ──────────────────────────────────────────────────────────────────

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this WebApplication app)
    {
        // Health check — no auth required (used by container probes)
        app.MapGet("/api/health", () => Results.Ok(new
        {
            status = "healthy",
            service = "apim-portal-bff-dotnet",
            timestamp = DateTime.UtcNow.ToString("O"),
            version = typeof(HealthEndpoints).Assembly.GetName().Version?.ToString() ?? "1.0.0",
        }))
        .WithName("Health")
        .WithTags("Health")
        .AllowAnonymous()
        .ExcludeFromDescription();
    }
}
