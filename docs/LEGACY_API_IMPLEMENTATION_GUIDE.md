# Legacy API Integration — Step-by-Step Implementation Guide

## Overview

This guide walks you through integrating legacy API support into your existing .NET BFF. By the end, you'll have:

✅ Legacy APIs showing in the unified catalog  
✅ Try-It console working for both cloud and legacy APIs  
✅ Automatic Entra ID → legacy auth translation  
✅ Monitoring and audit logging for legacy calls  

---

## Prerequisites

- Existing BFF running on ASP.NET Core 10 Minimal API
- Azure APIM configured with cloud APIs
- Access to legacy API endpoints
- Entra ID authentication already set up

---

## Phase 1: Core Infrastructure (Week 1)

### Step 1.1: Create Legacy API Service Interfaces

Create a new file: `bff-dotnet/Services/ILegacyApiService.cs`

```csharp
namespace BffApi.Services.Legacy;

/// <summary>
/// Interface for interacting with legacy API systems.
/// Abstracts away protocol details (SOAP, binary, etc.)
/// </summary>
public interface ILegacyApiService
{
    /// <summary>
    /// Fetch all APIs available from legacy system
    /// </summary>
    Task<List<ApiDetail>> GetApisAsync();
    
    /// <summary>
    /// Fetch specific API metadata from legacy system
    /// </summary>
    Task<ApiDetail?> GetApiAsync(string apiId);
    
    /// <summary>
    /// Fetch operation details for a legacy API
    /// </summary>
    Task<OperationDetail?> GetOperationAsync(string apiId, string operationId);
    
    /// <summary>
    /// Execute an operation on legacy API
    /// </summary>
    Task<ApiResponse> ExecuteOperationAsync(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        LegacyAuthToken? authToken = null);
    
    /// <summary>
    /// Get subscription credentials for legacy API
    /// </summary>
    Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId);
}

/// <summary>
/// Represents an API from legacy system
/// </summary>
public class ApiDetail
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    
    /// <summary>
    /// API source: "cloud" or "legacy"
    /// </summary>
    public required string Source { get; init; }
    
    /// <summary>
    /// Protocol type: REST, SOAP, CUSTOM, etc.
    /// </summary>
    public required string Protocol { get; init; }
    
    /// <summary>
    /// Authentication method: OAuth2, NTLM, CustomToken, etc.
    /// </summary>
    public required string Authentication { get; init; }
    
    /// <summary>
    /// OpenAPI spec URL (cloud) or WSDL URL (legacy)
    /// </summary>
    public string? SpecUrl { get; init; }
    
    public List<OperationDetail> Operations { get; init; } = [];
    
    /// <summary>
    /// Deprecation metadata (for legacy APIs only)
    /// </summary>
    public DeprecationInfo? Deprecation { get; init; }
}

public class OperationDetail
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Method { get; init; }
    public required string Path { get; init; }
    public string? Description { get; init; }
    public List<ParameterDetail> Parameters { get; init; } = [];
}

public class ParameterDetail
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public bool Required { get; init; }
    public string? Description { get; init; }
}

public class ExecuteApiRequest
{
    public required object Payload { get; init; }
    public Dictionary<string, string>? Headers { get; init; }
}

public class ApiResponse
{
    public required int StatusCode { get; init; }
    public required object? Body { get; init; }
    public Dictionary<string, string>? Headers { get; init; }
}

public class LegacyAuthToken
{
    /// <summary>
    /// Token type: SessionToken, ApiKey, Certificate, etc.
    /// </summary>
    public required string Type { get; init; }
    
    public required string Value { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public class LegacySubscription
{
    public required string Id { get; init; }
    public required string ApiId { get; init; }
    public required string UserId { get; init; }
    public required string Plan { get; init; }
    public DateTime CreatedAt { get; init; }
    
    public required LegacyCredentials Credentials { get; init; }
}

public class LegacyCredentials
{
    public string? ApiKey { get; set; }
    public string? SessionToken { get; set; }
    public string? Certificate { get; set; }
    public string? CustomToken { get; set; }
    public DateTime ExpiryDate { get; set; }
}

public class DeprecationInfo
{
    public required string Status { get; init; } // "active", "deprecated", "legacy"
    public DateTime? PlannedRetirement { get; init; }
    public string? ModernAlternativeId { get; init; }
    public string? MigrationGuide { get; init; }
}
```

### Step 1.2: Create Legacy API Service Implementation

