# Legacy API Integration — Quick Reference

## One-Page Quick Start

### 1. Create Service Files
```bash
# Create these files in your bff-dotnet/Services/Legacy/ directory

Services/Legacy/
├── ILegacyApiService.cs          # Core interface + data models
├── SoapLegacyApiService.cs       # SOAP adapter implementation
├── LegacyAuthenticationBridge.cs # Token translation
└── LegacySubscriptionService.cs  # Subscription management
```

### 2. Update Program.cs
```csharp
// Add these registrations
builder.Services.AddScoped<ILegacyApiService, SoapLegacyApiService>();
builder.Services.AddScoped<IUnifiedApiService, UnifiedApiService>();
builder.Services.AddScoped<ILegacyAuthenticationBridge, LegacyAuthenticationBridge>();
builder.Services.AddScoped<ILegacySubscriptionService, LegacySubscriptionService>();

builder.Services.AddHttpClient<SoapLegacyApiService>()
    .ConfigureHttpClient(client => {
        client.Timeout = TimeSpan.FromSeconds(30);
    });

app.UseMiddleware<LegacyApiMonitoringMiddleware>();
```

### 3. Update Endpoints
```csharp
// Inject IUnifiedApiService into your endpoints
app.MapGet("/api/apis", (IUnifiedApiService svc) => svc.GetAllApisAsync());
app.MapPost("/api/apis/{id}/execute", ExecuteOperation);
```

### 4. Set Environment Variables
```env
LEGACY_SOAP_ENDPOINT=https://legacy-api.komatsu.com/soap
LEGACY_AUTH_ENDPOINT=https://legacy-api.komatsu.com/auth
```

### 5. Update React Components
```tsx
// Show legacy badge on API cards
{api.source === 'legacy' && <Chip label="Legacy" color="warning" />}

// Show warning in Try-It console
{api.protocol === 'SOAP' && <Alert>
  This API uses SOAP. Requests will be auto-translated.
</Alert>}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (3-4 days)
- [ ] Create ILegacyApiService interface
- [ ] Implement SoapLegacyApiService
- [ ] Create UnifiedApiService
- [ ] Register in DI container
- [ ] Test with mock SOAP responses

**Verify:** `GET /api/apis` returns both cloud and legacy APIs

### Phase 2: Integration (2-3 days)
- [ ] Update API endpoints to use UnifiedApiService
- [ ] Add try-it endpoint for legacy APIs
- [ ] Create monitoring middleware
- [ ] Add logging

**Verify:** Try-It console works for at least one legacy API

### Phase 3: Authentication (2-3 days)
- [ ] Create LegacyAuthenticationBridge
- [ ] Implement token translation logic
- [ ] Test with actual legacy auth endpoint
- [ ] Add error handling and caching

**Verify:** Entra ID tokens successfully translate to legacy auth format

### Phase 4: Subscriptions (2-3 days)
- [ ] Create LegacySubscriptionService
- [ ] Add subscription endpoints
- [ ] Test subscription creation/revocation
- [ ] Implement credential management

**Verify:** Create subscription to legacy API and get valid credentials back

### Phase 5: UI & Monitoring (3-4 days)
- [ ] Update API card component (add legacy badge)
- [ ] Update Try-It console (auto-translate)
- [ ] Set up Application Insights tracking
- [ ] Create alerts for legacy API failures

**Verify:** Portal shows legacy APIs with proper warnings

**Total Timeline:** 2-3 weeks for basic implementation

---

## Code Copy Snippets

### Minimum Viable Service

```csharp
// Just the essentials to get started
public interface ILegacyApiService {
    Task<List<ApiDetail>> GetApisAsync();
}

public class SoapLegacyApiService(HttpClient client, ILogger<SoapLegacyApiService> log) 
    : ILegacyApiService {
    
    public async Task<List<ApiDetail>> GetApisAsync() {
        var soapReq = CreateSoapEnvelope("GetAPICatalog", null);
        var resp = await client.PostAsync("https://legacy-api.komatsu.com/soap",
            new StringContent(soapReq, Encoding.UTF8, "text/xml"));
        
        var xml = await resp.Content.ReadAsStringAsync();
        return ParseXml(xml); // Parse catalog from SOAP response
    }
}
```

### Simple SOAP → JSON Conversion

```csharp
private object ConvertSoapToJson(XmlDocument xml) {
    var body = xml.SelectSingleNode("//soap:Body")?.FirstChild;
    if (body == null) return new { };
    
