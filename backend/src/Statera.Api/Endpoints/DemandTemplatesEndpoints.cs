// backend/src/Statera.Api/Endpoints/DemandTemplatesEndpoints.cs
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Authorization;
using Statera.Api.Contracts;
using Statera.Api.Mapping;
using Statera.Domain;
using Statera.Domain.Staffing;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class DemandTemplatesEndpoints
{
    public static void MapDemandTemplatesEndpoints(this RouteGroupBuilder v1)
    {
        var tierFilter = new Func<EndpointFilterInvocationContext, EndpointFilterDelegate, ValueTask<object?>>(
            async (ctx, next) =>
            {
                if (!TierEnforcement.CanAccessGrowthFeature(ctx.HttpContext))
                    return TierEnforcement.UpgradeRequired();
                return await next(ctx);
            });

        // ========= Facility-scoped list =========
        var gFacility = v1.MapGroup("/facilities/{facilityId:guid}/demand-templates")
                          .WithTags("Demand Templates")
                          .AddEndpointFilter(tierFilter);

        gFacility.MapGet("/", async (
            [FromRoute] Guid facilityId,
            [FromQuery(Name = "q")] string? q,
            [FromQuery] DemandTemplateStatus? status,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            page = page <= 0 ? 1 : page;
            pageSize = pageSize is <= 0 or > 200 ? 20 : pageSize;

            var query = db.DemandTemplates
                .AsNoTracking()
                .Include(x => x.Days)
                .Where(x => x.FacilityId == facilityId);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var s = q.Trim();
                query = query.Where(x =>
                    x.Name.Contains(s) ||
                    (x.Notes != null && x.Notes.Contains(s)) ||
                    (x.Role != null && x.Role.Contains(s)));
            }

            if (status.HasValue)
                query = query.Where(x => x.Status == status.Value);

            var total = await query.CountAsync(ct);

            var items = await query
                .OrderByDescending(x => x.UpdatedOn ?? x.CreatedOn)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => x.ToDto())
                .ToListAsync(ct);

            return Results.Ok(new PagedResult<DemandTemplateDto>(items, total));
        })
        .WithSummary("List demand templates in a facility");

        // ========= Global item routes (match FE) =========
        var gGlobal = v1.MapGroup("/demand-templates")
                        .WithTags("Demand Templates")
                        .AddEndpointFilter(tierFilter);

        // GET by id
        gGlobal.MapGet("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.DemandTemplates
                .AsNoTracking()
                .Include(x => x.Days)
                .FirstOrDefaultAsync(x => x.Id == id, ct);

            return e is null ? Results.NotFound() : Results.Ok(e.ToDto());
        });

        // POST create
        gGlobal.MapPost("/", async (
            [FromBody] CreateDemandTemplateRequest body,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(body.Name))
                return Results.BadRequest("Name is required.");

            var entity = new DemandTemplate
            {
                FacilityId = body.FacilityId,
                UnitId = body.UnitId,
                Name = body.Name.Trim(),
                Role = string.IsNullOrWhiteSpace(body.Role) ? null : body.Role.Trim(),
                Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim(),
                Status = DemandTemplateStatus.Draft,
                CreatedOn = DateTime.UtcNow
            };

            if (body.Days != null)
            {
                foreach (var d in body.Days)
                {
                    if (d.Day < 0 || d.Day > 6) return Results.BadRequest("Day must be 0..6.");
                    entity.Days.Add(new DemandTemplateDay
                    {
                        Day = d.Day,
                        Required = Math.Max(0, d.Required)
                    });
                }
            }

            db.DemandTemplates.Add(entity);
            await db.SaveChangesAsync(ct);

            var dto = entity.ToDto();
            return Results.Created($"/api/v1/demand-templates/{entity.Id}", dto);
        });

        // PUT update (+ concurrency via RowVersion)
        gGlobal.MapPut("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromBody] UpdateDemandTemplateRequest body,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.DemandTemplates
                .Include(x => x.Days)
                .FirstOrDefaultAsync(x => x.Id == id, ct);

            if (e is null) return Results.NotFound();

            // RowVersion check (client sends base64 string)
            if (e.RowVersion is not null && body.RowVersion is not null)
            {
                var clientVersion = Convert.FromBase64String(body.RowVersion);
                if (!e.RowVersion.SequenceEqual(clientVersion))
                    return Results.Conflict("The template was modified by someone else. Refresh and try again.");
            }

            e.Apply(body);

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict("Concurrency conflict. Please reload.");
            }

            return Results.Ok(e.ToDto());
        });

        // DELETE
        gGlobal.MapDelete("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.DemandTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e is null) return Results.NotFound();

            db.DemandTemplates.Remove(e);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

      

        // Validate
        gGlobal.MapPost("/{id:guid}:validate", async (
            [FromRoute] Guid id,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.DemandTemplates
                .AsNoTracking()
                .Include(x => x.Days)
                .FirstOrDefaultAsync(x => x.Id == id, ct);

            if (e is null) return Results.NotFound();

            var issues = new List<ValidationIssue>();

            if (string.IsNullOrWhiteSpace(e.Name))
                issues.Add(new("NameMissing", "Name is required.", "error", "name"));

            if (!e.Days.Any())
                issues.Add(new("NoDays", "At least one day is required.", "warning", "days"));

            if (e.Days.Any(d => d.Required < 0))
                issues.Add(new("NegativeRequired", "Required cannot be negative.", "error", "days"));

            // Example info-level hint
            if (string.IsNullOrWhiteSpace(e.Role))
                issues.Add(new("RoleEmpty", "No role specified; template applies broadly.", "info", "role"));

            return Results.Ok(issues);
        });

        // Approve
        gGlobal.MapPost("/{id:guid}:approve", async (
            [FromRoute] Guid id,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.DemandTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e is null) return Results.NotFound();

            if (e.Status is not DemandTemplateStatus.Draft and not DemandTemplateStatus.Review)
                return Results.BadRequest("Only Draft or Review templates can be Approved.");

            e.Status = DemandTemplateStatus.Approved;
            e.UpdatedOn = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            // Reload with days for DTO
            var dto = await db.DemandTemplates.AsNoTracking().Include(x => x.Days).Where(x => x.Id == id).Select(x => x.ToDto()).FirstAsync(ct);
            return Results.Ok(dto);
        });

        // Publish
        gGlobal.MapPost("/{id:guid}:publish", async (
            [FromRoute] Guid id,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            var e = await db.DemandTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (e is null) return Results.NotFound();

            if (e.Status != DemandTemplateStatus.Approved)
                return Results.BadRequest("Only Approved templates can be Published.");

            e.Status = DemandTemplateStatus.Published;
            e.UpdatedOn = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            var dto = await db.DemandTemplates.AsNoTracking().Include(x => x.Days).Where(x => x.Id == id).Select(x => x.ToDto()).FirstAsync(ct);
            return Results.Ok(dto);
        });

        // Apply template to date range — creates real OpenShift records
        gGlobal.MapPost("/{id:guid}:apply", async (
            [FromRoute] Guid id,
            [FromBody] ApplyToRangeRequest body,
            [FromServices] AppDbContext db,
            HttpContext http,
            CancellationToken ct) =>
        {
            var template = await db.DemandTemplates
                .AsNoTracking()
                .Include(x => x.Days)
                .FirstOrDefaultAsync(x => x.Id == id, ct);

            if (template is null) return Results.NotFound();

            if (!DateOnly.TryParse(body.StartDate, out var start) ||
                !DateOnly.TryParse(body.EndDate, out var end) ||
                end < start)
                return Results.BadRequest("Invalid date range.");

            var userId = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? http.User.FindFirstValue("sub")
                      ?? "system";

            var role = template.Role ?? "Staff";
            var openShifts = new List<OpenShift>();

            for (var d = start; d <= end; d = d.AddDays(1))
            {
                var dow = (int)d.DayOfWeek; // 0=Sun..6=Sat matches DemandTemplateDay.Day
                var dayConfig = template.Days.FirstOrDefault(day => day.Day == dow);
                if (dayConfig is null || dayConfig.Required <= 0) continue;

                // Default shift window: 07:00–19:00 UTC (12-hour day shift)
                var shiftStart = d.ToDateTime(new TimeOnly(7, 0), DateTimeKind.Utc);
                var shiftEnd = d.ToDateTime(new TimeOnly(19, 0), DateTimeKind.Utc);

                for (var slot = 0; slot < dayConfig.Required; slot++)
                {
                    openShifts.Add(new OpenShift
                    {
                        Id = Guid.NewGuid(),
                        FacilityId = template.FacilityId,
                        UnitId = template.UnitId,
                        Role = role,
                        StartUtc = shiftStart,
                        EndUtc = shiftEnd,
                        Notes = $"Applied from template: {template.Name}",
                        Status = "Open",
                        CreatedByUserId = userId,
                        CreatedUtc = DateTime.UtcNow
                    });
                }
            }

            if (openShifts.Count > 0)
            {
                db.OpenShifts.AddRange(openShifts);
                await db.SaveChangesAsync(ct);
            }

            return Results.Ok(new { applied = openShifts.Count });
        });
    }
}
