// backend/src/Statera.Api/Endpoints/ShiftTemplatesEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;
using DomainUnit = Statera.Domain.Unit;
using DomainFacility = Statera.Domain.Facility;
using DomainShiftTemplate = Statera.Domain.ShiftTemplate;

namespace Statera.Api.Endpoints;

public static class ShiftTemplatesEndpoints
{
    public static RouteGroupBuilder MapTemplatesEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/templates").WithTags("ShiftTemplates");

        g.MapGet("/", async (Guid? facilityId, Guid? unitId, [FromServices] AppDbContext db) =>
        {
            var q = db.ShiftTemplates.AsNoTracking().AsQueryable();
            if (facilityId.HasValue) q = q.Where(t => t.FacilityId == facilityId.Value);
            if (unitId.HasValue) q = q.Where(t => t.UnitId == unitId.Value);

            var rows = await q.ToListAsync();
            return Results.Ok(rows.Select(t => new {
                t.Id,
                t.FacilityId,
                t.UnitId,
                t.Name,
                t.Type,
                t.StartLocal,
                t.EndLocal,
                t.RequiredCount,
                t.QualificationsCsv
            }));
        });

        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var t = await db.ShiftTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return t is null ? Results.NotFound() : Results.Ok(new
            {
                t.Id,
                t.FacilityId,
                t.UnitId,
                t.Name,
                t.Type,
                t.StartLocal,
                t.EndLocal,
                t.RequiredCount,
                t.QualificationsCsv
            });
        });

        g.MapPost("/", async ([FromBody] CreateShiftTemplateRequest req, [FromServices] AppDbContext db) =>
        {
            if (!await db.Set<DomainFacility>().AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found" });
            if (!await db.Set<DomainUnit>().AnyAsync(u => u.Id == req.UnitId))
                return Results.BadRequest(new { error = "Unit not found" });

            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { error = "Name is required" });
            if (string.IsNullOrWhiteSpace(req.Type))
                return Results.BadRequest(new { error = "Type is required" });
            if (req.RequiredCount < 1)
                return Results.BadRequest(new { error = "RequiredCount must be >= 1" });
            if (req.EndLocal <= req.StartLocal)
                return Results.BadRequest(new { error = "EndLocal must be after StartLocal" });

            var e = new DomainShiftTemplate
            {
                Id = Guid.NewGuid(),
                FacilityId = req.FacilityId,
                UnitId = req.UnitId,
                Name = req.Name.Trim(),
                Type = req.Type.Trim(),
                StartLocal = req.StartLocal,
                EndLocal = req.EndLocal,
                RequiredCount = req.RequiredCount,
                QualificationsCsv = string.IsNullOrWhiteSpace(req.QualificationsCsv) ? null : req.QualificationsCsv!.Trim()
            };

            db.ShiftTemplates.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/templates/{e.Id}", new
            {
                e.Id,
                e.FacilityId,
                e.UnitId,
                e.Name,
                e.Type,
                e.StartLocal,
                e.EndLocal,
                e.RequiredCount,
                e.QualificationsCsv
            });
        });

        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateShiftTemplateRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.ShiftTemplates.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            var facilityId = req.FacilityId ?? e.FacilityId;
            if (!await db.Set<DomainFacility>().AnyAsync(f => f.Id == facilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            var unitId = req.UnitId ?? e.UnitId;
            if (!await db.Set<DomainUnit>().AnyAsync(u => u.Id == unitId))
                return Results.BadRequest(new { error = "Unit not found" });

            var start = req.StartLocal ?? e.StartLocal;
            var end = req.EndLocal ?? e.EndLocal;
            if (end <= start) return Results.BadRequest(new { error = "EndLocal must be after StartLocal" });

            if (req.RequiredCount.HasValue && req.RequiredCount.Value < 1)
                return Results.BadRequest(new { error = "RequiredCount must be >= 1" });

            e.FacilityId = facilityId;
            e.UnitId = unitId;
            if (!string.IsNullOrWhiteSpace(req.Name)) e.Name = req.Name!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Type)) e.Type = req.Type!.Trim();
            e.StartLocal = start;
            e.EndLocal = end;
            e.RequiredCount = req.RequiredCount ?? e.RequiredCount;
            e.QualificationsCsv = req.QualificationsCsv ?? e.QualificationsCsv;

            await db.SaveChangesAsync();
            return Results.Ok(new
            {
                e.Id,
                e.FacilityId,
                e.UnitId,
                e.Name,
                e.Type,
                e.StartLocal,
                e.EndLocal,
                e.RequiredCount,
                e.QualificationsCsv
            });
        });

        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.ShiftTemplates.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            db.ShiftTemplates.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
