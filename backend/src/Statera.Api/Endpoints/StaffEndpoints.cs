// backend/src/Statera.Api/Endpoints/StaffEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;          // AppDbContext
using Statera.Api.Contracts;          // CreateStaffRequest, UpdateStaffRequest
using Statera.Domain;                 // Staff, EmploymentType
using DomStaff = Statera.Domain.Staff;

namespace Statera.Api.Endpoints;

public static class StaffEndpoints
{
    /// <summary>
    /// Maps staff endpoints under the provided v1 route group (e.g., /api/v1).
    /// </summary>
    public static RouteGroupBuilder MapStaffEndpoints(this RouteGroupBuilder v1)
    {
        // ----- Facility-scoped shorthand: /api/v1/facilities/{facilityId}/staff  -----
        // Mirrors GET /api/v1/staff?facilityId=...
        v1.MapGet("/facilities/{facilityId:guid}/staff", async (
            Guid facilityId,
            Guid? unitId,
            bool? active,
            string? role,
            string? q,
            [FromServices] AppDbContext db) =>
        {
            var query = db.Staff.AsNoTracking().AsQueryable();

            // Required facility filter for this route:
            query = query.Where(s => s.FacilityId == facilityId);

            if (unitId.HasValue) query = query.Where(s => s.UnitId == unitId.Value);
            if (active.HasValue) query = query.Where(s => s.Active == active.Value);
            if (!string.IsNullOrWhiteSpace(role))
            {
                var r = role.Trim();
                query = query.Where(s => s.Role == r);
            }
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(s =>
                    (s.FirstName != null && s.FirstName.Contains(term)) ||
                    (s.LastName != null && s.LastName.Contains(term)) ||
                    (s.Email != null && s.Email.Contains(term)));
            }

            var rows = await query
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName)
                .ToListAsync();

            return Results.Ok(rows);
        })
        .WithTags("Staff");

        // ----- Original /api/v1/staff group -----
        var g = v1.MapGroup("/staff").WithTags("Staff");

        // GET /api/v1/staff?facilityId=&unitId=&active=&role=&q=
        g.MapGet("/", async (
            Guid? facilityId,
            Guid? unitId,
            bool? active,
            string? role,
            string? q,
            [FromServices] AppDbContext db) =>
        {
            var query = db.Staff.AsNoTracking().AsQueryable();

            if (facilityId.HasValue) query = query.Where(s => s.FacilityId == facilityId.Value);
            if (unitId.HasValue) query = query.Where(s => s.UnitId == unitId.Value);
            if (active.HasValue) query = query.Where(s => s.Active == active.Value);

            if (!string.IsNullOrWhiteSpace(role))
            {
                var r = role.Trim();
                query = query.Where(s => s.Role == r);
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(s =>
                    (s.FirstName != null && s.FirstName.Contains(term)) ||
                    (s.LastName != null && s.LastName.Contains(term)) ||
                    (s.Email != null && s.Email.Contains(term)));
            }

            var rows = await query
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName)
                .ToListAsync();

            return Results.Ok(rows);
        });

        // GET /api/v1/staff/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            return e is null ? Results.NotFound() : Results.Ok(e);
        });

        // POST /api/v1/staff
        g.MapPost("/", async ([FromBody] CreateStaffRequest req, [FromServices] AppDbContext db) =>
        {
            if (req.FacilityId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId is required" });

            if (!await db.Facilities.AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            if (req.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == req.UnitId.Value))
                return Results.BadRequest(new { error = "Unit not found" });

            if (string.IsNullOrWhiteSpace(req.FirstName) ||
                string.IsNullOrWhiteSpace(req.LastName) ||
                string.IsNullOrWhiteSpace(req.Role) ||
                string.IsNullOrWhiteSpace(req.EmploymentType))
            {
                return Results.BadRequest(new { error = "FirstName, LastName, Role, EmploymentType are required" });
            }

            if (!Enum.TryParse<EmploymentType>(req.EmploymentType, ignoreCase: true, out var et))
            {
                var allowed = string.Join(", ", Enum.GetNames(typeof(EmploymentType)));
                return Results.BadRequest(new { error = $"EmploymentType must be one of: {allowed}" });
            }

            // Optional: enforce unique email if provided
            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var email = req.Email.Trim();
                var exists = await db.Staff.AnyAsync(s => s.Email != null && s.Email == email);
                if (exists) return Results.Conflict(new { error = "A staff member with that email already exists." });
            }

            var e = new DomStaff
            {
                Id = Guid.NewGuid(),
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim(),
                FacilityId = req.FacilityId,
                UnitId = req.UnitId,
                Role = req.Role.Trim(),
                EmploymentType = et,
                Active = req.Active
            };

            db.Staff.Add(e);
            await db.SaveChangesAsync();

            return Results.Created($"/api/v1/staff/{e.Id}", e);
        });

        // PUT /api/v1/staff/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateStaffRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (e is null) return Results.NotFound();

            if (req.FacilityId.HasValue)
            {
                var fid = req.FacilityId.Value;
                if (!await db.Facilities.AnyAsync(f => f.Id == fid))
                    return Results.BadRequest(new { error = "Facility not found" });
                e.FacilityId = fid;
            }

            if (req.UnitId.HasValue)
            {
                var uid = req.UnitId.Value;
                if (!await db.Units.AnyAsync(u => u.Id == uid))
                    return Results.BadRequest(new { error = "Unit not found" });
                e.UnitId = uid;
            }

            if (!string.IsNullOrWhiteSpace(req.FirstName)) e.FirstName = req.FirstName.Trim();
            if (!string.IsNullOrWhiteSpace(req.LastName)) e.LastName = req.LastName.Trim();
            if (!string.IsNullOrWhiteSpace(req.Role)) e.Role = req.Role.Trim();

            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var email = req.Email.Trim();
                var exists = await db.Staff.AnyAsync(s => s.Id != id && s.Email != null && s.Email == email);
                if (exists) return Results.Conflict(new { error = "A staff member with that email already exists." });
                e.Email = email;
            }

            if (!string.IsNullOrWhiteSpace(req.EmploymentType))
            {
                if (!Enum.TryParse<EmploymentType>(req.EmploymentType, ignoreCase: true, out var et))
                {
                    var allowed = string.Join(", ", Enum.GetNames(typeof(EmploymentType)));
                    return Results.BadRequest(new { error = $"EmploymentType must be one of: {allowed}" });
                }
                e.EmploymentType = et;
            }

            if (req.Active.HasValue) e.Active = req.Active.Value;

            await db.SaveChangesAsync();
            return Results.Ok(e);
        });

        // DELETE /api/v1/staff/{id}
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (e is null) return Results.NotFound();

            db.Staff.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
