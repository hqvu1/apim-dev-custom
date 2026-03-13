# 🔐 RBAC Architecture & Implementation Guide

## Executive Summary

This document describes a **production-grade, enterprise-scale RBAC system** for the Komatsu API Marketplace BFF that extends beyond simple role retrieval from Global Admin API. The design supports:

- **Multi-source roles**: Global Admin API + local application roles + claim-based attribution
- **Fine-grained permissions**: Role → Action → Resource (API, Product, Subscription)
- **Hierarchical roles**: Roles can inherit permissions from parent roles
- **Policy-driven authorization**: Hot-reloadable policies without application restart
- **Claim augmentation**: Enrich JWT claims with derived roles and permissions
- **Audit & compliance**: Structured logging of all authorization decisions
- **Extensibility**: Custom authorization handlers for complex business rules
- **Performance**: Multi-layer caching (claims, roles, policies, decisions)

---

## 1. **RBAC Design Principles**

### **1.1 Core Principles**

| Principle | Description | Implementation |
|-----------|-------------|-----------------|
| **Least Privilege** | Default deny; explicitly grant permissions | Policies require explicit `Allow`, no implicit grants |
| **Single Authority** | One source of truth for role definitions | Global Admin API + cached local policy definitions |
| **Immutable Audit Trail** | Record all authorization decisions | `AuthorizationAuditMiddleware` logs every check |
| **Separation of Concerns** | Auth logic separate from business logic | Custom `IAuthorizationHandler` implementations |
| **Claim-Based** | Use claims (not roles list) as auth source | Enrich JWT with derived permissions at login |
| **Hot-Reload** | Update policies without restarting app | Configuration reload via `IOptions<T>` change token |
| **Performance** | Minimize external calls; cache aggressively | Role cache (30 min), policy cache (in-process) |

### **1.2 Authorization Flow**

```
User Request with JWT Token
   │
   ▼
┌─────────────────────────────────────┐
│ JwtBearerMiddleware                 │ ✓ Validates signature
│ (Validates against Entra ID JWKS)   │ ✓ Checks expiration
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ ClaimsEnrichmentMiddleware          │ ✓ Extracts user ID from JWT
│                                     │ ✓ Calls Global Admin API
│                                     │ ✓ Augments claims with roles
│                                     │ ✓ Adds permission claims
│                                     │ ✓ Caches enriched claims
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ [Authorize(Policy = "...")]         │ ✓ Routes to custom handler
│ ASP.NET Core Authorization          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Custom IAuthorizationHandler        │ ✓ Checks claims/roles
│ (e.g., ApiAccessHandler)            │ ✓ Evaluates policy
│                                     │ ✓ Logs decision
└──────────────┬──────────────────────┘
               │
               ├─→ Deny  → 403 Forbidden
               │
               └─→ Allow → Continue to endpoint
```

---

## 2. **Role Model & Hierarchy**

### **2.1 Role Definition**

A **role** is a named collection of permissions that can be:
- Assigned to users by Global Admin API
- Inherited from parent roles (role composition)
- Granted permission to perform actions on specific resources

```csharp
public record RoleDefinition
{
    // Unique role identifier (e.g., "Distributor", "Admin", "ApiReader")
    public required string Name { get; init; }
    
    // Human-readable description
    public required string Description { get; init; }
    
    // Parent role(s) from which this role inherits permissions
    // e.g., "Distributor" inherits from "BasicUser"
    public List<string> InheritsFrom { get; init; } = [];
    
    // Direct permissions granted (Read, TryIt, Subscribe, Manage)
    public List<string> Permissions { get; init; } = [];
    
    // Resource-level constraints (API IDs, Product IDs)
    // If empty, permission applies globally
    public Dictionary<string, List<string>> ResourceScopes { get; init; } = [];
};
```

### **2.2 Role Hierarchy Example**

```
Admin (Root)
  ├─ Read, TryIt, Subscribe, Manage on all APIs
  └─ No resource constraints
  
Sales Manager (extends: Admin)
  ├─ Inherits: Read, TryIt, Subscribe
  ├─ Additional: Manage (limited to assigned products)
  └─ ResourceScopes: { "Products": ["prod-123", "prod-456"] }

Distributor (extends: BasicUser)
  ├─ Inherits: Read, TryIt
  ├─ Additional: Subscribe (self only)
  └─ ResourceScopes: { "APIs": ["api-auth", "api-data"] }

BasicUser (Root)
  ├─ Read, TryIt
  └─ No Manage, no Subscribe
```

