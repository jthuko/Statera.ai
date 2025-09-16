// backend/src/Statera.Api/Endpoints/UsersEndpoints.cs
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsersEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/users").WithTags("Users");

        // LIST
        g.MapGet("/", async ([FromServices] UserManager<AppUser> um) =>
        {
            // Identity stores users in the manager's store; use Users IQueryable if supported
            var q = um.Users; // IQueryable<AppUser> when using EF store
            var rows = await q.AsNoTracking().ToListAsync();
            return Results.Ok(rows.Select(u => new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.EmailConfirmed,
                u.LockoutEnabled,
                u.LockoutEnd
            }));
        });

        // GET by id
        g.MapGet("/{id}", async (string id, [FromServices] UserManager<AppUser> um) =>
        {
            var u = await um.FindByIdAsync(id);
            return u is null
                ? Results.NotFound()
                : Results.Ok(new { u.Id, u.UserName, u.Email, u.EmailConfirmed, u.LockoutEnabled, u.LockoutEnd });
        });

        // CREATE
        g.MapPost("/", async ([FromBody] CreateIdentityUserRequest req, [FromServices] UserManager<AppUser> um) =>
        {
            var user = new AppUser
            {
                UserName = string.IsNullOrWhiteSpace(req.UserName) ? req.Email : req.UserName!.Trim(),
                Email = req.Email.Trim()
            };

            var result = await um.CreateAsync(user, req.Password);
            if (!result.Succeeded)
                return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description) });

            return Results.Created($"/api/v1/users/{user.Id}", new
            {
                user.Id,
                user.UserName,
                user.Email,
                user.EmailConfirmed,
                user.LockoutEnabled,
                user.LockoutEnd
            });
        });

        // UPDATE
        g.MapPut("/{id}", async (string id, [FromBody] UpdateIdentityUserRequest req, [FromServices] UserManager<AppUser> um) =>
        {
            var u = await um.FindByIdAsync(id);
            if (u is null) return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(req.Email)) u.Email = req.Email!.Trim();
            if (!string.IsNullOrWhiteSpace(req.UserName)) u.UserName = req.UserName!.Trim();
            if (req.LockoutEnabled.HasValue) u.LockoutEnabled = req.LockoutEnabled.Value;

            var result = await um.UpdateAsync(u);
            if (!result.Succeeded)
                return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description) });

            return Results.Ok(new { u.Id, u.UserName, u.Email, u.EmailConfirmed, u.LockoutEnabled, u.LockoutEnd });
        });

        // DELETE
        g.MapDelete("/{id}", async (string id, [FromServices] UserManager<AppUser> um) =>
        {
            var u = await um.FindByIdAsync(id);
            if (u is null) return Results.NotFound();

            var result = await um.DeleteAsync(u);
            if (!result.Succeeded)
                return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description) });

            return Results.NoContent();
        });

        return v1;
    }
}
