// ---------------------------------------------------------------------------
// AdminEndpoints — minimal API route group for /admin.
//
// Matches SPA's Admin.tsx calls:
//   GET  /api/admin/registrations?status=pending   → RegistrationRequest[]
//   POST /api/admin/registrations/{id}/approve      → RegistrationRequest
//   POST /api/admin/registrations/{id}/reject       → RegistrationRequest
//   GET  /api/admin/metrics                         → AdminMetric[]
//
// Protected by ApiManage RBAC policy (Admin/GlobalAdmin roles only).
// POC: returns mock data. Production: integrate with portal database.
// See docs/STORY_MAPPING_GAP_ANALYSIS.md §"Critical Misalignment"
// ---------------------------------------------------------------------------

using Komatsu.ApimMarketplace.Bff.Models;
using Komatsu.ApimMarketplace.Bff.Services;

namespace Komatsu.ApimMarketplace.Bff.Endpoints;

public static class AdminEndpoints
{
    // Mock pending registrations for POC
    private static readonly List<RegistrationRequest> MockRegistrations =
    [
        new()
        {
            Id = "REG-0001",
            Company = "Acme Construction",
            Region = "NA-West",
            Contact = "john@acme.com",
            Role = "Dealer",
            Status = "Submitted",
            CreatedDate = DateTime.UtcNow.AddDays(-3).ToString("O"),
        },
        new()
        {
            Id = "REG-0002",
            Company = "BuildCorp International",
            Region = "NA-East",
            Contact = "jane@buildcorp.com",
            Role = "Vendor",
            Status = "Submitted",
            CreatedDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
        },
    ];

    public static RouteGroupBuilder MapAdminEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin")
            .RequireAuthorization("ApiManage");

        // GET /admin/registrations — list registration requests (optional ?status= filter)
        group.MapGet("/registrations", (string? status) =>
        {
            var regs = MockRegistrations.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                regs = regs.Where(r => r.Status.Equals(status, StringComparison.OrdinalIgnoreCase)
                                    || (status.Equals("pending", StringComparison.OrdinalIgnoreCase)
                                        && r.Status.Equals("Submitted", StringComparison.OrdinalIgnoreCase)));
            }
            return Results.Ok(regs.ToList());
        })
        .WithName("ListRegistrations")
        .WithSummary("List registration requests with optional status filter")
        .Produces<List<RegistrationRequest>>();

        // POST /admin/registrations/{id}/approve — approve a registration
        group.MapPost("/registrations/{id}/approve", (string id) =>
        {
            var reg = MockRegistrations.FirstOrDefault(r => r.Id == id);
            if (reg is null) return Results.NotFound();

            // In-place status update for POC (mock data is mutable via list reference)
            var index = MockRegistrations.IndexOf(reg);
            MockRegistrations[index] = new RegistrationRequest
            {
                Id = reg.Id,
                Company = reg.Company,
                Region = reg.Region,
                Contact = reg.Contact,
                Role = reg.Role,
                Status = "Approved",
                CreatedDate = reg.CreatedDate,
            };

            return Results.Ok(MockRegistrations[index]);
        })
        .WithName("ApproveRegistration")
        .WithSummary("Approve a pending registration request")
        .Produces<RegistrationRequest>()
        .Produces(StatusCodes.Status404NotFound);

        // POST /admin/registrations/{id}/reject — reject a registration
        group.MapPost("/registrations/{id}/reject", (string id) =>
        {
            var reg = MockRegistrations.FirstOrDefault(r => r.Id == id);
            if (reg is null) return Results.NotFound();

            var index = MockRegistrations.IndexOf(reg);
            MockRegistrations[index] = new RegistrationRequest
            {
                Id = reg.Id,
                Company = reg.Company,
                Region = reg.Region,
                Contact = reg.Contact,
                Role = reg.Role,
                Status = "Rejected",
                CreatedDate = reg.CreatedDate,
            };

            return Results.Ok(MockRegistrations[index]);
        })
        .WithName("RejectRegistration")
        .WithSummary("Reject a pending registration request")
        .Produces<RegistrationRequest>()
        .Produces(StatusCodes.Status404NotFound);

        // GET /admin/metrics — portal admin metrics
        group.MapGet("/metrics", async (IArmApiService svc, CancellationToken ct) =>
        {
            var stats = await svc.GetStatsAsync(ct);
            var metrics = new AdminMetric[]
            {
                new() { Label = "Available APIs", Value = stats.AvailableApis.ToString() },
                new() { Label = "Products", Value = stats.Products.ToString() },
                new() { Label = "Active Subscriptions", Value = stats.Subscriptions.ToString() },
                new() { Label = "Pending Registrations", Value = MockRegistrations.Count(r => r.Status == "Submitted").ToString() },
                new() { Label = "Uptime", Value = stats.Uptime },
            };
            return Results.Ok(metrics);
        })
        .WithName("GetAdminMetrics")
        .WithSummary("Portal admin metrics (API counts, registrations, uptime)")
        .Produces<AdminMetric[]>();

        return group;
    }
}
