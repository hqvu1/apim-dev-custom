// ---------------------------------------------------------------------------
// GlobalAdminRoleProvider — fetches user business roles from the Komatsu
// Global Admin API and caches them per user for 30 minutes.
//
// Auth flow:
//   1. SPA authenticates user via MSAL → Entra ID → obtains JWT
//   2. SPA sends JWT to BFF in Authorization header
//   3. BFF validates JWT, extracts user-id (oid / sub claim)
//   4. BFF calls Global Admin API: GET /users/{userId}/roles
//   5. Response contains business roles: Distributor, Vendor, Customer, Admin
//   6. BFF caches roles per user (30 min) and feeds them into RBAC pipeline
//
// Global Admin API:
//   Base URL: https://apim-globaladmin-uat-jpneast-001.azure-api.net
//   Auth:     Ocp-Apim-Subscription-Key header (API key — to be configured)
//
// Configuration section: "GlobalAdmin" in appsettings.json
// ---------------------------------------------------------------------------

using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace BffApi.Services;

// ─── Configuration ───────────────────────────────────────────────────────────

public sealed class GlobalAdminSettings
{
    public const string SectionName = "GlobalAdmin";

    /// <summary>Base URL of the Global Admin API (no trailing slash).</summary>
    public string BaseUrl { get; set; } = "https://apim-globaladmin-uat-jpneast-001.azure-api.net";

    /// <summary>APIM subscription key for authenticating with the Global Admin API.</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>How long to cache a user's roles (default: 30 minutes).</summary>
    public int RoleCacheMinutes { get; set; } = 30;
}

// ─── Interface ───────────────────────────────────────────────────────────────

public interface IRoleProvider
{
    /// <summary>
    /// Returns the business roles for a user (e.g. Distributor, Vendor, Customer, Admin).
    /// Results are cached per userId for the configured TTL.
    /// </summary>
    Task<IReadOnlyList<string>> GetUserRolesAsync(string userId, CancellationToken ct = default);
}

// ─── Live implementation (calls Global Admin API) ────────────────────────────

public sealed class GlobalAdminRoleProvider : IRoleProvider
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IMemoryCache _cache;
    private readonly GlobalAdminSettings _settings;
    private readonly ILogger<GlobalAdminRoleProvider> _logger;

    private static readonly TimeSpan DefaultCacheTtl = TimeSpan.FromMinutes(30);

    public GlobalAdminRoleProvider(
        IHttpClientFactory httpFactory,
        IMemoryCache cache,
        IOptions<GlobalAdminSettings> settings,
        ILogger<GlobalAdminRoleProvider> logger)
    {
        _httpFactory = httpFactory;
        _cache = cache;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> GetUserRolesAsync(string userId, CancellationToken ct = default)
    {
        var cacheKey = $"ga-roles:{userId}";

        if (_cache.TryGetValue<IReadOnlyList<string>>(cacheKey, out var cached) && cached is not null)
        {
            _logger.LogDebug("Global Admin roles cache HIT for user {UserId}: [{Roles}]",
                userId, string.Join(", ", cached));
            return cached;
        }

        try
        {
            var client = _httpFactory.CreateClient("GlobalAdmin");
            var url = $"{_settings.BaseUrl.TrimEnd('/')}/users/{Uri.EscapeDataString(userId)}/roles";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                request.Headers.Add("Ocp-Apim-Subscription-Key", _settings.ApiKey);
            }

            var response = await client.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();

            var roles = await response.Content.ReadFromJsonAsync<string[]>(ct) ?? [];

            var ttl = TimeSpan.FromMinutes(_settings.RoleCacheMinutes > 0
                ? _settings.RoleCacheMinutes
                : DefaultCacheTtl.TotalMinutes);

            _cache.Set(cacheKey, (IReadOnlyList<string>)roles, ttl);

            _logger.LogInformation(
                "Global Admin roles fetched for user {UserId}: [{Roles}] (cached {Minutes} min)",
                userId, string.Join(", ", roles), ttl.TotalMinutes);

            return roles;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch roles from Global Admin API for user {UserId}", userId);
            // On failure, return empty — RBAC will deny access (fail-closed)
            return [];
        }
    }
}

// ─── Mock implementation (development / testing) ─────────────────────────────

/// <summary>
/// Returns mock roles for local development. Every user is a Distributor
/// with all permissions. Replace with <see cref="GlobalAdminRoleProvider"/>
/// once the Global Admin API key is configured.
/// </summary>
public sealed class MockRoleProvider : IRoleProvider
{
    private static readonly IReadOnlyList<string> MockRoles = ["Distributor"];
    private readonly ILogger<MockRoleProvider> _logger;

    public MockRoleProvider(ILogger<MockRoleProvider> logger)
    {
        _logger = logger;
    }

    public Task<IReadOnlyList<string>> GetUserRolesAsync(string userId, CancellationToken ct = default)
    {
        _logger.LogDebug("MockRoleProvider: returning [{Roles}] for user {UserId}",
            string.Join(", ", MockRoles), userId);
        return Task.FromResult(MockRoles);
    }
}
