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
using DomAssignment = Statera.Domain.Assignment;

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

        // ── Facility-Scoped Assignments ───────────────────────────────────────────

        // GET /api/v1/facilities/{facilityId}/assignments
        g.MapGet("/{facilityId:guid}/assignments", async (
            Guid facilityId,
            string? start,
            string? end,
            Guid? unitId,
            string? roleId,
            Guid? staffId,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var q = db.Assignments.AsNoTracking().Where(a => a.FacilityId == facilityId);

            if (staffId.HasValue) q = q.Where(a => a.StaffId == staffId.Value);
            if (unitId.HasValue)  q = q.Where(a => a.UnitId == unitId.Value);
            if (!string.IsNullOrWhiteSpace(roleId)) q = q.Where(a => a.RoleId == roleId);
            if (!string.IsNullOrWhiteSpace(start) && DateTime.TryParse(start, out var fromUtc))
                q = q.Where(a => a.EndUtc > fromUtc);
            if (!string.IsNullOrWhiteSpace(end) && DateTime.TryParse(end, out var toUtc))
                q = q.Where(a => a.StartUtc < toUtc);

            var rows = await q.OrderBy(a => a.StartUtc).ToListAsync(ct);
            return Results.Ok(rows.Select(a => new
            {
                id        = a.Id,
                facilityId = a.FacilityId,
                unitId    = a.UnitId,
                staffId   = a.StaffId,
                roleId    = a.RoleId,
                start     = a.StartUtc,
                end       = a.EndUtc,
                notes     = a.Notes
            }));
        })
        .RequireAuthorization("FacilityAccess");

        // POST /api/v1/facilities/{facilityId}/assignments
        g.MapPost("/{facilityId:guid}/assignments", async (
            Guid facilityId,
            [FromBody] FacilityAssignmentCreateRequest req,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var facility = await db.Facilities.AsNoTracking().FirstOrDefaultAsync(f => f.Id == facilityId, ct);
            if (facility is null) return Results.NotFound();

            if (!await db.Staff.AnyAsync(s => s.Id == req.StaffId && s.FacilityId == facilityId, ct))
                return Results.BadRequest(new { error = "Staff not found in this facility" });

            if (!DateTime.TryParse(req.Start, null, System.Globalization.DateTimeStyles.RoundtripKind, out var startUtc))
                return Results.BadRequest(new { error = "Invalid start date" });
            if (!DateTime.TryParse(req.End, null, System.Globalization.DateTimeStyles.RoundtripKind, out var endUtc))
                return Results.BadRequest(new { error = "Invalid end date" });
            if (startUtc >= endUtc)
                return Results.BadRequest(new { error = "start must be before end" });

            var availError = await CheckAvailabilityAsync(db, req.StaffId, DateTime.SpecifyKind(startUtc, DateTimeKind.Utc), DateTime.SpecifyKind(endUtc, DateTimeKind.Utc), ct);
            if (availError is not null) return Results.UnprocessableEntity(new { error = availError, code = "AVAILABILITY_CONFLICT" });

            var e = new DomAssignment
            {
                Id            = Guid.NewGuid(),
                StaffId       = req.StaffId,
                FacilityId    = facilityId,
                UnitId        = req.UnitId == Guid.Empty ? null : req.UnitId,
                FacilityState = facility.State,
                RoleId        = req.RoleId,
                StartUtc      = DateTime.SpecifyKind(startUtc, DateTimeKind.Utc),
                EndUtc        = DateTime.SpecifyKind(endUtc, DateTimeKind.Utc),
                Notes         = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim()
            };

            db.Assignments.Add(e);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/api/v1/facilities/{facilityId}/assignments/{e.Id}", new
            {
                id        = e.Id,
                facilityId = e.FacilityId,
                unitId    = e.UnitId,
                staffId   = e.StaffId,
                roleId    = e.RoleId,
                start     = e.StartUtc,
                end       = e.EndUtc,
                notes     = e.Notes
            });
        })
        .RequireAuthorization("FacilityAccess");

        // PUT /api/v1/facilities/{facilityId}/assignments/{id}
        g.MapPut("/{facilityId:guid}/assignments/{id:guid}", async (
            Guid facilityId,
            Guid id,
            [FromBody] FacilityAssignmentUpdateRequest req,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.Assignments.FirstOrDefaultAsync(a => a.Id == id && a.FacilityId == facilityId, ct);
            if (e is null) return Results.NotFound();

            if (req.StaffId.HasValue)
            {
                if (!await db.Staff.AnyAsync(s => s.Id == req.StaffId.Value && s.FacilityId == facilityId, ct))
                    return Results.BadRequest(new { error = "Staff not found in this facility" });
                e.StaffId = req.StaffId.Value;
            }
            if (req.UnitId.HasValue) e.UnitId = req.UnitId.Value == Guid.Empty ? null : req.UnitId.Value;
            if (!string.IsNullOrWhiteSpace(req.RoleId)) e.RoleId = req.RoleId;

            if (!string.IsNullOrWhiteSpace(req.Start) &&
                DateTime.TryParse(req.Start, null, System.Globalization.DateTimeStyles.RoundtripKind, out var startUtc))
                e.StartUtc = DateTime.SpecifyKind(startUtc, DateTimeKind.Utc);
            if (!string.IsNullOrWhiteSpace(req.End) &&
                DateTime.TryParse(req.End, null, System.Globalization.DateTimeStyles.RoundtripKind, out var endUtc))
                e.EndUtc = DateTime.SpecifyKind(endUtc, DateTimeKind.Utc);

            if (e.StartUtc >= e.EndUtc)
                return Results.BadRequest(new { error = "start must be before end" });

            if (req.Notes is not null) e.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();

            var availErr = await CheckAvailabilityAsync(db, e.StaffId, e.StartUtc, e.EndUtc, ct);
            if (availErr is not null) return Results.UnprocessableEntity(new { error = availErr, code = "AVAILABILITY_CONFLICT" });

            await db.SaveChangesAsync(ct);

            return Results.Ok(new
            {
                id        = e.Id,
                facilityId = e.FacilityId,
                unitId    = e.UnitId,
                staffId   = e.StaffId,
                roleId    = e.RoleId,
                start     = e.StartUtc,
                end       = e.EndUtc,
                notes     = e.Notes
            });
        })
        .RequireAuthorization("FacilityAccess");

        // DELETE /api/v1/facilities/{facilityId}/assignments/{id}
        g.MapDelete("/{facilityId:guid}/assignments/{id:guid}", async (
            Guid facilityId,
            Guid id,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.Assignments.FirstOrDefaultAsync(a => a.Id == id && a.FacilityId == facilityId, ct);
            if (e is null) return Results.NotFound();
            db.Assignments.Remove(e);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .RequireAuthorization("FacilityAccess");

        return v1;
    }

    private static async Task<string?> CheckAvailabilityAsync(
        AppDbContext db, Guid staffId, DateTime startUtc, DateTime endUtc, CancellationToken ct)
    {
        var avail = await db.StaffAvailabilities.AsNoTracking()
            .Where(a => a.StaffId == staffId)
            .ToListAsync(ct);

        if (avail.Count == 0) return null; // no restrictions defined

        var cursor = startUtc.Date;
        while (cursor <= endUtc.Date)
        {
            var dow     = cursor.DayOfWeek;
            var segStart = cursor == startUtc.Date ? startUtc.TimeOfDay : TimeSpan.Zero;
            var segEnd   = cursor == endUtc.Date   ? endUtc.TimeOfDay   : TimeSpan.FromHours(24);
            if (segEnd == TimeSpan.Zero) { cursor = cursor.AddDays(1); continue; }

            var covered = avail.Any(a =>
                a.DayOfWeek == dow &&
                a.StartLocal <= segStart &&
                a.EndLocal   >= segEnd);

            if (!covered)
                return $"Staff is not available on {dow}. Adjust the shift time or update their availability settings.";

            cursor = cursor.AddDays(1);
        }
        return null;
    }
}
