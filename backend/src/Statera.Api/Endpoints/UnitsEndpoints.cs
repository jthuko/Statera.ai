using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;   // UnitDto, CreateUnitUnderFacilityRequest, UpdateUnitRequest
using Statera.Infrastructure;  // AppDbContext

namespace Statera.Api.Endpoints;

public static class UnitsEndpoints
{
    public static IEndpointRouteBuilder MapUnitsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/v1").WithTags("Units");
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
                        Name = u.Name
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

                var id = Guid.NewGuid();

                // Parameterized INSERT, no dependency on CLR entity type
                await db.Database.ExecuteSqlInterpolatedAsync($@"
                    INSERT INTO [Units] ([Id], [FacilityId], [Name])
                    VALUES ({id}, {facilityId}, {req.Name.Trim()});
                ", ct);

                // Read back just-created row via EF LINQ
                var dto = await db.Units
                    .AsNoTracking()
                    .Where(u => u.Id == id)
                    .Select(u => new UnitDto
                    {
                        Id = u.Id,
                        FacilityId = u.FacilityId,
                        Name = u.Name
                    })
                    .SingleAsync(ct);

                return TypedResults.Created($"/api/v1/units/{id}", dto);
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

        return app;
    }
}