Create: `bff-dotnet/Services/Legacy/SoapLegacyApiService.cs`

```csharp
namespace BffApi.Services.Legacy;

using System.Xml;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;

/// <summary>
/// Implementation for SOAP-based legacy APIs
/// </summary>
public class SoapLegacyApiService(
    HttpClient httpClient,
    ILogger<SoapLegacyApiService> logger) : ILegacyApiService
{
    private readonly string _legacyEndpoint = 
        Environment.GetEnvironmentVariable("LEGACY_SOAP_ENDPOINT") 
        ?? "https://legacy-api.komatsu.com/soap";
    
    public async Task<List<ApiDetail>> GetApisAsync()
    {
        logger.LogInformation("Fetching legacy SOAP APIs from {Endpoint}", _legacyEndpoint);
        
        try
        {
            // Call legacy SOAP endpoint to get catalog
            var soapRequest = CreateSoapEnvelope("GetAPICatalog", null);
            
            var response = await httpClient.PostAsync(
                _legacyEndpoint,
                new StringContent(soapRequest, Encoding.UTF8, "text/xml"));
            
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Legacy SOAP call failed: {Status}", response.StatusCode);
                return [];
            }
            
            var xmlContent = await response.Content.ReadAsStringAsync();
            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);
            
            return ParseSoapCatalog(xmlDoc);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching legacy APIs");
            return [];
        }
    }
    
    public async Task<ApiDetail?> GetApiAsync(string apiId)
    {
        logger.LogInformation("Fetching legacy API: {ApiId}", apiId);
        
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
            "Executing legacy operation: {ApiId}/{OperationId}",
            apiId, operationId);
        
        try
        {
            // Build SOAP request
            var soapRequest = CreateSoapEnvelope(operationId, request.Payload);
            
            // Execute SOAP call
            var response = await httpClient.PostAsync(
                $"{_legacyEndpoint}/{apiId}",
                new StringContent(soapRequest, Encoding.UTF8, "text/xml"));
            
            // Parse SOAP response
            var xmlContent = await response.Content.ReadAsStringAsync();
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
        catch (Exception ex)
        {
            logger.LogError(ex, "Error executing legacy operation");
            return new ApiResponse
            {
                StatusCode = 500,
                Body = new { error = ex.Message }
            };
        }
    }
    
    public async Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId)
    {
        // Implementation depends on how subscriptions are stored (DB, cache, etc.)
        // For now, return null; will be implemented in Phase 2
        return await Task.FromResult<LegacySubscription?>(null);
    }
    
    private string CreateSoapEnvelope(string methodName, object? parameters)
    {
        var parameterXml = "";
        
        if (parameters is not null)
        {
            if (parameters is IDictionary<string, object> dict)
            {
                foreach (var kvp in dict)
                {
                    parameterXml += $"<{kvp.Key}>{XmlEscape(kvp.Value?.ToString() ?? "")}</{kvp.Key}>";
                }
            }
            else
            {
                // Fallback: serialize as JSON, then to XML
                var json = System.Text.Json.JsonSerializer.Serialize(parameters);
                parameterXml = $"<Parameters>{json}</Parameters>";
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
    
    private List<ApiDetail> ParseSoapCatalog(XmlDocument xmlDoc)
    {
        var apis = new List<ApiDetail>();
        
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
                SpecUrl = $"{_legacyEndpoint}?wsdl",
                Operations = operations,
                Deprecation = new DeprecationInfo
                {
                    Status = "legacy",
                    PlannedRetirement = DateTime.UtcNow.AddYears(2)
                }
            });
        }
        
        return apis;
    }
    
    private object ConvertSoapResponseToJson(XmlDocument xmlDoc)
    {
        // Simple SOAP → JSON conversion
        // Production: Use more robust XML-to-JSON library
        
        var body = xmlDoc.SelectSingleNode("//soap:Body");
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
    
    private static string XmlEscape(string? text)
    {
        return System.Net.WebUtility.HtmlEncode(text ?? "");
    }
}
```

### Step 1.3: Create Unified API Service

Update or create: `bff-dotnet/Services/UnifiedApiService.cs`

