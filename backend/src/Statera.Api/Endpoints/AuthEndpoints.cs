using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/auth").WithTags("Auth");

        g.MapPost("/login", async (
            [FromBody] LoginRequest req,
            [FromServices] UserManager<AppUser> um,
            [FromServices] SignInManager<AppUser> sm,
            [FromServices] IJwtService jwt,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return Results.BadRequest(new { error = "Missing credentials" });

            var user = await um.FindByEmailAsync(req.Email);
            if (user is null) return Results.Unauthorized();

            var result = await sm.CheckPasswordSignInAsync(user, req.Password, lockoutOnFailure: false);
            if (!result.Succeeded) return Results.Unauthorized();

            // Owners get all facility IDs; FacilityAdmins get only their assigned ones
            List<Guid> facilityIds;
            if (user.SystemRole == "Owner")
            {
                facilityIds = await db.Facilities.Select(f => f.Id).ToListAsync(ct);
            }
            else
            {
                facilityIds = await db.UserFacilityRoles
                    .Where(ufr => ufr.UserId == user.Id)
                    .Select(ufr => ufr.FacilityId)
                    .ToListAsync(ct);
            }

            var tokens = await jwt.CreateAsync(user, facilityIds, ct);
            return Results.Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
        });

        // Returns the current user's identity decoded from the Bearer token
        g.MapGet("/me", (HttpContext ctx) =>
        {
            var userId   = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var email    = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Email);
            var sysRole  = ctx.User.FindFirstValue("system_role") ?? "FacilityAdmin";
            var fidClaims = ctx.User.FindAll("facility_id")
                                    .Select(c => c.Value)
                                    .ToList();

            if (userId is null) return Results.Unauthorized();

            return Results.Ok(new UserInfoResponse(userId, email ?? "", sysRole, fidClaims));
        })
        .RequireAuthorization();

        g.MapPost("/refresh", ([FromBody] RefreshTokenRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Results.BadRequest(new { error = "Missing refresh token" });
            // TODO: validate stored refresh token server-side for production
            return Results.Unauthorized();
        });

        g.MapPost("/logout", ([FromBody] LogoutRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Results.BadRequest(new { error = "Missing refresh token" });
            return Results.Ok(new { ok = true });
        });

        g.MapPost("/register", ([FromBody] RegisterUserRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) ||
                string.IsNullOrWhiteSpace(req.Password) ||
                string.IsNullOrWhiteSpace(req.FirstName) ||
                string.IsNullOrWhiteSpace(req.LastName))
            {
                return Results.BadRequest(new { error = "All fields are required" });
            }
            return Results.Ok(new { registered = true, email = req.Email });
        });

        return v1;
    }
}
