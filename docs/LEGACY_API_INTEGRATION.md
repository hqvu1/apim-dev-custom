# Legacy API Integration Strategy — Komatsu API Marketplace

## Executive Summary

**The Challenge:** Some Komatsu legacy APIs cannot be onboarded to Azure APIM due to:
- Proprietary protocols (SOAP, legacy binary protocols)
- Custom authentication mechanisms
- Network constraints (on-premises only, air-gapped)
- Platform limitations (mainframe, unsupported OS)
- Regulatory/compliance restrictions
- High cost/risk of modernization

**The Solution:** Implement a **hybrid catalog approach** where:
1. **Cloud-native APIs** → Directly in APIM (primary path)
2. **Legacy APIs** → Integrated via adapters/proxies (secondary path)
3. **Unified portal** → Single discovery experience for both
4. **Gradual migration** → Modernize legacy systems over time

---

## 1. Legacy API Integration Patterns

### Pattern 1A: API Gateway Adapter (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                    SPA (React)                              │
│              Unified API Discovery Portal                   │
└────────────────┬────────────────────────────────────────────┘
                 │
        Single Bearer token (Entra ID)
                 │
    ┌────────────▼────────────────┐
    │                             │
    ▼                             ▼
┌─────────────────┐         ┌──────────────────┐
│  Azure APIM     │         │  Legacy Gateway  │
│                 │         │  (Adapter)       │
│  • REST APIs    │         │                  │
│  • Cloud-native │         │  • SOAP wrapper  │
│  • OpenAPI      │         │  • Binary proto  │
│  • Modern auth  │         │  • Legacy auth   │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │                  ┌────────┴──────────┐
         │                  ▼                   ▼
    ┌────▼─────────┐   ┌─────────┐        ┌─────────┐
    │ Cloud APIs   │   │ SOAP    │        │ Legacy  │
    │ REST/GraphQL │   │ Backend │        │ System  │
    └──────────────┘   └─────────┘        │(on-prem)│
                                          └─────────┘
```

### Pattern 1B: Service Adapter Sidecar

```
Legacy System with Sidecar Adapter
┌──────────────────────────────────────┐
│  Legacy System (SOAP, Binary, etc.)  │
├──────────────────────────────────────┤
│  Sidecar Adapter Container           │
│  • Translates requests                │
│  • Handles authentication             │
│  • Converts to REST/OpenAPI           │
│  • Proxies to APIM registry           │
└─────────────┬────────────────────────┘
              │
              │ Registers as APIM API
              │
              ▼
         ┌──────────┐
         │ APIM     │
         │ Unified  │
         │ Registry │
         └──────────┘
```

---

## 2. Detailed Architecture: Dual-Source Portal

### **Component Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                          SPA Portal                             │
│                                                                 │
│  [API Catalog] [Search] [Filter] [Try-It] [Subscriptions]     │
│                                                                 │
│  • Single search across cloud + legacy APIs                    │
│  • Unified authentication (Entra ID)                           │
│  • Consistent UI for both API types                            │
│  • Same Try-It console experience                              │
│  • Unified subscription management                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
              JWT Bearer token
                  │
    ┌─────────────▼──────────────┐
    │    BFF (.NET)              │
    │                            │
    │  ┌────────────────────────┐│
    │  │ Unified Catalog API    ││
    │  │                        ││
    │  │ GET /api/apis          ││ ← Aggregates from both sources
    │  │ GET /api/apis/{id}     ││
    │  │ POST /api/try          ││
    │  │ POST /api/subscriptions││
    │  └────────────────────────┘│
    │                            │
    │  ┌──────────────────────────────────────┐
    │  │ Data Layer (Dual Source)             │
    │  │                                      │
    │  │  ICloudApiService    ILegacyApiService
    │  │  ├─ GetApis()        ├─ GetApis()
    │  │  ├─ GetOperations()  ├─ GetOperations()
    │  │  ├─ Execute()        ├─ Execute()
    │  │  └─ Subscribe()      └─ Subscribe()
    │  └──────────────────────────────────────┘
    │                            │
    └────────────┬───────────────┴──────────────┘
                 │              │
        ┌────────┴──┐       ┌──┴────────┐
        ▼           ▼       ▼           ▼
     ─────────── ARM API  Legacy   Legacy
    │ Azure APIM │        Gateway  System
    │ (REST)     │        (SOAP)   (Binary)
    └────────────┘
```

