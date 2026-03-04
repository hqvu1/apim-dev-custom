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
        group.MapGet("/{apiId}", async (string apiId, IArmApiService svc, CancellationToken ct) =>
        {
            var api = await svc.GetApiAsync(apiId, ct);
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

        return group;
    }
}
