using System.Net;
using System.Net.Http.Json;
using BffApi.Models;

namespace BffApi.Tests.Endpoints;

public class SupportEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SupportEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task GetFaqs_ReturnsOk_WithFaqList()
    {
        var response = await _client.GetAsync("/api/support/faqs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var faqs = await response.ReadJsonAsync<List<string>>();
        Assert.NotNull(faqs);
        Assert.NotEmpty(faqs);
    }

    [Fact]
    public async Task CreateTicket_ReturnsCreated()
    {
        var body = new CreateTicketRequest
        {
            Category = "Integration",
            Api = "warranty-api",
            Impact = "Medium",
            Description = "Cannot authenticate with OAuth2 token",
        };

        var response = await _client.PostAsJsonAsync("/api/support/tickets", body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var ticket = await response.ReadJsonAsync<SupportTicket>();
        Assert.NotNull(ticket);
        Assert.StartsWith("TICKET-", ticket.Id);
        Assert.Equal("Open", ticket.Status);
        Assert.Equal("Integration", ticket.Category);
    }

    [Fact]
    public async Task GetMyTickets_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/support/my-tickets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CreateTicket_ThenGetMyTickets_ContainsNewTicket()
    {
        var body = new CreateTicketRequest
        {
            Category = "Bug",
            Description = "Rate limit exceeded unexpectedly",
        };

        var createResponse = await _client.PostAsJsonAsync("/api/support/tickets", body);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var listResponse = await _client.GetAsync("/api/support/my-tickets");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var tickets = await listResponse.ReadJsonAsync<List<SupportTicket>>();
        Assert.NotNull(tickets);
        Assert.Contains(tickets, t => t.Description == "Rate limit exceeded unexpectedly");
    }
}

public class RegistrationEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public RegistrationEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task GetRegistrationConfig_ReturnsFields()
    {
        var response = await _client.GetAsync("/api/registration/config");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var config = await response.ReadJsonAsync<RegistrationConfig>();
        Assert.NotNull(config);
        Assert.NotEmpty(config.Fields);
        Assert.Contains("Company", config.Fields);
    }

    [Fact]
    public async Task SubmitRegistration_ReturnsCreated()
    {
        var body = new CreateRegistrationRequest
        {
            Company = "TestCorp",
            Contact = "test@testcorp.com",
            Role = "Dealer",
        };

        var response = await _client.PostAsJsonAsync("/api/registration", body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var reg = await response.ReadJsonAsync<RegistrationRequest>();
        Assert.NotNull(reg);
        Assert.StartsWith("REG-", reg.Id);
        Assert.Equal("Submitted", reg.Status);
    }

    [Fact]
    public async Task GetRegistrationStatus_ReturnsStatus()
    {
        var response = await _client.GetAsync("/api/registration/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var status = await response.ReadJsonAsync<RegistrationStatus>();
        Assert.NotNull(status);
        Assert.False(string.IsNullOrEmpty(status.Status));
    }
}

public class AdminEndpointsTests : IClassFixture<BffWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminEndpointsTests(BffWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task ListRegistrations_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/admin/registrations");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var regs = await response.ReadJsonAsync<List<RegistrationRequest>>();
        Assert.NotNull(regs);
        Assert.NotEmpty(regs);
    }

    [Fact]
    public async Task ListRegistrations_FiltersByPending()
    {
        var response = await _client.GetAsync("/api/admin/registrations?status=pending");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var regs = await response.ReadJsonAsync<List<RegistrationRequest>>();
        Assert.NotNull(regs);
    }

    [Fact]
    public async Task ApproveRegistration_ReturnsOk()
    {
        var response = await _client.PostAsync("/api/admin/registrations/REG-0001/approve", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reg = await response.ReadJsonAsync<RegistrationRequest>();
        Assert.NotNull(reg);
        Assert.Equal("Approved", reg.Status);
    }

    [Fact]
    public async Task RejectRegistration_ReturnsOk()
    {
        var response = await _client.PostAsync("/api/admin/registrations/REG-0002/reject", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reg = await response.ReadJsonAsync<RegistrationRequest>();
        Assert.NotNull(reg);
        Assert.Equal("Rejected", reg.Status);
    }

    [Fact]
    public async Task ApproveRegistration_ReturnsNotFound_ForMissing()
    {
        var response = await _client.PostAsync("/api/admin/registrations/NONEXISTENT/approve", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAdminMetrics_ReturnsOk_WithMetrics()
    {
        var response = await _client.GetAsync("/api/admin/metrics");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var metrics = await response.ReadJsonAsync<List<AdminMetric>>();
        Assert.NotNull(metrics);
        Assert.NotEmpty(metrics);
        Assert.Contains(metrics, m => m.Label == "Available APIs");
    }
}
