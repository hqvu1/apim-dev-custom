// ---------------------------------------------------------------------------
// SoapLegacyApiService — Adapter for SOAP-based legacy APIs.
//
// Handles communication with legacy SOAP endpoints and transforms responses
// to modern REST/JSON format for consumption by the unified catalog.
//
// Features:
//   ✅ SOAP envelope creation and parsing
//   ✅ Catalog discovery from SOAP endpoints
//   ✅ Operation execution with request/response transformation
//   ✅ Error handling and logging
//   ✅ Response caching (configurable TTL)
//
// Configuration:
//   appsettings.json:
//     "LegacyApis": {
//       "Soap": {
//         "Endpoint": "https://legacy-api.komatsu.com/soap",
//         "AuthEndpoint": "https://legacy-api.komatsu.com/auth",
//         "TimeoutSeconds": 30,
//         "CacheTTLMinutes": 60
//       }
//     }
//
// Environment variables:
//   LEGACY_SOAP_ENDPOINT=https://legacy-api.komatsu.com/soap
//   LEGACY_AUTH_ENDPOINT=https://legacy-api.komatsu.com/auth
// ---------------------------------------------------------------------------

using System.Text;
using System.Xml;
using System.Xml.Linq;
using Komatsu.ApimMarketplace.Bff.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Komatsu.ApimMarketplace.Bff.Services.Legacy;

/// <summary>
/// Configuration for SOAP legacy API integration.
/// </summary>
public sealed class SoapLegacySettings
{
    public string Endpoint { get; set; } = "https://legacy-api.komatsu.com/soap";
    public string AuthEndpoint { get; set; } = "https://legacy-api.komatsu.com/auth";
    public int TimeoutSeconds { get; set; } = 30;
    public int CacheTTLMinutes { get; set; } = 60;
}

