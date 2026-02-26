using System;
using System.Linq;
using System.Globalization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;
using Statera.Application.Services;

namespace Statera.Api.Endpoints;

public static class SchedulerEndpoints
{
    public static RouteGroupBuilder MapSchedulerEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/scheduler").WithTags("Scheduler");

        // POST /api/v1/scheduler/suggest-assignments
        g.MapPost("/suggest-assignments", async (
            [FromBody] SuggestRequest req,
            [FromServices] SchedulerSuggestionService svc,
            [FromServices] AppDbContext db) =>
        {
            if (req is null) return Results.BadRequest(new { error = "Missing body" });

            if (!DateTimeOffset.TryParse(req.StartUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var startDto))
                return Results.BadRequest(new { error = "Invalid StartUtc" });
            if (!DateTimeOffset.TryParse(req.EndUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var endDto))
                return Results.BadRequest(new { error = "Invalid EndUtc" });

            var start = startDto.UtcDateTime;
            var end   = endDto.UtcDateTime;

            // Resolve FacilityId
            Guid? facilityId = null;
            if (!string.IsNullOrWhiteSpace(req.FacilityId) && Guid.TryParse(req.FacilityId, out var fid))
                facilityId = fid;

            // Resolve UnitId
            Guid unitId;
            if (!Guid.TryParse(req.UnitId, out unitId))
            {
                if (int.TryParse(req.UnitId, out var idx))
                {
                    var unitQuery = db.Units.AsQueryable();
                    if (facilityId.HasValue)
                        unitQuery = unitQuery.Where(u => u.FacilityId == facilityId.Value);
                    var units = await unitQuery.OrderBy(u => u.Name).Select(u => u.Id).ToListAsync();
                    if (units.Count == 0) return Results.BadRequest(new { error = "No units available" });
                    var pos = Math.Clamp(idx - 1, 0, units.Count - 1);
                    unitId = units[pos];
                }
                else
                {
                    var fallbackQuery = db.Units.AsQueryable();
                    if (facilityId.HasValue)
                        fallbackQuery = fallbackQuery.Where(u => u.FacilityId == facilityId.Value);
                    var first = await fallbackQuery.Select(u => u.Id).FirstOrDefaultAsync();
                    if (first == Guid.Empty)
                        return Results.BadRequest(new { error = "UnitId invalid and no fallback unit" });
                    unitId = first;
                }
            }

            try
            {
                var list = await svc.SuggestAsync(
                    start, end, unitId,
                    req.RequiredCredential ?? "RN",
                    facilityId: facilityId,
                    ct: default);

                var outList = list.Select(s => new
                {
                    staffId   = s.StaffId.ToString(),
                    score     = s.Score,
                    reasoning = s.Reasoning
                }).ToList();

                return Results.Ok(outList);
            }
            catch (ArgumentException aex)
            {
                return Results.BadRequest(new { error = aex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message);
            }
        });

        return v1;
    }

    public record SuggestRequest(
        string StartUtc,
        string EndUtc,
        string UnitId,
        string RequiredCredential,
        string? FacilityId = null);
}
