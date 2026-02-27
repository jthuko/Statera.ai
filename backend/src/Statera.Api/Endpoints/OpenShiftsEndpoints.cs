// src/Statera.Api/Endpoints/OpenShiftsEndpoints.cs
// Open Shifts / Shift Marketplace
// Admin posts open shifts; staff browse, request, and withdraw; admin approves/denies.
// On approval an Assignment is created and all other pending requests are denied.

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Statera.Domain;
using Statera.Domain.Staffing;
using Statera.Infrastructure;
using Statera.Application;
using System.Security.Claims;

namespace Statera.Api.Endpoints;

public static class OpenShiftsEndpoints
{
    public static RouteGroupBuilder MapOpenShiftEndpoints(this RouteGroupBuilder v1)
    {
        // ── Facility-scoped list (used by both admin and staff portal) ─────────
        // GET /api/v1/facilities/{facilityId}/open-shifts
        var fac = v1.MapGroup("/facilities/{facilityId:guid}").RequireAuthorization();

        fac.MapGet("/open-shifts", async (
            Guid facilityId,
            HttpContext ctx,
            [FromServices] AppDbContext db,
            [FromQuery] string? start,
            [FromQuery] string? end,
            [FromQuery] string? status,
            [FromQuery] string? role,
            [FromQuery] Guid? unitId) =>
        {
            var sysRole   = ctx.User.FindFirstValue("system_role") ?? "FacilityAdmin";
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            var isStaff   = sysRole == "Staff" && Guid.TryParse(staffIdStr, out _);
            var staffGuid = isStaff && Guid.TryParse(staffIdStr, out var sg) ? sg : (Guid?)null;

            var query = db.OpenShifts
                .AsNoTracking()
                .Where(s => s.FacilityId == facilityId);

            if (!string.IsNullOrWhiteSpace(start) && DateTimeOffset.TryParse(start, out var startDto))
            {
                var sUtc = startDto.UtcDateTime;
                query = query.Where(s => s.EndUtc > sUtc);
            }
            if (!string.IsNullOrWhiteSpace(end) && DateTimeOffset.TryParse(end, out var endDto))
            {
                var eUtc = endDto.UtcDateTime;
                query = query.Where(s => s.StartUtc < eUtc);
            }

            if (isStaff)
            {
                // Staff: only open shifts matching role and availability; no overlapping assignments
                var staffMember = await db.Staff.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == staffGuid!.Value);
                if (staffMember is null) return Results.Unauthorized();

                var staffRole = staffMember.Role?.Trim().ToLower();
                query = query.Where(s => s.Status == "Open" && s.Role.ToLower() == staffRole);

                var avail = await db.StaffAvailabilities.AsNoTracking()
                    .Where(a => a.StaffId == staffGuid!.Value)
                    .ToListAsync();

                var allShifts = await query
                    .OrderBy(s => s.StartUtc)
                    .ToListAsync();

                if (allShifts.Count == 0) return Results.Ok(Array.Empty<object>());

                var minStart = allShifts.Min(s => s.StartUtc);
                var maxEnd   = allShifts.Max(s => s.EndUtc);
                var myAssignments = await db.Assignments.AsNoTracking()
                    .Where(a => a.StaffId == staffGuid!.Value &&
                                a.StartUtc < maxEnd &&
                                a.EndUtc > minStart)
                    .ToListAsync();

                // Load this staff member's requests
                var myRequests = await db.OpenShiftRequests.AsNoTracking()
                    .Where(r => r.StaffId == staffGuid!.Value &&
                                allShifts.Select(s => s.Id).Contains(r.OpenShiftId))
                    .ToListAsync();

                var facilityStates = await db.Facilities.AsNoTracking()
                    .Where(f => allShifts.Select(s => s.FacilityId).Contains(f.Id))
                    .Select(f => new { f.Id, f.State })
                    .ToListAsync();

                var stateMap = facilityStates.ToDictionary(x => x.Id, x => x.State);
                string? ResolveState(Guid fid) => stateMap.TryGetValue(fid, out var st) ? st : null;

                var filtered = allShifts
                    .Where(s =>
                    {
                        if (avail.Count > 0 && !ShiftFitsAvailability(avail, s.StartUtc, s.EndUtc, ResolveState(s.FacilityId)))
                            return false;
                        if (myAssignments.Any(a => a.StartUtc < s.EndUtc && a.EndUtc > s.StartUtc))
                            return false;
                        return true;
                    })
                    .Select(s =>
                    {
                        var myReq = myRequests.FirstOrDefault(r => r.OpenShiftId == s.Id);
                        return MapShiftDto(s, myReq?.Id, myReq?.Status, requestCount: null);
                    })
                    .ToList();

                return Results.Ok(filtered);
            }
            else
            {
                // Admin: all shifts with optional filters
                if (!string.IsNullOrWhiteSpace(status))
                    query = query.Where(s => s.Status == status);
                if (!string.IsNullOrWhiteSpace(role))
                    query = query.Where(s => s.Role == role);
                if (unitId.HasValue)
                    query = query.Where(s => s.UnitId == unitId);

                var shifts = await query
                    .Include(s => s.Requests)
                    .OrderByDescending(s => s.CreatedUtc)
                    .ToListAsync();

                var result = shifts.Select(s =>
                {
                    var pendingCount = s.Requests.Count(r => r.Status == "Pending");
                    return MapShiftDto(s, null, null, pendingCount);
                });

                return Results.Ok(result);
            }
        });

