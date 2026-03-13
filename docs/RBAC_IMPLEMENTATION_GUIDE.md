# RBAC Implementation Guide

## Quick Start

This guide shows how to implement the enterprise RBAC architecture in the BFF using ASP.NET Core.

---

## 1. Program.cs Setup

### Add NuGet Packages

```bash
dotnet add package Microsoft.Extensions.Http.Resilience
dotnet add package System.Security.Claims
```

### Configuration Section

```csharp
// Program.cs

var builder = WebApplication.CreateBuilder(args);

// ─── RBAC Configuration ───────────────────────────────────────────────
builder.Configuration.AddJsonFile("rbac-config.json", optional: true, reloadOnChange: true);
builder.Services.Configure<BffApi.Authorization.RbacConfig>(
    builder.Configuration.GetSection("Rbac"));

// ─── Services ─────────────────────────────────────────────────────────
builder.Services.AddScoped<BffApi.Authorization.IRoleProvider, CachedRoleProvider>();
builder.Services.AddScoped<BffApi.Authorization.IRbacPolicyProvider, RbacPolicyProvider>();
builder.Services.AddScoped<BffApi.Authorization.IClaimsEnricher, ClaimsEnricher>();

// ─── Authorization Handlers ───────────────────────────────────────────
builder.Services.AddSingleton<IAuthorizationHandler, ApiAccessHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, ResourceOwnershipHandler>();

// ─── Authorization Policies ───────────────────────────────────────────
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiRead", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new ApiAccessRequirement(Permission.Read));
    })
    .AddPolicy("ApiTryIt", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new ApiAccessRequirement(Permission.TryIt));
    })
    .AddPolicy("ApiSubscribe", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new ApiAccessRequirement(Permission.Subscribe));
    })
    .AddPolicy("ApiManage", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new ApiAccessRequirement(Permission.Manage));
    })
    .AddPolicy("SubscriptionOwner", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new ResourceOwnershipRequirement("subscription"));
    });

// ─── Middleware ───────────────────────────────────────────────────────
var app = builder.Build();

app.UseAuthentication();
app.UseMiddleware<BffApi.Middleware.ClaimsEnrichmentMiddleware>();
app.UseAuthorization();
app.UseMiddleware<BffApi.Middleware.AuthorizationAuditMiddleware>();

// ─── Endpoints ───────────────────────────────────────────────────────
app.MapGet("/api/apis", GetApisCatalog)
    .RequireAuthorization("ApiRead")
    .WithName("GetApisCatalog")
    .WithOpenApi();

app.MapGet("/api/apis/{apiId}", GetApiDetail)
    .RequireAuthorization("ApiRead")
    .WithName("GetApiDetail")
    .WithOpenApi();

app.MapPost("/api/apis/{apiId}/try", TryApi)
    .RequireAuthorization("ApiTryIt")
    .WithName("TryApi")
    .WithOpenApi();

app.MapPost("/api/subscriptions", CreateSubscription)
    .RequireAuthorization("ApiSubscribe")
    .WithName("CreateSubscription")
    .WithOpenApi();

app.MapPut("/api/subscriptions/{subId}", UpdateSubscription)
    .RequireAuthorization("SubscriptionOwner")
    .WithName("UpdateSubscription")
    .WithOpenApi();

app.MapDelete("/api/subscriptions/{subId}", DeleteSubscription)
    .RequireAuthorization("SubscriptionOwner")
    .WithName("DeleteSubscription")
    .WithOpenApi();

app.MapPost("/api/admin/**", AdminOperations)
    .RequireAuthorization("ApiManage")
    .WithName("AdminOperations")
    .WithOpenApi();

app.Run();
```

---

## 2. Endpoint Usage Examples

### Simple Role-Based Check

```csharp
app.MapGet("/api/apis", async (IApiService apiService) =>
{
    var apis = await apiService.GetApisAsync();
    return Results.Ok(apis);
})
.RequireAuthorization("ApiRead")
.WithName("GetApisCatalog")
.WithOpenApi();
```

### Resource Ownership Check

