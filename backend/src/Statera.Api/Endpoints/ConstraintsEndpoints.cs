// backend/src/Statera.Api/Endpoints/ConstraintsEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;

// If your domain type is named differently, adjust this alias:
using DomainConstraint = Statera.Domain.Constraint;

namespace Statera.Api.Endpoints;

public static class ConstraintsEndpoints
{
    public static RouteGroupBuilder MapConstraintsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/constraints").WithTags("Constraints");

        // GET /api/v1/constraints?facilityId=&unitId=
        g.MapGet("/", async (Guid? facilityId, Guid? unitId, [FromServices] AppDbContext db) =>
        {
            var q = db.Set<DomainConstraint>().AsNoTracking().AsQueryable();
            if (facilityId.HasValue) q = q.Where(c => c.FacilityId == facilityId.Value);
            if (unitId.HasValue) q = q.Where(c => c.UnitId == unitId.Value);

            var rows = await q.OrderBy(c => c.Code).ToListAsync();
            return Results.Ok(rows.Select(c => new
            {
                c.Id,
                c.FacilityId,
                c.UnitId,
                c.Code,
                c.Value
            }));
        });

        // GET /api/v1/constraints/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var c = await db.Set<DomainConstraint>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return c is null ? Results.NotFound() : Results.Ok(new { c.Id, c.FacilityId, c.UnitId, c.Code, c.Value });
        });

        // POST /api/v1/constraints
        g.MapPost("/", async ([FromBody] CreateConstraintRequest req, [FromServices] AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Code))
                return Results.BadRequest(new { error = "Code is required" });
            if (string.IsNullOrWhiteSpace(req.Value))
                return Results.BadRequest(new { error = "Value is required" });

            var e = new DomainConstraint
            {
                Id = Guid.NewGuid(),
                FacilityId = req.FacilityId,
                UnitId = req.UnitId,
                Code = req.Code.Trim(),
                Value = req.Value.Trim()
            };

            db.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/constraints/{e.Id}", new { e.Id, e.FacilityId, e.UnitId, e.Code, e.Value });
        });

        // PUT /api/v1/constraints/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateConstraintRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Set<DomainConstraint>().FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(req.Code)) e.Code = req.Code!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Value)) e.Value = req.Value!.Trim();
            e.FacilityId = req.FacilityId ?? e.FacilityId;
            e.UnitId = req.UnitId ?? e.UnitId;

            await db.SaveChangesAsync();
            return Results.Ok(new { e.Id, e.FacilityId, e.UnitId, e.Code, e.Value });
        });

        // DELETE /api/v1/constraints/{id}
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Set<DomainConstraint>().FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            db.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
