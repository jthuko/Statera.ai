using System;
using System.Linq;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Domain;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class TimeClockEndpoints
{
    public static RouteGroupBuilder MapTimeClockEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/timeclock").WithTags("TimeClock").RequireAuthorization();

        // POST /api/v1/timeclock/clockin
        g.MapPost("/clockin", async (
            [FromBody] ClockInRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var staffId = GetStaffId(ctx, req.StaffId);
            if (staffId == Guid.Empty) return Results.BadRequest(new { error = "StaffId required." });

            var staff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.Id == staffId);
            if (staff is null) return Results.NotFound(new { error = "Staff not found." });

            var open = await db.TimeClockEntries
                .FirstOrDefaultAsync(e => e.StaffId == staffId && e.ClockOutUtc == null);
            if (open is not null)
                return Results.Conflict(new { error = "Already clocked in.", entryId = open.Id });

            var entry = new TimeClockEntry
            {
                Id          = Guid.NewGuid(),
                StaffId     = staffId,
                FacilityId  = staff.FacilityId,
                UnitId      = req.UnitId ?? staff.UnitId,
                ClockInUtc  = DateTime.UtcNow,
                IsManual    = false,
                Status      = "ClockedIn",
                Notes       = req.Notes,
            };
            db.TimeClockEntries.Add(entry);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/timeclock/{entry.Id}", MapDto(entry, null));
        });

        // POST /api/v1/timeclock/clockout
        g.MapPost("/clockout", async (
            [FromBody] ClockOutRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var staffId = GetStaffId(ctx, req.StaffId);
            if (staffId == Guid.Empty) return Results.BadRequest(new { error = "StaffId required." });

            var entry = await db.TimeClockEntries
                .FirstOrDefaultAsync(e => e.StaffId == staffId && e.ClockOutUtc == null);
            if (entry is null) return Results.NotFound(new { error = "No active clock-in found." });

            // Auto-close any open lunch break
            if (entry.LunchOutUtc.HasValue && !entry.LunchInUtc.HasValue)
                entry.LunchInUtc = DateTime.UtcNow;

            entry.ClockOutUtc = DateTime.UtcNow;
            entry.Status = "ClockedOut";
            if (!string.IsNullOrWhiteSpace(req.Notes)) entry.Notes = req.Notes;
            await db.SaveChangesAsync();
            return Results.Ok(MapDto(entry, null));
        });

        // POST /api/v1/timeclock/lunch-out  — start lunch break
        g.MapPost("/lunch-out", async (
            [FromBody] LunchRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var staffId = GetStaffId(ctx, req.StaffId);
            if (staffId == Guid.Empty) return Results.BadRequest(new { error = "StaffId required." });

            var entry = await db.TimeClockEntries
                .FirstOrDefaultAsync(e => e.StaffId == staffId && e.ClockOutUtc == null);
            if (entry is null) return Results.NotFound(new { error = "No active clock-in found." });
            if (entry.LunchOutUtc.HasValue && !entry.LunchInUtc.HasValue)
                return Results.Conflict(new { error = "Already on lunch break." });

            entry.LunchOutUtc = DateTime.UtcNow;
            entry.LunchInUtc  = null;
            entry.Status      = "OnLunch";
            await db.SaveChangesAsync();
            return Results.Ok(MapDto(entry, null));
        });

        // POST /api/v1/timeclock/lunch-return  — return from lunch
        g.MapPost("/lunch-return", async (
            [FromBody] LunchRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var staffId = GetStaffId(ctx, req.StaffId);
            if (staffId == Guid.Empty) return Results.BadRequest(new { error = "StaffId required." });

            var entry = await db.TimeClockEntries
                .FirstOrDefaultAsync(e => e.StaffId == staffId && e.ClockOutUtc == null);
            if (entry is null) return Results.NotFound(new { error = "No active clock-in found." });
            if (!entry.LunchOutUtc.HasValue || entry.LunchInUtc.HasValue)
                return Results.BadRequest(new { error = "Not currently on a lunch break." });

            entry.LunchInUtc = DateTime.UtcNow;
            entry.Status     = "ClockedIn";
            await db.SaveChangesAsync();
            return Results.Ok(MapDto(entry, null));
        });

        // GET /api/v1/timeclock/active?staffId=
        g.MapGet("/active", async (
            HttpContext ctx,
            [FromQuery] Guid? staffId,
            [FromServices] AppDbContext db) =>
        {
            var sid = GetStaffId(ctx, staffId);
            if (sid == Guid.Empty) return Results.BadRequest(new { error = "StaffId required." });

            var entry = await db.TimeClockEntries
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.StaffId == sid && e.ClockOutUtc == null);

            if (entry is null) return Results.Ok((object?)null);

            var staff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.Id == entry.StaffId);
            return Results.Ok(MapDto(entry, staff));
        });

        // GET /api/v1/timeclock?facilityId=&staffId=&from=&to=&status=&page=&pageSize=
        g.MapGet("/", async (
            [FromServices] AppDbContext db,
            [FromQuery] Guid? facilityId,
            [FromQuery] Guid? staffId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50) =>
        {
            var query =
                from e in db.TimeClockEntries.AsNoTracking()
                join s in db.Staff.AsNoTracking() on e.StaffId equals s.Id into sj
                from s in sj.DefaultIfEmpty()
                select new { e, s };

            if (facilityId.HasValue) query = query.Where(x => x.e.FacilityId == facilityId.Value);
            if (staffId.HasValue)    query = query.Where(x => x.e.StaffId == staffId.Value);
            if (from.HasValue)       query = query.Where(x => x.e.ClockInUtc >= DateTime.SpecifyKind(from.Value, DateTimeKind.Utc));
            if (to.HasValue)         query = query.Where(x => x.e.ClockInUtc <= DateTime.SpecifyKind(to.Value, DateTimeKind.Utc));
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.e.Status == status);

            var total = await query.CountAsync();
            var safe  = Math.Max(1, page);
            var size  = Math.Clamp(pageSize, 1, 200);

            var items = await query
                .OrderByDescending(x => x.e.ClockInUtc)
                .Skip((safe - 1) * size).Take(size)
                .ToListAsync();

            return Results.Ok(new
            {
                Total = total,
                Items = items.Select(x => MapDto(x.e, x.s))
            });
        });

        // GET /api/v1/timeclock/clocked-in-count?facilityId=
        g.MapGet("/clocked-in-count", async (
            [FromServices] AppDbContext db,
            [FromQuery] Guid facilityId) =>
        {
            var count = await db.TimeClockEntries
                .AsNoTracking()
                .Where(e => e.FacilityId == facilityId && e.ClockOutUtc == null)
                .Select(e => e.StaffId)
                .Distinct()
                .CountAsync();
            return Results.Ok(new { count });
        });

        // PUT /api/v1/timeclock/{id}  — admin manual entry or adjustment (includes lunch)
        g.MapPut("/{id:guid}", async (
            Guid id,
            [FromBody] AdjustClockRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var entry = await db.TimeClockEntries.FindAsync(id);
            if (entry is null) return Results.NotFound();

            entry.ClockInUtc  = DateTime.SpecifyKind(req.ClockInUtc, DateTimeKind.Utc);
            entry.ClockOutUtc = req.ClockOutUtc.HasValue
                ? DateTime.SpecifyKind(req.ClockOutUtc.Value, DateTimeKind.Utc) : null;
            entry.LunchOutUtc = req.LunchOutUtc.HasValue
                ? DateTime.SpecifyKind(req.LunchOutUtc.Value, DateTimeKind.Utc) : null;
            entry.LunchInUtc  = req.LunchInUtc.HasValue
                ? DateTime.SpecifyKind(req.LunchInUtc.Value, DateTimeKind.Utc) : null;
            entry.IsManual    = true;
            entry.Status      = req.ClockOutUtc.HasValue ? "Adjusted" : entry.Status;
            if (!string.IsNullOrWhiteSpace(req.AdminNotes)) entry.AdminNotes = req.AdminNotes;
            entry.ReviewedByUserId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            entry.ReviewedUtc      = DateTime.UtcNow;
            // Clear any pending correction since admin has manually set values
            entry.CorrectionNotes      = null;
            entry.CorrectedClockInUtc  = null;
            entry.CorrectedClockOutUtc = null;
            entry.CorrectedLunchOutUtc = null;
            entry.CorrectedLunchInUtc  = null;
            await db.SaveChangesAsync();
            return Results.Ok(MapDto(entry, null));
        });

        // POST /api/v1/timeclock/{id}/correction  — staff submits a time correction
        g.MapPost("/{id:guid}/correction", async (
            Guid id,
            [FromBody] CorrectionRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var entry = await db.TimeClockEntries.FindAsync(id);
            if (entry is null) return Results.NotFound();

            entry.CorrectionNotes      = req.Notes;
            entry.CorrectedClockInUtc  = req.ClockInUtc.HasValue
                ? DateTime.SpecifyKind(req.ClockInUtc.Value, DateTimeKind.Utc) : null;
            entry.CorrectedClockOutUtc = req.ClockOutUtc.HasValue
                ? DateTime.SpecifyKind(req.ClockOutUtc.Value, DateTimeKind.Utc) : null;
            entry.CorrectedLunchOutUtc = req.LunchOutUtc.HasValue
                ? DateTime.SpecifyKind(req.LunchOutUtc.Value, DateTimeKind.Utc) : null;
            entry.CorrectedLunchInUtc  = req.LunchInUtc.HasValue
                ? DateTime.SpecifyKind(req.LunchInUtc.Value, DateTimeKind.Utc) : null;
            entry.Status = "PendingCorrection";
            await db.SaveChangesAsync();
            return Results.Ok(MapDto(entry, null));
        });

        // PATCH /api/v1/timeclock/{id}/review  — approve or deny (applies correction if approved)
        g.MapPatch("/{id:guid}/review", async (
            Guid id,
            [FromBody] ReviewClockRequest req,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var entry = await db.TimeClockEntries.FindAsync(id);
            if (entry is null) return Results.NotFound();

            var allowed = new[] { "Approved", "Denied" };
            if (!allowed.Contains(req.Status))
                return Results.BadRequest(new { error = "Status must be Approved or Denied." });

            // When approving a correction, apply the corrected values
            if (req.Status == "Approved" && entry.CorrectedClockInUtc.HasValue)
            {
                entry.ClockInUtc  = entry.CorrectedClockInUtc.Value;
                entry.ClockOutUtc = entry.CorrectedClockOutUtc ?? entry.ClockOutUtc;
                entry.LunchOutUtc = entry.CorrectedLunchOutUtc ?? entry.LunchOutUtc;
                entry.LunchInUtc  = entry.CorrectedLunchInUtc  ?? entry.LunchInUtc;
                entry.IsManual    = true;
            }

            entry.Status           = req.Status;
            entry.AdminNotes       = req.AdminNotes;
            entry.ReviewedByUserId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            entry.ReviewedUtc      = DateTime.UtcNow;
            // Clear correction fields after review
            entry.CorrectionNotes      = null;
            entry.CorrectedClockInUtc  = null;
            entry.CorrectedClockOutUtc = null;
            entry.CorrectedLunchOutUtc = null;
            entry.CorrectedLunchInUtc  = null;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }

    private static Guid GetStaffId(HttpContext ctx, Guid? provided)
    {
        if (provided.HasValue && provided.Value != Guid.Empty) return provided.Value;
        var claim = ctx.User.FindFirstValue("staff_id");
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    private static double NetWorkedMinutes(TimeClockEntry e)
    {
        if (!e.ClockOutUtc.HasValue) return 0;
        var total = (e.ClockOutUtc.Value - e.ClockInUtc).TotalMinutes;
        if (e.LunchOutUtc.HasValue && e.LunchInUtc.HasValue)
            total -= (e.LunchInUtc.Value - e.LunchOutUtc.Value).TotalMinutes;
        return Math.Max(0, total);
    }

    private static DateTime AsUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static DateTime? AsUtc(DateTime? value) =>
        value.HasValue ? AsUtc(value.Value) : null;

    private static object MapDto(TimeClockEntry e, Statera.Domain.Staff? s) => new
    {
        e.Id, e.StaffId,
        StaffName  = s != null ? $"{s.FirstName} {s.LastName}" : null,
        e.FacilityId, e.UnitId,
        ClockInUtc  = AsUtc(e.ClockInUtc),
        ClockOutUtc = AsUtc(e.ClockOutUtc),
        LunchOutUtc = AsUtc(e.LunchOutUtc),
        LunchInUtc  = AsUtc(e.LunchInUtc),
        DurationMinutes = e.ClockOutUtc.HasValue ? (int)NetWorkedMinutes(e) : (int?)null,
        LunchMinutes    = (e.LunchOutUtc.HasValue && e.LunchInUtc.HasValue)
                          ? (int)(e.LunchInUtc.Value - e.LunchOutUtc.Value).TotalMinutes : (int?)null,
        e.IsManual, e.Status, e.Notes, e.AdminNotes,
        e.ReviewedByUserId, ReviewedUtc = AsUtc(e.ReviewedUtc),
        e.CorrectionNotes,
        CorrectedClockInUtc  = AsUtc(e.CorrectedClockInUtc),
        CorrectedClockOutUtc = AsUtc(e.CorrectedClockOutUtc),
        CorrectedLunchOutUtc = AsUtc(e.CorrectedLunchOutUtc),
        CorrectedLunchInUtc  = AsUtc(e.CorrectedLunchInUtc),
    };

    private record ClockInRequest(Guid? StaffId, Guid? UnitId, string? Notes);
    private record ClockOutRequest(Guid? StaffId, string? Notes);
    private record LunchRequest(Guid? StaffId);
    private record AdjustClockRequest(DateTime ClockInUtc, DateTime? ClockOutUtc, DateTime? LunchOutUtc, DateTime? LunchInUtc, string? AdminNotes);
    private record CorrectionRequest(string? Notes, DateTime? ClockInUtc, DateTime? ClockOutUtc, DateTime? LunchOutUtc, DateTime? LunchInUtc);
    private record ReviewClockRequest(string Status, string? AdminNotes);
}