```csharp
app.MapPut("/api/subscriptions/{subId}", 
    async (string subId, UpdateSubscriptionRequest request, 
           ISubscriptionService service, HttpContext context) =>
{
    // Fetch subscription to check ownership
    var subscription = await service.GetSubscriptionAsync(subId);
    if (subscription == null)
    {
        return Results.NotFound();
    }

    // Set owner ID in context for authorization check
    context.SetResourceOwner("subscription", subscription.CreatedBy);

    // This will fail at the authorization layer if user doesn't own it
    var updated = await service.UpdateSubscriptionAsync(subId, request);
    return Results.Ok(updated);
})
.RequireAuthorization("SubscriptionOwner")
.WithName("UpdateSubscription")
.WithOpenApi();
```

### Fine-Grained Permission Check

```csharp
app.MapPost("/api/apis/{apiId}/try",
    async (string apiId, TryItRequest request, IApiService service, 
           IAuthorizationService authz, ClaimsPrincipal user) =>
{
    // Custom check before executing API call
    var requirement = new ApiAccessRequirement(Permission.TryIt);
    var context = new AuthorizationHandlerContext(
        new[] { requirement }, user, null);

    var result = await authz.AuthorizeAsync(user, null, requirement);
    if (!result.Succeeded)
    {
        return Results.Forbid();
    }

    // Execute API call
    var response = await service.ExecuteApiAsync(apiId, request);
    return Results.Ok(response);
})
.RequireAuthorization("ApiTryIt")
.WithName("TryApi")
.WithOpenApi();
```

---

## 3. Testing

### Unit Test Pattern

```csharp
using NUnit.Framework;
using Moq;

[TestFixture]
public class ApiAccessHandlerTests
{
    private Mock<IRoleProvider> _roleProvider;
    private Mock<RbacPolicyProvider> _rbacProvider;
    private ApiAccessHandler _handler;

    [SetUp]
    public void SetUp()
    {
        _roleProvider = new Mock<IRoleProvider>();
        _rbacProvider = new Mock<RbacPolicyProvider>();
        var logger = new Mock<ILogger<ApiAccessHandler>>();
        var env = new Mock<IHostEnvironment>();
        env.Setup(e => e.IsDevelopment()).Returns(false);

        _handler = new ApiAccessHandler(
            _rbacProvider.Object, 
            _roleProvider.Object,
            logger.Object, 
            env.Object);
    }

    [Test]
    public async Task ShouldGrantAccessWhenUserHasPermission()
    {
        // Arrange
        var userId = "user-123";
        var roles = new[] { "Distributor" };
        
        _roleProvider.Setup(p => p.GetUserRolesAsync(userId))
            .ReturnsAsync(roles);
        
        _rbacProvider.Setup(p => p.HasApiPermission(roles, "api-data", Permission.Read))
            .Returns(true);

        var claims = new Claim[] { new("oid", userId) };
        var identity = new ClaimsIdentity(claims, "test");
        var user = new ClaimsPrincipal(identity);

        var context = new AuthorizationHandlerContext(
            new[] { new ApiAccessRequirement(Permission.Read) },
            user,
            null);

        // Act
        await _handler.HandleRequirementAsync(context, new ApiAccessRequirement(Permission.Read));

        // Assert
        Assert.That(context.HasSucceeded, Is.True);
    }

    [Test]
    public async Task ShouldDenyAccessWhenUserLacksPermission()
    {
        // Arrange
        var userId = "user-456";
        var roles = new[] { "BasicUser" };
        
        _roleProvider.Setup(p => p.GetUserRolesAsync(userId))
            .ReturnsAsync(roles);
        
        _rbacProvider.Setup(p => p.HasApiPermission(roles, "api-admin", Permission.Manage))
            .Returns(false);

        var claims = new Claim[] { new("oid", userId) };
        var identity = new ClaimsIdentity(claims, "test");
        var user = new ClaimsPrincipal(identity);

        var context = new AuthorizationHandlerContext(
            new[] { new ApiAccessRequirement(Permission.Manage) },
            user,
            null);

        // Act
        await _handler.HandleRequirementAsync(context, new ApiAccessRequirement(Permission.Manage));

        // Assert
        Assert.That(context.HasSucceeded, Is.False);
    }
}
```