```csharp
namespace BffApi.Services;

using BffApi.Services.Legacy;
using Microsoft.Extensions.Caching.Memory;

/// <summary>
/// Unified service that aggregates cloud APIM and legacy APIs
/// </summary>
public interface IUnifiedApiService
{
    Task<List<ApiDetail>> GetAllApisAsync();
    Task<ApiDetail?> GetApiAsync(string apiId);
    Task<ApiResponse> ExecuteOperationAsync(string apiId, string operationId, 
        ExecuteApiRequest request, string? userToken = null);
}

public class UnifiedApiService(
    ICloudApiService cloudApi,
    ILegacyApiService legacyApi,
    IMemoryCache cache,
    ILogger<UnifiedApiService> logger) : IUnifiedApiService
{
    private const string CloudApisCacheKey = "unified:cloud-apis";
    private const string LegacyApisCacheKey = "unified:legacy-apis";
    private const int CacheTTLMinutes = 60;
    
    public async Task<List<ApiDetail>> GetAllApisAsync()
    {
        logger.LogInformation("Fetching all APIs (cloud + legacy)");
        
        // Fetch from both sources in parallel
        var cloudTask = GetCloudApisAsync();
        var legacyTask = GetLegacyApisAsync();
        
        await Task.WhenAll(cloudTask, legacyTask);
        
        var cloudApis = await cloudTask;
        var legacyApis = await legacyTask;
        
        // Merge results
        var all = cloudApis.Concat(legacyApis)
            .OrderBy(a => a.Name)
            .ToList();
        
        logger.LogInformation("Found {CloudCount} cloud APIs and {LegacyCount} legacy APIs",
            cloudApis.Count, legacyApis.Count);
        
        return all;
    }
    
    public async Task<ApiDetail?> GetApiAsync(string apiId)
    {
        var all = await GetAllApisAsync();
        return all.FirstOrDefault(a => a.Id == apiId);
    }
    
    public async Task<ApiResponse> ExecuteOperationAsync(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        string? userToken = null)
    {
        logger.LogInformation("Executing operation: {ApiId}/{OperationId}", 
            apiId, operationId);
        
        // Route to correct service based on API ID
        if (apiId.StartsWith("legacy-"))
        {
            return await legacyApi.ExecuteOperationAsync(apiId, operationId, request);
        }
        else
        {
            return await cloudApi.ExecuteOperationAsync(apiId, operationId, request, userToken);
        }
    }
    
    private async Task<List<ApiDetail>> GetCloudApisAsync()
    {
        if (cache.TryGetValue(CloudApisCacheKey, out List<ApiDetail>? cachedApis))
        {
            return cachedApis ?? [];
        }
        
        var apis = await cloudApi.GetApisAsync();
        
        cache.Set(CloudApisCacheKey, apis, 
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheTTLMinutes)
            });
        
        return apis;
    }
    
    private async Task<List<ApiDetail>> GetLegacyApisAsync()
    {
        if (cache.TryGetValue(LegacyApisCacheKey, out List<ApiDetail>? cachedApis))
        {
            return cachedApis ?? [];
        }
        
        var apis = await legacyApi.GetApisAsync();
        
        cache.Set(LegacyApisCacheKey, apis,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheTTLMinutes)
            });
        
        return apis;
    }
}
```

---

## Phase 2: Integration with BFF (Week 2)

### Step 2.1: Register Services in Program.cs

Update `bff-dotnet/Program.cs`:

```csharp
// Add these using statements at the top
using BffApi.Services;
using BffApi.Services.Legacy;

var builder = WebApplication.CreateBuilder(args);

// ... existing code ...

// Add Legacy API Support
builder.Services.AddScoped<ILegacyApiService, SoapLegacyApiService>();
builder.Services.AddScoped<IUnifiedApiService, UnifiedApiService>();

// Configure HTTP client for legacy API calls
builder.Services.AddHttpClient<SoapLegacyApiService>()
    .ConfigureHttpClient(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
        // Add any default headers for legacy API
        client.DefaultRequestHeaders.Add("Accept", "text/xml");
    });

// ... rest of configuration ...
```

### Step 2.2: Update API Endpoints

Update `bff-dotnet/Endpoints/ApisEndpoints.cs`:

