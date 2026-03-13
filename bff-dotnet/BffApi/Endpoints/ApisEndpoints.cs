// ---------------------------------------------------------------------------
// ApisEndpoints — minimal API route group for /apis.
//
// Matches the SPA's useApimCatalog expectations:
//   GET  /apis                            → PagedResult<ApiContract>
//   GET  /apis/highlights                 → PagedResult<ApiContract>  (top 3)
//   GET  /apis/{apiId}                    → ApiContract
//   GET  /apis/{apiId}/operations         → PagedResult<OperationContract>
//   GET  /apis/{apiId}/products           → PagedResult<ProductContract>
//   GET  /apis/{apiId}/openapi            → OpenAPI spec (redirect or inline)
//
// Enhanced (per APIM_DATA_API_COMPARISON.md):
//   ✅ $top/$skip pagination passthrough
//   ✅ $filter for search
//   ✅ RBAC filtering via ApiRead policy
//
// See docs/ARCHITECTURE_DESIGN.md §4, docs/APIM_DATA_API_COMPARISON.md §4.2
// ---------------------------------------------------------------------------

using BffApi.Authorization;
using BffApi.Models;
using BffApi.Services;

namespace BffApi.Endpoints;

public static class ApisEndpoints
{
    public static RouteGroupBuilder MapApisEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/apis")
            .WithTags("APIs")
            .RequireAuthorization("ApiRead");

        // GET /apis — list all APIs with optional pagination & filter
        group.MapGet("/", async (
            int? top, int? skip, string? filter,
            IArmApiService svc,
            RbacPolicyProvider rbac,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            var result = await svc.ListApisAsync(top, skip, filter, ct);

            // RBAC: filter APIs based on user's roles
            var roles = ctx.User.Claims
                .Where(c => c.Type is "roles" or "role"
                            or "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                .Select(c => c.Value)
                .ToList();

            var accessible = rbac.GetAccessibleApis(roles, Permission.Read);
            if (accessible is not null)
            {
                // Filter to only APIs the user's roles can see
                var filtered = result.Value.Where(a => accessible.Contains(a.Id)).ToList();
                return Results.Ok(new PagedResult<ApiContract>
                {
                    Value = filtered,
                    Count = filtered.Count,
                });
            }

            return Results.Ok(result);
        })
        .WithName("ListApis")
        .WithSummary("List all APIs from the APIM catalog with optional pagination")
        .Produces<PagedResult<ApiContract>>();

        // GET /apis/highlights — top 3 for homepage (returns flat array, not paged)
        group.MapGet("/highlights", async (IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.ListApisAsync(top: 3, ct: ct);
            return Results.Ok(result.Value);
        })
        .WithName("ListApiHighlights")
        .WithSummary("Top 3 highlighted APIs for the homepage")
        .Produces<List<ApiContract>>();

        // GET /apis/{apiId} — single API detail
        group.MapGet("/{apiId}", async (string apiId, string? revision, IArmApiService svc, CancellationToken ct) =>
        {
            var api = await svc.GetApiAsync(apiId, revision, ct);
            return api is null ? Results.NotFound() : Results.Ok(api);
        })
        .WithName("GetApi")
        .WithSummary("Get details for a single API")
        .Produces<ApiContract>()
        .Produces(StatusCodes.Status404NotFound);

        // GET /apis/{apiId}/operations — operations for an API with pagination
        group.MapGet("/{apiId}/operations", async (
            string apiId, int? top, int? skip,
            IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.ListOperationsAsync(apiId, top, skip, ct);
            return Results.Ok(result);
        })
        .WithName("ListApiOperations")
        .WithSummary("List operations for an API with optional pagination")
        .Produces<PagedResult<OperationContract>>();

        // GET /apis/{apiId}/products — products linked to an API
        group.MapGet("/{apiId}/products", async (string apiId, IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.ListProductsForApiAsync(apiId, ct);
            return Results.Ok(result);
        })
        .WithName("ListApiProducts")
        .WithSummary("List products linked to an API")
        .Produces<PagedResult<ProductContract>>();

        // GET /apis/{apiId}/openapi — export OpenAPI spec
        group.MapGet("/{apiId}/openapi", async (string apiId, string? format, IArmApiService svc, CancellationToken ct) =>
        {
            var spec = await svc.ExportOpenApiSpecAsync(apiId, format ?? "swagger-link", ct);
            if (spec is null) return Results.NotFound();

            var root = spec.Value;
            if (root.TryGetProperty("properties", out var props))
            {
                if (props.TryGetProperty("value", out var val))
                {
                    if (val.ValueKind == System.Text.Json.JsonValueKind.Object && val.TryGetProperty("link", out var link))
                    {
                        var linkStr = link.GetString();
                        if (!string.IsNullOrEmpty(linkStr)) return Results.Redirect(linkStr);
                    }
                    if (val.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        var valStr = val.GetString();
                        if (!string.IsNullOrEmpty(valStr) && valStr.StartsWith("http")) return Results.Redirect(valStr);
                    }
                }
            }

            return Results.Ok(spec.Value);
        })
        .WithName("ExportOpenApiSpec")
        .WithSummary("Export OpenAPI/Swagger specification for an API")
        .RequireAuthorization("ApiTryIt")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status302Found)
        .Produces(StatusCodes.Status404NotFound);

