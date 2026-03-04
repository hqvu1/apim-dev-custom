// ---------------------------------------------------------------------------
// ProductsEndpoints — minimal API route group for /products.
//
// Matches SPA:  GET /products  →  PagedResult<ProductContract>
// Enhanced with $top/$skip pagination.
// ---------------------------------------------------------------------------

using BffApi.Models;
using BffApi.Services;

namespace BffApi.Endpoints;

public static class ProductsEndpoints
{
    public static RouteGroupBuilder MapProductsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products")
            .WithTags("Products")
            .RequireAuthorization("ApiRead");

        // GET /products — list all published products with optional pagination
        group.MapGet("/", async (int? top, int? skip, IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.ListProductsAsync(top, skip, ct);
            return Results.Ok(result);
        })
        .WithName("ListProducts")
        .WithSummary("List all published APIM products with optional pagination")
        .Produces<PagedResult<ProductContract>>();

        return group;
    }
}
