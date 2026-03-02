// backend/src/Statera.Api/Endpoints/ForecastEndpoints.cs
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Statera.Api.Authorization;
using Statera.Api.Contracts;
using Statera.Api.Integrations;
using Statera.Infrastructure;

using DomainAssignment = Statera.Domain.Assignment;
using DomainShiftTemplate = Statera.Domain.ShiftTemplate;

namespace Statera.Api.Endpoints;

public static class ForecastEndpoints
{
    public static RouteGroupBuilder MapForecastEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/forecast").WithTags("Forecast")
            .AddEndpointFilter(async (ctx, next) =>
            {
                if (!TierEnforcement.CanAccessGrowthFeature(ctx.HttpContext))
                    return TierEnforcement.UpgradeRequired();
                return await next(ctx);
            });

        // ── POST /forecast/demand ─────────────────────────────────────────────
        // Rolling 12-week historical average of distinct staff per day-of-week.
        g.MapPost("/demand", async (
            [FromBody] DemandForecastRequest req,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            if (req.FacilityId == Guid.Empty || req.UnitId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId and UnitId are required" });
            if (req.From > req.To)
                return Results.BadRequest(new { error = "From must be on/before To" });

            // Historical window: 12 weeks before req.From
            var histEnd = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var histStart = histEnd.AddDays(-84); // 12 * 7

            var historical = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == req.FacilityId
                         && a.UnitId == req.UnitId
                         && a.StartUtc >= histStart
                         && a.StartUtc < histEnd)
                .Select(a => new { a.StaffId, a.StartUtc })
                .ToListAsync(ct);

            // Average distinct staff per day-of-week (0=Sun..6=Sat)
            var avgByDow = historical
                .GroupBy(a => (int)a.StartUtc.DayOfWeek)
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        // Group by calendar date first, then average distinct staff across those dates
                        var perDay = g.GroupBy(a => a.StartUtc.Date)
                                      .Select(d => d.Select(x => x.StaffId).Distinct().Count())
                                      .ToList();
                        return perDay.Count > 0 ? (int)Math.Round(perDay.Average()) : 0;
                    });

