using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using BffApi.Models;
using BffApi.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BffApi.Tests;

/// <summary>
/// Shared <see cref="WebApplicationFactory{TEntryPoint}"/> that configures
/// the BFF for integration testing:
///   • Forces Development environment + UseMockMode=true
///   • Replaces auth with a test scheme that auto-authenticates as Admin
///   • Sets fallback policy to allow all requests
/// </summary>
public class BffWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Features:UseMockMode", "true");

        builder.ConfigureTestServices(services =>
        {
            // Register the test auth scheme
            services.AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });

            // Override the default scheme to "Test" via PostConfigure so it runs
            // AFTER Program.cs sets "Bearer" as default.
            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = "Test";
                options.DefaultChallengeScheme = "Test";
                options.DefaultScheme = "Test";
            });

            // Override the named RBAC policies and fallback to use the test scheme
            // and just require authentication (no custom ApiAccessRequirement).
            // This bypasses ApiAccessHandler which calls IRoleProvider externally.
            services.AddAuthorizationBuilder()
                .AddPolicy("ApiRead", p => p.AddAuthenticationSchemes("Test").RequireAuthenticatedUser())
                .AddPolicy("ApiTryIt", p => p.AddAuthenticationSchemes("Test").RequireAuthenticatedUser())
                .AddPolicy("ApiSubscribe", p => p.AddAuthenticationSchemes("Test").RequireAuthenticatedUser())
                .AddPolicy("ApiManage", p => p.AddAuthenticationSchemes("Test").RequireAuthenticatedUser())
                .SetDefaultPolicy(new AuthorizationPolicyBuilder("Test")
                    .RequireAuthenticatedUser()
                    .Build())
                .SetFallbackPolicy(new AuthorizationPolicyBuilder("Test")
                    .RequireAuthenticatedUser()
                    .Build());
        });
    }

    /// <summary>
    /// Creates an HttpClient that does NOT follow redirects.
    /// The test auth handler auto-authenticates every request.
    /// </summary>
    public HttpClient CreateTestClient()
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
        return client;
    }
}

/// <summary>
/// Authentication handler that auto-succeeds with an Admin dev identity.
/// Used in integration tests so endpoints don't require real JWT tokens.
/// </summary>
public class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim("sub", "test-user"),
            new Claim("oid", "test-user"),
            new Claim("name", "Test User"),
            new Claim("preferred_username", "test@localhost"),
            new Claim("roles", "Admin"),
            new Claim(ClaimTypes.Role, "Admin"),
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

/// <summary>
/// Helpers for deserializing JSON responses in tests.
/// </summary>
public static class TestHelpers
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<T?> ReadJsonAsync<T>(this HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(json, JsonOptions);
    }
}
