using BffApi.Authorization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace BffApi.Tests.Authorization;

public class RbacPolicyProviderTests
{
    private static RbacPolicyProvider CreateProvider(List<RbacPolicyEntry> policies)
    {
        var config = new RbacPoliciesConfig { Policies = policies };
        var monitor = Substitute.For<IOptionsMonitor<RbacPoliciesConfig>>();
        monitor.CurrentValue.Returns(config);
        var logger = Substitute.For<ILogger<RbacPolicyProvider>>();
        return new RbacPolicyProvider(monitor, logger);
    }

    // ── HasGeneralPermission ────────────────────────────────────────────────

    [Fact]
    public void HasGeneralPermission_ReturnsTrue_WhenRoleHasPermission()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Developer",
                Apis = ["*"],
                Permissions = ["read", "tryit"],
            }
        ]);

        Assert.True(provider.HasGeneralPermission(["Developer"], Permission.Read));
    }

    [Fact]
    public void HasGeneralPermission_ReturnsFalse_WhenRoleLacksPermission()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Viewer",
                Apis = ["*"],
                Permissions = ["read"],
            }
        ]);

        Assert.False(provider.HasGeneralPermission(["Viewer"], Permission.Manage));
    }

    [Fact]
    public void HasGeneralPermission_ReturnsFalse_WhenRoleNotConfigured()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Admin",
                Apis = ["*"],
                Permissions = ["read", "manage"],
            }
        ]);

        Assert.False(provider.HasGeneralPermission(["UnknownRole"], Permission.Read));
    }

    [Fact]
    public void HasGeneralPermission_IsCaseInsensitive()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "developer",
                Apis = ["*"],
                Permissions = ["Read"],
            }
        ]);

        Assert.True(provider.HasGeneralPermission(["Developer"], Permission.Read));
    }

    // ── HasApiPermission ────────────────────────────────────────────────────

    [Fact]
    public void HasApiPermission_ReturnsTrue_WithWildcardApis()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Admin",
                Apis = ["*"],
                Permissions = ["read", "manage"],
            }
        ]);

        Assert.True(provider.HasApiPermission(["Admin"], "any-api-id", Permission.Read));
    }

    [Fact]
    public void HasApiPermission_ReturnsTrue_WhenApiExplicitlyListed()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Developer",
                Apis = ["warranty-api", "equipment-api"],
                Permissions = ["read", "tryit"],
            }
        ]);

        Assert.True(provider.HasApiPermission(["Developer"], "warranty-api", Permission.Read));
    }

    [Fact]
    public void HasApiPermission_ReturnsFalse_WhenApiNotListed()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Developer",
                Apis = ["warranty-api"],
                Permissions = ["read"],
            }
        ]);

        Assert.False(provider.HasApiPermission(["Developer"], "equipment-api", Permission.Read));
    }

    [Fact]
    public void HasApiPermission_ReturnsFalse_WhenPermissionNotGranted()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Viewer",
                Apis = ["*"],
                Permissions = ["read"],
            }
        ]);

        Assert.False(provider.HasApiPermission(["Viewer"], "warranty-api", Permission.Subscribe));
    }

    [Fact]
    public void HasApiPermission_ChecksMultipleRoles()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Viewer",
                Apis = ["*"],
                Permissions = ["read"],
            },
            new RbacPolicyEntry
            {
                Role = "Tester",
                Apis = ["warranty-api"],
                Permissions = ["tryit"],
            }
        ]);

        // User has both Viewer and Tester roles
        Assert.True(provider.HasApiPermission(["Viewer", "Tester"], "warranty-api", Permission.TryIt));
    }

    // ── GetAccessibleApis ───────────────────────────────────────────────────

    [Fact]
    public void GetAccessibleApis_ReturnsNull_WhenWildcard()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Admin",
                Apis = ["*"],
                Permissions = ["read"],
            }
        ]);

        var result = provider.GetAccessibleApis(["Admin"], Permission.Read);
        Assert.Null(result); // null means "all APIs"
    }

    [Fact]
    public void GetAccessibleApis_ReturnsSpecificApis()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Developer",
                Apis = ["warranty-api", "equipment-api"],
                Permissions = ["read"],
            }
        ]);

        var result = provider.GetAccessibleApis(["Developer"], Permission.Read);
        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        Assert.Contains("warranty-api", result);
        Assert.Contains("equipment-api", result);
    }

    [Fact]
    public void GetAccessibleApis_AggregatesAcrossMultipleRoles()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Developer",
                Apis = ["warranty-api"],
                Permissions = ["read"],
            },
            new RbacPolicyEntry
            {
                Role = "Tester",
                Apis = ["equipment-api"],
                Permissions = ["read"],
            }
        ]);

        var result = provider.GetAccessibleApis(["Developer", "Tester"], Permission.Read);
        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public void GetAccessibleApis_ReturnsEmpty_WhenNoMatchingPermission()
    {
        var provider = CreateProvider(
        [
            new RbacPolicyEntry
            {
                Role = "Viewer",
                Apis = ["warranty-api"],
                Permissions = ["read"],
            }
        ]);

        var result = provider.GetAccessibleApis(["Viewer"], Permission.Manage);
        Assert.NotNull(result);
        Assert.Empty(result);
    }
}