    var result = new Dictionary<string, object>();
    foreach (XmlNode node in body.ChildNodes) {
        result[node.Name] = node.InnerText;
    }
    return result;
}
```

### Token Translation (Simple)

```csharp
public async Task<LegacyAuthToken> TranslateTokenAsync(ClaimsPrincipal user, string system) {
    var email = user.FindFirst(ClaimTypes.Email)?.Value ?? "unknown";
    
    // Call legacy auth endpoint
    var soapReq = $@"<soap:Envelope>
        <soap:Body><Login><username>{email}</username></Login></soap:Body>
    </soap:Envelope>";
    
    var resp = await _httpClient.PostAsync(_authEndpoint,
        new StringContent(soapReq, Encoding.UTF8, "text/xml"));
    
    var xml = new XmlDocument();
    xml.LoadXml(await resp.Content.ReadAsStringAsync());
    
    return new LegacyAuthToken {
        Type = "SoapSessionToken",
        Value = xml.SelectSingleNode("//SessionToken")?.InnerText ?? "",
        ExpiresAt = DateTime.UtcNow.AddHours(8)
    };
}
```

---

## Common SOAP Patterns

### Pattern 1: Catalog SOAP Call
```csharp
public string GetCatalogSoap() => @"<?xml version=""1.0""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <GetAPICatalog />
  </soap:Body>
</soap:Envelope>";

// Parse response
var catalog = xml.SelectNodes("//API");
foreach (XmlNode api in catalog) {
    var name = api.SelectSingleNode("Name")?.InnerText;
    var desc = api.SelectSingleNode("Description")?.InnerText;
}
```

### Pattern 2: Operation SOAP Call
```csharp
public string ExecuteOperationSoap(string method, Dictionary<string, string> @params) {
    var paramXml = string.Join("", @params.Select(p => 
        $"<{p.Key}>{p.Value}</{p.Key}>"));
    
    return $@"<?xml version=""1.0""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <{method}>
      {paramXml}
    </{method}>
  </soap:Body>
</soap:Envelope>";
}
```

### Pattern 3: WSDL → OpenAPI
```
Legacy SOAP API
├─ WSDL at /auth?wsdl
├─ Operations: Login, Logout, GetUser, UpdateUser
└─ Convert to →

Modern Catalog Entry
├─ Protocol: SOAP
├─ SpecUrl: https://legacy.../auth?wsdl
├─ Operations: Login, Logout, GetUser, UpdateUser
└─ Store: Same as cloud APIs
```

---

## Testing

### Unit Test Template

```csharp
[TestClass]
public class LegacyApiServiceTests {
    private SoapLegacyApiService _service;
    
    [TestInitialize]
    public void Setup() {
        var mockHttp = new Mock<HttpClient>();
        var mockLog = new Mock<ILogger<SoapLegacyApiService>>();
        _service = new SoapLegacyApiService(mockHttp.Object, mockLog.Object);
    }
    
    [TestMethod]
    public async Task GetApisAsync_ReturnsApiList() {
        var result = await _service.GetApisAsync();
        Assert.IsNotNull(result);
        Assert.IsTrue(result.Any(a => a.Source == "legacy"));
    }
}
```

### Integration Test Template

```csharp
[TestClass]
public class LegacyApiIntegrationTests {
    [TestMethod]
    public async Task UnifiedService_ReturnsBothSourceTypes() {
        var svc = new UnifiedApiService(cloudApi, legacyApi, cache, logger);
        var all = await svc.GetAllApisAsync();
        
        Assert.IsTrue(all.Any(a => a.Source == "cloud"));
        Assert.IsTrue(all.Any(a => a.Source == "legacy"));
    }
}
```

---

## Configuration Examples

### appsettings.json
```json
{
  "LegacyApis": {
    "Enabled": true,
    "Soap": {
      "Endpoint": "https://legacy-api.komatsu.com/soap",
      "AuthEndpoint": "https://legacy-api.komatsu.com/auth",
      "TimeoutSeconds": 30
    },
    "CacheTTLMinutes": 60
  }
}
```

### .env
```
LEGACY_SOAP_ENDPOINT=https://legacy-api.komatsu.com/soap
LEGACY_AUTH_ENDPOINT=https://legacy-api.komatsu.com/auth
LEGACY_CACHE_TTL=60
```

---

## Monitoring Events

### Track in Application Insights
```csharp
telemetryClient.TrackEvent("LegacyApiCatalogFetched", 
    new { count = apis.Count, duration = sw.ElapsedMilliseconds });

