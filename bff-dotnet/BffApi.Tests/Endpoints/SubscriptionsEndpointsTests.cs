using System.Net;
using System.Net.Http.Json;
using BffApi.Models;

namespace BffApi.Tests.Endpoints;

public class SubscriptionsEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SubscriptionsEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task ListSubscriptions_ReturnsOk_WithPagedResult()
    {
        var response = await _client.GetAsync("/api/subscriptions");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<SubscriptionContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
    }

    [Fact]
    public async Task GetSubscription_ReturnsOk_ForExisting()
    {
        var response = await _client.GetAsync("/api/subscriptions/sub-warranty-1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sub = await response.ReadJsonAsync<SubscriptionContract>();
        Assert.NotNull(sub);
        Assert.Equal("sub-warranty-1", sub.Id);
    }

    [Fact]
    public async Task GetSubscription_ReturnsNotFound_ForMissing()
    {
        var response = await _client.GetAsync("/api/subscriptions/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateSubscription_ReturnsCreated()
    {
        var body = new CreateSubscriptionRequest
        {
            Scope = "/products/starter",
            DisplayName = "Test Subscription",
        };

        var response = await _client.PostAsJsonAsync("/api/subscriptions", body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sub = await response.ReadJsonAsync<SubscriptionContract>();
        Assert.NotNull(sub);
        Assert.Equal("Test Subscription", sub.DisplayName);
        Assert.Equal("submitted", sub.State);
    }

    [Fact]
    public async Task DeleteSubscription_ReturnsNoContent()
    {
        var response = await _client.DeleteAsync("/api/subscriptions/sub-warranty-1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task ListSecrets_ReturnsOk_WithKeys()
    {
        var response = await _client.PostAsync("/api/subscriptions/sub-warranty-1/secrets", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sub = await response.ReadJsonAsync<SubscriptionContract>();
        Assert.NotNull(sub);
        Assert.NotNull(sub.PrimaryKey);
        Assert.NotNull(sub.SecondaryKey);
    }

    [Fact]
    public async Task RegeneratePrimaryKey_ReturnsOk()
    {
        var response = await _client.PostAsync("/api/subscriptions/sub-warranty-1/regeneratePrimaryKey", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RegenerateSecondaryKey_ReturnsOk()
    {
        var response = await _client.PostAsync("/api/subscriptions/sub-warranty-1/regenerateSecondaryKey", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── User alias route ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetMySubscriptions_ReturnsOk_ViaUserAlias()
    {
        var response = await _client.GetAsync("/api/users/me/subscriptions");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.ReadJsonAsync<PagedResult<SubscriptionContract>>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Value);
    }
}
