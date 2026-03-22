namespace Komatsu.ApimMarketplace.Bff.Services;

public sealed class GlobalAdminSettings
{
    public const string SectionName = "GlobalAdmin";

    /// <summary>Base URL of the Global Admin API (no trailing slash).</summary>
    public string BaseUrl { get; set; } = "https://apim-globaladmin-uat-jpneast-001.azure-api.net";

    /// <summary>APIM subscription key for authenticating with the Global Admin API.</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>How long to cache a user's roles (default: 30 minutes).</summary>
    public int RoleCacheMinutes { get; set; } = 30;
}
