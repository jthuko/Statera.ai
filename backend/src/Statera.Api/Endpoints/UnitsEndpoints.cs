// backend/src/Statera.Api/Endpoints/UnitsEndpoints.cs
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

namespace Statera.Api.Endpoints;

public static class UnitsEndpoints
{
    public static RouteGroupBuilder MapUnitsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/units").WithTags("Units");

        g.MapGet("/", async (Guid? facilityId, [FromServices] AppDbContext db) =>
        {
            var q = db.Set<DomainUnit>().AsNoTracking().AsQueryable();
            if (facilityId.HasValue) q = q.Where(u => u.FacilityId == facilityId.Value);

            var rows = await q.ToListAsync();
            return Results.Ok(rows.Select(u => new { u.Id, u.FacilityId, u.Name }));
        });

        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Set<DomainUnit>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return e is null ? Results.NotFound() : Results.Ok(new { e.Id, e.FacilityId, e.Name });
        });

        g.MapPost("/", async ([FromBody] CreateUnitRequest req, [FromServices] AppDbContext db) =>
        {
            if (!await db.Set<DomainFacility>().AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            var e = new DomainUnit { Id = Guid.NewGuid(), FacilityId = req.FacilityId, Name = req.Name.Trim() };
            db.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/units/{e.Id}", new { e.Id, e.FacilityId, e.Name });
        });

        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateUnitRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Set<DomainUnit>().FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            var facilityId = req.FacilityId ?? e.FacilityId;
            if (!await db.Set<DomainFacility>().AnyAsync(f => f.Id == facilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            e.FacilityId = facilityId;
            if (!string.IsNullOrWhiteSpace(req.Name)) e.Name = req.Name!.Trim();

            await db.SaveChangesAsync();
            return Results.Ok(new { e.Id, e.FacilityId, e.Name });
        });

        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Set<DomainUnit>().FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();
            db.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