### **2.3 Permission Matrix**

```
Permission  | Description                    | Example Use Case
──────────────────────────────────────────────────────────────
Read        | View API catalog, details      | Browse APIs
TryIt       | Execute APIs in sandbox        | Test integration
Subscribe   | Create subscriptions           | Get credentials
Manage      | Full admin access              | Manage products
```

---

## 3. **Implementation Architecture**

### **3.1 Component Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Request                            │
└────────────────────────────┬────────────────────────────────┘
                             │
┌─────────────────────────────▼────────────────────────────────┐
│ Middleware Pipeline                                          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1. JWT Bearer Authentication                            │ │
│ │    • Validates signature against Entra ID JWKS          │ │
│ │    • Extracts claims into HttpContext.User              │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 2. Claims Enrichment Middleware                         │ │
│ │    • Gets user ID from claims                           │ │
│ │    • Calls IRoleProvider → Global Admin API             │ │
│ │    • Augments claims with business roles                │ │
│ │    • Adds derived permission claims                     │ │
│ │    • Caches enriched claims (30 min)                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│ Authorization Policy Evaluation                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [Authorize(Policy = "ApiRead")]  ← Policy decorator    │ │
│ │         │                                                │ │
│ │         ▼                                                │ │
│ │ Authorization Service                                   │ │
│ │   • Finds matching policy requirements                  │ │
│ │   • Routes to custom handlers (IAuthorizationHandler)   │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Custom Authorization Handlers                           │ │
│ │                                                         │ │
│ │ • ApiAccessHandler                                      │ │
│ │   (Fine-grained API permission checks)                  │ │
│ │                                                         │ │
│ │ • ResourceOwnershipHandler                              │ │
│ │   (User owns subscription, can modify)                  │ │
│ │                                                         │ │
│ │ • TenantIsolationHandler                                │ │
│ │   (Multi-tenant data access validation)                 │ │
│ │                                                         │ │
│ │ • FeatureAccessHandler                                  │ │
│ │   (Feature flag + role-based feature gates)             │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            Authorize (200)      Deny (403)
```

### **3.2 Service Layer**

```csharp
public interface IRoleProvider
{
    /// <summary>
    /// Get user's business roles from Global Admin API.
    /// Results are cached for 30 minutes.
    /// </summary>
    Task<IReadOnlyCollection<string>> GetUserRolesAsync(string userId);
    
    /// <summary>
    /// Get detailed role definition (permissions, hierarchy).
    /// Resolves role inheritance automatically.
    /// </summary>
    Task<RoleDefinition?> GetRoleDefinitionAsync(string roleName);
    
    /// <summary>
    /// Invalidate role cache for a user (e.g., after admin updates).
    /// </summary>
    Task InvalidateUserRoleCacheAsync(string userId);
}

public interface IRbacPolicyProvider
{
    /// <summary>
    /// Check if user roles have a general permission (not API-specific).
    /// </summary>
    bool HasGeneralPermission(IReadOnlyCollection<string> roles, Permission permission);
    
    /// <summary>
    /// Check if user roles have permission on a specific API.
    /// </summary>
    bool HasApiPermission(IReadOnlyCollection<string> roles, string apiId, Permission permission);
    
    /// <summary>
    /// Check if user roles have permission on a specific resource.
    /// Handles resource scoping and role inheritance.
    /// </summary>
    bool HasResourcePermission(IReadOnlyCollection<string> roles, string resourceId, 
                              string resourceType, Permission permission);
}

public interface IClaimsEnricher
{
    /// <summary>
    /// Augment JWT claims with derived roles and permissions.
    /// Called once per request and cached.
    /// </summary>
    Task<IReadOnlyCollection<Claim>> EnrichClaimsAsync(ClaimsPrincipal user);
}

