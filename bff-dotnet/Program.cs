// ---------------------------------------------------------------------------
// Program.cs — ASP.NET Core 10 Minimal API composition root for the BFF.
//
// Architecture:
//   Nginx :8080  →  /api/*  →  BFF :3001  →  ARM Management API (APIM)
//
// Features:
//   ✅ JWT Bearer authentication (Entra ID / MSAL)
//   ✅ RBAC authorization pipeline (ApiRead, ApiTryIt, ApiSubscribe, ApiManage)
//   ✅ IHttpClientFactory + Microsoft.Extensions.Http.Resilience (retry, circuit breaker)
//   ✅ DefaultAzureCredential → ARM token for APIM proxy
//   ✅ IMemoryCache for response deduplication (1-min TTL)
//   ✅ Mock mode for local development (IsDevelopment + UseMockMode flag)
//   ✅ OpenAPI / Scalar (development only)
//   ✅ Structured logging via middleware
//   ✅ x-ms-apim-client portal telemetry header
//   ✅ Health endpoint (anonymous)
//   ✅ CORS for same-origin Nginx proxy
//   ✅ Security headers
//   ✅ Tags endpoint (P0)
//   ✅ Subscription lifecycle: detail, update, secrets (P0)
//   ✅ User profile from MSAL token claims (P1)
//   ✅ $top/$skip pagination passthrough (P0)
//
// See docs/BFF_MIGRATION_DECISION.md, docs/ARCHITECTURE_DESIGN.md,
//     docs/APIM_DATA_API_COMPARISON.md, docs/BFF_EVOLUTION_ANALYSIS.md
// ---------------------------------------------------------------------------

using System.Text.Json;
using BffApi.Authorization;
using BffApi.Endpoints;
using BffApi.Middleware;
using BffApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ─── Configuration binding ───────────────────────────────────────────────────

builder.Services.Configure<ApimSettings>(builder.Configuration.GetSection(ApimSettings.SectionName));

// RBAC policies — hot-reloadable from rbac-policies.json
builder.Configuration.AddJsonFile("rbac-policies.json", optional: true, reloadOnChange: true);
builder.Services.Configure<RbacConfig>(builder.Configuration);

var useMockMode = builder.Configuration.GetValue<bool>("Features:UseMockMode");

// ─── JSON serialization defaults ─────────────────────────────────────────────

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});