            // Weeks of history seen per DOW — used as confidence proxy (saturates at 4 weeks → 1.0)
            var weeksByDow = historical
                .GroupBy(a => (int)a.StartUtc.DayOfWeek)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(a => a.StartUtc.Date).Distinct().Count());

            // Required heads from ShiftTemplates for this unit
            var templates = await db.ShiftTemplates
                .AsNoTracking()
                .Where(t => t.FacilityId == req.FacilityId && t.UnitId == req.UnitId)
                .ToListAsync(ct);

            // ShiftTemplate has no DayOfWeek — required heads apply uniformly to all days
            var requiredHeads = templates.Sum(t => t.RequiredCount);

            var points = new List<DemandPoint>();
            for (var d = req.From; d <= req.To; d = d.AddDays(1))
            {
                var dow = (int)d.DayOfWeek;
                var required = requiredHeads;
                var avg = avgByDow.GetValueOrDefault(dow, 0);
                var weeksOfData = weeksByDow.GetValueOrDefault(dow, 0);
                var confidence = Math.Min(1.0, weeksOfData / 4.0);
                points.Add(new DemandPoint(d, required, avg, confidence));
            }

            return Results.Ok(new DemandForecastResponse(points));
        });

        // ── POST /forecast/burnout ────────────────────────────────────────────
        // Multi-factor burnout risk: hours, shift count, consecutive days.
        g.MapPost("/burnout", async (
            [FromBody] BurnoutRiskRequest req,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            if (req.FacilityId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId is required" });
            if (req.From > req.To)
                return Results.BadRequest(new { error = "From must be on/before To" });

            // Look back 4 weeks from req.From for the burnout window
            var windowEnd = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
            var windowStart = req.From.AddDays(-28).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            var assignments = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == req.FacilityId
                         && a.StartUtc >= windowStart
                         && a.StartUtc <= windowEnd)
                .Select(a => new { a.StaffId, a.StartUtc, a.EndUtc })
                .ToListAsync(ct);

            // Load staff names for all involved staff
            var staffIds = assignments.Select(a => a.StaffId).Distinct().ToList();
            var staffNames = await db.Staff
                .AsNoTracking()
                .Where(s => staffIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => $"{s.FirstName} {s.LastName}", ct);

            var fourWeeksAgoUtc = req.From.AddDays(-28).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            var points = assignments
                .GroupBy(a => a.StaffId)
                .Select(g =>
                {
                    var last4wk = g.Where(a => a.StartUtc >= fourWeeksAgoUtc).ToList();
                    var hoursLast4Wk = last4wk.Sum(a => (a.EndUtc - a.StartUtc).TotalHours);
                    var shiftsLast4Wk = last4wk.Count;

                    // Consecutive days: longest streak of calendar days with any shift
                    var days = g.Select(a => DateOnly.FromDateTime(a.StartUtc))
                                .Distinct()
                                .OrderBy(d => d)
                                .ToList();
                    var maxStreak = 0;
                    var streak = 1;
                    for (var i = 1; i < days.Count; i++)
                    {
                        if (days[i].DayNumber - days[i - 1].DayNumber == 1)
                            streak++;
                        else
                            streak = 1;
                        maxStreak = Math.Max(maxStreak, streak);
                    }
                    if (days.Count > 0 && maxStreak == 0) maxStreak = 1;

                    // Weighted score clamped to [0, 1]
                    var score = Math.Min(1.0,
                        0.4 * (hoursLast4Wk / 160.0) +   // 160h = 40h/wk * 4wk
                        0.3 * (shiftsLast4Wk / 20.0) +    // 20 shifts = 5/day * 4wk
                        0.3 * (maxStreak / 7.0));          // 7 consecutive days = high risk

                    var name = staffNames.GetValueOrDefault(g.Key, "Unknown");
                    return new BurnoutPoint(g.Key, name, Math.Round(score, 3),
                        Math.Round(hoursLast4Wk, 1), maxStreak, shiftsLast4Wk);
                })
                .OrderByDescending(p => p.RiskScore)
                .ToList();

            return Results.Ok(new BurnoutRiskResponse(points));
        });

        // ── POST /forecast/whatif ─────────────────────────────────────────────
        // Real simulation: apply scenario multiplier to historical demand vs actual coverage.
        g.MapPost("/whatif", async (
            [FromBody] WhatIfScenarioRequest req,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            if (req.FacilityId == Guid.Empty || req.UnitId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId and UnitId are required" });
            if (string.IsNullOrWhiteSpace(req.Scenario))
                return Results.BadRequest(new { error = "Scenario is required" });
            if (req.From > req.To)
                return Results.BadRequest(new { error = "From must be on/before To" });

            var sc = req.Scenario.ToLowerInvariant();

            // Parse multiplier from scenario text
            double demandMultiplier = 1.0;
            double staffMultiplier = 1.0;
            var recommendations = new List<string>();

            if (sc.Contains("flu") || sc.Contains("pandemic") || sc.Contains("outbreak"))
            {
                demandMultiplier = 1.35;
                staffMultiplier = 0.85; // staff also call out sick
                recommendations.Add("Pre-approve overtime for all eligible staff.");
                recommendations.Add("Contact agency for temp staff roster.");
            }
            else if (sc.Contains("holiday"))
            {
                demandMultiplier = 0.8;
                staffMultiplier = 0.75;
                recommendations.Add("Confirm holiday coverage agreements with union reps.");
            }
            else if (sc.Contains("weekend surge"))
            {
                demandMultiplier = 1.2;
                recommendations.Add("Adjust weekend shift templates to add one float per unit.");
            }
            else if (sc.Contains("reduce staff") || sc.Contains("cut staff"))
            {
                staffMultiplier = 0.8;
                recommendations.Add("Assess which shifts can be covered by cross-trained staff.");
            }
            else if (sc.Contains("add staff") || sc.Contains("hire"))
            {
                staffMultiplier = 1.2;
                recommendations.Add("Ensure new hires are oriented before being counted in coverage.");
            }
            else
            {
                // Try to extract a percentage
                var match = System.Text.RegularExpressions.Regex.Match(sc, @"(\d+)\s*%");
                if (match.Success && int.TryParse(match.Groups[1].Value, out var pct))
                {
                    if (sc.Contains("increase") || sc.Contains("surge") || sc.Contains("more"))
                        demandMultiplier = 1 + pct / 100.0;
                    else if (sc.Contains("decrease") || sc.Contains("reduce") || sc.Contains("less"))
                        demandMultiplier = 1 - pct / 100.0;
                }
                if (recommendations.Count == 0)
                    recommendations.Add("Review staffing levels per unit for the specified period.");
            }

            // Pull historical coverage for the range
            var fromUtc = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var toUtc = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            var assignments = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == req.FacilityId
                         && a.UnitId == req.UnitId
                         && a.StartUtc >= fromUtc
                         && a.StartUtc <= toUtc)
                .Select(a => new { a.StaffId, a.StartUtc })
                .ToListAsync(ct);

            var templates = await db.ShiftTemplates
                .AsNoTracking()
                .Where(t => t.FacilityId == req.FacilityId && t.UnitId == req.UnitId)
                .ToListAsync(ct);

            // ShiftTemplate has no DayOfWeek — required heads apply uniformly to all days
            var requiredHeads = Math.Max(1, templates.Sum(t => t.RequiredCount));

            var effects = new List<WhatIfEffect>();
            var totalCurrentCoverage = 0.0;
            var totalProjectedCoverage = 0.0;
            var gapDays = 0;
            var overtimeTriggers = 0;

            for (var d = req.From; d <= req.To; d = d.AddDays(1))
            {
                var required = requiredHeads;
                var dayStr = d.ToString("ddd yyyy-MM-dd");

                var actualStaff = assignments
                    .Where(a => DateOnly.FromDateTime(a.StartUtc) == d)
                    .Select(a => a.StaffId)
                    .Distinct()
                    .Count();

                var projectedRequired = Math.Max(1, (int)Math.Ceiling(required * demandMultiplier));
                var projectedStaff = Math.Max(0, (int)Math.Round(actualStaff * staffMultiplier));

                var currentCov = required > 0 ? Math.Min(1.0, (double)actualStaff / required) : 1.0;
                var projectedCov = projectedRequired > 0
                    ? Math.Min(1.0, (double)projectedStaff / projectedRequired)
                    : 1.0;

                totalCurrentCoverage += currentCov;
                totalProjectedCoverage += projectedCov;

                if (projectedCov < 0.9) gapDays++;
                if (projectedStaff > required * 1.1) overtimeTriggers++;

                effects.Add(new WhatIfEffect(dayStr,
                    Math.Round(currentCov, 3), Math.Round(projectedCov, 3)));
            }

            var totalDays = Math.Max(1, req.To.DayNumber - req.From.DayNumber + 1);
            var avgCurrent = totalCurrentCoverage / totalDays;
            var avgProjected = totalProjectedCoverage / totalDays;

            return Results.Ok(new WhatIfResponse(
                req.Scenario,
                Math.Round(avgCurrent, 3),
                Math.Round(avgProjected, 3),
                gapDays,
                overtimeTriggers > 0,
                effects,
                recommendations));
        });

        // ── POST /forecast/insights ───────────────────────────────────────────
        // Call Claude claude-sonnet-4-6 to generate natural-language staffing insights.
        g.MapPost("/insights", async (
            [FromBody] ForecastInsightsRequest req,
            [FromServices] AppDbContext db,
            [FromServices] IHttpClientFactory httpClientFactory,
            [FromServices] IOptions<AnthropicSettings> anthropicOpts,
            CancellationToken ct) =>
        {
            if (req.FacilityId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId is required" });
            if (req.From > req.To)
                return Results.BadRequest(new { error = "From must be on/before To" });

            var fromUtc = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var toUtc = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
            var totalDays = Math.Max(1, req.To.DayNumber - req.From.DayNumber + 1);

            // Gather coverage data
            var assignmentsQuery = db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == req.FacilityId
                         && a.StartUtc >= fromUtc
                         && a.StartUtc <= toUtc);
            if (req.UnitId.HasValue)
                assignmentsQuery = assignmentsQuery.Where(a => a.UnitId == req.UnitId);

            var assignments = await assignmentsQuery
                .Select(a => new { a.StaffId, a.StartUtc, a.EndUtc })
                .ToListAsync(ct);

            var templatesQuery = db.ShiftTemplates
                .AsNoTracking()
                .Where(t => t.FacilityId == req.FacilityId);
            if (req.UnitId.HasValue)
                templatesQuery = templatesQuery.Where(t => t.UnitId == req.UnitId);
            var templates = await templatesQuery.ToListAsync(ct);

            // ShiftTemplate has no DayOfWeek — required heads apply uniformly to all days
            var requiredHeads = templates.Sum(t => t.RequiredCount);

            // Aggregate per day
            var understaffedDays = 0;
            var overtimeDays = 0;
            double totalCoverage = 0;
            var dowCounts = new Dictionary<int, int>();

            for (var d = req.From; d <= req.To; d = d.AddDays(1))
            {
                var dow = (int)d.DayOfWeek;
                var required = requiredHeads;
                var actual = assignments
                    .Where(a => DateOnly.FromDateTime(a.StartUtc) == d)
                    .Select(a => a.StaffId).Distinct().Count();

                if (required > 0)
                {
                    var cov = (double)actual / required;
                    totalCoverage += Math.Min(1.0, cov);
                    if (cov < 0.9) understaffedDays++;
                    if (cov > 1.15) overtimeDays++;
                }

                dowCounts[dow] = dowCounts.GetValueOrDefault(dow, 0) + actual;
            }

            var avgCoverage = totalDays > 0 ? totalCoverage / totalDays : 0;
            var peakDow = dowCounts.OrderByDescending(kv => kv.Value).FirstOrDefault();
            var dowNames = new[] { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };
            var peakDayName = peakDow.Key >= 0 && peakDow.Key < 7 ? dowNames[peakDow.Key] : "Unknown";

            // Burnout: top 3 at-risk staff
            var fourWeeksAgo = fromUtc.AddDays(-28);
            var burnoutData = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == req.FacilityId && a.StartUtc >= fourWeeksAgo && a.StartUtc <= toUtc)
                .Select(a => new { a.StaffId, a.StartUtc, a.EndUtc })
                .ToListAsync(ct);

            var topAtRisk = burnoutData
                .GroupBy(a => a.StaffId)
                .Select(g =>
                {
                    var hrs = g.Sum(a => (a.EndUtc - a.StartUtc).TotalHours);
                    var shifts = g.Count();
                    return new { StaffId = g.Key, Hours = hrs, Shifts = shifts };
                })
                .OrderByDescending(x => x.Hours)
                .Take(3)
                .ToList();

            var summary = new ForecastSummary(
                Math.Round(avgCoverage, 3),
                understaffedDays,
                overtimeDays,
                peakDow.Value,
                peakDayName);

            // Build Claude prompt — extract JSON schema to variable to avoid raw-string brace issues
            var insightSchema = """{"title": string, "body": string, "severity": "info"|"warning"|"critical"}""";
            var topRiskSummary = string.Join("; ", topAtRisk.Select(x => $"{x.Hours:F0}h / {x.Shifts} shifts"));
            var prompt =
                "You are a healthcare staffing analyst. Based on the data below, return a JSON array of staffing insights.\n" +
                $"Each insight must be: {insightSchema}\n" +
                "Return ONLY the raw JSON array, no markdown, no explanation.\n\n" +
                $"Period: {req.From:yyyy-MM-dd} to {req.To:yyyy-MM-dd} ({totalDays} days)\n" +
                $"Average coverage rate: {avgCoverage:P1}\n" +
                $"Understaffed days (<90% coverage): {understaffedDays}\n" +
                $"Overtime days (>115% coverage): {overtimeDays}\n" +
                $"Peak staffing day: {peakDayName}\n" +
                $"Top 3 high-hours staff (last 4 weeks): {topRiskSummary}\n\n" +
                "Generate 3 to 5 actionable insights appropriate for a nursing facility manager.";

            var apiKey = anthropicOpts.Value.ApiKey;
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                // Return summary with placeholder insights when no API key configured
                var fallback = new List<AiInsight>
                {
                    new("API Key Not Configured",
                        "Set Anthropic:ApiKey in appsettings.json to enable AI-powered insights.",
                        "warning"),
                    new($"Coverage Rate: {avgCoverage:P1}",
                        understaffedDays > 0
                            ? $"{understaffedDays} days fell below 90% coverage in this period."
                            : "Coverage was consistently above 90% — no critical gaps detected.",
                        understaffedDays > totalDays / 4 ? "warning" : "info"),
                    new($"Overtime Pressure",
                        overtimeDays > 0
                            ? $"{overtimeDays} days exceeded 115% coverage, indicating overtime risk."
                            : "No overtime pressure detected in this period.",
                        overtimeDays > 5 ? "warning" : "info")
                };
                return Results.Ok(new ForecastInsightsResponse(summary, fallback, null));
            }

            // Call Claude
            var requestBody = new
            {
                model = "claude-sonnet-4-6",
                max_tokens = 1024,
                messages = new[]
                {
                    new { role = "user", content = prompt }
                }
            };

            var client = httpClientFactory.CreateClient("anthropic");
            using var httpReq = new HttpRequestMessage(HttpMethod.Post, "/v1/messages");
            httpReq.Headers.Add("x-api-key", apiKey);
            httpReq.Content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            HttpResponseMessage httpResp;
            try
            {
                httpResp = await client.SendAsync(httpReq, ct);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Failed to reach Anthropic API: {ex.Message}");
            }

            if (!httpResp.IsSuccessStatusCode)
            {
                var errBody = await httpResp.Content.ReadAsStringAsync(ct);
                return Results.Problem($"Anthropic API error {(int)httpResp.StatusCode}: {errBody}");
            }

            var responseJson = await httpResp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseJson);

            var tokensUsed = doc.RootElement
                .GetProperty("usage")
                .GetProperty("output_tokens")
                .GetInt32()
                .ToString();

            var rawText = doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text")
                .GetString() ?? "[]";

            // Strip markdown fences defensively
            rawText = rawText.Trim();
            if (rawText.StartsWith("```")) rawText = rawText[(rawText.IndexOf('\n') + 1)..];
            if (rawText.EndsWith("```")) rawText = rawText[..rawText.LastIndexOf("```")];
            rawText = rawText.Trim();

            List<AiInsight> insights;
            try
            {
                insights = JsonSerializer.Deserialize<List<AiInsight>>(rawText,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
            }
            catch
            {
                insights = [new AiInsight("Parse Error",
                    "Claude returned an unexpected format. Raw: " + rawText[..Math.Min(200, rawText.Length)],
                    "warning")];
            }

            return Results.Ok(new ForecastInsightsResponse(summary, insights, tokensUsed));
        });

        return v1;
    }
}