public interface IAuthorizationAuditor
{
    /// <summary>
    /// Log authorization decision for compliance/debugging.
    /// </summary>
    Task AuditAuthorizationDecisionAsync(AuthorizationDecision decision);
}
```

### **3.3 Configuration Model**

```csharp
// rbac-config.json — Define roles and policies (hot-reloadable)
{
  "roles": [
    {
      "name": "Admin",
      "description": "Full administrative access",
      "permissions": ["Read", "TryIt", "Subscribe", "Manage"],
      "inheritsFrom": [],
      "resourceScopes": {}
    },
    {
      "name": "Distributor",
      "description": "Distributor partner with limited access",
      "permissions": ["Read", "TryIt", "Subscribe"],
      "inheritsFrom": ["BasicUser"],
      "resourceScopes": {
        "APIs": ["api-data", "api-auth"],
        "Products": []
      }
    }
  ],
  "policies": {
    "ApiRead": {
      "requiredPermission": "Read",
      "applicableRoles": ["Admin", "Distributor", "BasicUser"]
    },
    "ApiManage": {
      "requiredPermission": "Manage",
      "applicableRoles": ["Admin"]
    }
  },
  "caching": {
    "roleCacheDurationMinutes": 30,
    "policyCacheDurationMinutes": 60,
    "decisionCacheDurationMinutes": 5
  }
}
```

---

## 4. **Key Components & Patterns**

### **4.1 Claims Enrichment Middleware**

Enriches JWT claims with derived business roles and permissions before policy evaluation.

```csharp
public class ClaimsEnrichmentMiddleware(
    RequestDelegate next,
    IClaimsEnricher enricher,
    ILogger<ClaimsEnrichmentMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            try
            {
                var enrichedClaims = await enricher.EnrichClaimsAsync(context.User);
                var identity = context.User.Identity as ClaimsIdentity;
                if (identity != null)
                {
                    foreach (var claim in enrichedClaims)
                    {
                        identity.AddClaim(claim);
                    }
                    logger.LogDebug("Claims enriched for user {UserId} with {ClaimCount} claims",
                        identity.FindFirst("oid")?.Value ?? "unknown", enrichedClaims.Count);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to enrich claims");
                // Fail open in dev, fail closed in production
                if (!context.RequestServices.GetRequiredService<IHostEnvironment>().IsProduction())
                {
                    throw;
                }
            }
        }

        await next(context);
    }
}
```

### **4.2 Policy-Based Authorization**

Define policies that compose multiple authorization handlers.

```csharp
// In Program.cs
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
        policy.AddRequirements(new TenantIsolationRequirement());
    })
    .AddPolicy("SubscriptionOwner", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new ResourceOwnershipRequirement("subscription"));
    });

// In endpoint definition
app.MapGet("/api/apis/{apiId}", GetApiDetail)
    .RequireAuthorization("ApiRead")
    .WithName("GetApiDetail")
    .WithOpenApi();

app.MapPost("/api/subscriptions", CreateSubscription)
    .RequireAuthorization("ApiSubscribe")
    .WithName("CreateSubscription")
    .WithOpenApi();
```

### **4.3 Resource-Level Authorization Handler**

Check if a user owns a resource before allowing modifications.

```csharp
public class ResourceOwnershipHandler(ILogger<ResourceOwnershipHandler> logger)
    : AuthorizationHandler<ResourceOwnershipRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ResourceOwnershipRequirement requirement)
    {
        var userId = context.User.FindFirst("oid")?.Value;
        var resourceOwnerId = (context.Resource as HttpContext)
            ?.Items["ResourceOwnerId"]?.ToString();

        if (userId == resourceOwnerId)
        {
            logger.LogDebug("Resource ownership check passed: {UserId} owns {ResourceId}",
                userId, resourceOwnerId);
            context.Succeed(requirement);
        }
        else
        {
            logger.LogWarning("Resource ownership check failed: {UserId} does not own resource owned by {Owner}",
                userId, resourceOwnerId);
        }

        return Task.CompletedTask;
    }
}

public record ResourceOwnershipRequirement(string ResourceType) : IAuthorizationRequirement;
```

### **4.4 Audit Logging**

Structured logging of all authorization decisions for compliance.

```csharp
public class AuthorizationAuditMiddleware(
    RequestDelegate next,
    IAuthorizationAuditor auditor,
    ILogger<AuthorizationAuditMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        // Capture response status before it completes
        var originalStatusCode = context.Response.StatusCode;
        var startTime = DateTime.UtcNow;

        try
        {
            await next(context);
        }
        finally
        {
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                var decision = new AuthorizationDecision
                {
                    UserId = context.User.FindFirst("oid")?.Value ?? "unknown",
                    Method = context.Request.Method,
                    Path = context.Request.Path,
                    StatusCode = context.Response.StatusCode,
                    Timestamp = startTime,
                    DurationMs = (DateTime.UtcNow - startTime).TotalMilliseconds,
                    Authorized = context.Response.StatusCode != 403
                };

                logger.LogInformation(
                    "Authorization decision: {UserId} {Method} {Path} → {Status} ({Duration}ms)",
                    decision.UserId, decision.Method, decision.Path,
                    decision.StatusCode, decision.DurationMs);

                await auditor.AuditAuthorizationDecisionAsync(decision);
            }
        }
    }
}

