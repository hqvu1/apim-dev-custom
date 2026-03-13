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

        // GET /products/{productId} — single product detail
        group.MapGet("/{productId}", async (string productId, IArmApiService svc, CancellationToken ct) =>
        {
            var product = await svc.GetProductAsync(productId, ct);
            return product is null ? Results.NotFound() : Results.Ok(product);
        })
        .WithName("GetProduct")
        .WithSummary("Get details for a single product")
        .Produces<ProductContract>()
        .Produces(StatusCodes.Status404NotFound);

        // GET /products/{productId}/apis — APIs belonging to a product
        group.MapGet("/{productId}/apis", async (
            string productId, int? top, int? skip, string? filter,
            IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.GetProductApisAsync(productId, top, skip, filter, ct);
            return Results.Ok(result);
        })
        .WithName("GetProductApis")
        .WithSummary("List APIs belonging to a product with optional pagination")
        .Produces<PagedResult<ApiContract>>();

        return group;
    }
}