### Integration Test Pattern

```csharp
using Microsoft.AspNetCore.Mvc.Testing;

[TestFixture]
public class RbacIntegrationTests
{
    private WebApplicationFactory<Program> _factory;
    private HttpClient _client;

    [SetUp]
    public void SetUp()
    {
        _factory = new WebApplicationFactory<Program>();
        _client = _factory.CreateClient();
    }

    [Test]
    public async Task ShouldReturn200ForAuthorizedRequest()
    {
        // Arrange
        var token = GenerateValidJwt(userId: "user-123", roles: "Distributor");
        _client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.GetAsync("/api/apis");

        // Assert
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task ShouldReturn403ForUnauthorizedRequest()
    {
        // Arrange
        var token = GenerateValidJwt(userId: "user-456", roles: "BasicUser");
        _client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.PostAsync("/api/subscriptions", 
            new StringContent("{}", Encoding.UTF8, "application/json"));

        // Assert
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }
}
```

---

## 4. Configuration Files

### rbac-config.json Example

See `rbac-config-example.json` for a complete configuration template.

Key sections:
- **roles**: Define roles with permissions and resource scopes
- **policies**: Map policies to permissions
- **caching**: Configure cache durations
- **features**: Enable/disable RBAC features

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "BffApi.Authorization": "Debug",
      "BffApi.Middleware": "Debug"
    }
  },
  "GlobalAdmin": {
    "ApiUrl": "https://global-admin-api.komatsu.com",
    "ApiKey": "${GLOBAL_ADMIN_API_KEY}"
  }
}
```

---

## 5. Deployment Checklist

- [ ] RBAC configuration (rbac-config.json) is in the container image
- [ ] Global Admin API credentials are set in Container App secrets
- [ ] Authorization audit logging is enabled in Application Insights
- [ ] Role cache TTL is tuned for your deployment (30 min default)
- [ ] Fail-closed behavior is enabled in production
- [ ] All endpoints have appropriate `[Authorize(Policy = "...")]` attributes
- [ ] Resource ownership checks are implemented for modifying endpoints
- [ ] Audit logs are being ingested into compliance dashboard
- [ ] Alert on authorization decision latency > 500ms
- [ ] Alert on authorization failure rate > 5%

---

## 6. Migration Path

### Phase 1 (Current): Simple RBAC
```csharp
[Authorize(Policy = "ApiRead")]
app.MapGet("/api/apis", GetApis);
```

### Phase 2: Resource Scoping
```csharp
// Add resource-level checks
context.SetResourceOwner("subscription", subscription.CreatedBy);
```

### Phase 3: Role Hierarchy
```json
{
  "inheritsFrom": ["BasicUser"],
  "permissions": ["Subscribe"]
}
```

### Phase 4: Dynamic Policies
```json
{
  "caching": {
    "policyCacheDurationMinutes": 1
  }
}
```

### Phase 5: Audit & Compliance
- Structured logging to Application Insights
- Compliance dashboards
- Role change history

---

## 7. Troubleshooting

### "Authorization failed for user"

✓ Check that user roles are returned from Global Admin API  
✓ Verify RBAC configuration defines the role  
✓ Check that role has the required permission  
✓ Verify resource scoping if applicable  

### "Claims enrichment is slow"

✓ Increase role cache TTL (`roleCacheDurationMinutes`)  
✓ Enable sliding expiration  
✓ Profile Global Admin API latency  
✓ Consider batching role lookups  

### "Authorization cache is stale"

✓ Reduce cache TTL for testing  
✓ Implement manual cache invalidation on role changes  
✓ Enable decision caching for GET-only operations  

---

## References

- [RBAC Architecture Document](./RBAC_ARCHITECTURE.md)
- [ASP.NET Core Authorization](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/)
- [Policy-based Authorization](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies)
- [Custom Authorization Handlers](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/resourcebased)