/// <summary>
/// Adapter for SOAP-based legacy API systems.
/// Translates SOAP protocol to REST-like interface.
/// </summary>
public class SoapLegacyApiService(
    HttpClient httpClient,
    IMemoryCache cache,
    IOptionsMonitor<SoapLegacySettings> optionsMonitor,
    ILogger<SoapLegacyApiService> logger) : ILegacyApiService
{
    private const string CatalogCacheKey = "soap-legacy:catalog";

    public async Task<List<ApiDetail>> GetApisAsync()
    {
        logger.LogInformation("Fetching legacy SOAP APIs");

        // Try cache first
        if (cache.TryGetValue(CatalogCacheKey, out List<ApiDetail>? cachedApis))
        {
            logger.LogDebug("Returning cached legacy SOAP APIs ({Count})", cachedApis?.Count ?? 0);
            return cachedApis ?? [];
        }

        try
        {
            var options = optionsMonitor.CurrentValue;

            // Create SOAP request for catalog discovery
            var soapRequest = CreateSoapEnvelope("GetAPICatalog", null);

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(options.TimeoutSeconds));

            var response = await httpClient.PostAsync(
                options.Endpoint,
                new StringContent(soapRequest, Encoding.UTF8, "text/xml"),
                cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Legacy SOAP catalog request failed: {Status}",
                    response.StatusCode);
                return [];
            }

            var xmlContent = await response.Content.ReadAsStringAsync(cts.Token);
            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);

            var apis = ParseSoapCatalog(xmlDoc);

            // Cache the result
            cache.Set(CatalogCacheKey, apis,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(options.CacheTTLMinutes)
                });

            logger.LogInformation("Fetched {Count} legacy SOAP APIs", apis.Count);
            return apis;
        }
        catch (OperationCanceledException)
        {
            logger.LogError("Legacy SOAP catalog request timed out");
            return [];
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching legacy SOAP APIs");
            return [];
        }
    }

    public async Task<ApiDetail?> GetApiAsync(string apiId)
    {
        var apis = await GetApisAsync();
        return apis.FirstOrDefault(a => a.Id == apiId);
    }

    public async Task<OperationDetail?> GetOperationAsync(string apiId, string operationId)
    {
        var api = await GetApiAsync(apiId);
        return api?.Operations.FirstOrDefault(op => op.Id == operationId);
    }

    public async Task<ApiResponse> ExecuteOperationAsync(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        LegacyAuthToken? authToken = null)
    {
        logger.LogInformation(
            "Executing legacy SOAP operation: {ApiId}/{OperationId}",
            apiId, operationId);

        try
        {
            var options = optionsMonitor.CurrentValue;

            // Build SOAP request
            var soapRequest = CreateSoapEnvelope(operationId, request.Payload);

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(options.TimeoutSeconds));

            // Execute SOAP call
            var response = await httpClient.PostAsync(
                $"{options.Endpoint}/{apiId}",
                new StringContent(soapRequest, Encoding.UTF8, "text/xml"),
                cts.Token);

            // Parse SOAP response and convert to JSON
            var xmlContent = await response.Content.ReadAsStringAsync(cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Legacy SOAP operation failed: {Status} | {Content}",
                    response.StatusCode,
                    xmlContent[..Math.Min(500, xmlContent.Length)]);

                return new ApiResponse
                {
                    StatusCode = (int)response.StatusCode,
                    Body = new { error = "Legacy API error", detail = xmlContent }
                };
            }

            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);

            // Convert SOAP response to JSON for portal
            var jsonBody = ConvertSoapResponseToJson(xmlDoc);

            return new ApiResponse
            {
                StatusCode = (int)response.StatusCode,
                Body = jsonBody,
                Headers = response.Headers.ToDictionary(h => h.Key, h => h.Value.FirstOrDefault() ?? "")
            };
        }
        catch (OperationCanceledException)
        {
            logger.LogError("Legacy SOAP operation timed out: {ApiId}/{OperationId}", apiId, operationId);
            return new ApiResponse
            {
                StatusCode = 504,
                Body = new { error = "Request timeout" }
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error executing legacy SOAP operation");
            return new ApiResponse
            {
                StatusCode = 500,
                Body = new { error = ex.Message }
            };
        }
    }

    public async Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId)
    {
        // Implementation depends on subscription storage (DB, cache, etc.)
        // For now, return null; implemented in Phase 2
        return await Task.FromResult<LegacySubscription?>(null);
    }

    /// <summary>
    /// Create a SOAP envelope for the given method and parameters.
    /// </summary>
    private string CreateSoapEnvelope(string methodName, object? parameters)
    {
        var parameterXml = "";

        if (parameters is not null)
        {
            if (parameters is Dictionary<string, object> dict)
            {
                foreach (var kvp in dict)
                {
                    parameterXml += $"<{kvp.Key}>{XmlEscape(kvp.Value?.ToString() ?? "")}</{kvp.Key}>";
                }
            }
            else if (parameters is IDictionary<string, string> stringDict)
            {
                foreach (var kvp in stringDict)
                {
                    parameterXml += $"<{kvp.Key}>{XmlEscape(kvp.Value ?? "")}</{kvp.Key}>";
                }
            }
            else
            {
                // Fallback: serialize as JSON in a Parameters element
                var json = System.Text.Json.JsonSerializer.Serialize(parameters);
                parameterXml = $"<Parameters>{XmlEscape(json)}</Parameters>";
            }
        }

        return $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <{methodName}>
      {parameterXml}
    </{methodName}>
  </soap:Body>
</soap:Envelope>";
    }

    /// <summary>
    /// Parse SOAP catalog response into ApiDetail list.
    /// </summary>
    private List<ApiDetail> ParseSoapCatalog(XmlDocument xmlDoc)
    {
        var apis = new List<ApiDetail>();

        try
        {
            // Adjust XPath based on actual SOAP response structure
            var nsManager = new XmlNamespaceManager(xmlDoc.NameTable);
            nsManager.AddNamespace("soap", "http://schemas.xmlsoap.org/soap/envelope/");

            foreach (XmlNode apiNode in xmlDoc.GetElementsByTagName("API"))
            {
                var apiId = apiNode.SelectSingleNode("ID")?.InnerText ?? "";
                var apiName = apiNode.SelectSingleNode("Name")?.InnerText ?? "";
                var apiDesc = apiNode.SelectSingleNode("Description")?.InnerText ?? "";

                var operations = new List<OperationDetail>();
                foreach (XmlNode opNode in apiNode.SelectNodes("Operations/Operation"))
                {
                    operations.Add(new OperationDetail
                    {
                        Id = opNode.SelectSingleNode("ID")?.InnerText ?? "",
                        Name = opNode.SelectSingleNode("Name")?.InnerText ?? "",
                        Method = "POST", // SOAP methods are always POST
                        Path = apiName,
                        Description = opNode.SelectSingleNode("Description")?.InnerText ?? ""
                    });
                }

                apis.Add(new ApiDetail
                {
                    Id = $"legacy-soap-{apiId}",
                    Name = apiName,
                    Description = apiDesc,
                    Source = "legacy",
                    Protocol = "SOAP",
                    Authentication = "NTLM",
                    SpecUrl = $"{optionsMonitor.CurrentValue.Endpoint}?wsdl",
                    Operations = operations,
                    Deprecation = new DeprecationInfo
                    {
                        Status = "legacy",
                        PlannedRetirement = DateTime.UtcNow.AddYears(2)
                    }
                });
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error parsing SOAP catalog response");
        }

        return apis;
    }

    /// <summary>
    /// Convert SOAP response XML to JSON-compatible object.
    /// </summary>
    private object ConvertSoapResponseToJson(XmlDocument xmlDoc)
    {
        try
        {
            var namespaceManager = new XmlNamespaceManager(xmlDoc.NameTable);
            namespaceManager.AddNamespace("soap", "http://schemas.xmlsoap.org/soap/envelope/");
            
            var body = xmlDoc.SelectSingleNode("//soap:Body", namespaceManager)
                ?? xmlDoc.SelectSingleNode("//soap:Body");

            if (body?.FirstChild is null)
                return new { };

            var resultNode = body.FirstChild;
            var result = new Dictionary<string, object>();

            foreach (XmlNode node in resultNode.ChildNodes)
            {
                result[node.Name] = node.InnerText;
            }

            return result;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error converting SOAP response to JSON");
            return new { error = "Failed to parse response" };
        }
    }

    /// <summary>
    /// Escape string for XML element content.
    /// </summary>
    private static string XmlEscape(string? text)
    {
        return System.Net.WebUtility.HtmlEncode(text ?? "");
    }
}