```csharp
namespace BffApi.Endpoints;

using BffApi.Services;
using BffApi.Services.Legacy;

public static class ApisEndpoints
{
    public static void MapApisEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/apis")
            .WithName("APIs")
            .WithOpenApi();
        
        // GET all APIs (cloud + legacy)
        group.MapGet("/", GetAllApis)
            .WithName("GetAllApis")
            .WithOpenApi();
        
        // GET specific API
        group.MapGet("/{apiId}", GetApiById)
            .WithName("GetApi")
            .WithOpenApi();
        
        // GET API operations
        group.MapGet("/{apiId}/operations", GetApiOperations)
            .WithName("GetApiOperations")
            .WithOpenApi();
        
        // POST to execute API operation (Try-It)
        group.MapPost("/{apiId}/operations/{operationId}/execute", ExecuteOperation)
            .WithName("ExecuteApiOperation")
            .RequireAuthorization()
            .WithOpenApi();
    }
    
    private static async Task<IResult> GetAllApis(
        IUnifiedApiService apiService)
    {
        var apis = await apiService.GetAllApisAsync();
        return Results.Ok(apis);
    }
    
    private static async Task<IResult> GetApiById(
        string apiId,
        IUnifiedApiService apiService)
    {
        var api = await apiService.GetApiAsync(apiId);
        
        if (api is null)
            return Results.NotFound();
        
        return Results.Ok(api);
    }
    
    private static async Task<IResult> GetApiOperations(
        string apiId,
        IUnifiedApiService apiService)
    {
        var api = await apiService.GetApiAsync(apiId);
        
        if (api is null)
            return Results.NotFound();
        
        return Results.Ok(api.Operations);
    }
    
    private static async Task<IResult> ExecuteOperation(
        string apiId,
        string operationId,
        ExecuteApiRequest request,
        IUnifiedApiService apiService,
        ClaimsPrincipal user,
        ILogger<ApisEndpoints> logger)
    {
        var userEmail = user.FindFirst(ClaimTypes.Email)?.Value ?? "unknown";
        
        logger.LogInformation(
            "User {User} executing operation {ApiId}/{OperationId}",
            userEmail, apiId, operationId);
        
        var result = await apiService.ExecuteOperationAsync(
            apiId,
            operationId,
            request,
            user.FindFirst("access_token")?.Value);
        
        return Results.Json(result, statusCode: result.StatusCode);
    }
}
```

---

## Phase 3: Authentication Bridge (Week 3)

### Step 3.1: Create Authentication Bridge

Create: `bff-dotnet/Services/Legacy/LegacyAuthenticationBridge.cs`

```csharp
namespace BffApi.Services.Legacy;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

/// <summary>
/// Translates Entra ID tokens to legacy authentication formats
/// </summary>
public interface ILegacyAuthenticationBridge
{
    Task<LegacyAuthToken> TranslateTokenAsync(
        ClaimsPrincipal user,
        string targetSystem);
}

public class LegacyAuthenticationBridge(
    HttpClient httpClient,
    IMemoryCache cache,
    ILogger<LegacyAuthenticationBridge> logger) : ILegacyAuthenticationBridge
{
    private readonly string _legacyAuthEndpoint = 
        Environment.GetEnvironmentVariable("LEGACY_AUTH_ENDPOINT") 
        ?? "https://legacy-api.komatsu.com/auth";
    
    public async Task<LegacyAuthToken> TranslateTokenAsync(
        ClaimsPrincipal user,
        string targetSystem)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
        var userEmail = user.FindFirst(ClaimTypes.Email)?.Value ?? "unknown";
        
        logger.LogInformation(
            "Translating token for user {User} to system {System}",
            userEmail, targetSystem);
        
        // Check cache first
        var cacheKey = $"legacy-auth:{userId}:{targetSystem}";
        if (cache.TryGetValue(cacheKey, out LegacyAuthToken? cachedToken))
        {
            if (cachedToken?.ExpiresAt > DateTime.UtcNow)
            {
                logger.LogDebug("Using cached auth token for {User}", userEmail);
                return cachedToken;
            }
        }
        
        // Translate to target format
        var token = targetSystem switch
        {
            "legacy-soap" => await TranslateToSoapSessionAsync(userEmail, userId),
            "legacy-ntlm" => TranslateToNtlmCredentials(userId),
            _ => throw new InvalidOperationException($"Unknown system: {targetSystem}")
        };
        
        // Cache the token
        cache.Set(cacheKey, token,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = token.ExpiresAt - DateTime.UtcNow
            });
        
        return token;
    }
    
    private async Task<LegacyAuthToken> TranslateToSoapSessionAsync(
        string userEmail,
        string userId)
    {
        // Call legacy SOAP authentication endpoint
        var soapRequest = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <Login>
      <username>{XmlEscape(userEmail)}</username>
      <userId>{XmlEscape(userId)}</userId>
    </Login>
  </soap:Body>
</soap:Envelope>";
        
        try
        {
            var response = await httpClient.PostAsync(
                _legacyAuthEndpoint,
                new StringContent(soapRequest, Encoding.UTF8, "text/xml"));
            
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("SOAP auth failed: {Status}", response.StatusCode);
                throw new InvalidOperationException("Legacy auth failed");
            }
            
            // Parse SOAP response
            var xmlContent = await response.Content.ReadAsStringAsync();
            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);
            
            // Extract session token from response
            var sessionToken = xmlDoc.SelectSingleNode("//SessionToken")?.InnerText;
            var expiresInHours = int.TryParse(
                xmlDoc.SelectSingleNode("//ExpiresInHours")?.InnerText ?? "8", 
                out var hours) ? hours : 8;
            
            return new LegacyAuthToken
            {
                Type = "SoapSessionToken",
                Value = sessionToken ?? throw new InvalidOperationException("No session token in response"),
                ExpiresAt = DateTime.UtcNow.AddHours(expiresInHours)
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error translating to SOAP session");
            throw;
        }
    }
    
    private LegacyAuthToken TranslateToNtlmCredentials(string userId)
    {
        // For NTLM, return Kerberos ticket reference
        // (actual auth happens at network level via domain credentials)
        
        return new LegacyAuthToken
        {
            Type = "KerberosTicket",
            Value = $"krb5:{userId}@KOMATSU.COM",
            ExpiresAt = DateTime.UtcNow.AddHours(10)
        };
    }
    
    private static string XmlEscape(string text)
    {
        return System.Net.WebUtility.HtmlEncode(text ?? "");
    }
}
```

