using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace Statera.Api.Authorization;

/// <summary>
/// Requirement marker for facility-scoped authorization.
/// </summary>
public class FacilityAccessRequirement : IAuthorizationRequirement { }

/// <summary>
/// Authorization handler that ensures the authenticated user has access to the
/// facility referenced in the route (via the {facilityId} segment).
/// Owners bypass all facility checks; FacilityAdmins must have a matching
/// "facility_id" claim in their JWT token.
/// </summary>
public class FacilityAccessHandler : AuthorizationHandler<FacilityAccessRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        FacilityAccessRequirement requirement)
    {
        var user = context.User;

        if (!(user.Identity?.IsAuthenticated ?? false))
            return Task.CompletedTask;

        var sysRole = user.FindFirstValue("system_role");

        // Owners have global access — no facility check needed
        if (sysRole == "Owner")
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // Extract the facilityId from the HTTP route
        if (context.Resource is not HttpContext httpCtx)
        {
            // If there is no HttpContext resource (e.g. unit tests), succeed by default
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var routeValues = httpCtx.Request.RouteValues;

        // If this endpoint has no {facilityId} in the route, allow it through
        if (!routeValues.TryGetValue("facilityId", out var rawId) ||
            !Guid.TryParse(rawId?.ToString(), out var requestedFacilityId))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // Check whether any facility_id claim in the JWT matches the requested facility
        var allowedIds = user.FindAll("facility_id")
                             .Select(c => c.Value)
                             .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (allowedIds.Contains(requestedFacilityId.ToString()))
            context.Succeed(requirement);

        // Otherwise the requirement stays unfulfilled → 403 Forbidden

        return Task.CompletedTask;
    }
}
