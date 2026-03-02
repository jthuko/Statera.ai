using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public class StripeOptions
{
    public string SecretKey { get; set; } = "";
    public string WebhookSecret { get; set; } = "";
    public string PriceId { get; set; } = "";
    public string SuccessUrl { get; set; } = "https://statera-ai.com/billing/success";
    public string CancelUrl { get; set; } = "https://statera-ai.com/trial-expired";
}

public static class BillingEndpoints
{
    public static RouteGroupBuilder MapBillingEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/billing").WithTags("Billing");

        // POST /api/v1/billing/checkout-session
        // Creates a Stripe Checkout Session and returns the redirect URL.
        g.MapPost("/checkout-session", async (
            HttpContext ctx,
            [FromServices] AppDbContext db,
            [FromServices] IOptions<StripeOptions> opts,
            CancellationToken ct) =>
        {
            var stripeOpts = opts.Value;
            StripeConfiguration.ApiKey = stripeOpts.SecretKey;

            var facilityIdStr = ctx.User.FindAll("facility_id").Select(c => c.Value).FirstOrDefault();
            if (!Guid.TryParse(facilityIdStr, out var facilityId))
                return Results.BadRequest(new { error = "No facility associated with this account" });

            var facility = await db.Facilities.FirstOrDefaultAsync(f => f.Id == facilityId, ct);
            if (facility is null)
                return Results.NotFound(new { error = "Facility not found" });

            var email = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Email) ?? "";

            // Reuse existing Stripe customer if available
            string? customerId = facility.StripeCustomerId;
            if (string.IsNullOrWhiteSpace(customerId))
            {
                var customerService = new CustomerService();
                var customer = await customerService.CreateAsync(new CustomerCreateOptions
                {
                    Email = email,
                    Name = facility.Name,
                    Metadata = new Dictionary<string, string> { ["facility_id"] = facilityId.ToString() }
                }, cancellationToken: ct);
                customerId = customer.Id;
                facility.StripeCustomerId = customerId;
                await db.SaveChangesAsync(ct);
            }

            var sessionService = new SessionService();
            var session = await sessionService.CreateAsync(new SessionCreateOptions
            {
                Customer = customerId,
                Mode = "subscription",
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions { Price = stripeOpts.PriceId, Quantity = 1 }
                },
                SuccessUrl = stripeOpts.SuccessUrl + "?session_id={CHECKOUT_SESSION_ID}",
                CancelUrl = stripeOpts.CancelUrl,
                Metadata = new Dictionary<string, string> { ["facility_id"] = facilityId.ToString() },
                SubscriptionData = new SessionSubscriptionDataOptions
                {
                    Metadata = new Dictionary<string, string> { ["facility_id"] = facilityId.ToString() }
                }
            }, cancellationToken: ct);

            return Results.Ok(new { url = session.Url });
        })
        .RequireAuthorization();

        // POST /api/v1/billing/webhook
        // Stripe sends events here. No JWT auth — validated by Stripe signature.
        g.MapPost("/webhook", async (
            HttpContext ctx,
            [FromServices] AppDbContext db,
            [FromServices] IOptions<StripeOptions> opts,
            CancellationToken ct) =>
        {
            var stripeOpts = opts.Value;
            StripeConfiguration.ApiKey = stripeOpts.SecretKey;

            string json;
            using (var reader = new System.IO.StreamReader(ctx.Request.Body))
                json = await reader.ReadToEndAsync(ct);

            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    ctx.Request.Headers["Stripe-Signature"],
                    stripeOpts.WebhookSecret);
            }
            catch (StripeException)
            {
                return Results.BadRequest(new { error = "Invalid webhook signature" });
            }

            switch (stripeEvent.Type)
            {
                case EventTypes.CheckoutSessionCompleted:
                {
                    var session = stripeEvent.Data.Object as Session;
                    if (session?.Metadata?.TryGetValue("facility_id", out var fid) == true
                        && Guid.TryParse(fid, out var facilityId))
                    {
                        var facility = await db.Facilities.FirstOrDefaultAsync(f => f.Id == facilityId, ct);
                        if (facility is not null)
                        {
                            facility.PlanStatus = Statera.Domain.PlanStatus.Active;
                            facility.StripeCustomerId = session.CustomerId;
                            facility.StripeSubscriptionId = session.SubscriptionId;
                            await db.SaveChangesAsync(ct);
                        }
                    }
                    break;
                }

                case EventTypes.CustomerSubscriptionDeleted:
                case EventTypes.CustomerSubscriptionUpdated:
                {
                    var subscription = stripeEvent.Data.Object as Subscription;
                    if (subscription?.Metadata?.TryGetValue("facility_id", out var fid) == true
                        && Guid.TryParse(fid, out var facilityId))
                    {
                        var facility = await db.Facilities.FirstOrDefaultAsync(f => f.Id == facilityId, ct);
                        if (facility is not null)
                        {
                            if (stripeEvent.Type == EventTypes.CustomerSubscriptionDeleted
                                || subscription.Status == "canceled")
                            {
                                facility.PlanStatus = Statera.Domain.PlanStatus.Cancelled;
                            }
                            else if (subscription.Status == "active" || subscription.Status == "trialing")
                            {
                                facility.PlanStatus = Statera.Domain.PlanStatus.Active;
                            }
                            await db.SaveChangesAsync(ct);
                        }
                    }
                    break;
                }

                case EventTypes.InvoicePaymentFailed:
                {
                    var invoice = stripeEvent.Data.Object as Invoice;
                    if (invoice?.SubscriptionId is not null)
                    {
                        var facility = await db.Facilities
                            .FirstOrDefaultAsync(f => f.StripeSubscriptionId == invoice.SubscriptionId, ct);
                        if (facility is not null)
                        {
                            facility.PlanStatus = Statera.Domain.PlanStatus.Expired;
                            await db.SaveChangesAsync(ct);
                        }
                    }
                    break;
                }
            }

            return Results.Ok(new { received = true });
        });

        return v1;
    }
}