### Step 3.2: Register Authentication Bridge

Update `Program.cs`:

```csharp
builder.Services.AddScoped<ILegacyAuthenticationBridge, LegacyAuthenticationBridge>();
```

---

## Phase 4: Legacy Subscriptions (Week 4)

### Step 4.1: Create Legacy Subscription Service

Create: `bff-dotnet/Services/Legacy/LegacySubscriptionService.cs`

```csharp
namespace BffApi.Services.Legacy;

/// <summary>
/// Manages subscriptions to legacy APIs
/// </summary>
public interface ILegacySubscriptionService
{
    Task<LegacySubscription> CreateSubscriptionAsync(
        string apiId,
        string userId,
        string plan);
    
    Task<List<LegacySubscription>> GetUserSubscriptionsAsync(string userId);
    
    Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId);
    
    Task RevokeSubscriptionAsync(string subscriptionId);
}

public class LegacySubscriptionService(
    ILegacyApiService legacyApi,
    IMemoryCache cache,
    ILogger<LegacySubscriptionService> logger) : ILegacySubscriptionService
{
    public async Task<LegacySubscription> CreateSubscriptionAsync(
        string apiId,
        string userId,
        string plan)
    {
        logger.LogInformation(
            "Creating subscription to legacy API {ApiId} for user {UserId} with plan {Plan}",
            apiId, userId, plan);
        
        // Call legacy API to create subscription
        var request = new ExecuteApiRequest
        {
            Payload = new
            {
                userId,
                apiId = apiId.Replace("legacy-soap-", ""),
                plan
            }
        };
        
        var response = await legacyApi.ExecuteOperationAsync(
            apiId,
            "CreateSubscription",
            request);
        
        if (response.StatusCode != 200)
        {
            throw new InvalidOperationException(
                $"Legacy subscription creation failed: {response.StatusCode}");
        }
        
        // Extract credentials from response
        var credentials = ExtractCredentialsFromResponse(response.Body);
        
        // Create subscription record
        var subscription = new LegacySubscription
        {
            Id = Guid.NewGuid().ToString(),
            ApiId = apiId,
            UserId = userId,
            Plan = plan,
            CreatedAt = DateTime.UtcNow,
            Credentials = credentials
        };
        
        // Cache subscription
        var cacheKey = $"legacy-subscription:{subscription.Id}";
        cache.Set(cacheKey, subscription,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
            });
        
        return subscription;
    }
    
    public async Task<List<LegacySubscription>> GetUserSubscriptionsAsync(string userId)
    {
        // Query legacy API for user's subscriptions
        var request = new ExecuteApiRequest
        {
            Payload = new { userId }
        };
        
        var response = await legacyApi.ExecuteOperationAsync(
            "legacy-soap", // placeholder
            "GetUserSubscriptions",
            request);
        
        // Parse response and convert to LegacySubscription list
        // Implementation depends on response format
        
        return [];
    }
    
    public async Task<LegacySubscription?> GetSubscriptionAsync(string subscriptionId)
    {
        var cacheKey = $"legacy-subscription:{subscriptionId}";
        if (cache.TryGetValue(cacheKey, out LegacySubscription? cached))
        {
            return cached;
        }
        
        // Query legacy system
        await Task.Delay(100); // Placeholder
        
        return null;
    }
    
    public async Task RevokeSubscriptionAsync(string subscriptionId)
    {
        logger.LogInformation("Revoking legacy subscription: {SubscriptionId}", subscriptionId);
        
        var subscription = await GetSubscriptionAsync(subscriptionId);
        if (subscription is null)
            throw new InvalidOperationException($"Subscription not found: {subscriptionId}");
        
        // Call legacy API to revoke
        var request = new ExecuteApiRequest
        {
            Payload = new { subscriptionId }
        };
        
        await legacyApi.ExecuteOperationAsync(
            subscription.ApiId,
            "RevokeSubscription",
            request);
        
        // Clear cache
        cache.Remove($"legacy-subscription:{subscriptionId}");
    }
    
    private LegacyCredentials ExtractCredentialsFromResponse(object? body)
    {
        // Parse response body and extract credentials
        // Adjust based on actual legacy API response format
        
        if (body is not JsonElement json)
            return new LegacyCredentials { ExpiryDate = DateTime.UtcNow.AddYears(1) };
        
        return new LegacyCredentials
        {
            ApiKey = json.TryGetProperty("apiKey", out var key) 
                ? key.GetString() 
                : null,
            SessionToken = json.TryGetProperty("sessionToken", out var token) 
                ? token.GetString() 
                : null,
            ExpiryDate = DateTime.UtcNow.AddYears(1)
        };
    }
}
```

