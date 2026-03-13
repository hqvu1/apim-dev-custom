// ---------------------------------------------------------------------------
// SupportEndpoints — minimal API route group for /support.
//
// Matches SPA's Support.tsx calls:
//   GET  /api/support/faqs        → string[] (FAQ items)
//   POST /api/support/tickets     → SupportTicket (create)
//   GET  /api/support/my-tickets  → SupportTicket[] (user's tickets)
//
// POC: returns mock data. Production: integrate with ServiceNow or ITSM.
// See docs/STORY_MAPPING_GAP_ANALYSIS.md §M4–M7
// ---------------------------------------------------------------------------

using BffApi.Models;

namespace BffApi.Endpoints;

public static class SupportEndpoints
{
    // Mock FAQ data — future: fetch from CMS / Knowledge Base
    private static readonly string[] MockFaqs =
    [
        "How do I subscribe to an API? — Navigate to the API Catalog, select an API, and click 'Request Access'.",
        "How do I rotate my API keys? — Go to My Integrations, click 'Manage' on a subscription, and select 'Regenerate Key'.",
        "What is the rate limit for the Starter plan? — The Starter plan allows 100 requests per minute.",
        "How do I contact support? — Use the 'Create Ticket' tab or email api-support@komatsu.com.",
        "Can I test APIs before subscribing? — Yes, use the Try-It Console available on each API's detail page.",
    ];

    // In-memory ticket store for POC (not persisted across restarts)
    private static readonly List<SupportTicket> TicketStore = [];
    private static int _ticketCounter;

    public static RouteGroupBuilder MapSupportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/support")
            .WithTags("Support")
            .RequireAuthorization();

        // GET /support/faqs — FAQ list for knowledge base tab
        group.MapGet("/faqs", () => Results.Ok(MockFaqs))
            .WithName("GetFaqs")
            .WithSummary("List frequently asked questions")
            .Produces<string[]>();

        // POST /support/tickets — create a support ticket
        group.MapPost("/tickets", (CreateTicketRequest body, HttpContext ctx) =>
        {
            var userId = ctx.User.FindFirst("sub")?.Value ?? "anonymous";
            var ticket = new SupportTicket
            {
                Id = $"TICKET-{Interlocked.Increment(ref _ticketCounter):D4}",
                Subject = !string.IsNullOrWhiteSpace(body.Description)
                    ? body.Description[..Math.Min(body.Description.Length, 80)]
                    : "Support request",
                Status = "Open",
                Category = body.Category,
                Api = body.Api,
                Impact = body.Impact,
                Description = body.Description,
                CreatedDate = DateTime.UtcNow.ToString("O"),
            };

            TicketStore.Add(ticket);

            return Results.Created($"/api/support/tickets/{ticket.Id}", ticket);
        })
        .WithName("CreateTicket")
        .WithSummary("Submit a support ticket")
        .Produces<SupportTicket>(StatusCodes.Status201Created);

        // GET /support/my-tickets — user's ticket history
        group.MapGet("/my-tickets", (HttpContext ctx) =>
        {
            // POC: return all tickets (production: filter by user identity)
            return Results.Ok(TicketStore.AsReadOnly());
        })
        .WithName("GetMyTickets")
        .WithSummary("List the current user's support tickets")
        .Produces<List<SupportTicket>>();

        return group;
    }
}