### **API Aggregation Logic**

```csharp
public interface IUnifiedApiService
{
    /// <summary>
    /// Get all APIs (both cloud + legacy)
    /// </summary>
    Task<List<ApiDetail>> GetAllApisAsync();
    
    /// <summary>
    /// Get API by ID (routes to correct source)
    /// </summary>
    Task<ApiDetail?> GetApiAsync(string apiId);
    
    /// <summary>
    /// Execute API operation on either cloud or legacy
    /// </summary>
    Task<ApiResponse> ExecuteOperationAsync(
        string apiId, 
        string operationId, 
        ExecuteApiRequest request);
}

public class UnifiedApiService(
    ICloudApiService cloudApi,
    ILegacyApiService legacyApi) : IUnifiedApiService
{
    public async Task<List<ApiDetail>> GetAllApisAsync()
    {
        // Fetch from both sources in parallel
        var cloudApis = await cloudApi.GetApisAsync();
        var legacyApis = await legacyApi.GetApisAsync();
        
        // Merge results with metadata indicating source
        var combined = cloudApis.Concat(legacyApis)
            .OrderBy(a => a.Name)
            .ToList();
        
        return combined;
    }
    
    public async Task<ApiDetail?> GetApiAsync(string apiId)
    {
        // Check if API is in cloud or legacy catalog
        if (apiId.StartsWith("legacy-"))
        {
            return await legacyApi.GetApiAsync(apiId);
        }
        else
        {
            return await cloudApi.GetApiAsync(apiId);
        }
    }
    
    public async Task<ApiResponse> ExecuteOperationAsync(
        string apiId, 
        string operationId, 
        ExecuteApiRequest request)
    {
        if (apiId.StartsWith("legacy-"))
        {
            // Route to legacy gateway
            return await legacyApi.ExecuteOperationAsync(apiId, operationId, request);
        }
        else
        {
            // Route to APIM
            return await cloudApi.ExecuteOperationAsync(apiId, operationId, request);
        }
    }
}
```

---

## 3. Legacy API Gateway Implementation

### **Pattern: Adapter Wrapper**

