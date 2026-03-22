namespace Komatsu.ApimMarketplace.Bff.Services;

public interface ITokenProvider
{
    /// <summary>
    /// Acquires an access token for the given scope (e.g.
    /// "https://management.azure.com/.default"). Tokens are cached and
    /// refreshed automatically by the underlying credential.
    /// </summary>
    Task<string> GetTokenAsync(string scope, CancellationToken ct = default);

    /// <summary>
    /// Signals that the current credential's token was rejected by the
    /// upstream API (e.g. ARM returned 403 AuthorizationFailed).
    /// The provider will clear its token cache and permanently switch
    /// to the fallback credential (DefaultAzureCredential).
    /// </summary>
    void InvalidateCredential();
}
