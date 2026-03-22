// ---------------------------------------------------------------------------
// PortalTelemetryHandler — DelegatingHandler that adds the
// x-ms-apim-client header to every outbound APIM Data API request.
//
// This header is required for APIM analytics dashboards to track
// portal traffic. The official APIM Developer Portal sends this on every
// request. Without it, the custom portal's traffic is invisible.
//
// See docs/APIM_DATA_API_COMPARISON.md §4.4
// ---------------------------------------------------------------------------

namespace Komatsu.ApimMarketplace.Bff.Middleware;

/// <summary>
/// Adds <c>x-ms-apim-client</c> header to all outbound HTTP requests
/// made through the named "ArmApi" HttpClient.
/// </summary>
public sealed class PortalTelemetryHandler : DelegatingHandler
{
    private const string HeaderName = "x-ms-apim-client";
    private static readonly string HeaderValue = $"custom-bff-dotnet|{Environment.MachineName}|portal-request";

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.TryAddWithoutValidation(HeaderName, HeaderValue);
        return base.SendAsync(request, ct);
    }
}