```csharp
/// <summary>
/// ILegacyApiService — Implements same interface as cloud APIs
/// but translates requests/responses for legacy systems
/// </summary>
public interface ILegacyApiService
{
    Task<List<ApiDetail>> GetApisAsync();
    Task<ApiDetail?> GetApiAsync(string apiId);
    Task<OperationDetail?> GetOperationAsync(string apiId, string opId);
    Task<ApiResponse> ExecuteOperationAsync(string apiId, string opId, ExecuteApiRequest request);
}

/// <summary>
/// Adapter for SOAP-based legacy systems
/// </summary>
public class SoapLegacyAdapter(
    HttpClient httpClient,
    ILogger<SoapLegacyAdapter> logger) : ILegacyApiService
{
    private const string LegacyCatalogUrl = "https://legacy-api.komatsu.com/soap";
    
    public async Task<List<ApiDetail>> GetApisAsync()
    {
        // Call SOAP GetAPICatalog (or equivalent SOAP method)
        var soapRequest = CreateSoapEnvelope("GetAPICatalog", new { });
        var response = await httpClient.PostAsync(LegacyCatalogUrl, 
            new StringContent(soapRequest, Encoding.UTF8, "text/xml"));
        
        // Parse SOAP response
        var xmlDoc = new XmlDocument();
        xmlDoc.LoadXml(await response.Content.ReadAsStringAsync());
        
        // Convert to ApiDetail list
        return TransformSoapToCatalog(xmlDoc);
    }
    
    public async Task<ApiResponse> ExecuteOperationAsync(
        string apiId, 
        string opId, 
        ExecuteApiRequest request)
    {
        // Build SOAP request for specific operation
        var soapRequest = CreateSoapEnvelope(opId, request.Payload);
        
        // Call legacy endpoint
        var response = await httpClient.PostAsync($"{LegacyCatalogUrl}/{apiId}",
            new StringContent(soapRequest, Encoding.UTF8, "text/xml"));
        
        // Parse SOAP response, convert to JSON
        var xmlDoc = new XmlDocument();
        xmlDoc.LoadXml(await response.Content.ReadAsStringAsync());
        
        return new ApiResponse
        {
            StatusCode = response.StatusCode,
            Body = TransformSoapResponseToJson(xmlDoc)
        };
    }
    
    private string CreateSoapEnvelope(string method, object? parameters)
    {
        return $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <{method}>
      {SerializeParameters(parameters)}
    </{method}>
  </soap:Body>
</soap:Envelope>";
    }
    
    private List<ApiDetail> TransformSoapToCatalog(XmlDocument xmlDoc)
    {
        // Parse XML, extract API details, convert to standard format
        var apis = new List<ApiDetail>();
        foreach (XmlNode apiNode in xmlDoc.GetElementsByTagName("API"))
        {
            apis.Add(new ApiDetail
            {
                Id = $"legacy-{apiNode.SelectSingleNode("ID")?.InnerText}",
                Name = apiNode.SelectSingleNode("Name")?.InnerText ?? "",
                Description = apiNode.SelectSingleNode("Description")?.InnerText ?? "",
                Source = ApiSource.Legacy,
                Operations = ExtractOperations(apiNode)
            });
        }
        return apis;
    }
}

/// <summary>
/// Adapter for custom binary-protocol legacy systems
/// </summary>
public class CustomBinaryLegacyAdapter(
    ILogger<CustomBinaryLegacyAdapter> logger) : ILegacyApiService
{
    private const string LegacyServerHost = "legacy-compute.internal";
    private const int LegacyServerPort = 5000; // Custom port
    
    public async Task<ApiResponse> ExecuteOperationAsync(
        string apiId,
        string opId,
        ExecuteApiRequest request)
    {
        // For binary protocols: Establish socket connection
        using var socket = new Socket(AddressFamily.InterNetwork, 
            SocketType.Stream, ProtocolType.Tcp);
        
        await socket.ConnectAsync(LegacyServerHost, LegacyServerPort);
        
        // Serialize request to custom binary format
        var binaryRequest = SerializeToBinary(apiId, opId, request.Payload);
        
        // Send request
        await socket.SendAsync(new ArraySegment<byte>(binaryRequest),
            SocketFlags.None);
        
        // Receive response
        var buffer = new byte[8192];
        var received = await socket.ReceiveAsync(new ArraySegment<byte>(buffer),
            SocketFlags.None);
        
        // Deserialize response from binary
        var response = DeserializeFromBinary(buffer.Take(received).ToArray());
        
        return response;
    }
    
    private byte[] SerializeToBinary(string apiId, string opId, object? payload)
    {
        // Custom binary protocol serialization
        // (Implementation depends on legacy protocol)
        throw new NotImplementedException("Implement based on legacy protocol");
    }
}
```

---

## 4. API Metadata & Catalog Management

### **Dual-Source Metadata**

```json
// Cloud API (from APIM)
{
  "id": "api-auth",
  "name": "Authentication API",
  "description": "Modern REST authentication service",
  "source": "cloud",
  "protocol": "REST",
  "authentication": "OAuth2",
  "openApiSpec": "https://apim.azure.com/specs/auth.json",
  "operations": [
    {
      "id": "login",
      "method": "POST",
      "path": "/auth/login",
      "parameters": [...]
    }
  ]
}

// Legacy API (converted to standard format)
{
  "id": "legacy-auth-system",
  "name": "Legacy Authentication System",
  "description": "SOAP-based authentication (planned for migration)",
  "source": "legacy",
  "protocol": "SOAP",
  "authentication": "NTLM",
  "soapWsdl": "https://legacy-api.komatsu.com/auth?wsdl",
  "deprecationStatus": "legacy",
  "plannedRetirement": "2027-12-31",
  "modernAlternative": "api-auth",
  "operations": [
    {
      "id": "authenticate",
      "method": "POST",
      "soapAction": "Authenticate",
      "parameters": [...]
    }
  ]
}
```

---

## 5. Authentication Bridge

### **Problem: Legacy systems don't accept Entra ID tokens**

### **Solution: Token Translation Layer**