telemetryClient.TrackEvent("LegacyApiOperationExecuted", 
    new { apiId = apiId, operationId = opId, status = response.StatusCode });

telemetryClient.TrackException(exception, 
    new { context = "LegacyApiCall" });
```

### Alerts to Configure
- [ ] Legacy API endpoint unreachable (>30s timeout)
- [ ] Legacy auth translation failure rate >5%
- [ ] Legacy API response time >10s (slow)
- [ ] Legacy subscription creation failures

---

## Troubleshooting Quick Fixes

| Problem | Check | Fix |
|---------|-------|-----|
| **No legacy APIs showing** | ILegacyApiService registered? | Add to DI container in Program.cs |
| **SOAP endpoint 404** | Endpoint URL correct? | Check `LEGACY_SOAP_ENDPOINT` env var |
| **Token translation fails** | Legacy auth endpoint working? | Test with Postman/curl first |
| **High latency** | Cache enabled? | Increase `LEGACY_CACHE_TTL` |
| **XmlException parsing SOAP** | Response is valid XML? | Add `log.LogError(xmlContent)` |

---

## Files to Create/Modify

### Create (New Files)
- `bff-dotnet/Services/Legacy/ILegacyApiService.cs`
- `bff-dotnet/Services/Legacy/SoapLegacyApiService.cs`
- `bff-dotnet/Services/UnifiedApiService.cs`
- `bff-dotnet/Services/Legacy/LegacyAuthenticationBridge.cs`
- `bff-dotnet/Services/Legacy/LegacySubscriptionService.cs`
- `bff-dotnet/Middleware/LegacyApiMonitoringMiddleware.cs`

### Modify (Existing Files)
- `bff-dotnet/Program.cs` — Register services
- `bff-dotnet/Endpoints/ApisEndpoints.cs` — Use UnifiedApiService
- `bff-dotnet/Endpoints/SubscriptionsEndpoints.cs` — Add legacy subscriptions
- `src/components/ApiCard/ApiCard.tsx` — Show legacy badge
- `src/components/TryIt/TryItConsole.tsx` — Handle SOAP translation

---

## Decision Tree

```
Do you have legacy APIs?
├─ Yes, SOAP-based → Use SoapLegacyApiService
├─ Yes, custom binary → Create CustomBinaryLegacyAdapter
├─ Yes, REST but different auth → Extend SoapLegacyApiService auth bridge
└─ No → Skip legacy integration
```

---

## Success Criteria

✅ **Portal shows legacy APIs** — API catalog includes legacy systems  
✅ **Try-It works** — Can execute legacy operations from portal  
✅ **Auth translates** — Entra ID tokens work with legacy systems  
✅ **Subscriptions work** — Users can subscribe to legacy APIs  
✅ **Monitoring active** — Legacy API calls logged to Application Insights  
✅ **UI shows warnings** — Legacy badges and retirement dates visible  

---

## References

- **Full Architecture:** [LEGACY_API_INTEGRATION.md](./LEGACY_API_INTEGRATION.md)
- **Full Implementation Guide:** [LEGACY_API_IMPLEMENTATION_GUIDE.md](./LEGACY_API_IMPLEMENTATION_GUIDE.md)
- **System Design:** [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md)
- **Authorization:** [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md)

---

## Support

- **Question on integration?** → Check Phase in LEGACY_API_IMPLEMENTATION_GUIDE.md
- **SOAP parsing issues?** → See "Common SOAP Patterns" above
- **Not showing in portal?** → Verify ILegacyApiService in DI container
- **Authentication failing?** → Test legacy endpoint with Postman first

