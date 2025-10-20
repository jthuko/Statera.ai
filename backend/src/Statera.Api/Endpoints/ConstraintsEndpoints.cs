// backend/src/Statera.Api/Endpoints/ConstraintsEndpoints.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Domain.Staffing;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class ConstraintsEndpoints
{
    public static RouteGroupBuilder MapConstraintsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/facilities/{facilityId:guid}/constraints")
                  .WithTags("Constraints");

        // GET /api/v1/facilities/{facilityId}/constraints
        g.MapGet("/", async ([FromRoute] Guid facilityId, [FromServices] AppDbContext db) =>
        {
            var list = await db.RuleConstraints
                .AsNoTracking()
                .Where(x => x.FacilityId == facilityId)
                .OrderByDescending(x => x.UpdatedOn ?? x.CreatedOn)
                .Select(x => new ConstraintDto(
                    x.Id, x.FacilityId, x.Scope, x.UnitId, x.Role, x.Type,
                    x.Value, x.IsActive, x.Notes, x.CreatedOn, x.UpdatedOn))
                .ToListAsync();

            return Results.Ok(list);
        })
        .Produces<List<ConstraintDto>>(StatusCodes.Status200OK);

        // POST /api/v1/facilities/{facilityId}/constraints
        g.MapPost("/", async (
            [FromRoute] Guid facilityId,
            [FromBody] CreateConstraintRequest req,
            [FromServices] AppDbContext db) =>
        {
            // Basic validation based on scope
            if (req.Scope == RuleScope.Unit && (req.UnitId is null || req.UnitId == Guid.Empty))
                return Results.BadRequest(new { error = "UnitId is required for Unit scope" });
            if (req.Scope == RuleScope.Role && string.IsNullOrWhiteSpace(req.Role))
                return Results.BadRequest(new { error = "Role is required for Role scope" });

            var entity = new RuleConstraint
            {
                FacilityId = facilityId,                 // from route
                Scope = req.Scope,
                UnitId = req.Scope == RuleScope.Unit ? req.UnitId : null,
                Role = req.Scope == RuleScope.Role ? req.Role?.Trim() : null,
                Type = req.Type,
                Value = req.Value?.Trim() ?? "",
                IsActive = req.IsActive,
                Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes!.Trim(),
                CreatedOn = DateTime.UtcNow
            };

            db.RuleConstraints.Add(entity);
            await db.SaveChangesAsync();

            var dto = new ConstraintDto(
                entity.Id, entity.FacilityId, entity.Scope, entity.UnitId, entity.Role,
                entity.Type, entity.Value, entity.IsActive, entity.Notes, entity.CreatedOn, entity.UpdatedOn);

            return Results.Created($"/api/v1/facilities/{facilityId}/constraints/{entity.Id}", dto);
        })
        .Produces<ConstraintDto>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest);

        // PUT /api/v1/facilities/{facilityId}/constraints/{id}
        g.MapPut("/{id:guid}", async (
            [FromRoute] Guid facilityId,
            [FromRoute] Guid id,
            [FromBody] UpdateConstraintRequest req,
            [FromServices] AppDbContext db) =>
        {
            var entity = await db.RuleConstraints
                .Where(x => x.Id == id && x.FacilityId == facilityId)
                .FirstOrDefaultAsync();

            if (entity is null) return Results.NotFound();

            if (req.Scope == RuleScope.Unit && (req.UnitId is null || req.UnitId == Guid.Empty))
                return Results.BadRequest(new { error = "UnitId is required for Unit scope" });
            if (req.Scope == RuleScope.Role && string.IsNullOrWhiteSpace(req.Role))
                return Results.BadRequest(new { error = "Role is required for Role scope" });

            entity.Scope = req.Scope;
            entity.UnitId = req.Scope == RuleScope.Unit ? req.UnitId : null;
            entity.Role = req.Scope == RuleScope.Role ? req.Role?.Trim() : null;
            entity.Type = req.Type;
            entity.Value = req.Value?.Trim() ?? "";
            entity.IsActive = req.IsActive;
            entity.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes!.Trim();
            entity.UpdatedOn = DateTime.UtcNow;

            await db.SaveChangesAsync();

            var dto = new ConstraintDto(
                entity.Id, entity.FacilityId, entity.Scope, entity.UnitId, entity.Role,
                entity.Type, entity.Value, entity.IsActive, entity.Notes, entity.CreatedOn, entity.UpdatedOn);

            return Results.Ok(dto);
        })
        .Produces<ConstraintDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status400BadRequest);

        // DELETE /api/v1/facilities/{facilityId}/constraints/{id}
        g.MapDelete("/{id:guid}", async (
            [FromRoute] Guid facilityId,
            [FromRoute] Guid id,
            [FromServices] AppDbContext db) =>
        {
            var entity = await db.RuleConstraints
                .Where(x => x.Id == id && x.FacilityId == facilityId)
                .FirstOrDefaultAsync();

            if (entity is null) return Results.NotFound();

            db.RuleConstraints.Remove(entity);
            await db.SaveChangesAsync();
            return Results.NoContent();
        })
        .Produces(StatusCodes.Status204NoContent)
        .Produces(StatusCodes.Status404NotFound);

        return g;
    }
}
