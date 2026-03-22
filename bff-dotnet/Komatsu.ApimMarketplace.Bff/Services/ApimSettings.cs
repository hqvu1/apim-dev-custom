namespace Komatsu.ApimMarketplace.Bff.Services;

public sealed class ApimSettings
{
    public const string SectionName = "Apim";

    public string SubscriptionId { get; set; } = "";
    public string ResourceGroup { get; set; } = "";
    public string ServiceName { get; set; } = "";
    public string ApiVersion { get; set; } = "2022-08-01";
    public string? ManagedIdentityClientId { get; set; }

    /// <summary>
    /// When true, the BFF uses the APIM Data API (runtime endpoint) instead of
    /// the ARM Management API. The Data API returns flat responses (no ARM
    /// <c>properties</c> envelope) and requires user-scoped prefixing for
    /// subscription endpoints.
    /// </summary>
    public bool UseDataApi { get; set; }

    /// <summary>
    /// Base URL of the APIM Data API, e.g.
    /// <c>https://&lt;apim-name&gt;.azure-api.net</c> or a direct Data API URL.
    /// When <c>UseDataApi</c> is false, this is ignored and the ARM base URL is
    /// built from SubscriptionId / ResourceGroup / ServiceName.
    /// </summary>
    public string? DataApiUrl { get; set; }

    /// <summary>
    /// API version appended to Data API requests.
    /// Default matches the reference portal's <c>dataApiVersion</c>.
    /// </summary>
    public string DataApiVersion { get; set; } = "2022-04-01-preview";

    /// <summary>
    /// Azure App Registration (service principal) credentials used for
    /// client-credentials–based token acquisition for all ARM / Data API calls.
    /// </summary>
    public ServicePrincipalSettings ServicePrincipal { get; set; } = new();

    /// <summary>
    /// OAuth scope used when acquiring tokens for the ARM Management API.
    /// Default: <c>https://management.azure.com/.default</c>.
    /// </summary>
    public string ArmScope { get; set; } = "https://management.azure.com/.default";

    /// <summary>
    /// OAuth scope used when acquiring tokens for the APIM Data API.
    /// Default: <c>https://management.azure.com/.default</c>.
    /// Override when the Data API audience differs from ARM.
    /// </summary>
    public string DataApiScope { get; set; } = "https://management.azure.com/.default";
}

public sealed class ServicePrincipalSettings
{
    public string TenantId { get; set; } = "";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
}