```csharp
public interface ILegacyAuthenticationBridge
{
    /// <summary>
    /// Convert Entra ID JWT to legacy authentication format
    /// </summary>
    Task<LegacyAuthToken> TranslateTokenAsync(
        string entraIdJwt, 
        string targetSystem);
}

public class LegacyAuthenticationBridge(
    HttpClient httpClient,
    ITokenProvider tokenProvider,
    ILogger<LegacyAuthenticationBridge> logger) : ILegacyAuthenticationBridge
{
    public async Task<LegacyAuthToken> TranslateTokenAsync(
        string entraIdJwt,
        string targetSystem)
    {
        // Extract user info from Entra ID JWT
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(entraIdJwt);
        
        var userId = jwtToken.Claims.FirstOrDefault(c => c.Type == "oid")?.Value;
        var userEmail = jwtToken.Claims.FirstOrDefault(c => c.Type == "email")?.Value;
        
        return targetSystem switch
        {
            "legacy-soap" => await TranslateToSoapCredentialsAsync(userId, userEmail),
            "legacy-ntlm" => TranslateToNtlmCredentials(userId),
            "legacy-custom" => await TranslateToCustomProtocolAsync(userId, userEmail),
            _ => throw new InvalidOperationException($"Unknown target system: {targetSystem}")
        };
    }
    
    private async Task<LegacyAuthToken> TranslateToSoapCredentialsAsync(
        string userId, 
        string userEmail)
    {
        // Call legacy SOAP authentication endpoint
        var soapRequest = $@"<soap:Envelope>
            <soap:Body>
                <Login>
                    <username>{userEmail}</username>
                    <sessionToken>{Guid.NewGuid()}</sessionToken>
                </Login>
            </soap:Body>
        </soap:Envelope>";
        
        var response = await httpClient.PostAsync(
            "https://legacy-api.komatsu.com/auth",
            new StringContent(soapRequest, Encoding.UTF8, "text/xml"));
        
        // Parse SOAP response to extract session token
        var xmlDoc = new XmlDocument();
        xmlDoc.LoadXml(await response.Content.ReadAsStringAsync());
        
        var sessionToken = xmlDoc.SelectSingleNode("//SessionToken")?.InnerText;
        
        return new LegacyAuthToken
        {
            Type = LegacyAuthType.SoapSessionToken,
            Value = sessionToken,
            ExpiresIn = TimeSpan.FromHours(8)
        };
    }
    
    private LegacyAuthToken TranslateToNtlmCredentials(string userId)
    {
        // For NTLM: Use Kerberos ticket or service account
        // This is typically handled at the network level via domain credentials
        return new LegacyAuthToken
        {
            Type = LegacyAuthType.KerberosTicket,
            Value = $"krb5:{userId}@KOMATSU.COM",
            ExpiresIn = TimeSpan.FromHours(10)
        };
    }
}
```

---

## 6. Try-It Console for Legacy APIs

### **Problem: Legacy APIs don't accept REST/JSON in Try-It console**

### **Solution: Request/Response Transformation**

```csharp
public class LegacyTryItHandler(
    ILegacyApiService legacyApi,
    ILegacyAuthenticationBridge authBridge,
    ILogger<LegacyTryItHandler> logger)
{
    public async Task<ApiResponse> ExecuteTryItAsync(
        string apiId,
        string operationId,
        string entraIdToken,
        string requestBody)
    {
        logger.LogInformation(
            "Legacy Try-It: {ApiId} / {OperationId}",
            apiId, operationId);
        
        // Step 1: Translate Entra ID token to legacy auth format
        var legacyAuth = await authBridge.TranslateTokenAsync(
            entraIdToken, 
            apiId);
        
        // Step 2: Transform REST/JSON request to legacy format (SOAP, binary, etc.)
        var legacyRequest = TransformRequestFormat(
            apiId, 
            operationId, 
            requestBody, 
            legacyAuth);
        
        // Step 3: Execute on legacy system
        var legacyResponse = await legacyApi.ExecuteOperationAsync(
            apiId, 
            operationId, 
            new ExecuteApiRequest { Payload = legacyRequest });
        
        // Step 4: Transform legacy response back to REST/JSON for SPA
        var jsonResponse = TransformResponseFormat(
            apiId, 
            operationId, 
            legacyResponse);
        
        logger.LogInformation(
            "Legacy Try-It completed: {Status}",
            legacyResponse.StatusCode);
        
        return jsonResponse;
    }
    
    private ExecuteApiRequest TransformRequestFormat(
        string apiId,
        string operationId,
        string requestBody,
        LegacyAuthToken auth)
    {
        return apiId switch
        {
            "legacy-soap-*" => TransformJsonToSoap(requestBody, auth),
            "legacy-binary-*" => TransformJsonToBinary(requestBody, auth),
            _ => throw new InvalidOperationException($"Unknown API format: {apiId}")
        };
    }
    
    private ExecuteApiRequest TransformJsonToSoap(
        string jsonBody, 
        LegacyAuthToken auth)
    {
        // Parse JSON, map to SOAP XML structure
        var json = JsonDocument.Parse(jsonBody);
        var root = json.RootElement;
        
        var soapBody = new StringBuilder();
        soapBody.Append("<soap:Body>");
        
        foreach (var property in root.EnumerateObject())
        {
            soapBody.Append($"<{property.Name}>{property.Value}</{property.Name}>");
        }
        
        soapBody.Append("</soap:Body>");
        
        return new ExecuteApiRequest { Payload = soapBody.ToString() };
    }
}
```