### Step 4.2: Register Subscription Service

Update `Program.cs`:

```csharp
builder.Services.AddScoped<ILegacySubscriptionService, LegacySubscriptionService>();
```

### Step 4.3: Create Subscriptions Endpoint

Update `bff-dotnet/Endpoints/SubscriptionsEndpoints.cs`:

```csharp
public static void MapSubscriptionsEndpoints(this WebApplication app)
{
    var group = app.MapGroup("/api/subscriptions")
        .WithName("Subscriptions")
        .RequireAuthorization();
    
    // ... existing cloud subscription endpoints ...
    
    // POST create legacy subscription
    group.MapPost("/legacy/{apiId}", CreateLegacySubscription)
        .WithName("CreateLegacySubscription")
        .WithOpenApi();
    
    // GET user's legacy subscriptions
    group.MapGet("/legacy", GetUserLegacySubscriptions)
        .WithName("GetUserLegacySubscriptions")
        .WithOpenApi();
    
    // DELETE legacy subscription
    group.MapDelete("/legacy/{subscriptionId}", RevokeLegacySubscription)
        .WithName("RevokeLegacySubscription")
        .WithOpenApi();
}

private static async Task<IResult> CreateLegacySubscription(
    string apiId,
    CreateSubscriptionRequest req,
    ClaimsPrincipal user,
    ILegacySubscriptionService legacySubService,
    ILogger<SubscriptionsEndpoints> logger)
{
    var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
    
    try
    {
        var subscription = await legacySubService.CreateSubscriptionAsync(
            apiId, userId, req.Plan);
        
        return Results.Created($"/api/subscriptions/legacy/{subscription.Id}", subscription);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to create legacy subscription");
        return Results.BadRequest(new { error = ex.Message });
    }
}

private static async Task<IResult> GetUserLegacySubscriptions(
    ClaimsPrincipal user,
    ILegacySubscriptionService legacySubService)
{
    var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
    
    var subscriptions = await legacySubService.GetUserSubscriptionsAsync(userId);
    return Results.Ok(subscriptions);
}

private static async Task<IResult> RevokeLegacySubscription(
    string subscriptionId,
    ILegacySubscriptionService legacySubService)
{
    await legacySubService.RevokeSubscriptionAsync(subscriptionId);
    return Results.NoContent();
}
```

---

## Phase 5: Configuration & Monitoring (Week 5)

### Step 5.1: Add Configuration

Update `bff-dotnet/appsettings.json`:

```json
{
  "LegacyApis": {
    "Enabled": true,
    "Soap": {
      "Endpoint": "https://legacy-api.komatsu.com/soap",
      "AuthEndpoint": "https://legacy-api.komatsu.com/auth",
      "TimeoutSeconds": 30,
      "CacheTTLMinutes": 60
    },
    "Monitoring": {
      "LogAllRequests": true,
      "AlertOnFailure": true,
      "FailureThresholdPercent": 5
    }
  }
}
```

