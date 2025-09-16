// backend/src/Statera.Api/Endpoints/AssignmentsEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;

// Alias to avoid ambiguity with Contracts.Assignment
using DomainAssignment = Statera.Domain.Assignment;
using DomainUnit = Statera.Domain.Unit;

namespace Statera.Endpoints;

public static class AssignmentsEndpoints
{
    public static RouteGroupBuilder MapAssignmentsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/assignments").WithTags("Assignments");

        g.MapGet("/", async (Guid? staffId, Guid? facilityId, Guid? unitId, DateTime? fromUtc, DateTime? toUtc, [FromServices] AppDbContext db) =>
        {
            var q = db.Assignments.AsNoTracking().AsQueryable();

            if (staffId.HasValue) q = q.Where(a => a.StaffId == staffId.Value);
            if (facilityId.HasValue) q = q.Where(a => a.FacilityId == facilityId.Value);
            if (unitId.HasValue) q = q.Where(a => a.UnitId == unitId.Value);
            if (fromUtc.HasValue) q = q.Where(a => a.EndUtc > fromUtc.Value);
            if (toUtc.HasValue) q = q.Where(a => a.StartUtc < toUtc.Value);

            var rows = await q.OrderBy(a => a.StartUtc).ToListAsync();

            return Results.Ok(rows.Select(a => new
            {
                a.Id,
                a.StaffId,
                a.FacilityId,
                a.UnitId,
                a.FacilityState,
                a.StartUtc,
                a.EndUtc,
                a.Notes
            }));
        });

        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var a = await db.Assignments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return a is null ? Results.NotFound() : Results.Ok(new
            {
                a.Id,
                a.StaffId,
                a.FacilityId,
                a.UnitId,
                a.FacilityState,
                a.StartUtc,
                a.EndUtc,
                a.Notes
            });
        });

        g.MapPost("/", async ([FromBody] CreateAssignmentRequest req, [FromServices] AppDbContext db) =>
        {
            if (req.StartUtc >= req.EndUtc)
                return Results.BadRequest(new { error = "StartUtc must be before EndUtc" });

            if (!await db.Staff.AnyAsync(s => s.Id == req.StaffId))
                return Results.BadRequest(new { error = "Staff not found" });

            if (!await db.Facilities.AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            if (req.UnitId.HasValue && !await db.Set<DomainUnit>().AnyAsync(u => u.Id == req.UnitId.Value))
                return Results.BadRequest(new { error = "Unit not found" });

            var e = new DomainAssignment
            {
                Id = Guid.NewGuid(),
                StaffId = req.StaffId,
                FacilityId = req.FacilityId,
                UnitId = req.UnitId,
                FacilityState = req.FacilityState.Trim(),
                StartUtc = DateTime.SpecifyKind(req.StartUtc, DateTimeKind.Utc),
                EndUtc = DateTime.SpecifyKind(req.EndUtc, DateTimeKind.Utc),
                Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes!.Trim()
            };

            db.Assignments.Add(e);
            await db.SaveChangesAsync();

            return Results.Created($"/api/v1/assignments/{e.Id}", new
            {
                e.Id,
                e.StaffId,
                e.FacilityId,
                e.UnitId,
                e.FacilityState,
                e.StartUtc,
                e.EndUtc,
                e.Notes
            });
        });

        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateAssignmentRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Assignments.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            var staffId = req.StaffId ?? e.StaffId;
            if (!await db.Staff.AnyAsync(s => s.Id == staffId))
                return Results.BadRequest(new { error = "Staff not found" });

            var facilityId = req.FacilityId ?? e.FacilityId;
            if (!await db.Facilities.AnyAsync(f => f.Id == facilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            Guid? unitId = req.UnitId ?? e.UnitId;
            if (unitId.HasValue && !await db.Set<DomainUnit>().AnyAsync(u => u.Id == unitId.Value))
                return Results.BadRequest(new { error = "Unit not found" });

            var start = req.StartUtc ?? e.StartUtc;
            var end = req.EndUtc ?? e.EndUtc;
            if (start >= end) return Results.BadRequest(new { error = "StartUtc must be before EndUtc" });

            e.StaffId = staffId;
            e.FacilityId = facilityId;
            e.UnitId = unitId;
            if (!string.IsNullOrWhiteSpace(req.FacilityState)) e.FacilityState = req.FacilityState!.Trim();
            e.StartUtc = DateTime.SpecifyKind(start, DateTimeKind.Utc);
            e.EndUtc = DateTime.SpecifyKind(end, DateTimeKind.Utc);
            e.Notes = req.Notes ?? e.Notes;

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                e.Id,
                e.StaffId,
                e.FacilityId,
                e.UnitId,
                e.FacilityState,
                e.StartUtc,
                e.EndUtc,
                e.Notes
            });
        });

        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Assignments.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            db.Assignments.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
