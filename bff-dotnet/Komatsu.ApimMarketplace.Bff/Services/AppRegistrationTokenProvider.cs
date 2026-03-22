// ---------------------------------------------------------------------------
// AppRegistrationTokenProvider — acquires access tokens with automatic
// fallback from service-principal (ClientSecretCredential) to
// DefaultAzureCredential (managed identity / Azure CLI / env vars).
//
// Flow:
//   1. Try ClientSecretCredential (Apim:ServicePrincipal config)
//   2. If the SP token causes an ARM 403 (AuthorizationFailed), the caller
//      invokes InvalidateCredential() and the provider permanently switches
//      to DefaultAzureCredential for all subsequent requests.
//   3. If SP config is incomplete, DefaultAzureCredential is used from the
//      start — no exception on startup.
//
// Configuration:
//   Apim:ServicePrincipal  → { TenantId, ClientId, ClientSecret }
//   Apim:ManagedIdentityClientId → (optional) user-assigned MI client ID
//   Apim:ArmScope          → default "https://management.azure.com/.default"
//   Apim:DataApiScope      → default "https://management.azure.com/.default"
// ---------------------------------------------------------------------------

using Azure.Core;
using Azure.Identity;
using Microsoft.Extensions.Options;

namespace Komatsu.ApimMarketplace.Bff.Services;

// ─── Implementation ──────────────────────────────────────────────────────────

public sealed class AppRegistrationTokenProvider : ITokenProvider
{
    private readonly ClientSecretCredential? _spCredential;
    private readonly DefaultAzureCredential _fallbackCredential;
    private readonly ILogger<AppRegistrationTokenProvider> _logger;

    // In-memory token cache keyed by scope
    private readonly Dictionary<string, AccessToken> _tokenCache = new();
    private readonly SemaphoreSlim _lock = new(1, 1);

    /// <summary>
    /// When true, skip the SP credential and go straight to DefaultAzureCredential.
    /// Set permanently by <see cref="InvalidateCredential"/>.
    /// </summary>
    private volatile bool _spInvalidated;

    public AppRegistrationTokenProvider(
        IOptions<ServicePrincipalSettings> spSettings,
        IOptions<ApimSettings> apimSettings,
        ILogger<AppRegistrationTokenProvider> logger)
    {
        _logger = logger;
        var sp = spSettings.Value;

        // Build SP credential only when fully configured
        if (!string.IsNullOrWhiteSpace(sp.TenantId) &&
            !string.IsNullOrWhiteSpace(sp.ClientId) &&
            !string.IsNullOrWhiteSpace(sp.ClientSecret))
        {
            _spCredential = new ClientSecretCredential(sp.TenantId, sp.ClientId, sp.ClientSecret);
            _logger.LogInformation(
                "AppRegistrationTokenProvider initialised for tenant {TenantId}, client {ClientId}",
                sp.TenantId, sp.ClientId);
        }
        else
        {
            _logger.LogWarning(
                "ServicePrincipal configuration incomplete — will use DefaultAzureCredential only");
        }

        // DefaultAzureCredential picks up managed identity, Azure CLI, env vars, etc.
        var managedIdentityClientId = apimSettings.Value.ManagedIdentityClientId;
        _fallbackCredential = new DefaultAzureCredential(
            new DefaultAzureCredentialOptions
            {
                ManagedIdentityClientId = managedIdentityClientId
            });

        if (!string.IsNullOrWhiteSpace(managedIdentityClientId))
        {
            _logger.LogInformation(
                "DefaultAzureCredential fallback configured with ManagedIdentityClientId {ClientId}",
                managedIdentityClientId);
        }
    }

    /// <inheritdoc />
    public void InvalidateCredential()
    {
        if (_spInvalidated) return;

        _spInvalidated = true;
        _logger.LogWarning(
            "ServicePrincipal credential invalidated (ARM returned 403). " +
            "Switching permanently to DefaultAzureCredential for all subsequent requests.");

        // Clear cached SP tokens so the next call fetches via the fallback
        _lock.Wait();
        try { _tokenCache.Clear(); }
        finally { _lock.Release(); }
    }

    /// <inheritdoc />
    public async Task<string> GetTokenAsync(string scope, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            // Return cached token if still valid (5-min safety buffer)
            if (_tokenCache.TryGetValue(scope, out var cached) &&
                cached.ExpiresOn > DateTimeOffset.UtcNow.AddMinutes(5))
            {
                return cached.Token;
            }

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(30));
            var context = new TokenRequestContext([scope]);

            AccessToken token;

            // Try service principal first (unless invalidated)
            if (_spCredential is not null && !_spInvalidated)
            {
                try
                {
                    _logger.LogDebug("Acquiring token via ServicePrincipal for scope {Scope} ...", scope);
                    token = await _spCredential.GetTokenAsync(context, cts.Token);
                    _tokenCache[scope] = token;
                    _logger.LogInformation(
                        "Access token acquired via ServicePrincipal for scope {Scope}, expires {Expiry}",
                        scope, token.ExpiresOn);
                    return token.Token;
                }
                catch (AuthenticationFailedException ex)
                {
                    _logger.LogWarning(ex,
                        "ServicePrincipal token acquisition failed for scope {Scope}, " +
                        "falling back to DefaultAzureCredential", scope);
                    // Don't permanently invalidate — this was an auth failure, not a 403.
                    // The SP secret may be expired; let the fallback try this time.
                }
            }

            // Fallback to DefaultAzureCredential (managed identity, CLI, etc.)
            _logger.LogDebug("Acquiring token via DefaultAzureCredential for scope {Scope} ...", scope);
            token = await _fallbackCredential.GetTokenAsync(context, cts.Token);
            _tokenCache[scope] = token;
            _logger.LogInformation(
                "Access token acquired via DefaultAzureCredential for scope {Scope}, expires {Expiry}",
                scope, token.ExpiresOn);
            return token.Token;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogError(
                "Token acquisition TIMED OUT after 30s for scope {Scope}. " +
                "Possible causes: (1) corporate proxy/firewall blocking login.microsoftonline.com, " +
                "(2) expired client secret, (3) wrong TenantId for the scope. " +
                "Test manually: az account get-access-token --resource https://management.azure.com",
                scope);
            throw new InvalidOperationException(
                $"Token acquisition timed out for scope '{scope}'. " +
                "Check network access to login.microsoftonline.com and that the client secret is valid.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex,
                "Failed to acquire token for scope {Scope} from both ServicePrincipal " +
                "and DefaultAzureCredential.", scope);
            throw;
        }
        finally
        {
            _lock.Release();
        }
    }
}
