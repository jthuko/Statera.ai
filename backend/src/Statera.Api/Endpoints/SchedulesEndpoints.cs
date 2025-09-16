// backend/src/Statera.Api/Endpoints/SchedulesEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;
using DomainSchedule = Statera.Domain.Schedule;
using DomainUnit = Statera.Domain.Unit;
using DomainFacility = Statera.Domain.Facility;

namespace Statera.Api.Endpoints;

public static class SchedulesEndpoints
{
    public static RouteGroupBuilder MapSchedulesEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/schedules").WithTags("Schedules");

        g.MapGet("/", async (Guid? facilityId, Guid? unitId, [FromServices] AppDbContext db) =>
        {
            var q = db.Schedules.AsNoTracking().AsQueryable();
            if (facilityId.HasValue) q = q.Where(s => s.FacilityId == facilityId.Value);
            if (unitId.HasValue) q = q.Where(s => s.UnitId == unitId.Value);

            var rows = await q.OrderBy(s => s.Start).ToListAsync();
            return Results.Ok(rows.Select(s => new {
                s.Id,
                s.FacilityId,
                s.UnitId,
                s.Name,
                s.Start,
                s.End
            }));
        });

        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var s = await db.Schedules.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return s is null ? Results.NotFound() : Results.Ok(new
            {
                s.Id,
                s.FacilityId,
                s.UnitId,
                s.Name,
                s.Start,
                s.End
            });
        });

        g.MapPost("/", async ([FromBody] CreateScheduleRequest req, [FromServices] AppDbContext db) =>
        {
            if (!await db.Set<DomainFacility>().AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found" });
            if (!await db.Set<DomainUnit>().AnyAsync(u => u.Id == req.UnitId))
                return Results.BadRequest(new { error = "Unit not found" });
            if (req.End < req.Start)
                return Results.BadRequest(new { error = "End must be on/after Start" });
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { error = "Name is required" });

            var e = new DomainSchedule
            {
                Id = Guid.NewGuid(),
                FacilityId = req.FacilityId,
                UnitId = req.UnitId,
                Name = req.Name.Trim(),
                Start = req.Start,
                End = req.End
            };

            db.Schedules.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/schedules/{e.Id}", new { e.Id, e.FacilityId, e.UnitId, e.Name, e.Start, e.End });
        });

        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateScheduleRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Schedules.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            var facilityId = req.FacilityId ?? e.FacilityId;
            if (!await db.Set<DomainFacility>().AnyAsync(f => f.Id == facilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            var unitId = req.UnitId ?? e.UnitId;
            if (!await db.Set<DomainUnit>().AnyAsync(u => u.Id == unitId))
                return Results.BadRequest(new { error = "Unit not found" });

            var start = req.Start ?? e.Start;
            var end = req.End ?? e.End;
            if (end < start) return Results.BadRequest(new { error = "End must be on/after Start" });

            e.FacilityId = facilityId;
            e.UnitId = unitId;
            if (!string.IsNullOrWhiteSpace(req.Name)) e.Name = req.Name!.Trim();
            e.Start = start;
            e.End = end;

            await db.SaveChangesAsync();
            return Results.Ok(new { e.Id, e.FacilityId, e.UnitId, e.Name, e.Start, e.End });
        });

        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Schedules.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            db.Schedules.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
