// ---------------------------------------------------------------------------
// ILegacyApiService — Interface for legacy API integration.
//
// Provides a contract for adapters that wrap legacy systems (SOAP, binary, etc.)
// and expose them as modern REST/JSON APIs in the unified catalog.
//
// Implementation patterns:
//   • SoapLegacyApiService — SOAP-based legacy systems
//   • CustomBinaryLegacyAdapter — Binary protocol systems
//
// Models are defined in Models/LegacyModels.cs
// ---------------------------------------------------------------------------

using Komatsu.ApimMarketplace.Bff.Models;

namespace Komatsu.ApimMarketplace.Bff.Services.Legacy;

/// <summary>
/// Interface for legacy API systems (SOAP, binary, custom protocols).
/// Abstracts away protocol details and presents a REST-like interface
/// to the unified catalog.
/// </summary>
public interface ILegacyApiService
{
    /// <summary>
    /// Fetch all APIs available from legacy system.
    /// </summary>
    Task<List<ApiDetail>> GetApisAsync();

    /// <summary>
    /// Fetch specific API metadata from legacy system.
    /// </summary>
    Task<ApiDetail?> GetApiAsync(string apiId);

    /// <summary>
    /// Fetch operation details for a legacy API.
    /// </summary>
    Task<OperationDetail?> GetOperationAsync(string apiId, string operationId);

    /// <summary>
    /// Execute an operation on legacy API.
    /// </summary>
    Task<ApiResponse> ExecuteOperationAsync(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        LegacyAuthToken? authToken = null);

    /// <summary>
    /// Get subscription credentials for legacy API.
    /// </summary>
    Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId);
}