        // ── Open shift CRUD (admin) ────────────────────────────────────────────
        var g = v1.MapGroup("/open-shifts").RequireAuthorization();

        // POST /api/v1/open-shifts — admin creates open shift
        g.MapPost("/", async (
            HttpContext ctx,
            [FromBody] CreateOpenShiftRequest req,
            [FromServices] AppDbContext db) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (userId is null) return Results.Unauthorized();

            if (req.StartUtc >= req.EndUtc)
                return Results.BadRequest(new { error = "StartUtc must be before EndUtc." });

            if (!await db.Facilities.AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found." });

            if (string.IsNullOrWhiteSpace(req.Role))
                return Results.BadRequest(new { error = "Role is required." });

            var shift = new OpenShift
            {
                Id              = Guid.NewGuid(),
                FacilityId      = req.FacilityId,
                UnitId          = req.UnitId,
                Role            = req.Role.Trim(),
                StartUtc        = DateTime.SpecifyKind(req.StartUtc, DateTimeKind.Utc),
                EndUtc          = DateTime.SpecifyKind(req.EndUtc,   DateTimeKind.Utc),
                Notes           = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
                Status          = "Open",
                CreatedByUserId = userId,
                CreatedUtc      = DateTime.UtcNow,
            };

            db.OpenShifts.Add(shift);
            await db.SaveChangesAsync();

            return Results.Created($"/api/v1/open-shifts/{shift.Id}",
                MapShiftDto(shift, null, null, 0));
        });

        // PATCH /api/v1/open-shifts/{id} — update notes/times/status/role/unit
        g.MapPatch("/{id:guid}", async (
            Guid id,
            HttpContext ctx,
            [FromBody] UpdateOpenShiftRequest req,
            [FromServices] AppDbContext db) =>
        {
            var shift = await db.OpenShifts.FirstOrDefaultAsync(s => s.Id == id);
            if (shift is null) return Results.NotFound();

            if (req.StartUtc.HasValue) shift.StartUtc = DateTime.SpecifyKind(req.StartUtc.Value, DateTimeKind.Utc);
            if (req.EndUtc.HasValue)   shift.EndUtc   = DateTime.SpecifyKind(req.EndUtc.Value,   DateTimeKind.Utc);
            if (shift.StartUtc >= shift.EndUtc)
                return Results.BadRequest(new { error = "StartUtc must be before EndUtc." });

            if (req.Notes is not null) shift.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
            if (!string.IsNullOrWhiteSpace(req.Status)) shift.Status = req.Status;

            if (!string.IsNullOrWhiteSpace(req.Role)) shift.Role = req.Role.Trim();
            if (req.UnitId.HasValue) shift.UnitId = req.UnitId;

            await db.SaveChangesAsync();
            return Results.Ok(MapShiftDto(shift, null, null, null));
        });

        // DELETE /api/v1/open-shifts/{id} — admin deletes (only if no approved request)
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var shift = await db.OpenShifts
                .Include(s => s.Requests)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (shift is null) return Results.NotFound();

            if (shift.Requests.Any(r => r.Status == "Approved"))
                return Results.Conflict(new { error = "Cannot delete a shift with an approved request. Cancel it instead." });