        // GET /apis/{apiId}/operations/{operationId} — single operation detail
        group.MapGet("/{apiId}/operations/{operationId}", async (
            string apiId, string operationId,
            IArmApiService svc, CancellationToken ct) =>
        {
            var op = await svc.GetOperationAsync(apiId, operationId, ct);
            return op is null ? Results.NotFound() : Results.Ok(op);
        })
        .WithName("GetApiOperation")
        .WithSummary("Get details for a single API operation")
        .Produces<OperationContract>()
        .Produces(StatusCodes.Status404NotFound);

        // GET /apis/{apiId}/operations/{operationId}/tags — tags for an operation
        group.MapGet("/{apiId}/operations/{operationId}/tags", async (
            string apiId, string operationId,
            IArmApiService svc, CancellationToken ct) =>
        {
            var tags = await svc.GetOperationTagsAsync(apiId, operationId, ct);
            return Results.Ok(tags);
        })
        .WithName("GetOperationTags")
        .WithSummary("List tags for a specific API operation")
        .Produces<IReadOnlyList<TagContract>>();

        // GET /apis/{apiId}/operationsByTags — operations grouped by tag
        group.MapGet("/{apiId}/operationsByTags", async (
            string apiId, int? top, int? skip,
            [AsParameters] TagFilterParams tagFilter,
            IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.GetOperationsByTagsAsync(apiId, top, skip, tagFilter.Tags, tagFilter.Pattern, ct);
            return Results.Ok(result);
        })
        .WithName("GetOperationsByTags")
        .WithSummary("List operations grouped by tag")
        .Produces<PagedResult<TagGroup<OperationContract>>>();

        // GET /apis/{apiId}/schemas — API schemas
        group.MapGet("/{apiId}/schemas", async (string apiId, IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.GetApiSchemasAsync(apiId, ct);
            return Results.Ok(result);
        })
        .WithName("ListApiSchemas")
        .WithSummary("List schemas for an API (OpenAPI/Swagger/GraphQL)")
        .Produces<PagedResult<SchemaContract>>();

        // GET /apis/{apiId}/releases — API change log
        group.MapGet("/{apiId}/releases", async (
            string apiId, int? top, int? skip,
            IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.GetApiChangeLogAsync(apiId, top, skip, ct);
            return Results.Ok(result);
        })
        .WithName("ListApiChangeLog")
        .WithSummary("List change log entries for an API")
        .Produces<PagedResult<ChangeLogContract>>();

        // GET /apis/{apiId}/hostnames — API hostnames
        group.MapGet("/{apiId}/hostnames", async (string apiId, IArmApiService svc, CancellationToken ct) =>
        {
            var hostnames = await svc.GetApiHostnamesAsync(apiId, ct);
            return Results.Ok(hostnames);
        })
        .WithName("ListApiHostnames")
        .WithSummary("List hostnames for an API")
        .Produces<IReadOnlyList<string>>();

