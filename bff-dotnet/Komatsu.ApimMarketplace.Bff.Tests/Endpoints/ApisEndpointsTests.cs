using System.Net;
using Komatsu.ApimMarketplace.Bff.Models;

namespace Komatsu.ApimMarketplace.Bff.Tests.Endpoints;

public class ApisEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ApisEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    // ── GET /api/apis ────────────────────────────────────────────────────────

    [Fact]
    public async Task ListApis_ReturnsOk_WithPagedResult()
    {
        var response = await _client.GetAsync("/api/apis");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<ApiContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
        Assert.True(result.Count > 0);
    }

    [Fact]
    public async Task ListApis_SupportsPagination()
    {
        var response = await _client.GetAsync("/api/apis?top=1&skip=0");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<ApiContract>>();
        Assert.NotNull(result);
        Assert.Single(result.Value);
    }

    // ── GET /api/apis/highlights ─────────────────────────────────────────────

    [Fact]
    public async Task ListHighlights_ReturnsOk_WithArray()
    {
        var response = await _client.GetAsync("/api/apis/highlights");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<List<ApiContract>>();
        Assert.NotNull(result);
        Assert.True(result.Count <= 3);
    }

    // ── GET /api/apis/{apiId} ────────────────────────────────────────────────

    [Fact]
    public async Task GetApi_ReturnsOk_ForExistingApi()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var api = await response.ReadJsonAsync<ApiContract>();
        Assert.NotNull(api);
        Assert.Equal("warranty-api", api.Id);
    }

    [Fact]
    public async Task GetApi_ReturnsNotFound_ForMissingApi()
    {
        var response = await _client.GetAsync("/api/apis/nonexistent-api");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── GET /api/apis/{apiId}/operations ──────────────────────────────────────

    [Fact]
    public async Task ListOperations_ReturnsOk_WithOperations()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api/operations");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<OperationContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
    }

    // ── GET /api/apis/{apiId}/products ────────────────────────────────────────

    [Fact]
    public async Task ListApiProducts_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<ProductContract>>();
        Assert.NotNull(result);
    }

    // ── GET /api/apis/{apiId}/subscription ────────────────────────────────────

    [Fact]
    public async Task GetApiSubscriptionStatus_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api/subscription");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("status", json);
    }

    // ── GET /api/apis/{apiId}/try-config ──────────────────────────────────────

    [Fact]
    public async Task GetTryItConfig_ReturnsOperationLabels()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api/try-config");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var config = await response.ReadJsonAsync<TryItConfig>();
        Assert.NotNull(config);
        Assert.NotEmpty(config.Operations);
    }

    // ── GET /api/apis/{apiId}/releases ────────────────────────────────────────

    [Fact]
    public async Task ListChangeLog_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api/releases");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── GET /api/apis/{apiId}/hostnames ───────────────────────────────────────

    [Fact]
    public async Task ListHostnames_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/apis/warranty-api/hostnames");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