---

## 7. Subscription & Credential Management for Legacy

### **Handling Legacy API Keys/Credentials**

```csharp
public interface ILegacySubscriptionService
{
    /// <summary>
    /// Create subscription to legacy API
    /// Returns credentials in legacy format
    /// </summary>
    Task<LegacySubscription> CreateSubscriptionAsync(
        string apiId,
        string userId,
        string plan);
    
    /// <summary>
    /// Get active legacy subscriptions for user
    /// </summary>
    Task<List<LegacySubscription>> GetUserSubscriptionsAsync(string userId);
    
    /// <summary>
    /// Revoke legacy subscription and cleanup credentials
    /// </summary>
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
        // Step 1: Call legacy subscription endpoint
        var legacyRequest = new CreateSubscriptionRequest
        {
            UserId = userId,
            ApiId = apiId,
            Plan = plan
        };
        
        var response = await legacyApi.ExecuteOperationAsync(
            apiId,
            "CreateSubscription",
            new ExecuteApiRequest { Payload = legacyRequest });
        
        // Step 2: Extract credentials from response
        var credentials = ExtractLegacyCredentials(response);
        
        // Step 3: Create subscription record
        var subscription = new LegacySubscription
        {
            Id = Guid.NewGuid().ToString(),
            ApiId = apiId,
            UserId = userId,
            Plan = plan,
            CreatedAt = DateTime.UtcNow,
            Status = SubscriptionStatus.Active,
            Credentials = credentials // Legacy format (API key, session token, etc.)
        };
        
        logger.LogInformation(
            "Created legacy subscription: {SubscriptionId} for user {UserId}",
            subscription.Id, userId);
        
        return subscription;
    }
    
    private LegacyCredentials ExtractLegacyCredentials(ApiResponse response)
    {
        // Parse response based on legacy API format
        // Return credentials as-is (don't transform to APIM format)
        // These will be passed back to user in their original format
        
        return new LegacyCredentials
        {
            ApiKey = response.Body?["apiKey"]?.ToString(),
            SessionToken = response.Body?["sessionToken"]?.ToString(),
            ExpiryDate = DateTime.UtcNow.AddYears(1)
        };
    }
}

public class LegacySubscription
{
    public required string Id { get; init; }
    public required string ApiId { get; init; }
    public required string UserId { get; init; }
    public required string Plan { get; init; }
    public DateTime CreatedAt { get; init; }
    public SubscriptionStatus Status { get; init; }
    
    /// <summary>
    /// Credentials in legacy format (not standard APIM key format)
    /// </summary>
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
```

---

## 8. Portal UI/UX for Mixed API Types

### **SPA Display Logic**

