using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Statera.Api.Contracts;

namespace Statera.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/auth").WithTags("Auth");

        g.MapPost("/login", ([FromBody] LoginRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return Results.BadRequest(new { error = "Missing credentials" });

            // demo token
            var resp = new AuthResponse("access-token-demo", "refresh-token-demo");
            return Results.Ok(resp);
        });

        g.MapPost("/refresh", ([FromBody] RefreshTokenRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Results.BadRequest(new { error = "Missing refresh token" });
            var resp = new AuthResponse("access-token-demo-2", "refresh-token-demo-2");
            return Results.Ok(resp);
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