### Step 5.2: Add Monitoring Middleware

Create: `bff-dotnet/Middleware/LegacyApiMonitoringMiddleware.cs`

```csharp
namespace BffApi.Middleware;

using System.Diagnostics;

public class LegacyApiMonitoringMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<LegacyApiMonitoringMiddleware> _logger;
    
    public LegacyApiMonitoringMiddleware(
        RequestDelegate next,
        ILogger<LegacyApiMonitoringMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }
    
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api/apis"))
        {
            await _next(context);
            return;
        }
        
        var stopwatch = Stopwatch.StartNew();
        var originalResponseBody = context.Response.Body;
        
        using (var memoryStream = new MemoryStream())
        {
            context.Response.Body = memoryStream;
            
            try
            {
                await _next(context);
                stopwatch.Stop();
                
                var user = context.User?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "anonymous";
                
                _logger.LogInformation(
                    "Legacy API call: {Path} | User: {User} | Status: {Status} | Duration: {Duration}ms",
                    context.Request.Path,
                    user,
                    context.Response.StatusCode,
                    stopwatch.ElapsedMilliseconds);
                
                // Application Insights tracking
                var telemetryClient = context.RequestServices
                    .GetRequiredService<TelemetryClient>();
                
                telemetryClient.TrackEvent("LegacyApiCall", new Dictionary<string, string>
                {
                    { "path", context.Request.Path.Value ?? "" },
                    { "user", user },
                    { "status", context.Response.StatusCode.ToString() }
                }, new Dictionary<string, double>
                {
                    { "duration_ms", stopwatch.ElapsedMilliseconds }
                });
            }
            finally
            {
                await memoryStream.CopyToAsync(originalResponseBody);
            }
        }
    }
}
```

Register in `Program.cs`:

```csharp
app.UseMiddleware<LegacyApiMonitoringMiddleware>();
```

---

## Phase 6: Portal UI Updates (Week 5-6)

### Step 6.1: Update API Card Component

In your React SPA, update the API card to show legacy indicators:

```tsx
// src/components/ApiCard/ApiCard.tsx
interface ApiCardProps {
  api: ApiDetail;
}

export function ApiCard({ api }: ApiCardProps) {
  const isLegacy = api.source === 'legacy';
  
  return (
    <Card
      sx={{
        borderLeft: isLegacy ? '4px solid #ff9800' : '4px solid #4caf50',
        opacity: isLegacy && api.deprecation?.status === 'legacy' ? 0.85 : 1
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6">{api.name}</Typography>
          {isLegacy && (
            <Chip
              icon={<WarningIcon fontSize="small" />}
              label="Legacy"
              color="warning"
              size="small"
              variant="outlined"
            />
          )}
          {api.protocol && (
            <Chip
              label={api.protocol}
              size="small"
              variant="filled"
            />
          )}
        </Box>
        
        <Typography color="textSecondary" variant="body2" paragraph>
          {api.description}
        </Typography>
        
        {isLegacy && api.deprecation && (
          <Alert severity="warning" icon={<InfoIcon />}>
            <Typography variant="caption">
              This is a legacy API. 
              {api.deprecation.plannedRetirement && (
                <> Planned for retirement: <strong>
                  {new Date(api.deprecation.plannedRetirement).toLocaleDateString()}
                </strong></>
              )}
              {api.deprecation.modernAlternativeId && (
                <> See <Link>{api.deprecation.modernAlternativeId}</Link> for modern alternative.</>
              )}
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 6.2: Update Try-It Console

```tsx
// src/components/TryIt/TryItConsole.tsx
interface TryItProps {
  api: ApiDetail;
  operation: OperationDetail;
}

