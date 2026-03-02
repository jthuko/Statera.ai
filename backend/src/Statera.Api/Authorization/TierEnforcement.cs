using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Statera.Api.Authorization;

/// <summary>
/// Helpers for enforcing plan tier requirements on API endpoints.
/// Trial users always pass (they have full Growth-equivalent access).
/// Starter users are blocked from Growth+ features.
/// </summary>
public static class TierEnforcement
{
    private static readonly HashSet<string> GrowthTiers =
        new(StringComparer.OrdinalIgnoreCase) { "Growth", "Scale", "Enterprise" };

    /// <summary>
    /// Returns true if the calling user may access a Growth+ feature.
    /// Trial status always passes. Active Starter accounts are blocked.
    /// </summary>
    public static bool CanAccessGrowthFeature(HttpContext ctx)
    {
        var planStatus = ctx.User.FindFirstValue("plan_status");
        var planTier   = ctx.User.FindFirstValue("plan_tier");

        // Trial users get full access while evaluating
        if (string.Equals(planStatus, "Trial", StringComparison.OrdinalIgnoreCase))
            return true;

        return planTier != null && GrowthTiers.Contains(planTier);
    }

    /// <summary>Returns a 402 Payment Required response with upgrade details.</summary>
    public static IResult UpgradeRequired() =>
        Results.Json(
            new { error = "upgrade_required", requiredTier = "Growth",
                  message = "This feature requires the Growth plan or higher." },
            statusCode: 402);
}
