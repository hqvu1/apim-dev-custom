namespace BffApi.Services;

public interface IRoleProvider
{
    /// <summary>
    /// Returns the business roles for a user (e.g. Distributor, Vendor, Customer, Admin).
    /// Results are cached per userId for the configured TTL.
    /// </summary>
    Task<IReadOnlyList<string>> GetUserRolesAsync(string userId, CancellationToken ct = default);
}
