// backend/src/Statera.Api/Endpoints/RequestsEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;

using DomainTimeOff = Statera.Domain.TimeOffRequest;
using DomainStaff = Statera.Domain.Staff;

namespace Statera.Api.Endpoints;

public static class RequestsEndpoints
{
    public static RouteGroupBuilder MapRequestsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/requests").WithTags("TimeOff");

        // GET /api/v1/requests?staffId=&status=
        g.MapGet("/", async (Guid? staffId, string? status, [FromServices] AppDbContext db) =>
        {
            var q = db.TimeOffRequests.AsNoTracking().AsQueryable();
            if (staffId.HasValue) q = q.Where(r => r.StaffId == staffId.Value);
            if (!string.IsNullOrWhiteSpace(status))
            {
                var s = status.Trim().ToLowerInvariant();
                q = q.Where(r => r.Status.ToLower() == s);
            }

            var rows = await q.OrderByDescending(r => r.StartUtc).ToListAsync();
            return Results.Ok(rows.Select(r => new
            {
                r.Id,
                r.StaffId,
                r.Type,
                r.Status,
                r.StartUtc,
                r.EndUtc,
                r.Reason
            }));
        });

        // GET /api/v1/requests/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var r = await db.TimeOffRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return r is null ? Results.NotFound() : Results.Ok(new
            {
                r.Id,
                r.StaffId,
                r.Type,
                r.Status,
                r.StartUtc,
                r.EndUtc,
                r.Reason
            });
        });

        // POST /api/v1/requests
        g.MapPost("/", async ([FromBody] CreateTimeOffRequest req, [FromServices] AppDbContext db) =>
        {
            if (!await db.Set<DomainStaff>().AnyAsync(s => s.Id == req.StaffId))
                return Results.BadRequest(new { error = "Staff not found" });
            if (req.EndUtc <= req.StartUtc)
                return Results.BadRequest(new { error = "EndUtc must be after StartUtc" });
            if (string.IsNullOrWhiteSpace(req.Type))
                return Results.BadRequest(new { error = "Type is required" });

            var e = new DomainTimeOff
            {
                Id = Guid.NewGuid(),
                StaffId = req.StaffId,
                Type = req.Type.Trim(),
                Status = "Pending",
                StartUtc = DateTime.SpecifyKind(req.StartUtc, DateTimeKind.Utc),
                EndUtc = DateTime.SpecifyKind(req.EndUtc, DateTimeKind.Utc),
                Reason = string.IsNullOrWhiteSpace(req.Reason) ? null : req.Reason!.Trim()
            };

            db.TimeOffRequests.Add(e);
            await db.SaveChangesAsync();

            return Results.Created($"/api/v1/requests/{e.Id}", new
            {
                e.Id,
                e.StaffId,
                e.Type,
                e.Status,
                e.StartUtc,
                e.EndUtc,
                e.Reason
            });
        });

        // PUT /api/v1/requests/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateTimeOffRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.TimeOffRequests.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            var staffId = req.StaffId ?? e.StaffId;
            if (!await db.Set<DomainStaff>().AnyAsync(s => s.Id == staffId))
                return Results.BadRequest(new { error = "Staff not found" });

            var start = req.StartUtc ?? e.StartUtc;
            var end = req.EndUtc ?? e.EndUtc;
            if (end <= start) return Results.BadRequest(new { error = "EndUtc must be after StartUtc" });

            e.StaffId = staffId;
            if (!string.IsNullOrWhiteSpace(req.Type)) e.Type = req.Type!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Status)) e.Status = req.Status!.Trim();
            e.StartUtc = DateTime.SpecifyKind(start, DateTimeKind.Utc);
            e.EndUtc = DateTime.SpecifyKind(end, DateTimeKind.Utc);
            e.Reason = req.Reason ?? e.Reason;

            await db.SaveChangesAsync();
            return Results.Ok(new { e.Id, e.StaffId, e.Type, e.Status, e.StartUtc, e.EndUtc, e.Reason });
        });

        // DELETE /api/v1/requests/{id}
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.TimeOffRequests.FirstOrDefaultAsync(x => x.Id == id);
            if (e is null) return Results.NotFound();

            db.TimeOffRequests.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }
}