// ─── Authentication: JWT Bearer from Entra ID ────────────────────────────────
// In development with mock mode, auth is relaxed. In production, tokens are
// validated against Entra ID JWKS endpoint.

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var entra = builder.Configuration.GetSection("EntraId");
        var tenantId = entra["TenantId"];
        var clientId = entra["ClientId"];

        if (useMockMode && builder.Environment.IsDevelopment())
        {
            // Mock mode: accept any token (or no token) for local testing
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                ValidateIssuerSigningKey = false,
                SignatureValidator = (token, _) => new Microsoft.IdentityModel.JsonWebTokens.JsonWebToken(token),
            };
            // When no Authorization header is present, auto-succeed with an anonymous principal
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    if (string.IsNullOrEmpty(ctx.Request.Headers.Authorization))
                    {
                        // Create a mock principal with Admin role for local dev
                        var claims = new[]
                        {
                            new System.Security.Claims.Claim("sub", "dev-user"),
                            new System.Security.Claims.Claim("name", "Local Developer"),
                            new System.Security.Claims.Claim("roles", "Admin"),
                        };
                        ctx.Principal = new System.Security.Claims.ClaimsPrincipal(
                            new System.Security.Claims.ClaimsIdentity(claims, "MockAuth"));
                        ctx.Success();
                    }
                    return Task.CompletedTask;
                },
            };
        }
        else if (!string.IsNullOrWhiteSpace(tenantId) && !string.IsNullOrWhiteSpace(clientId))
        {
            // ── Multi-tenant token validation ──────────────────────────────
            // The SPA can authenticate via either the workforce tenant or the
            // CIAM (external) tenant.  Rather than locking Authority to a single
            // OIDC endpoint we resolve signing keys from ALL configured tenants
            // so that tokens from either issuer validate correctly.

            var externalTenantId = entra["ExternalTenantId"];
            var ciamHost         = entra["CiamHost"];
            var instance         = entra["Instance"] ?? "https://login.microsoftonline.com/";

            var metadataAddresses = new List<string>
            {
                $"{instance}{tenantId}/v2.0/.well-known/openid-configuration"
            };

            if (!string.IsNullOrWhiteSpace(externalTenantId) && !string.IsNullOrWhiteSpace(ciamHost))
            {
                metadataAddresses.Add(
                    $"https://{ciamHost}/{externalTenantId}/v2.0/.well-known/openid-configuration");
            }

            // ConfigurationManagers cache the JWKS keys automatically.
            var configManagers = metadataAddresses
                .Select(addr => new ConfigurationManager<OpenIdConnectConfiguration>(
                    addr,
                    new OpenIdConnectConfigurationRetriever(),
                    new HttpDocumentRetriever()))
                .ToList();

            // Do NOT set options.Authority — we resolve keys ourselves.
            var validAudiences = entra.GetSection("ValidAudiences").Get<string[]>()
                ?? [clientId, $"api://{clientId}"];

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer          = true,
                ValidIssuers            = entra.GetSection("ValidIssuers").Get<string[]>() ?? [],
                ValidateAudience        = true,
                ValidAudiences          = validAudiences,
                ValidateIssuerSigningKey = true,
                RoleClaimType           = "roles",
                NameClaimType           = "preferred_username",

                // Aggregate signing keys from all configured tenant OIDC endpoints
                IssuerSigningKeyResolver = (token, securityToken, kid, validationParameters) =>
                {
                    return configManagers
                        .SelectMany(cm =>
                        {
                            try
                            {
                                var cfg = cm.GetConfigurationAsync(CancellationToken.None)
                                             .GetAwaiter().GetResult();
                                return cfg.SigningKeys;
                            }
                            catch
                            {
                                return Enumerable.Empty<SecurityKey>();
                            }
                        })
                        .ToList();
                }
            };

            // Log auth failures so JWT issues are visible during development.
            // In Development, when the SPA cannot acquire a BFF access token
            // (e.g. API scope not configured in the Entra app registration),
            // grant a synthetic dev identity so the BFF is still usable locally.
            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices
                        .GetRequiredService<ILoggerFactory>()
                        .CreateLogger("JwtBearer");
                    logger.LogWarning("JWT authentication failed: {Error}", ctx.Exception.Message);
                    if (ctx.Exception.InnerException is not null)
                        logger.LogWarning("  Inner: {Inner}", ctx.Exception.InnerException.Message);
                    return Task.CompletedTask;
                },
                OnMessageReceived = ctx =>
                {
                    // Development-only fallback: when no Bearer token is present,
                    // auto-authenticate as a dev user so endpoints work without
                    // a properly configured API scope in Entra ID.
                    if (builder.Environment.IsDevelopment()
                        && string.IsNullOrEmpty(ctx.Request.Headers.Authorization))
                    {
                        var devLogger = ctx.HttpContext.RequestServices
                            .GetRequiredService<ILoggerFactory>()
                            .CreateLogger("JwtBearer");
                        devLogger.LogWarning(
                            "No Authorization header in Development — granting dev identity. " +
                            "Configure the API scope in Entra ID before deploying to production.");

                        var claims = new[]
                        {
                            new System.Security.Claims.Claim("sub", "dev-user"),
                            new System.Security.Claims.Claim("name", "Local Developer"),
                            new System.Security.Claims.Claim("preferred_username", "dev@localhost"),
                            new System.Security.Claims.Claim("roles", "Admin"),
                        };
                        ctx.Principal = new System.Security.Claims.ClaimsPrincipal(
                            new System.Security.Claims.ClaimsIdentity(claims, "DevAuth"));
                        ctx.Success();
                    }
                    return Task.CompletedTask;
                }
            };
        }
        else if (builder.Environment.IsDevelopment())
        {
            // Development without Entra config: skip real JWT validation
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                ValidateIssuerSigningKey = false,
                SignatureValidator = (token, _) => new Microsoft.IdentityModel.JsonWebTokens.JsonWebToken(token),
            };
        }
    });

// ─── Authorization: RBAC policy pipeline ─────────────────────────────────────
// Custom authorization policies map to the Permission enum.
// ApiAccessHandler checks user roles against rbac-policies.json.
// In mock mode (development), auth is bypassed so endpoints can be tested without tokens.
// See docs/BFF_MIGRATION_DECISION.md §3 — RBAC Authorization Handler

var authBuilder = builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiRead", p => p.AddRequirements(new ApiAccessRequirement(Permission.Read)))
    .AddPolicy("ApiTryIt", p => p.AddRequirements(new ApiAccessRequirement(Permission.TryIt)))
    .AddPolicy("ApiSubscribe", p => p.AddRequirements(new ApiAccessRequirement(Permission.Subscribe)))
    .AddPolicy("ApiManage", p => p.AddRequirements(new ApiAccessRequirement(Permission.Manage)));

