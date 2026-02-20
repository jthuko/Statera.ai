using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;   // UnitDto, CreateUnitUnderFacilityRequest, UpdateUnitRequest
using Statera.Infrastructure;  // AppDbContext

namespace Statera.Api.Endpoints;

public static class UnitsEndpoints
{
    public static RouteGroupBuilder MapUnitsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.WithTags("Units");
        // .RequireAuthorization();

        // ---------- LIST (by facility) ----------
        g.MapGet("/facilities/{facilityId:guid}/units",
            async Task<Ok<List<UnitDto>>> (Guid facilityId, AppDbContext db, CancellationToken ct) =>
            {

                var items = await db.Units
                    .AsNoTracking()
                    .Where(u => u.FacilityId == facilityId)
                    .OrderBy(u => u.Name)
                    .Select(u => new UnitDto
                    {
                        Id = u.Id,
                        FacilityId = u.FacilityId,
                        Name = u.Name,
                        Type = u.Type,
                        Floor = u.Floor,
                        Capacity = u.Capacity,
                        Notes = u.Notes,
                        IsActive = u.IsActive
                    })
                    .ToListAsync(ct);

                return TypedResults.Ok(items);
            });

        // ---------- CREATE (under facility) ----------
        // Uses your CreateUnitUnderFacilityRequest(Name)
        g.MapPost("/facilities/{facilityId:guid}/units",
            async Task<Results<Created<UnitDto>, BadRequest<string>>> (
                Guid facilityId, CreateUnitUnderFacilityRequest req, AppDbContext db, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(req.Name))
                    return TypedResults.BadRequest("Name is required.");

                // Ensure facility exists so we can return a friendly message instead of FK errors
                var facilityExists = await db.Facilities.AsNoTracking().AnyAsync(f => f.Id == facilityId, ct);
                if (!facilityExists)
                    return TypedResults.BadRequest("Facility not found.");

                var id = Guid.NewGuid();

                // Create using EF to ensure proper typing / relationships
                var unit = new Statera.Domain.Unit
                {
                    Id = id,
                    FacilityId = facilityId,
                    Name = req.Name.Trim(),
                    Type = req.Type,
                    Floor = req.Floor,
                    Capacity = req.Capacity,
                    Notes = req.Notes,
                    IsActive = req.IsActive ?? true
                };

                db.Units.Add(unit);
                await db.SaveChangesAsync(ct);

                var dto = new UnitDto { Id = unit.Id, FacilityId = unit.FacilityId, Name = unit.Name, Type = unit.Type, Floor = unit.Floor, Capacity = unit.Capacity, Notes = unit.Notes, IsActive = unit.IsActive };
                return TypedResults.Created($"/facilities/{facilityId}/units/{id}", dto);
            });

        // ---------- READ (by unit id) ----------
        g.MapGet("/units/{id:guid}",
            async Task<Results<Ok<UnitDto>, NotFound>> (Guid id, AppDbContext db, CancellationToken ct) =>
            {
                var dto = await db.Units
                    .AsNoTracking()
                    .Where(u => u.Id == id)
                    .Select(u => new UnitDto
                    {
                        Id = u.Id,
                        FacilityId = u.FacilityId,
                        Name = u.Name
                    })
                    .SingleOrDefaultAsync(ct);

                return dto is null ? TypedResults.NotFound() : TypedResults.Ok(dto);
            });

        // ---------- UPDATE (by unit id) ----------
        // Uses your UpdateUnitRequest(Guid? FacilityId, string? Name)
        g.MapPut("/units/{id:guid}",
            async Task<Results<Ok<UnitDto>, NotFound, BadRequest<string>>> (
                Guid id, UpdateUnitRequest req, AppDbContext db, CancellationToken ct) =>
            {
                // Build a minimal dynamic UPDATE based on provided fields
                if (!req.FacilityId.HasValue && req.Name is null)
                {
                    // nothing to change; return current
                    var current = await db.Units
                        .AsNoTracking()
                        .Where(u => u.Id == id)
                        .Select(u => new UnitDto { Id = u.Id, FacilityId = u.FacilityId, Name = u.Name })
                        .SingleOrDefaultAsync(ct);
                    return current is null ? TypedResults.NotFound() : TypedResults.Ok(current);
                }

                if (req.Name is not null && string.IsNullOrWhiteSpace(req.Name))
                    return TypedResults.BadRequest("Name is required.");

                // Apply updates with SQL so we don't need the CLR entity type here
                if (req.FacilityId.HasValue && req.Name is not null)
                {
                    await db.Database.ExecuteSqlInterpolatedAsync($@"
                        UPDATE [Units]
                           SET [FacilityId] = {req.FacilityId.Value},
                               [Name]       = {req.Name.Trim()}
                         WHERE [Id]         = {id};
                    ", ct);
                }
                else if (req.FacilityId.HasValue)
                {
                    await db.Database.ExecuteSqlInterpolatedAsync($@"
                        UPDATE [Units]
                           SET [FacilityId] = {req.FacilityId.Value}
                         WHERE [Id]         = {id};
                    ", ct);
                }
                else if (req.Name is not null)
                {
                    await db.Database.ExecuteSqlInterpolatedAsync($@"
                        UPDATE [Units]
                           SET [Name] = {req.Name.Trim()}
                         WHERE [Id]   = {id};
                    ", ct);
                }

                // Return the updated row
                var dto = await db.Units
                    .AsNoTracking()
                    .Where(u => u.Id == id)
                    .Select(u => new UnitDto
                    {
                        Id = u.Id,
                        FacilityId = u.FacilityId,
                        Name = u.Name
                    })
                    .SingleOrDefaultAsync(ct);

                return dto is null ? TypedResults.NotFound() : TypedResults.Ok(dto);
            });

        // ---------- DELETE (hard delete) ----------
        g.MapDelete("/units/{id:guid}",
            async Task<Results<NoContent, NotFound>> (Guid id, AppDbContext db, CancellationToken ct) =>
            {
                var affected = await db.Database.ExecuteSqlInterpolatedAsync($@"
                    DELETE FROM [Units] WHERE [Id] = {id};
                ", ct);

                if (affected == 0) return TypedResults.NotFound();
                return TypedResults.NoContent();
            });

        return v1;
    }
}