export function TryItConsole({ api, operation }: TryItProps) {
  const isLegacy = api.source === 'legacy';
  
  return (
    <Box>
      {isLegacy && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>Legacy API</AlertTitle>
          This API uses {api.protocol} protocol. Your request will be translated
          to the legacy format and back to JSON automatically.
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit}>
        {/* Request body input */}
        <TextField
          fullWidth
          multiline
          rows={10}
          label="Request Body (JSON)"
          value={requestBody}
          onChange={(e) => setRequestBody(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <Button variant="contained" type="submit">
          Execute
        </Button>
      </Box>
      
      {response && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Response (Status: {response.statusCode})</Typography>
          <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <pre>{JSON.stringify(response.body, null, 2)}</pre>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
```

---

## Testing Checklist

### Unit Tests

```csharp
// bff-dotnet/Tests/SoapLegacyApiServiceTests.cs

[TestClass]
public class SoapLegacyApiServiceTests
{
    private Mock<HttpClient> _httpClientMock;
    private Mock<ILogger<SoapLegacyApiService>> _loggerMock;
    private SoapLegacyApiService _service;
    
    [TestInitialize]
    public void Setup()
    {
        _httpClientMock = new Mock<HttpClient>();
        _loggerMock = new Mock<ILogger<SoapLegacyApiService>>();
        _service = new SoapLegacyApiService(_httpClientMock.Object, _loggerMock.Object);
    }
    
    [TestMethod]
    public async Task GetApisAsync_ReturnsApis_WhenResponseIsValid()
    {
        // Arrange
        var soapResponse = @"<?xml version=""1.0""?>
<soap:Envelope>
  <soap:Body>
    <APIs>
      <API>
        <ID>api-1</ID>
        <Name>Test API</Name>
      </API>
    </APIs>
  </soap:Body>
</soap:Envelope>";
        
        // Act
        var result = await _service.GetApisAsync();
        
        // Assert
        Assert.IsNotNull(result);
        Assert.IsTrue(result.Count > 0);
    }
    
    [TestMethod]
    public async Task ExecuteOperationAsync_ReturnsJsonResponse()
    {
        // Arrange
        var request = new ExecuteApiRequest { Payload = new { } };
        
        // Act
        var result = await _service.ExecuteOperationAsync(
            "legacy-soap-auth",
            "GetUser",
            request);
        
        // Assert
        Assert.IsNotNull(result);
        Assert.IsTrue(result.StatusCode >= 200 && result.StatusCode < 300);
    }
}
```

### Integration Tests

```csharp
[TestClass]
public class LegacyApiIntegrationTests
{
    private WebApplicationFactory<Program> _factory;
    private HttpClient _client;
    
    [TestInitialize]
    public void Setup()
    {
        _factory = new WebApplicationFactory<Program>();
        _client = _factory.CreateClient();
    }
    
    [TestMethod]
    public async Task GetAllApis_ReturnsBothCloudAndLegacyApis()
    {
        // Arrange
        var token = await GetAuthToken();
        _client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await _client.GetAsync("/api/apis");
        
        // Assert
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsAsync<List<ApiDetail>>();
        
        Assert.IsTrue(json.Any(a => a.Source == "cloud"));
        Assert.IsTrue(json.Any(a => a.Source == "legacy"));
    }
}
```

---

## Deployment Checklist

- [ ] Legacy API endpoints configured in `.env`
- [ ] SOAP endpoint responds to test requests
- [ ] Authentication method for legacy system determined
- [ ] Caching TTLs tuned for your environment
- [ ] BFF build passes without errors
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Portal shows legacy APIs in catalog
- [ ] Try-It console works for legacy APIs
- [ ] Subscriptions created for legacy APIs
- [ ] Monitoring alerts configured
- [ ] Legacy API deprecation warnings visible in UI
- [ ] Documentation updated with legacy API info

---

## Environment Variables

```
LEGACY_SOAP_ENDPOINT=https://legacy-api.komatsu.com/soap
LEGACY_AUTH_ENDPOINT=https://legacy-api.komatsu.com/auth
LEGACY_API_CACHE_TTL_MINUTES=60
LEGACY_ENABLE_MONITORING=true
```

---

## Next Steps

1. **Assess Your Legacy APIs** — Map each legacy system to adapter pattern (SOAP, binary, REST)
2. **Prioritize Integration** — Start with highest-value legacy APIs first
3. **Security Review** — Ensure credential handling meets compliance requirements
4. **Load Testing** — Test with realistic legacy API response times
5. **User Communication** — Update developer docs with legacy API usage

---

## Troubleshooting

### Problem: Legacy API returns 500 error
**Solution:** Enable detailed SOAP logging, check legacy endpoint auth, verify network connectivity

### Problem: Token translation fails
**Solution:** Validate Entra ID token claims, check legacy auth endpoint, add debug logging

### Problem: High latency for legacy calls
**Solution:** Increase cache TTL, batch requests where possible, consider request queuing

---

## References

- [LEGACY_API_INTEGRATION.md](./LEGACY_API_INTEGRATION.md) — Complete architecture
- [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) — System overview
- [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md) — Authorization for all API types