if (useMockMode && builder.Environment.IsDevelopment())
{
    // In mock mode, set fallback policy to allow anonymous so endpoints work without JWT
    authBuilder.SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAssertion(_ => true)
        .Build());
}

builder.Services.AddSingleton<IAuthorizationHandler, ApiAccessHandler>();
builder.Services.AddSingleton<RbacPolicyProvider>();

// ─── In-memory cache (response deduplication) ────────────────────────────────
builder.Services.AddMemoryCache();

// ─── HttpClient + Resilience (Microsoft.Extensions.Http.Resilience) ──────────
// Standard resilience pipeline: retry on 429/5xx with exponential backoff,
// circuit breaker, and total request timeout.
// Portal telemetry header (x-ms-apim-client) added via DelegatingHandler.

builder.Services.AddTransient<PortalTelemetryHandler>();

builder.Services.AddHttpClient("ArmApi", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.Timeout = TimeSpan.FromSeconds(60);
})
.AddHttpMessageHandler<PortalTelemetryHandler>()
.AddStandardResilienceHandler(options =>
{
    options.Retry.MaxRetryAttempts = 3;
    options.Retry.BackoffType = Polly.DelayBackoffType.Exponential;
    options.Retry.UseJitter = true;
    options.Retry.Delay = TimeSpan.FromMilliseconds(500);
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(30);
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(90);
    options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(60);
    options.CircuitBreaker.MinimumThroughput = 5;
});

// ─── Services: mock vs. real ARM ─────────────────────────────────────────────

if (useMockMode)
{
    builder.Services.AddSingleton<IArmApiService, MockApiService>();
    builder.Logging.AddConsole();
}
else
{
    builder.Services.AddScoped<IArmApiService, ArmApiService>();
}

// ─── CORS ────────────────────────────────────────────────────────────────────
// In production, Nginx handles same-origin. For local dev the SPA may be on :5173.

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// ─── OpenAPI (dev only) ──────────────────────────────────────────────────────

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Build & configure the HTTP pipeline
// ═══════════════════════════════════════════════════════════════════════════════

var app = builder.Build();

// ── Dev middleware ────────────────────────────────────────────────────────────

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // Scalar UI for API exploration
    app.MapScalarApiReference();
}

// ── Structured request logging ───────────────────────────────────────────────

app.UseMiddleware<RequestLoggingMiddleware>();

// ── Security headers (mirrors nginx.conf when running standalone) ────────────

app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ── Map endpoint groups ──────────────────────────────────────────────────────

app.MapApisEndpoints();
app.MapTagsEndpoints();
app.MapProductsEndpoints();
app.MapSubscriptionsEndpoints();
app.MapStatsEndpoints();
app.MapNewsEndpoints();
app.MapUserEndpoints();
app.MapHealthEndpoints();

// ── Startup banner ───────────────────────────────────────────────────────────

app.Lifetime.ApplicationStarted.Register(() =>
{
    var settings = builder.Configuration.GetSection("Apim").Get<ApimSettings>()!;
    app.Logger.LogInformation("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    app.Logger.LogInformation("APIM Portal BFF (.NET 10) Started");
    app.Logger.LogInformation("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    app.Logger.LogInformation("Port:          {Urls}", builder.WebHost.GetSetting("urls") ?? "http://localhost:3001");
    app.Logger.LogInformation("APIM:          {Name} ({RG})", settings.ServiceName, settings.ResourceGroup);
    app.Logger.LogInformation("Auth:          {Mode}", useMockMode ? "Mock Mode (Development)" : "Azure Managed Identity + JWT Bearer");
    app.Logger.LogInformation("RBAC:          Policy-based (rbac-policies.json, hot-reload)");
    app.Logger.LogInformation("Resilience:    Standard (retry 3x, circuit breaker, timeout)");
    app.Logger.LogInformation("Caching:       IMemoryCache (1-min TTL for GET responses)");
    app.Logger.LogInformation("Environment:   {Env}", app.Environment.EnvironmentName);
    if (useMockMode)
    {
        app.Logger.LogWarning("Running in MOCK MODE — all API calls return static data");
    }
    app.Logger.LogInformation("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

app.Run();

// ── Make Program accessible for WebApplicationFactory integration tests ──────
namespace BffApi { public partial class Program; }