public record AuthorizationDecision
{
    public required string UserId { get; init; }
    public required string Method { get; init; }
    public required string Path { get; init; }
    public required int StatusCode { get; init; }
    public required DateTime Timestamp { get; init; }
    public required double DurationMs { get; init; }
    public required bool Authorized { get; init; }
}
```

### **4.5 Role Caching Strategy**

Multi-level caching for performance.

```csharp
public class CachedRoleProvider(
    GlobalAdminClient client,
    IMemoryCache cache,
    ILogger<CachedRoleProvider> logger) : IRoleProvider
{
    private const string CacheKeyPrefix = "roles:";
    private const int DefaultCacheDurationMinutes = 30;

    public async Task<IReadOnlyCollection<string>> GetUserRolesAsync(string userId)
    {
        var cacheKey = $"{CacheKeyPrefix}{userId}";

        if (cache.TryGetValue(cacheKey, out IReadOnlyCollection<string> cachedRoles))
        {
            logger.LogDebug("Cache hit for user roles: {UserId}", userId);
            return cachedRoles;
        }

        logger.LogDebug("Cache miss for user roles: {UserId} — fetching from Global Admin API", userId);

        var roles = await client.GetUserRolesAsync(userId);

        var cacheEntryOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(DefaultCacheDurationMinutes),
            SlidingExpiration = TimeSpan.FromMinutes(5) // Extend if accessed before expiry
        };

        cache.Set(cacheKey, roles, cacheEntryOptions);
        logger.LogDebug("Cached user roles: {UserId} → {Roles}", userId, string.Join(",", roles));

        return roles;
    }

    public async Task InvalidateUserRoleCacheAsync(string userId)
    {
        var cacheKey = $"{CacheKeyPrefix}{userId}";
        cache.Remove(cacheKey);
        logger.LogInformation("Invalidated role cache for user {UserId}", userId);
    }
}
```

---

## 5. **Best Practices & Patterns**

### **5.1 Fail Modes**

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| **JWT validation fails** | 401 Unauthorized | Reject unauthenticated requests |
| **Global Admin API times out** | 403 Forbidden (prod), grant access (dev) | Fail closed in production; allow dev testing |
| **No roles found** | 403 in prod, grant access in dev | Prevent accidental access; enable testing |
| **Policy not found** | 403 Forbidden | Unknown policies should deny |

### **5.2 Performance Optimization**

| Strategy | Implementation |
|----------|-----------------|
| **Claim caching** | Enrich claims once per request; store in `HttpContext.Items` |
| **Role caching** | 30-min TTL with 5-min sliding expiration in `IMemoryCache` |
| **Policy caching** | In-memory with hot reload via `IOptions<T>` change token |
| **Decision caching** | 5-min cache for GET requests (read-only operations) |
| **Batch claims** | Enrich all needed claims in one Global Admin call |

### **5.3 Testing Strategy**

```csharp
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

        _handler = new ApiAccessHandler(_rbacProvider.Object, _roleProvider.Object, 
                                        logger.Object, env.Object);
    }

    [Test]
    public async Task ShouldGrantAccessWhenUserHasPermission()
    {
        // Arrange
        var userId = "test-user";
        var roles = new[] { "Distributor" };
        _roleProvider.Setup(p => p.GetUserRolesAsync(userId))
            .ReturnsAsync(roles);
        _rbacProvider.Setup(p => p.HasApiPermission(roles, "api-123", Permission.Read))
            .Returns(true);

        var context = new AuthorizationHandlerContext(
            new[] { new ApiAccessRequirement(Permission.Read) },
            CreateClaimsPrincipal(userId),
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
        var userId = "test-user";
        var roles = new[] { "BasicUser" };
        _roleProvider.Setup(p => p.GetUserRolesAsync(userId))
            .ReturnsAsync(roles);
        _rbacProvider.Setup(p => p.HasApiPermission(roles, "api-123", Permission.Manage))
            .Returns(false);

        var context = new AuthorizationHandlerContext(
            new[] { new ApiAccessRequirement(Permission.Manage) },
            CreateClaimsPrincipal(userId),
            null);

        // Act
        await _handler.HandleRequirementAsync(context, new ApiAccessRequirement(Permission.Manage));

        // Assert
        Assert.That(context.HasSucceeded, Is.False);
    }

    private static ClaimsPrincipal CreateClaimsPrincipal(string userId)
    {
        var claims = new[] { new Claim("oid", userId) };
        var identity = new ClaimsIdentity(claims, "test");
        return new ClaimsPrincipal(identity);
    }
}
```

---

## 6. **Migration Path**

### **Phase 1 (Current)**: Simple Role + Permission Check
- Get roles from Global Admin API
- Check role against permission list
- Cache role for 30 min

### **Phase 2**: Claim Enrichment + Resource Scoping
- Add claims enrichment middleware
- Support resource-level permissions (API-specific)
- Add ownership verification for subscriptions

### **Phase 3**: Role Hierarchy + Inheritance
- Support role inheritance (`InheritsFrom`)
- Resolve transitive permissions
- Add role composition

### **Phase 4**: Dynamic Policies + Feature Gates
- Hot-reload policies from config file
- Add feature flag integration
- Support custom claim-based rules

### **Phase 5**: Audit & Compliance
- Structured authorization audit logging
- Compliance dashboard
- Role change history tracking

---

## 7. **Configuration Example**

**Program.cs setup:**

```csharp
// Configuration
builder.Services.Configure<RbacConfig>(builder.Configuration.GetSection("Rbac"));