        // GET /apis/{apiId}/subscription — per-API subscription status check
        // SPA ApiDetails.tsx calls this to show "Subscribed" / "Not subscribed" badge
        group.MapGet("/{apiId}/subscription", async (
            string apiId, IArmApiService svc, HttpContext ctx, CancellationToken ct) =>
        {
            // Check if the current user has any subscription scoped to this API's product
            var subs = await svc.ListSubscriptionsAsync(top: 100, ct: ct);
            var match = subs.Value.FirstOrDefault(s =>
                s.Scope is not null && s.Scope.Contains(apiId, StringComparison.OrdinalIgnoreCase)
                && s.State is "active" or "submitted");

            if (match is not null)
            {
                return Results.Ok(new { status = match.State ?? "active", subscriptionId = match.Id });
            }

            return Results.Ok(new { status = "Not subscribed", subscriptionId = (string?)null });
        })
        .WithName("GetApiSubscriptionStatus")
        .WithSummary("Check current user's subscription status for a specific API")
        .Produces(StatusCodes.Status200OK);

        // GET /apis/{apiId}/try-config — Try-It console configuration
        // SPA ApiTryIt.tsx calls this to populate the operations list
        group.MapGet("/{apiId}/try-config", async (
            string apiId, IArmApiService svc, CancellationToken ct) =>
        {
            var ops = await svc.ListOperationsAsync(apiId, top: 100, ct: ct);
            var operationLabels = ops.Value
                .Select(o => $"{o.Method.ToUpperInvariant()} {o.UrlTemplate}")
                .ToArray();

            return Results.Ok(new Models.TryItConfig { Operations = operationLabels });
        })
        .WithName("GetApiTryItConfig")
        .WithSummary("Get Try-It console configuration for an API")
        .RequireAuthorization("ApiTryIt")
        .Produces<Models.TryItConfig>();

        return group;
    }

    // GET /apis/byTags — APIs grouped by tags (separate route group to avoid conflict with /{apiId})
    public static RouteGroupBuilder MapApisByTagsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/apisByTags")
            .WithTags("APIs")
            .RequireAuthorization("ApiRead");

        group.MapGet("/", async (
            int? top, int? skip,
            [AsParameters] TagFilterParams tagFilter,
            IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.GetApisByTagsAsync(top, skip, tagFilter.Tags, tagFilter.Pattern, ct);
            return Results.Ok(result);
        })
        .WithName("GetApisByTags")
        .WithSummary("List APIs grouped by tag for tag-based catalog browsing")
        .Produces<PagedResult<TagGroup<ApiContract>>>();

        return group;
    }

    // GET /apis/versionSets — API version set endpoints
    public static RouteGroupBuilder MapApiVersionSetEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/apiVersionSets")
            .WithTags("APIs")
            .RequireAuthorization("ApiRead");

        group.MapGet("/{versionSetId}", async (string versionSetId, IArmApiService svc, CancellationToken ct) =>
        {
            var vs = await svc.GetApiVersionSetAsync(versionSetId, ct);
            return vs is null ? Results.NotFound() : Results.Ok(vs);
        })
        .WithName("GetApiVersionSet")
        .WithSummary("Get API version set details")
        .Produces<VersionSetContract>()
        .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/{versionSetId}/apis", async (
            string versionSetId, IArmApiService svc, CancellationToken ct) =>
        {
            var apis = await svc.GetApisInVersionSetAsync(versionSetId, ct);
            return Results.Ok(apis);
        })
        .WithName("GetApisInVersionSet")
        .WithSummary("List APIs belonging to a version set")
        .Produces<IReadOnlyList<ApiContract>>();

        return group;
    }
}

/// <summary>
/// Query parameter binding for tag-based filtering.
/// </summary>
public sealed class TagFilterParams
{
    public string[]? Tags { get; init; }
    public string? Pattern { get; init; }
}
