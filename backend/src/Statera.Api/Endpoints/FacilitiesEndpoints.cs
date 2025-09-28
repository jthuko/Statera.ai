using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;            // AppDbContext
using Statera.Api.Contracts;            // DTOs
using DomFacility = Statera.Domain.Facility;

namespace Statera.Api.Endpoints;

public static class FacilitiesEndpoints
{
    public static RouteGroupBuilder MapFacilitiesEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/facilities").WithTags("Facilities");

        // GET /api/v1/facilities
        g.MapGet("/", async ([FromServices] AppDbContext db) =>
        {
            var rows = await db.Facilities
                .AsNoTracking()
                .OrderBy(f => f.Name)
                .Select(f => new FacilityItemResponse(f.Id, f.Name, f.Address, f.City, f.State, f.Zip))
                .ToListAsync();

            return Results.Ok(rows);
        });

        // GET /api/v1/facilities/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Facilities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return e is null
                ? Results.NotFound()
                : Results.Ok(new FacilityItemResponse(e.Id, e.Name, e.Address, e.City, e.State, e.Zip));
        });

        // POST /api/v1/facilities
        g.MapPost("/", async ([FromBody] CreateFacilityRequest req, [FromServices] AppDbContext db) =>
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
            await db.SaveChangesAsync();

            return Results.Created(
                $"/api/v1/facilities/{e.Id}",
                new FacilityItemResponse(e.Id, e.Name, e.Address, e.City, e.State, e.Zip)
            );
        });

        // PUT /api/v1/facilities/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateFacilityRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Facilities.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            if (req.Name is not null) e.Name = req.Name.Trim();
            if (req.Address is not null) e.Address = req.Address.Trim();
            if (req.City is not null) e.City = req.City.Trim();
            if (req.State is not null) e.State = req.State.Trim();
            if (req.Zip is not null) e.Zip = req.Zip.Trim();

            await db.SaveChangesAsync();

            return Results.Ok(new FacilityItemResponse(e.Id, e.Name, e.Address, e.City, e.State, e.Zip));
        });

        // DELETE /api/v1/facilities/{id}
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Facilities.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            db.Facilities.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
