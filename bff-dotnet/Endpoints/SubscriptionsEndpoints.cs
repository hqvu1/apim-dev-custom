// ---------------------------------------------------------------------------
// SubscriptionsEndpoints — minimal API route group for /subscriptions.
//
// Matches SPA's useApimCatalog and adds P0 features per APIM_DATA_API_COMPARISON:
//   GET    /subscriptions                  → PagedResult<SubscriptionContract>
//   GET    /subscriptions/{subId}          → SubscriptionContract (P0)
//   POST   /subscriptions                  → SubscriptionContract
//   PATCH  /subscriptions/{subId}          → SubscriptionContract (P0 — rename/cancel)
//   DELETE /subscriptions/{subId}          → 204 No Content
//   POST   /subscriptions/{subId}/secrets  → SubscriptionContract (P0 — keys)
//
// Write operations (POST, PATCH, DELETE) require ApiSubscribe authorization.
// Read operations require ApiRead.
// Secrets require ApiSubscribe.
//
// See docs/APIM_DATA_API_COMPARISON.md §4.1 — Subscription Lifecycle
// ---------------------------------------------------------------------------

using BffApi.Models;
using BffApi.Services;

namespace BffApi.Endpoints;

public static class SubscriptionsEndpoints
{
    public static RouteGroupBuilder MapSubscriptionsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/subscriptions")
            .WithTags("Subscriptions")
            .RequireAuthorization("ApiRead");

        // GET /subscriptions — list subscriptions with optional pagination
        group.MapGet("/", async (int? top, int? skip, IArmApiService svc, CancellationToken ct) =>
        {
            var result = await svc.ListSubscriptionsAsync(top, skip, ct);
            return Results.Ok(result);
        })
        .WithName("ListSubscriptions")
        .WithSummary("List all subscriptions with optional pagination")
        .Produces<PagedResult<SubscriptionContract>>();

        // GET /subscriptions/{subId} — individual subscription detail (P0)
        group.MapGet("/{subId}", async (string subId, IArmApiService svc, CancellationToken ct) =>
        {
            var sub = await svc.GetSubscriptionAsync(subId, ct);
            return sub is null ? Results.NotFound() : Results.Ok(sub);
        })
        .WithName("GetSubscription")
        .WithSummary("Get individual subscription detail")
        .Produces<SubscriptionContract>()
        .Produces(StatusCodes.Status404NotFound);

        // POST /subscriptions — create (or request) a new subscription
        group.MapPost("/", async (CreateSubscriptionRequest body, IArmApiService svc, CancellationToken ct) =>
        {
            var sub = await svc.CreateSubscriptionAsync(body, ct);
            return sub is null
                ? Results.Problem("Failed to create subscription", statusCode: 500)
                : Results.Created($"/subscriptions/{sub.Id}", sub);
        })
        .WithName("CreateSubscription")
        .WithSummary("Create or request a new subscription")
        .RequireAuthorization("ApiSubscribe")
        .Produces<SubscriptionContract>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status500InternalServerError);

        // PATCH /subscriptions/{subId} — update (cancel or rename) a subscription (P0)
        group.MapPatch("/{subId}", async (string subId, object patchBody, IArmApiService svc, CancellationToken ct) =>
        {
            var sub = await svc.UpdateSubscriptionAsync(subId, patchBody, ct);
            return sub is null ? Results.NotFound() : Results.Ok(sub);
        })
        .WithName("UpdateSubscription")
        .WithSummary("Update a subscription (cancel, rename)")
        .RequireAuthorization("ApiSubscribe")
        .Produces<SubscriptionContract>()
        .Produces(StatusCodes.Status404NotFound);

        // DELETE /subscriptions/{subId} — cancel subscription
        group.MapDelete("/{subId}", async (string subId, IArmApiService svc, CancellationToken ct) =>
        {
            var deleted = await svc.DeleteSubscriptionAsync(subId, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        })
        .WithName("CancelSubscription")
        .WithSummary("Cancel a subscription")
        .RequireAuthorization("ApiSubscribe")
        .Produces(StatusCodes.Status204NoContent)
        .Produces(StatusCodes.Status404NotFound);

        // POST /subscriptions/{subId}/secrets — retrieve primary/secondary keys (P0)
        group.MapPost("/{subId}/secrets", async (string subId, IArmApiService svc, CancellationToken ct) =>
        {
            var secrets = await svc.ListSubscriptionSecretsAsync(subId, ct);
            return secrets is null ? Results.NotFound() : Results.Ok(secrets);
        })
        .WithName("ListSubscriptionSecrets")
        .WithSummary("Retrieve subscription primary/secondary keys")
        .RequireAuthorization("ApiSubscribe")
        .Produces<SubscriptionContract>()
        .Produces(StatusCodes.Status404NotFound);

        return group;
    }
}
