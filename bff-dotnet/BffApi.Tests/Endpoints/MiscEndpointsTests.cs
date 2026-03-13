using System.Net;
using BffApi.Models;

namespace BffApi.Tests.Endpoints;

public class MiscEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public MiscEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    // ── Tags ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListTags_ReturnsOk_WithTags()
    {
        var response = await _client.GetAsync("/api/tags");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<TagContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStats_ReturnsOk_WithCounts()
    {
        var response = await _client.GetAsync("/api/stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stats = await response.ReadJsonAsync<PlatformStats>();
        Assert.NotNull(stats);
        Assert.True(stats.AvailableApis > 0);
        Assert.True(stats.Products > 0);
    }

    // ── News ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetNews_ReturnsOk_WithItems()
    {
        var response = await _client.GetAsync("/api/news");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var news = await response.ReadJsonAsync<List<NewsItem>>();
        Assert.NotNull(news);
        Assert.NotEmpty(news);
    }

    // ── User profile ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCurrentUser_ReturnsOk_WithProfile()
    {
        var response = await _client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var profile = await response.ReadJsonAsync<UserProfile>();
        Assert.NotNull(profile);
        Assert.NotNull(profile.Id);
        Assert.NotEmpty(profile.Roles);
    }

    // ── Products ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListProducts_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<ProductContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
    }

    [Fact]
    public async Task GetProduct_ReturnsOk_ForExisting()
    {
        var response = await _client.GetAsync("/api/products/starter");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var product = await response.ReadJsonAsync<ProductContract>();
        Assert.NotNull(product);
        Assert.Equal("starter", product.Id);
    }

    [Fact]
    public async Task GetProduct_ReturnsNotFound_ForMissing()
    {
        var response = await _client.GetAsync("/api/products/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── Health ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Health_ReturnsOk_Anonymous()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("healthy", json);
    }
}