// Services
builder.Services.AddScoped<IRoleProvider, CachedRoleProvider>();
builder.Services.AddScoped<IRbacPolicyProvider, RbacPolicyProvider>();
builder.Services.AddScoped<IClaimsEnricher, ClaimsEnricher>();
builder.Services.AddScoped<IAuthorizationAuditor, AuthorizationAuditor>();

// Handlers
builder.Services.AddSingleton<IAuthorizationHandler, ApiAccessHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, ResourceOwnershipHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, TenantIsolationHandler>();

// Middleware
var app = builder.Build();
app.UseMiddleware<ClaimsEnrichmentMiddleware>();
app.UseMiddleware<AuthorizationAuditMiddleware>();
```

**rbac-config.json:**

```json
{
  "roles": [
    {
      "name": "Admin",
      "description": "Full administrative access to all APIs and features",
      "permissions": ["Read", "TryIt", "Subscribe", "Manage"],
      "inheritsFrom": [],
      "resourceScopes": {}
    },
    {
      "name": "Distributor",
      "description": "Distributor partner with read, tryit, and subscribe access",
      "permissions": ["Read", "TryIt", "Subscribe"],
      "inheritsFrom": ["BasicUser"],
      "resourceScopes": {
        "APIs": ["api-data", "api-auth"],
        "Products": ["prod-core"]
      }
    }
  ],
  "caching": {
    "roleCacheDurationMinutes": 30,
    "policyCacheDurationMinutes": 60
  }
}
```

---

## 8. **Monitoring & Observability**

### **Key Metrics**

```
rbac_authorization_checks_total
  • Labels: policy, result (allow/deny), user_role

rbac_role_cache_hits
  • Hit rate for role caching

rbac_global_admin_api_duration_ms
  • Latency of Global Admin API calls

rbac_authorization_decision_duration_ms
  • End-to-end authorization decision time
```

### **Alerts**

- **High 403 rate**: May indicate permission misconfiguration
- **Low role cache hit rate**: Consider increasing TTL
- **Global Admin API timeouts**: Check API health and network
- **Authorization decision latency > 500ms**: Investigate caching

---

## 9. **Security Considerations**

| Control | Implementation |
|---------|-----------------|
| **JWT validation** | Signature verification against Entra ID JWKS endpoint |
| **Token expiration** | Enforced by JWT middleware (typically 1 hour) |
| **Role tampering** | Verified server-side; client claims ignored |
| **Privilege escalation** | Fail-closed authorization; no implicit grants |
| **Role drift detection** | Hourly cache invalidation + explicit cache busting |
| **Audit trail** | Structured logging of all decisions with user context |

---

## 10. **Conclusion**

This RBAC architecture provides a **enterprise-grade, scalable authorization system** that:

✅ Extends beyond simple role retrieval  
✅ Supports multi-source roles and hierarchical permissions  
✅ Provides fine-grained resource-level access control  
✅ Maintains high performance through strategic caching  
✅ Enables hot-reload policy updates  
✅ Supports audit and compliance requirements  
✅ Follows ASP.NET Core best practices  

The design is **extensible**, allowing for future enhancements (feature gates, machine learning-based anomaly detection, etc.) without architectural changes.
