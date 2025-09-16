// backend/src/Statera.Api/Endpoints/ForecastEndpoints.cs
using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;
using Statera.Api.Contracts;

using DomainAssignment = Statera.Domain.Assignment;
using DomainShiftTemplate = Statera.Domain.ShiftTemplate;

namespace Statera.Api.Endpoints;

public static class ForecastEndpoints
{
    public static RouteGroupBuilder MapForecastEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/forecast").WithTags("Forecast");

        // POST /api/v1/forecast/demand
        g.MapPost("/demand", async ([FromBody] DemandForecastRequest req, [FromServices] AppDbContext db) =>
        {
            if (req.FacilityId == Guid.Empty || req.UnitId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId and UnitId are required" });
            if (req.From > req.To)
                return Results.BadRequest(new { error = "From must be on/before To" });

            var templates = await db.Set<DomainShiftTemplate>()
                .AsNoTracking()
                .Where(t => t.FacilityId == req.FacilityId && t.UnitId == req.UnitId)
                .ToListAsync();

            var points = new List<DemandPoint>();
            for (var d = req.From; d <= req.To; d = d.AddDays(1))
            {
                var heads = templates.Sum(t => t.RequiredCount); // naive daily pattern
                points.Add(new DemandPoint(d, heads));
            }

            return Results.Ok(new DemandForecastResponse(points));
        });

        // POST /api/v1/forecast/burnout
        g.MapPost("/burnout", async ([FromBody] BurnoutRiskRequest req, [FromServices] AppDbContext db) =>
        {
            if (req.FacilityId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId is required" });
            if (req.From > req.To)
                return Results.BadRequest(new { error = "From must be on/before To" });

            var fromUtc = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var toUtc = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            var assignments = await db.Set<DomainAssignment>()
                .AsNoTracking()
                .Where(a => a.FacilityId == req.FacilityId &&
                            a.StartUtc < toUtc &&
                            a.EndUtc > fromUtc)
                .ToListAsync();

            var hoursByStaff = new Dictionary<Guid, double>();
            foreach (var a in assignments)
            {
                var start = a.StartUtc < fromUtc ? fromUtc : a.StartUtc;
                var end = a.EndUtc > toUtc ? toUtc : a.EndUtc;
                var hrs = (end - start).TotalHours;
                if (hrs <= 0) continue;

                hoursByStaff.TryGetValue(a.StaffId, out var cur);
                hoursByStaff[a.StaffId] = cur + hrs;
            }

            var totalDays = Math.Max(1, req.To.DayNumber - req.From.DayNumber + 1);
            var baselineHours = totalDays * 8.0; // naive baseline
            var points = hoursByStaff.Select(kv =>
            {
                var score = baselineHours <= 0 ? 0 : Math.Min(1.0, kv.Value / (baselineHours * 1.5));
                return new BurnoutPoint(kv.Key, score);
            }).ToList();

            return Results.Ok(new BurnoutRiskResponse(points));
        });

        // POST /api/v1/forecast/whatif
        g.MapPost("/whatif", ([FromBody] WhatIfScenarioRequest req) =>
        {
            if (req.FacilityId == Guid.Empty || req.UnitId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId and UnitId are required" });
            if (string.IsNullOrWhiteSpace(req.Scenario))
                return Results.BadRequest(new { error = "Scenario is required" });

            var sc = req.Scenario.Trim().ToLowerInvariant();
            var effects = new List<string>();

            if (sc.Contains("increase") && sc.Contains("demand"))
                effects.Add("Projected demand up ~10% over the next week.");
            if (sc.Contains("reduce") && sc.Contains("staff"))
                effects.Add("Coverage risk increases for weekend night assignments.");
            if (effects.Count == 0)
                effects.Add("No material effect detected by the current heuristic.");

            return Results.Ok(new WhatIfResponse(req.Scenario, effects));
        });

        return v1;
    }
}
