using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Domain;
using Statera.Infrastructure; // AppDbContext

namespace Statera.Api.Endpoints;

public static class TimeOffEndpoints
{
    public static RouteGroupBuilder MapTimeOffEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/timeoff").WithTags("TimeOff");

        // GET /api/v1/timeoff?facilityId=&unitId=&staffId=&status=&from=&to=&q=&page=1&pageSize=25
        g.MapGet("/", async (
            [FromServices] AppDbContext db,
            [FromQuery] Guid? facilityId = null,
            [FromQuery] Guid? unitId = null,
            [FromQuery] Guid? staffId = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? q = null,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null) =>
        {
            var pageVal = (page ?? 1);
            var pageSizeVal = (pageSize ?? 25);
            var pageSafe = pageVal <= 0 ? 1 : pageVal;
            var pageSizeSafe = pageSizeVal <= 0 || pageSizeVal > 200 ? 25 : pageSizeVal;

            // Left-join Staff so filters & projection are safe even if Staff is missing
            var query =
                from t in db.TimeOffRequests.AsNoTracking()
                join s in db.Staff.AsNoTracking() on t.StaffId equals s.Id into sj
                from s in sj.DefaultIfEmpty()
                select new { t, s };

            if (facilityId.HasValue)
                query = query.Where(x => x.s != null && x.s.FacilityId == facilityId.Value);

            if (unitId.HasValue)
                query = query.Where(x => x.s != null && x.s.UnitId == unitId.Value);

            if (staffId.HasValue)
                query = query.Where(x => x.t.StaffId == staffId.Value);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(x => x.t.Status == status);

            if (from.HasValue)
                query = query.Where(x => x.t.EndUtc >= DateTime.SpecifyKind(from.Value, DateTimeKind.Utc));

            if (to.HasValue)
                query = query.Where(x => x.t.StartUtc <= DateTime.SpecifyKind(to.Value, DateTimeKind.Utc));

            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(x => (x.t.Reason ?? "").Contains(q));

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(x => x.t.StartUtc)
                .Skip((pageSafe - 1) * pageSizeSafe)
                .Take(pageSizeSafe)
                .Select(x => new TimeOffRequestDto(
                    x.t.Id,
                    x.t.StaffId,
                    x.s != null ? (x.s.FirstName + " " + x.s.LastName) : string.Empty,
                    x.s != null ? x.s.UnitId : null,
                    x.s != null ? x.s.FacilityId : Guid.Empty,
                    x.t.Type,
                    x.t.Status,
                    x.t.StartUtc,
                    x.t.EndUtc,
                    x.t.Reason
                ))
                .ToListAsync();

            return Results.Ok(new TimeOffRequestPageResponse(total, items));
        });

        // POST /api/v1/timeoff
        g.MapPost("/", async ([FromBody] CreateTimeOffRequestRequest req, [FromServices] AppDbContext db) =>
        {
            if (req.EndUtc <= req.StartUtc)
                return Results.BadRequest("EndUtc must be after StartUtc");

            var staffExists = await db.Staff.AsNoTracking().AnyAsync(s => s.Id == req.StaffId);
            if (!staffExists) return Results.BadRequest("Staff not found");

            var entity = new TimeOffRequest
            {
                StaffId = req.StaffId,
                Type = string.IsNullOrWhiteSpace(req.Type) ? "Vacation" : req.Type,
                Status = "Pending",
                StartUtc = DateTime.SpecifyKind(req.StartUtc, DateTimeKind.Utc),
                EndUtc = DateTime.SpecifyKind(req.EndUtc, DateTimeKind.Utc),
                Reason = req.Reason
            };

            db.TimeOffRequests.Add(entity);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/timeoff/{entity.Id}", new { entity.Id });
        });

        // PUT /api/v1/timeoff/{id}
        g.MapPut("/{id}", async (Guid id, [FromBody] UpdateTimeOffRequestRequest req, [FromServices] AppDbContext db) =>
        {
            var entity = await db.TimeOffRequests.FindAsync(id);
            if (entity is null) return Results.NotFound();

            if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest("Only pending requests can be edited.");

            if (req.EndUtc <= req.StartUtc)
                return Results.BadRequest("EndUtc must be after StartUtc");

            entity.Type = req.Type;
            entity.StartUtc = DateTime.SpecifyKind(req.StartUtc, DateTimeKind.Utc);
            entity.EndUtc = DateTime.SpecifyKind(req.EndUtc, DateTimeKind.Utc);
            entity.Reason = req.Reason;

            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // PATCH /api/v1/timeoff/{id}/status
        g.MapPatch("/{id}/status", async (Guid id, [FromBody] ChangeTimeOffStatusRequest req, [FromServices] AppDbContext db) =>
        {
            var entity = await db.TimeOffRequests.FindAsync(id);
            if (entity is null) return Results.NotFound();

            if (string.Equals(req.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest("Cannot revert to Pending.");

            var allowed = new[] { "Approved", "Denied", "Cancelled" };
            if (!allowed.Contains(req.Status))
                return Results.BadRequest("Invalid status");

            entity.Status = req.Status;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // DELETE /api/v1/timeoff/{id}
        g.MapDelete("/{id}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var entity = await db.TimeOffRequests.FindAsync(id);
            if (entity is null) return Results.NotFound();

            if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest("Only pending requests can be deleted.");

            db.TimeOffRequests.Remove(entity);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return g;
    }

    // --- Local DTOs (keep here to avoid missing dependency issues) ---
    private record TimeOffRequestDto(
        Guid Id,
        Guid StaffId,
        string StaffName,
        Guid? StaffUnitId,
        Guid StaffFacilityId,
        string Type,
        string Status,
        DateTime StartUtc,
        DateTime EndUtc,
        string? Reason
    );

    private record TimeOffRequestPageResponse(int Total, IReadOnlyList<TimeOffRequestDto> Items);

    private record CreateTimeOffRequestRequest
    {
        public Guid StaffId { get; init; }
        public string Type { get; init; } = "Vacation";
        public DateTime StartUtc { get; init; }
        public DateTime EndUtc { get; init; }
        public string? Reason { get; init; }
    }

    private record UpdateTimeOffRequestRequest
    {
        public string Type { get; init; } = "Vacation";
        public DateTime StartUtc { get; init; }
        public DateTime EndUtc { get; init; }
        public string? Reason { get; init; }
    }

    private record ChangeTimeOffStatusRequest
    {
        public string Status { get; init; } = "Approved"; // Approved | Denied | Cancelled
        public string? ReviewedBy { get; init; }
    }
}
