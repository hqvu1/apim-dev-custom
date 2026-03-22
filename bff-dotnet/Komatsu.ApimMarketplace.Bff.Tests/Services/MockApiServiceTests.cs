using Komatsu.ApimMarketplace.Bff.Models;
using Komatsu.ApimMarketplace.Bff.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace Komatsu.ApimMarketplace.Bff.Tests.Services;

public class MockApiServiceTests
{
    private readonly MockApiService _service;

    public MockApiServiceTests()
    {
        _service = new MockApiService(NullLogger<MockApiService>.Instance);
    }

    // ── APIs ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListApis_ReturnsAllMockApis()
    {
        var result = await _service.ListApisAsync();

        Assert.NotNull(result);
        Assert.Equal(3, result.Count);
        Assert.Equal(3, result.Value.Count);
    }

    [Fact]
    public async Task ListApis_WithPagination_ReturnsCorrectSlice()
    {
        var result = await _service.ListApisAsync(top: 1, skip: 0);

        Assert.Single(result.Value);
        Assert.Equal(3, result.Count); // total count is always 3
    }

    [Fact]
    public async Task GetApi_ReturnsCorrectApi()
    {
        var api = await _service.GetApiAsync("warranty-api");

        Assert.NotNull(api);
        Assert.Equal("warranty-api", api.Id);
        Assert.Equal("Warranty API", api.Name);
    }

    [Fact]
    public async Task GetApi_NotFound_ReturnsNull()
    {
        var api = await _service.GetApiAsync("nonexistent-api");

        Assert.Null(api);
    }

    // ── Operations ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListOperations_ReturnsOperationsForApi()
    {
        var result = await _service.ListOperationsAsync("warranty-api");

        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
        Assert.Equal(2, result.Value.Count);
    }

    [Fact]
    public async Task ListOperations_UnknownApi_ReturnsEmptyResult()
    {
        var result = await _service.ListOperationsAsync("nonexistent-api");

        Assert.NotNull(result);
        Assert.Empty(result.Value);
    }

    // ── Products ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListProducts_ReturnsAllMockProducts()
    {
        var result = await _service.ListProductsAsync();

        Assert.NotNull(result);
        Assert.Equal(2, result.Value.Count);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetProduct_ReturnsCorrectProduct()
    {
        var product = await _service.GetProductAsync("starter");

        Assert.NotNull(product);
        Assert.Equal("starter", product.Id);
        Assert.Equal("Starter", product.DisplayName);
    }

    [Fact]
    public async Task GetProduct_NotFound_ReturnsNull()
    {
        var product = await _service.GetProductAsync("nonexistent-product");

        Assert.Null(product);
    }

    // ── Subscriptions ─────────────────────────────────────────────────────────

    [Fact]
    public async Task ListSubscriptions_ReturnsAllMockSubscriptions()
    {
        var result = await _service.ListSubscriptionsAsync();

        Assert.NotNull(result);
        Assert.Equal(3, result.Value.Count);
        Assert.Equal(3, result.Count);
    }

    [Fact]
    public async Task CreateSubscription_ReturnsNewSubscription()
    {
        var request = new CreateSubscriptionRequest
        {
            Scope = "/products/starter",
            DisplayName = "My Test Sub",
        };

        var sub = await _service.CreateSubscriptionAsync(request);

        Assert.NotNull(sub);
        Assert.Equal("My Test Sub", sub.DisplayName);
        Assert.Equal("submitted", sub.State);
        Assert.Equal("/products/starter", sub.Scope);
    }

    [Fact]
    public async Task DeleteSubscription_ReturnsTrue()
    {
        var result = await _service.DeleteSubscriptionAsync("sub-warranty-1");

        Assert.True(result);
    }

    // ── Stats ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStats_ReturnsCorrectCounts()
    {
        var stats = await _service.GetStatsAsync();

        Assert.NotNull(stats);
        Assert.Equal(3, stats.AvailableApis);  // 3 mock APIs
        Assert.Equal(2, stats.Products);        // 2 mock products
        Assert.Equal(3, stats.Subscriptions);   // 3 mock subscriptions
    }

    // ── OpenAPI ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExportOpenApiSpec_ReturnsNull()
    {
        var result = await _service.ExportOpenApiSpecAsync("warranty-api");

        Assert.Null(result);
    }
}
