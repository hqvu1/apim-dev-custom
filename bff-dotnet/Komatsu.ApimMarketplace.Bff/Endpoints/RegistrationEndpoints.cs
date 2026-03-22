// ---------------------------------------------------------------------------
// RegistrationEndpoints — minimal API route group for /registration.
//
// Matches SPA's Register.tsx and Onboarding.tsx calls:
//   GET  /api/registration/config  → { fields: string[] }
//   POST /api/registration         → RegistrationRequest (submit)
//   GET  /api/registration/status  → { status: string }
//
// POC: returns mock data. Production: integrate with Logic Apps workflow.
// See docs/STORY_MAPPING_GAP_ANALYSIS.md §"Critical Misalignment"
// ---------------------------------------------------------------------------

using Komatsu.ApimMarketplace.Bff.Models;

namespace Komatsu.ApimMarketplace.Bff.Endpoints;

public static class RegistrationEndpoints
{
    // In-memory registration store for POC
    private static readonly List<RegistrationRequest> RegistrationStore = [];
    private static int _regCounter;

    public static RouteGroupBuilder MapRegistrationEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/registration")
            .WithTags("Registration")
            .RequireAuthorization();

        // GET /registration/config — dynamic form field configuration
        group.MapGet("/config", () =>
        {
            var config = new RegistrationConfig
            {
                Fields = ["Company", "Contact", "Role"],
            };
            return Results.Ok(config);
        })
        .WithName("GetRegistrationConfig")
        .WithSummary("Get registration form field configuration")
        .Produces<RegistrationConfig>();

        // POST /registration — submit a registration request
        group.MapPost("/", (CreateRegistrationRequest body, HttpContext ctx) =>
        {
            var userId = ctx.User.FindFirst("sub")?.Value ?? "anonymous";
            var registration = new RegistrationRequest
            {
                Id = $"REG-{Interlocked.Increment(ref _regCounter):D4}",
                Company = body.Company ?? "Unknown",
                Region = "NA",
                Contact = body.Contact,
                Role = body.Role,
                Status = "Submitted",
                CreatedDate = DateTime.UtcNow.ToString("O"),
            };

            RegistrationStore.Add(registration);

            return Results.Created($"/api/registration/{registration.Id}", registration);
        })
        .WithName("SubmitRegistration")
        .WithSummary("Submit a dealer or vendor registration request")
        .Produces<RegistrationRequest>(StatusCodes.Status201Created);

        // GET /registration/status — current user's onboarding status
        group.MapGet("/status", (HttpContext ctx) =>
        {
            // POC: return latest registration status or default
            var latest = RegistrationStore.LastOrDefault();
            var status = new RegistrationStatus
            {
                Status = latest?.Status ?? "Under Review",
            };
            return Results.Ok(status);
        })
        .WithName("GetRegistrationStatus")
        .WithSummary("Get current user's registration/onboarding status")
        .Produces<RegistrationStatus>();

        return group;
    }
}
