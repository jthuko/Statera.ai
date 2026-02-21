using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;            // AppDbContext
using Statera.Api.Contracts;            // DTOs
using DomFacility = Statera.Domain.Facility;

namespace Statera.Api.Endpoints;

public static class FacilitiesEndpoints
{
    public static RouteGroupBuilder MapFacilitiesEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/facilities").WithTags("Facilities");

        // GET /api/v1/facilities — Owner sees all, FacilityAdmin sees only assigned ones
        g.MapGet("/", async (HttpContext ctx, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var sysRole = ctx.User.FindFirstValue("system_role");
            var query = db.Facilities.AsNoTracking();

            if (sysRole != "Owner")
            {
                var allowedIds = ctx.User.FindAll("facility_id")
                    .Select(c => Guid.Parse(c.Value))
                    .ToHashSet();
                query = query.Where(f => allowedIds.Contains(f.Id));
            }

            var rows = await query
                .OrderBy(f => f.Name)
                .Select(f => new FacilityItemResponse(f.Id, f.Name, f.Address, f.City, f.State, f.Zip))
                .ToListAsync(ct);

            return Results.Ok(rows);
        })
        .RequireAuthorization("Authenticated");

        // GET /api/v1/facilities/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var e = await db.Facilities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            return e is null
                ? Results.NotFound()
                : Results.Ok(new FacilityItemResponse(e.Id, e.Name, e.Address, e.City, e.State, e.Zip));
        })
        .RequireAuthorization("FacilityAccess");

        // POST /api/v1/facilities — Owner only
        g.MapPost("/", async ([FromBody] CreateFacilityRequest req, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name) ||
                string.IsNullOrWhiteSpace(req.Address) ||
                string.IsNullOrWhiteSpace(req.City) ||
                string.IsNullOrWhiteSpace(req.State) ||
                string.IsNullOrWhiteSpace(req.Zip))
            {
                return Results.BadRequest(new { error = "Name, Address, City, State, Zip are required" });
            }

            var e = new DomFacility
            {
                Id = Guid.NewGuid(),
                Name = req.Name.Trim(),
                Address = req.Address.Trim(),
                City = req.City.Trim(),
                State = req.State.Trim(),
                Zip = req.Zip.Trim()
            };

            db.Facilities.Add(e);
            await db.SaveChangesAsync(ct);

            return Results.Created(
                $"/api/v1/facilities/{e.Id}",
                new FacilityItemResponse(e.Id, e.Name, e.Address, e.City, e.State, e.Zip)
            );
        })
        .RequireAuthorization("OwnerOnly");

        // PUT /api/v1/facilities/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateFacilityRequest req, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var e = await db.Facilities.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e is null) return Results.NotFound();

            if (req.Name is not null) e.Name = req.Name.Trim();
            if (req.Address is not null) e.Address = req.Address.Trim();
            if (req.City is not null) e.City = req.City.Trim();
            if (req.State is not null) e.State = req.State.Trim();
            if (req.Zip is not null) e.Zip = req.Zip.Trim();

            await db.SaveChangesAsync(ct);

            return Results.Ok(new FacilityItemResponse(e.Id, e.Name, e.Address, e.City, e.State, e.Zip));
        })
        .RequireAuthorization("FacilityAccess");

        // DELETE /api/v1/facilities/{id} — Owner only
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var e = await db.Facilities.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e is null) return Results.NotFound();

            db.Facilities.Remove(e);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .RequireAuthorization("OwnerOnly");

        // ── Admin Management ─────────────────────────────────────────────────────

        // GET /api/v1/facilities/{facilityId}/admins
        // Owner or FacilityAdmin of that facility can list its admins
        g.MapGet("/{facilityId:guid}/admins", async (
            Guid facilityId,
            HttpContext ctx,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var callerId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var sysRole  = ctx.User.FindFirstValue("system_role");

            if (sysRole != "Owner")
            {
                var isFacilityAdmin = await db.UserFacilityRoles
                    .AnyAsync(ufr => ufr.UserId == callerId && ufr.FacilityId == facilityId, ct);
                if (!isFacilityAdmin) return Results.Forbid();
            }

            var admins = await db.UserFacilityRoles
                .Where(ufr => ufr.FacilityId == facilityId)
                .Join(db.Users,
                      ufr => ufr.UserId,
                      u   => u.Id,
                      (ufr, u) => new FacilityAdminResponse(
                          u.Id, u.Email ?? "", ufr.FacilityRole, ufr.AssignedUtc))
                .ToListAsync(ct);

            return Results.Ok(admins);
        })
        .RequireAuthorization("Authenticated");

        // POST /api/v1/facilities/{facilityId}/admins
        // Owner or FacilityAdmin of that facility can assign a new admin
        g.MapPost("/{facilityId:guid}/admins", async (
            Guid facilityId,
            [FromBody] AssignFacilityAdminRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var callerId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var sysRole  = ctx.User.FindFirstValue("system_role");

            if (sysRole != "Owner")
            {
                var isFacilityAdmin = await db.UserFacilityRoles
                    .AnyAsync(ufr => ufr.UserId == callerId && ufr.FacilityId == facilityId, ct);
                if (!isFacilityAdmin) return Results.Forbid();
            }

            var targetUser = await db.Users.FindAsync([req.UserId], ct);
            if (targetUser is null) return Results.BadRequest(new { error = "User not found" });

            var facilityExists = await db.Facilities.AnyAsync(f => f.Id == facilityId, ct);
            if (!facilityExists) return Results.NotFound();

            var existing = await db.UserFacilityRoles
                .FirstOrDefaultAsync(ufr => ufr.UserId == req.UserId && ufr.FacilityId == facilityId, ct);
            if (existing is not null)
                return Results.Conflict(new { error = "User is already assigned to this facility" });

            var entry = new UserFacilityRole
            {
                Id             = Guid.NewGuid(),
                UserId         = req.UserId,
                FacilityId     = facilityId,
                FacilityRole   = req.FacilityRole,
                AssignedByUserId = callerId,
                AssignedUtc    = DateTime.UtcNow
            };

            db.UserFacilityRoles.Add(entry);
            await db.SaveChangesAsync(ct);

            return Results.Created(
                $"/api/v1/facilities/{facilityId}/admins/{req.UserId}",
                new FacilityAdminResponse(req.UserId, targetUser.Email ?? "", entry.FacilityRole, entry.AssignedUtc));
        })
        .RequireAuthorization("Authenticated");

        // DELETE /api/v1/facilities/{facilityId}/admins/{userId} — Owner only
        g.MapDelete("/{facilityId:guid}/admins/{userId}", async (
            Guid facilityId,
            string userId,
            HttpContext ctx,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var sysRole = ctx.User.FindFirstValue("system_role");
            if (sysRole != "Owner") return Results.Forbid();

            var entry = await db.UserFacilityRoles
                .FirstOrDefaultAsync(ufr => ufr.FacilityId == facilityId && ufr.UserId == userId, ct);
            if (entry is null) return Results.NotFound();

            db.UserFacilityRoles.Remove(entry);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .RequireAuthorization("OwnerOnly");

        return v1;
    }
}
