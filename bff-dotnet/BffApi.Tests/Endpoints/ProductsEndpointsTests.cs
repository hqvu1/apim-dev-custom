using System.Net;
using BffApi.Models;

namespace BffApi.Tests.Endpoints;

public class ProductsEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ProductsEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    // ── GET /api/products ────────────────────────────────────────────────────

    [Fact]
    public async Task ListProducts_ReturnsPagedResult()
    {
        var response = await _client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<ProductContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
        Assert.True(result.Count > 0);
    }

    // ── GET /api/products/{productId} ────────────────────────────────────────

    [Fact]
    public async Task GetProduct_ReturnsProduct()
    {
        var response = await _client.GetAsync("/api/products/starter");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var product = await response.ReadJsonAsync<ProductContract>();
        Assert.NotNull(product);
        Assert.Equal("starter", product.Id);
    }

    [Fact]
    public async Task GetProduct_NotFound_Returns404()
    {
        var response = await _client.GetAsync("/api/products/nonexistent-product");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── GET /api/products/{productId}/apis ───────────────────────────────────

    [Fact]
    public async Task GetProductApis_ReturnsPagedResult()
    {
        var response = await _client.GetAsync("/api/products/starter/apis");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<ApiContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
    }
}