```tsx
// React component for API card
interface ApiCardProps {
  api: ApiDetail;
}

export function ApiCard({ api }: ApiCardProps) {
  const isLegacy = api.source === 'legacy';
  
  return (
    <Card
      sx={{
        borderLeft: isLegacy ? '4px solid #ff9800' : '4px solid #4caf50'
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">{api.name}</Typography>
          {isLegacy && (
            <Chip 
              label="Legacy" 
              color="warning" 
              size="small"
              icon={<WarningIcon />}
            />
          )}
        </Box>
        
        <Typography color="textSecondary" variant="body2">
          {api.description}
        </Typography>
        
        {isLegacy && api.deprecationStatus && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="caption">
              This API is legacy and planned for retirement on{' '}
              <strong>{api.plannedRetirement}</strong>
              {api.modernAlternative && (
                <>
                  . Please migrate to{' '}
                  <Link href={`/apis/${api.modernAlternative}`}>
                    {api.modernAlternative}
                  </Link>
                  .
                </>
              )}
            </Typography>
          </Alert>
        )}
        
        <Box display="flex" gap={1} mt={2}>
          <ProtocolBadge protocol={api.protocol} />
          <AuthBadge auth={api.authentication} />
        </Box>
      </CardContent>
      
      <CardActions>
        <Button size="small">View Details</Button>
        <Button size="small">Try It</Button>
      </CardActions>
    </Card>
  );
}

// Try-It handler recognizes legacy APIs
function TryItConsole({ api }: { api: ApiDetail }) {
  if (api.source === 'legacy') {
    return (
      <Box>
        <Alert severity="info">
          This is a legacy API. Request/response format will be translated
          automatically between REST/JSON and {api.protocol}.
        </Alert>
        <LegacyTryItForm api={api} />
      </Box>
    );
  }
  
  return <ModernTryItConsole api={api} />;
}
```

---

## 9. Data Synchronization Strategy

### **Keeping Catalogs in Sync**

```csharp
public interface ICatalogSyncService
{
    /// <summary>
    /// Periodically sync legacy API catalog from source
    /// </summary>
    Task SyncLegacyApisAsync();
    
    /// <summary>
    /// Detect when cloud APIM catalog changes
    /// </summary>
    Task SyncCloudApisAsync();
}

public class CatalogSyncService(
    ICloudApiService cloudApi,
    ILegacyApiService legacyApi,
    IMemoryCache cache,
    ILogger<CatalogSyncService> logger) : ICatalogSyncService
{
    public async Task SyncLegacyApisAsync()
    {
        try
        {
            logger.LogInformation("Starting legacy API catalog sync");
            
            // Fetch fresh legacy API catalog
            var legacyApis = await legacyApi.GetApisAsync();
            
            // Clear cache to force refresh
            cache.Remove("legacy:apis");
            cache.Set("legacy:apis", legacyApis, 
                new MemoryCacheEntryOptions 
                { 
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1) 
                });
            
            logger.LogInformation(
                "Synced {Count} legacy APIs", 
                legacyApis.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Legacy catalog sync failed");
            // Fallback: use cached version
        }
    }
    
    public async Task SyncCloudApisAsync()
    {
        // APIM catalog changes are detected via:
        // • Webhook subscriptions (real-time)
        // • Periodic polling (1-hour TTL on cache)
        // • Manual invalidation via admin API
        
        var cloudApis = await cloudApi.GetApisAsync();
        cache.Remove("cloud:apis");
        cache.Set("cloud:apis", cloudApis,
            new MemoryCacheEntryOptions 
            { 
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1) 
            });
    }
}

// Hosted service for periodic sync
public class CatalogSyncBackgroundJob(
    IServiceProvider serviceProvider,
    ILogger<CatalogSyncBackgroundJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = serviceProvider.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ICatalogSyncService>();
            
            try
            {
                // Sync every 30 minutes
                await syncService.SyncLegacyApisAsync();
                await syncService.SyncCloudApisAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Catalog sync failed");
            }
            
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }
}
```

---

## 10. Migration Roadmap

### **Phase 1: Parallel Existence**
```
Year 1 (2024-2025)
├─ Cloud APIM APIs available in portal
├─ Legacy APIs available via adapters
├─ Both work side-by-side
└─ Marketing: "Modern APIs available; legacy APIs supported"
```

### **Phase 2: Deprecation & Guidance**
```
Year 2 (2025-2026)
├─ Mark legacy APIs as "Deprecated"
├─ Show migration path in portal
├─ Offer migration assistance to partners
├─ Track usage metrics
└─ Set retirement dates (e.g., Dec 31, 2027)
```

