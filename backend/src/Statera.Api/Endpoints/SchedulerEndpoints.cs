using System;
using System.Linq;
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
        g.MapPost("/suggest-assignments", async ([FromBody] SuggestRequest req, [FromServices] SchedulerSuggestionService svc, [FromServices] AppDbContext db) =>
        {
            if (req is null) return Results.BadRequest(new { error = "Missing body" });

            // parse start/end
            if (!DateTime.TryParse(req.StartUtc, out var start)) return Results.BadRequest(new { error = "Invalid StartUtc" });
            if (!DateTime.TryParse(req.EndUtc, out var end)) return Results.BadRequest(new { error = "Invalid EndUtc" });

            Guid unitId;
            // try parse GUID first
            if (!Guid.TryParse(req.UnitId, out unitId))
            {
                // if client sent a numeric index, try to map to a unit by ordinal (1-based index)
                if (int.TryParse(req.UnitId, out var idx))
                {
                    var units = await db.Units.OrderBy(u => u.Name).Select(u => u.Id).ToListAsync();
                    if (units.Count == 0) return Results.BadRequest(new { error = "No units available" });
                    var pos = Math.Max(0, idx - 1);
                    pos = Math.Min(pos, units.Count - 1);
                    unitId = units[pos];
                }
                else
                {
                    // fallback: pick first unit
                    var first = await db.Units.Select(u => u.Id).FirstOrDefaultAsync();
                    if (first == Guid.Empty) return Results.BadRequest(new { error = "UnitId invalid and no fallback unit" });
                    unitId = first;
                }
            }

            try
            {
                var list = await svc.SuggestAsync(start, end, unitId, req.RequiredCredential ?? "", default);
                // map to simple DTO with staffId as string
                var outList = list.Select(s => new { staffId = s.StaffId.ToString(), score = s.Score, reasoning = s.Reasoning }).ToList();
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

    public record SuggestRequest(string StartUtc, string EndUtc, string UnitId, string RequiredCredential);
}
