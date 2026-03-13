using System.Security.Claims;
using BffApi.Authorization;
using BffApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace BffApi.Tests.Authorization;

public class ApiAccessHandlerTests
{
    private readonly IRbacPolicyProvider _rbac = Substitute.For<IRbacPolicyProvider>();
    private readonly IRoleProvider _roleProvider = Substitute.For<IRoleProvider>();
    private readonly ILogger<ApiAccessHandler> _logger = Substitute.For<ILogger<ApiAccessHandler>>();
    private readonly IHostEnvironment _env = Substitute.For<IHostEnvironment>();

    private ApiAccessHandler CreateHandler() =>
        new(_rbac as RbacPolicyProvider ?? CreateRealProvider(), _roleProvider, _logger, _env);

    // We need the concrete type for the primary constructor
    private ApiAccessHandler CreateHandlerWithRealRbac(RbacPolicyProvider provider) =>
        new(provider, _roleProvider, _logger, _env);

    private static RbacPolicyProvider CreateRealProvider()
    {
        var config = new RbacPoliciesConfig
        {
            Policies =
            [
                new RbacPolicyEntry { Role = "Admin", Apis = ["*"], Permissions = ["read", "tryit", "subscribe", "manage"] },
                new RbacPolicyEntry { Role = "Developer", Apis = ["*"], Permissions = ["read", "tryit"] },
            ]
        };
        var monitor = Substitute.For<Microsoft.Extensions.Options.IOptionsMonitor<RbacPoliciesConfig>>();
        monitor.CurrentValue.Returns(config);
        return new RbacPolicyProvider(monitor, Substitute.For<ILogger<RbacPolicyProvider>>());
    }

    private static AuthorizationHandlerContext CreateContext(
        Permission permission,
        ClaimsPrincipal? user = null,
        HttpContext? httpContext = null)
    {
        var requirement = new ApiAccessRequirement(permission);
        user ??= new ClaimsPrincipal(new ClaimsIdentity());
        return new AuthorizationHandlerContext([requirement], user, httpContext);
    }

    private static ClaimsPrincipal CreateUser(string userId, bool authenticated = true)
    {
        var claims = new List<Claim> { new("sub", userId) };
        var identity = new ClaimsIdentity(claims, authenticated ? "TestAuth" : null);
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task Succeeds_WhenDevUser_InDevelopment()
    {
        _env.EnvironmentName.Returns("Development");
        var handler = CreateHandlerWithRealRbac(CreateRealProvider());

        var user = CreateUser("dev-user");
        var context = CreateContext(Permission.Read, user);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Succeeds_WhenAdminRole()
    {
        _env.EnvironmentName.Returns("Production");
        _roleProvider.GetUserRolesAsync("user-1", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<string>>(["Admin"]));

        var handler = CreateHandlerWithRealRbac(CreateRealProvider());
        var user = CreateUser("user-1");
        var context = CreateContext(Permission.Manage, user);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Succeeds_WhenDeveloperRole_HasReadPermission()
    {
        _env.EnvironmentName.Returns("Production");
        _roleProvider.GetUserRolesAsync("user-2", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<string>>(["Developer"]));

        var handler = CreateHandlerWithRealRbac(CreateRealProvider());
        var user = CreateUser("user-2");
        var context = CreateContext(Permission.Read, user);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Fails_WhenDeveloperRole_LacksManagePermission()
    {
        _env.EnvironmentName.Returns("Production");
        _roleProvider.GetUserRolesAsync("user-3", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<string>>(["Developer"]));

        var handler = CreateHandlerWithRealRbac(CreateRealProvider());
        var user = CreateUser("user-3");
        var context = CreateContext(Permission.Manage, user);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task Fails_WhenNoUserIdInToken_InProduction()
    {
        _env.EnvironmentName.Returns("Production");
        var handler = CreateHandlerWithRealRbac(CreateRealProvider());

        // No claims at all
        var user = new ClaimsPrincipal(new ClaimsIdentity());
        var context = CreateContext(Permission.Read, user);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task Succeeds_WhenNoUserId_InDevelopment_AndAuthenticated()
    {
        _env.EnvironmentName.Returns("Development");
        var handler = CreateHandlerWithRealRbac(CreateRealProvider());

        // Authenticated but no oid/sub claims
        var identity = new ClaimsIdentity([], "TestAuth");
        var user = new ClaimsPrincipal(identity);
        var context = CreateContext(Permission.Read, user);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Succeeds_WhenNoRolesReturned_InDevelopment()
    {
        _env.EnvironmentName.Returns("Development");
        _roleProvider.GetUserRolesAsync("real-user", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<string>>([]));

        var handler = CreateHandlerWithRealRbac(CreateRealProvider());
        var user = CreateUser("real-user");
        var context = CreateContext(Permission.Read, user);

        await handler.HandleAsync(context);

        // Development fallback grants access when no roles returned
        Assert.True(context.HasSucceeded);
    }
}