### **Phase 3: Gradual Retirement**
```
Year 3+ (2026-2027)
├─ Send notifications to users of legacy APIs
├─ Offer extended support period
├─ Provide migration tools/samples
├─ Eventually disable legacy APIs
└─ Maintain read-only history (compliance)
```

---

## 11. Operational Concerns

### **Monitoring & Alerting**

```csharp
public class LegacyApiMonitoring
{
    // Track legacy API usage
    [Metric("legacy_api_calls_total")]
    public Counter LegacyApiCalls { get; set; }
    
    // Track legacy API errors
    [Metric("legacy_api_errors_total")]
    public Counter LegacyApiErrors { get; set; }
    
    // Track latency (legacy systems often slower)
    [Metric("legacy_api_latency_ms")]
    public Histogram LegacyApiLatency { get; set; }
    
    // Alert if legacy system becomes unreachable
    [Alert("legacy_system_down")]
    public void AlertWhenLegacyDown(string systemName)
    {
        // Send to ops team, auto-disable Try-It for that API
    }
}
```

### **Security Considerations**

| Concern | Mitigation |
|---------|-----------|
| **Exposing legacy auth** | Never expose NTLM/custom creds in UI; bridge at BFF only |
| **Network access** | Use VPN/firewalls for legacy systems on-prem |
| **Token translation** | Cache tokens securely; validate before use |
| **Audit trail** | Log all legacy API calls with user context |

---

## 12. Configuration Example

```json
{
  "ApiCatalog": {
    "CloudAPIM": {
      "Enabled": true,
      "Endpoint": "https://komatsu-apim.azure.net",
      "ApiVersion": "2021-12-01-preview"
    },
    "LegacySystems": [
      {
        "Id": "legacy-soap",
        "Name": "Legacy SOAP Services",
        "Type": "SOAP",
        "Endpoint": "https://legacy-api.komatsu.com/soap",
        "AuthType": "NTLM",
        "CacheTTLMinutes": 60,
        "Enabled": true,
        "DeprecationStatus": "legacy",
        "PlannedRetirement": "2027-12-31"
      },
      {
        "Id": "legacy-binary",
        "Name": "Legacy Binary Protocol",
        "Type": "Custom",
        "Endpoint": "legacy-compute.internal:5000",
        "AuthType": "CustomToken",
        "CacheTTLMinutes": 120,
        "Enabled": true,
        "DeprecationStatus": "deprecated",
        "PlannedRetirement": "2026-06-30"
      }
    ],
    "UnifiedCatalog": {
      "MergeResults": true,
      "DisplayLegacyWarnings": true,
      "SuggestModernAlternatives": true
    }
  }
}
```

---

## 13. Cost Implications

### **Without Legacy Support**
- Only cloud-native APIs
- Requires migrating all legacy systems upfront (high cost)
- Some partners can't upgrade → lose business

### **With Legacy Support (Recommended)**
- Parallel infrastructure for adapters (low cost)
- Gradual migration over 2–3 years
- Retain all partners during transition

**Net Cost: +$50–100K/year for adapter infrastructure vs. -$500K+ in migration costs**

---

## 14. Conclusion

### **Recommendation: Support Legacy APIs via Adapters**

```
✅ Enables unified discovery (cloud + legacy in one portal)
✅ Reduces pressure for immediate legacy modernization
✅ Allows phased migration roadmap
✅ Maintains backward compatibility
✅ Protects Komatsu's partner relationships
```

### **Key Principles**

1. **Single Abstraction** — Portal sees all APIs the same way (REST/JSON)
2. **Request/Response Translation** — BFF handles protocol transformation
3. **Auth Bridge** — Translate Entra ID tokens to legacy auth formats
4. **Gradual Sunset** — Mark legacy, set retirement dates, offer migration support
5. **Operational Parity** — Legacy APIs monitored/logged/audited like cloud APIs

This approach is used successfully by:
- **Salesforce** (legacy SOAP alongside REST)
- **AWS** (legacy APIs alongside new services)
- **Microsoft** (legacy protocols alongside modern APIs)

---

## References

- [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) — Overall architecture
- [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md) — Authorization for all API types
- Adapter Pattern: Enterprise Integration Patterns (Gregor Hohpe & Bobby Woolf)
- Legacy System Integration: Working Effectively with Legacy Code (Michael Feathers)