            db.OpenShifts.Remove(shift);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // GET /api/v1/open-shifts/{id}/requests — admin sees all requests
        g.MapGet("/{id:guid}/requests", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var shift = await db.OpenShifts.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);
            if (shift is null) return Results.NotFound();

            var requests = await db.OpenShiftRequests
                .AsNoTracking()
                .Where(r => r.OpenShiftId == id)
                .ToListAsync();

            // Load staff names
            var staffIds = requests.Select(r => r.StaffId).Distinct().ToList();
            var staffNames = await db.Staff.AsNoTracking()
                .Where(s => staffIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => $"{s.FirstName} {s.LastName}");

            var result = requests.Select(r => new
            {
                r.Id, r.OpenShiftId, r.StaffId,
                StaffName       = staffNames.GetValueOrDefault(r.StaffId, "Unknown"),
                r.Status, r.RequestedUtc, r.ReviewedUtc, r.Notes,
            });

            return Results.Ok(result);
        });

        // PATCH /api/v1/open-shifts/{id}/requests/{reqId} — admin approves or denies
        g.MapPatch("/{id:guid}/requests/{reqId:guid}", async (
            Guid id,
            Guid reqId,
            HttpContext ctx,
            [FromBody] ReviewRequestBody body,
            [FromServices] AppDbContext db) =>
        {
            var reviewerId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (reviewerId is null) return Results.Unauthorized();

            var shift = await db.OpenShifts
                .Include(s => s.Requests)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (shift is null) return Results.NotFound(new { error = "Open shift not found." });

            var request = shift.Requests.FirstOrDefault(r => r.Id == reqId);
            if (request is null) return Results.NotFound(new { error = "Request not found." });

            if (request.Status != "Pending")
                return Results.Conflict(new { error = $"Request is already '{request.Status}'." });

            if (body.Action == "Approve")
            {
                if (shift.Status != "Open")
                    return Results.Conflict(new { error = "This shift is no longer open." });

                // Full constraint validation
                var staff = await db.Staff.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == request.StaffId);
                if (staff is null) return Results.BadRequest(new { error = "Staff not found." });

                var startUtc = DateTime.SpecifyKind(shift.StartUtc, DateTimeKind.Utc);
                var endUtc   = DateTime.SpecifyKind(shift.EndUtc,   DateTimeKind.Utc);

                var constraintError = await ValidateShiftConstraintsAsync(
                    db, staff, shift.FacilityId, startUtc, endUtc);
                if (constraintError is not null)
                    return Results.UnprocessableEntity(new
                    {
                        error = constraintError,
                        code = constraintError.StartsWith("License is expired", StringComparison.OrdinalIgnoreCase)
                            ? "LICENSE_EXPIRED"
                            : "CONSTRAINT_VIOLATION"
                    });

                // Create the assignment
                var facilityState = await db.Facilities.AsNoTracking()
                    .Where(f => f.Id == shift.FacilityId)
                    .Select(f => f.State)
                    .FirstOrDefaultAsync() ?? "XX";

                var assignment = new Assignment
                {
                    Id            = Guid.NewGuid(),
                    StaffId       = staff.Id,
                    FacilityId    = shift.FacilityId,
                    UnitId        = shift.UnitId,
                    FacilityState = facilityState,
                    RoleId        = shift.Role,
                    StartUtc      = startUtc,
                    EndUtc        = endUtc,
                    Notes         = $"Via open shift #{shift.Id}",
                };
                db.Assignments.Add(assignment);

                // Approve this request, deny all others
                request.Status          = "Approved";
                request.ReviewedByUserId = reviewerId;
                request.ReviewedUtc     = DateTime.UtcNow;

                foreach (var other in shift.Requests.Where(r => r.Id != reqId && r.Status == "Pending"))
                {
                    other.Status           = "Denied";
                    other.ReviewedByUserId = reviewerId;
                    other.ReviewedUtc      = DateTime.UtcNow;
                }

                shift.Status = "Filled";
            }
            else if (body.Action == "Deny")
            {
                request.Status           = "Denied";
                request.ReviewedByUserId = reviewerId;
                request.ReviewedUtc      = DateTime.UtcNow;
            }
            else
            {
                return Results.BadRequest(new { error = "Action must be 'Approve' or 'Deny'." });
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { request.Id, request.Status });
        });

        // ── Staff endpoints ────────────────────────────────────────────────────

        // POST /api/v1/open-shifts/{id}/requests — staff claims a shift
        g.MapPost("/{id:guid}/requests", async (
            Guid id,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            if (!Guid.TryParse(staffIdStr, out var staffId))
                return Results.Unauthorized();

            var shift = await db.OpenShifts
                .Include(s => s.Requests)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (shift is null) return Results.NotFound(new { error = "Open shift not found." });

            if (shift.Status != "Open")
                return Results.Conflict(new { error = "This shift is no longer open." });

            // Check not already requested
            if (shift.Requests.Any(r => r.StaffId == staffId))
                return Results.Conflict(new { error = "You have already requested this shift." });

            var staff = await db.Staff.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == staffId);
            if (staff is null) return Results.BadRequest(new { error = "Staff record not found." });

            // Role check
            if (!string.Equals(staff.Role, shift.Role, StringComparison.OrdinalIgnoreCase))
                return Results.UnprocessableEntity(new
                {
                    error = $"Your role ({staff.Role}) does not match the required role ({shift.Role})."
                });

            var startUtc = DateTime.SpecifyKind(shift.StartUtc, DateTimeKind.Utc);
            var endUtc   = DateTime.SpecifyKind(shift.EndUtc,   DateTimeKind.Utc);

            // Full constraint validation (so staff can see the issue immediately)
            var constraintError = await ValidateShiftConstraintsAsync(
                db, staff, shift.FacilityId, startUtc, endUtc);
            if (constraintError is not null)
                return Results.UnprocessableEntity(new
                {
                    error = constraintError,
                    code = constraintError.StartsWith("License is expired", StringComparison.OrdinalIgnoreCase)
                        ? "LICENSE_EXPIRED"
                        : "CONSTRAINT_VIOLATION"
                });

            var req = new OpenShiftRequest
            {
                Id           = Guid.NewGuid(),
                OpenShiftId  = id,
                StaffId      = staffId,
                Status       = "Pending",
                RequestedUtc = DateTime.UtcNow,
            };

            db.OpenShiftRequests.Add(req);
            await db.SaveChangesAsync();

            return Results.Created($"/api/v1/open-shifts/{id}/requests/{req.Id}",
                new { req.Id, req.OpenShiftId, req.StaffId, req.Status, req.RequestedUtc });
        });

        // DELETE /api/v1/open-shifts/{id}/requests/{reqId} — staff withdraws
        g.MapDelete("/{id:guid}/requests/{reqId:guid}", async (
            Guid id,
            Guid reqId,
            HttpContext ctx,
            [FromServices] AppDbContext db) =>
        {
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            if (!Guid.TryParse(staffIdStr, out var staffId))
                return Results.Unauthorized();

            var req = await db.OpenShiftRequests
                .FirstOrDefaultAsync(r => r.Id == reqId && r.OpenShiftId == id);
            if (req is null) return Results.NotFound();

            if (req.StaffId != staffId)
                return Results.Forbid();

            if (req.Status != "Pending")
                return Results.Conflict(new { error = $"Cannot withdraw a request with status '{req.Status}'." });

            db.OpenShiftRequests.Remove(req);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // GET /api/v1/open-shifts/my-requests — staff sees their own requests
        g.MapGet("/my-requests", async (HttpContext ctx, [FromServices] AppDbContext db) =>
        {
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            if (!Guid.TryParse(staffIdStr, out var staffId))
                return Results.Unauthorized();

            var requests = await db.OpenShiftRequests
                .AsNoTracking()
                .Where(r => r.StaffId == staffId)
                .OrderByDescending(r => r.RequestedUtc)
                .ToListAsync();

            var shiftIds = requests.Select(r => r.OpenShiftId).Distinct().ToList();
            var shifts   = await db.OpenShifts.AsNoTracking()
                .Where(s => shiftIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id);

            var result = requests.Select(r =>
            {
                shifts.TryGetValue(r.OpenShiftId, out var s);
                return new
                {
                    r.Id, r.OpenShiftId, r.Status, r.RequestedUtc, r.ReviewedUtc,
                    Shift = s is null ? null : (object)new
                    {
                        s.Role, s.StartUtc, s.EndUtc, s.Notes, s.FacilityId, s.UnitId
                    }
                };
            });

            return Results.Ok(result);
        });

        return v1;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static object MapShiftDto(
        OpenShift s,
        Guid? myRequestId,
        string? myRequestStatus,
        int? requestCount) => new
    {
        s.Id, s.FacilityId, s.UnitId, s.Role,
        s.StartUtc, s.EndUtc, s.Notes, s.Status, s.CreatedUtc,
        RequestCount    = requestCount,
        MyRequestId     = myRequestId,
        MyRequestStatus = myRequestStatus,
    };

    /// <summary>
    /// Checks availability, overlapping assignments, time-off conflicts, and constraint rules.
    /// Returns an error string on failure, null on success.
    /// </summary>
    private static async Task<string?> ValidateShiftConstraintsAsync(
        AppDbContext db,
        Staff staff,
        Guid facilityId,
        DateTime startUtc,
        DateTime endUtc)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (staff.LicenseExpiresOn.HasValue && staff.LicenseExpiresOn.Value < today)
            return "License is expired. Please update your license to request shifts.";

        // 1. Availability
        var avail = await db.StaffAvailabilities.AsNoTracking()
            .Where(a => a.StaffId == staff.Id)
            .ToListAsync();

        var facilityState = await db.Facilities.AsNoTracking()
            .Where(f => f.Id == facilityId)
            .Select(f => f.State)
            .FirstOrDefaultAsync();

        if (avail.Count > 0 && !ShiftFitsAvailability(avail, startUtc, endUtc, facilityState))
            return $"Staff is not available for this shift time. Check their availability settings.";

        // 2. Overlapping assignment
        var overlaps = await db.Assignments.AsNoTracking()
            .Where(a => a.StaffId == staff.Id &&
                        a.StartUtc < endUtc &&
                        a.EndUtc   > startUtc)
            .AnyAsync();
        if (overlaps)
            return "Staff already has an assignment that overlaps this shift.";

        // 3. Approved time-off conflict
        var timeOffConflict = await db.TimeOffRequests.AsNoTracking()
            .Where(t => t.StaffId == staff.Id &&
                        t.Status  == "Approved" &&
                        t.StartUtc < endUtc &&
                        t.EndUtc   > startUtc)
            .AnyAsync();
        if (timeOffConflict)
            return "Staff has approved time off that overlaps this shift.";

        // 4. Load facility constraints
        var constraints = await db.RuleConstraints.AsNoTracking()
            .Where(c => c.FacilityId == facilityId && c.IsActive)
            .ToListAsync();

        double ResolveConstraint(ConstraintType type, double defaultVal)
        {
            var m =
                constraints.FirstOrDefault(c =>
                    c.Type == type && c.Scope == RuleScope.Role &&
                    string.Equals(c.Role, staff.Role, StringComparison.OrdinalIgnoreCase)) ??
                constraints.FirstOrDefault(c =>
                    c.Type == type && c.Scope == RuleScope.Facility);
            return m != null && double.TryParse(m.Value, out var v) ? v : defaultVal;
        }

        double maxHoursWeek = ResolveConstraint(ConstraintType.MaxHoursPerWeek, 60);
        double overtimeCap  = ResolveConstraint(ConstraintType.OvertimeCapHours, 60);
        double minRest      = ResolveConstraint(ConstraintType.MinRestBetweenShiftsHours, 8);
        double maxConsDays  = ResolveConstraint(ConstraintType.MaxConsecutiveDays, 7);

        // 5. Weekly hours
        var weekStart = startUtc.Date.AddDays(-7);
        var weekAssignments = await db.Assignments.AsNoTracking()
            .Where(a => a.StaffId == staff.Id &&
                        a.StartUtc >= weekStart &&
                        a.StartUtc < endUtc)
            .ToListAsync();

        double weekHours = weekAssignments.Sum(a =>
        {
            var st = a.StartUtc < weekStart ? weekStart : a.StartUtc;
            var en = a.EndUtc   > startUtc  ? startUtc  : a.EndUtc;
            var h  = (en - st).TotalHours;
            return h > 0 ? h : 0;
        });
        double shiftHours = (endUtc - startUtc).TotalHours;

        if (weekHours + shiftHours > maxHoursWeek)
            return $"This shift would exceed the maximum of {maxHoursWeek}h/week (currently at {weekHours:F1}h).";

        if (weekHours + shiftHours > overtimeCap)
            return $"This shift would exceed the overtime cap of {overtimeCap}h/week (currently at {weekHours:F1}h).";

        // 6. Min rest between shifts
        var nearby = await db.Assignments.AsNoTracking()
            .Where(a => a.StaffId == staff.Id &&
                        a.EndUtc   >= startUtc.AddHours(-minRest * 2) &&
                        a.StartUtc <= endUtc.AddHours(minRest * 2))
            .ToListAsync();

        foreach (var a in nearby)
        {
            var gapBefore = (startUtc - a.EndUtc).TotalHours;
            var gapAfter  = (a.StartUtc - endUtc).TotalHours;
            if ((gapBefore >= 0 && gapBefore < minRest) || (gapAfter >= 0 && gapAfter < minRest))
                return $"Insufficient rest between shifts. Minimum rest required: {minRest}h.";
        }

        // 7. Max consecutive days
        var rangeStart = startUtc.Date.AddDays(-(int)maxConsDays - 1);
        var rangeEnd   = startUtc.Date.AddDays((int)maxConsDays + 1);
        var daysWorked = await db.Assignments.AsNoTracking()
            .Where(a => a.StaffId == staff.Id &&
                        a.StartUtc.Date >= rangeStart &&
                        a.StartUtc.Date <= rangeEnd)
            .Select(a => a.StartUtc.Date)
            .Distinct()
            .ToListAsync();

        daysWorked.Add(startUtc.Date);
        daysWorked = daysWorked.Distinct().OrderBy(d => d).ToList();

        int consecutive = 1, maxRun = 1;
        for (int i = 1; i < daysWorked.Count; i++)
        {
            if ((daysWorked[i] - daysWorked[i - 1]).TotalDays == 1) { consecutive++; maxRun = Math.Max(maxRun, consecutive); }
            else consecutive = 1;
        }
        if (maxRun > (int)maxConsDays)
            return $"This shift would exceed the maximum of {(int)maxConsDays} consecutive working days.";

        return null;
    }

    private static bool ShiftFitsAvailability(
        List<StaffAvailability> avail,
        DateTime startUtc,
        DateTime endUtc,
        string? facilityState)
    {
        var localStart = TimeZoneHelper.ToFacilityLocal(startUtc, facilityState);
        var localEnd   = TimeZoneHelper.ToFacilityLocal(endUtc, facilityState);

        if (ShiftFitsAvailabilityLocal(avail, localStart, localEnd))
            return true;

        var serverStart = DateTime.SpecifyKind(startUtc, DateTimeKind.Utc).ToLocalTime();
        var serverEnd   = DateTime.SpecifyKind(endUtc, DateTimeKind.Utc).ToLocalTime();
        return ShiftFitsAvailabilityLocal(avail, serverStart, serverEnd);
    }

    private static bool ShiftFitsAvailabilityLocal(
        List<StaffAvailability> avail,
        DateTime localStart,
        DateTime localEnd)
    {
        var cursor = localStart.Date;
        while (cursor < localEnd.Date || (cursor == localStart.Date && cursor == localEnd.Date))
        {
            var dow      = cursor.DayOfWeek;
            var segStart = cursor == localStart.Date ? localStart.TimeOfDay : TimeSpan.Zero;
            var segEnd   = cursor == localEnd.Date   ? localEnd.TimeOfDay   : TimeSpan.FromHours(24);
            if (segEnd == TimeSpan.Zero) { cursor = cursor.AddDays(1); continue; }

            // Relaxed: allow partial overlap of at least 4 hours
            var covered = avail.Any(a =>
                a.DayOfWeek == dow &&
                a.StartLocal < segEnd &&
                a.EndLocal > segStart &&
                (a.EndLocal - a.StartLocal).TotalHours >= 4 // at least 4h block
            );

            if (!covered) return false;
            cursor = cursor.AddDays(1);
        }
        return true;
    }
}

// ── Request/Response DTOs ──────────────────────────────────────────────────────

public record CreateOpenShiftRequest(
    Guid FacilityId,
    Guid? UnitId,
    string Role,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Notes);

public record UpdateOpenShiftRequest(
    DateTime? StartUtc,
    DateTime? EndUtc,
    string? Notes,
    string? Status,
    string? Role,
    Guid? UnitId);

public record ReviewRequestBody(string Action); // "Approve" | "Deny"
