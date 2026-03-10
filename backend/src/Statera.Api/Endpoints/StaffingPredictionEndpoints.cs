using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Statera.Api.Authorization;
using Statera.Api.Integrations;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class StaffingPredictionEndpoints
{
    public static RouteGroupBuilder MapStaffingPredictionEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/facilities/{facilityId}/staffing-predictions").WithTags("StaffingPredictions")
            .AddEndpointFilter(async (ctx, next) =>
            {
                if (!TierEnforcement.CanAccessGrowthFeature(ctx.HttpContext))
                    return TierEnforcement.UpgradeRequired();
                return await next(ctx);
            });

        // GET /api/v1/facilities/{facilityId}/staffing-predictions
        // Returns AI-generated shortage predictions for the next 4 weeks based on:
        //   • 12-week historical assignment patterns per role + day-of-week
        //   • Sick call-off rates from time-off history
        //   • Already-scheduled coverage for upcoming dates
        //   • Seasonal factors (holiday / flu season weighting)
        g.MapGet("/", async (
            Guid facilityId,
            [FromServices] AppDbContext db,
            [FromServices] IHttpClientFactory httpClientFactory,
            [FromServices] IOptions<AnthropicSettings> anthropicOpts,
            CancellationToken ct) =>
        {
            var today       = DateTime.UtcNow.Date;
            var histStart   = today.AddDays(-84); // 12 weeks back
            var forecastEnd = today.AddDays(28);  // 4 weeks ahead

            // ── 1. Historical assignments (last 12 weeks) ─────────────────────
            var historical = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == facilityId
                         && a.StartUtc >= histStart
                         && a.StartUtc < today)
                .Select(a => new { a.StaffId, a.StartUtc, a.RoleId })
                .ToListAsync(ct);

            // ── 2. Demand templates (required headcount per role) ─────────────
            var templates = await db.ShiftTemplates
                .AsNoTracking()
                .Where(t => t.FacilityId == facilityId)
                .Select(t => new { t.RoleId, t.RequiredCount })
                .ToListAsync(ct);

            var requiredByRole = templates
                .GroupBy(t => t.RoleId)
                .ToDictionary(g => g.Key, g => g.Sum(t => t.RequiredCount));

            // ── 3. Upcoming assignments (next 4 weeks, already scheduled) ─────
            var upcoming = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == facilityId
                         && a.StartUtc >= today
                         && a.StartUtc < forecastEnd)
                .Select(a => new { a.StaffId, a.StartUtc, a.RoleId })
                .ToListAsync(ct);

            // ── 4. Sick call-off rates (last 12 weeks, by day-of-week) ────────
            var sickCalloffs = await db.TimeOffRequests
                .AsNoTracking()
                .Where(r => r.Staff != null
                         && r.Staff.FacilityId == facilityId
                         && r.Status == "Approved"
                         && (r.Type == "Sick" || r.Type == "sick")
                         && r.StartUtc >= histStart
                         && r.StartUtc < today)
                .Select(r => new { r.StaffId, r.StartUtc })
                .ToListAsync(ct);

            // Base sick rate per day-of-week
            var sickByDow = new double[7];
            if (historical.Count > 0)
            {
                for (var dow = 0; dow < 7; dow++)
                {
                    var daysWithData = historical
                        .Where(a => (int)a.StartUtc.DayOfWeek == dow)
                        .Select(a => a.StartUtc.Date)
                        .Distinct()
                        .Count();

                    var sickOnDow = sickCalloffs
                        .Count(s => (int)s.StartUtc.DayOfWeek == dow);

                    sickByDow[dow] = daysWithData > 0
                        ? Math.Min(0.30, (double)sickOnDow / Math.Max(1, daysWithData) * 2.0)
                        : 0.05;
                }
            }
            else
            {
                // No data — baseline 5% sick rate
                for (var i = 0; i < 7; i++) sickByDow[i] = 0.05;
            }

            // ── 5. Historical shortage frequency per role + day-of-week ───────
            // Keys: (roleId, dow) → list of (date, staffed)
            var histByRoleDow = historical
                .GroupBy(a => (a.RoleId, (int)a.StartUtc.DayOfWeek))
                .ToDictionary(
                    g => g.Key,
                    g => g.GroupBy(a => a.StartUtc.Date)
                           .Select(d => d.Select(x => x.StaffId).Distinct().Count())
                           .ToList());

            // ── 6. Unique roles seen ──────────────────────────────────────────
            var allRoles = historical.Select(a => a.RoleId).Distinct()
                .Union(upcoming.Select(a => a.RoleId))
                .Union(requiredByRole.Keys)
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Distinct()
                .ToList();

            // ── 7. Generate per-day predictions ──────────────────────────────
            var rawPredictions = new List<RawPrediction>();

            for (var d = today; d < forecastEnd; d = d.AddDays(1))
            {
                var dow       = (int)d.DayOfWeek;
                var isWeekend = dow is 0 or 6; // Sun or Sat
                var month     = d.Month;

                // Seasonal multiplier: flu/holiday season raises risk
                var seasonal = 1.0;
                if (month is 11 or 12 or 1 or 2) seasonal = 1.25; // Nov–Feb flu season
                if (d.Month == 12 && d.Day is >= 24 and <= 26) seasonal = 1.5; // Christmas
                if (d.Month == 11 && d.Day is >= 24 and <= 28) seasonal = 1.4; // Thanksgiving
                if (d.Month == 7 && d.Day is >= 4 and <= 5)    seasonal = 1.35; // 4th of July

                foreach (var role in allRoles)
                {
                    var required    = requiredByRole.GetValueOrDefault(role, 1);
                    var sickRate    = sickByDow[dow] * seasonal;
                    var key         = (role, dow);

                    // Historical avg staffed on this DOW for this role
                    double histAvg = 0;
                    double shortageFreq = 0;
                    if (histByRoleDow.TryGetValue(key, out var counts) && counts.Count > 0)
                    {
                        histAvg     = counts.Average();
                        shortageFreq = counts.Count(c => c < required) / (double)counts.Count;
                    }

                    // Already-scheduled for this specific date/role
                    var scheduled = upcoming
                        .Where(a => a.StartUtc.Date == d && a.RoleId == role)
                        .Select(a => a.StaffId)
                        .Distinct()
                        .Count();

                    // Expected after sick call-offs
                    var effective   = scheduled * (1.0 - sickRate);
                    var histEffective = histAvg * (1.0 - sickRate);

                    // Probability of shortage
                    double probability;
                    if (scheduled > 0)
                    {
                        // Use scheduled data weighted with historical shortage frequency
                        var immediateRisk = Math.Max(0, 1.0 - effective / Math.Max(1, required));
                        probability = (immediateRisk * 0.6 + shortageFreq * 0.4) * seasonal;
                    }
                    else if (histAvg > 0)
                    {
                        // No schedule yet — rely on historical patterns
                        probability = (shortageFreq * 0.7 + 0.3 * (1 - histEffective / Math.Max(1, required))) * seasonal;
                    }
                    else
                    {
                        // No data at all
                        probability = 0.5 * seasonal;
                    }

                    probability = Math.Round(Math.Min(0.98, Math.Max(0, probability)), 2);

                    // Expected gap
                    var expectedGap = Math.Max(0, (int)Math.Ceiling(required - effective));

                    if (probability >= 0.50)
                    {
                        rawPredictions.Add(new RawPrediction(d, role, probability, required, scheduled, expectedGap, sickRate, shortageFreq, seasonal > 1.0));
                    }
                }
            }

            // ── 8. Group consecutive same-role days into shortage windows ─────
            var grouped = rawPredictions
                .OrderBy(p => p.Role)
                .ThenBy(p => p.Date)
                .ToList();

            var predictions = new List<StaffingPrediction>();
            var i2 = 0;
            while (i2 < grouped.Count)
            {
                var cur   = grouped[i2];
                var start = cur.Date;
                var end   = cur.Date;
                var maxP  = cur.Probability;
                var totalGap = cur.ExpectedGap;
                var count = 1;

                while (i2 + 1 < grouped.Count
                    && grouped[i2 + 1].Role == cur.Role
                    && (grouped[i2 + 1].Date - grouped[i2].Date).TotalDays <= 1)
                {
                    i2++;
                    end   = grouped[i2].Date;
                    maxP  = Math.Max(maxP, grouped[i2].Probability);
                    totalGap += grouped[i2].ExpectedGap;
                    count++;
                }

                var avgGap = (int)Math.Ceiling((double)totalGap / count);

                // Severity
                var severity = maxP switch
                {
                    >= 0.85 => "Critical",
                    >= 0.70 => "High",
                    >= 0.55 => "Medium",
                    _       => "Low",
                };

                // Build reason
                var reasonParts = new List<string>();
                if (cur.ShortageFreq > 0.3) reasonParts.Add($"{cur.ShortageFreq:P0} historical shortage rate on {start.DayOfWeek}s");
                if (cur.SickRate > 0.08)    reasonParts.Add($"{cur.SickRate:P0} projected sick call-off rate");
                if (cur.IsSeasonal)         reasonParts.Add("seasonal demand increase (holiday/flu period)");
                if (cur.Scheduled == 0)     reasonParts.Add("no staff scheduled yet");
                var reason = reasonParts.Count > 0 ? string.Join("; ", reasonParts) : "based on historical patterns";

                // Default recommendation
                var staffNeeded = Math.Max(1, avgGap);
                var recommendation = $"Add {staffNeeded} PRN {cur.Role}{(staffNeeded > 1 ? "s" : "")}";
                if (cur.Scheduled > 0 && avgGap > 0)
                    recommendation = $"Add {staffNeeded} PRN {cur.Role}{(staffNeeded > 1 ? "s" : "")} or post as open shift";
                if (severity == "Critical")
                    recommendation = $"Urgently recruit {staffNeeded + 1} agency/PRN {cur.Role}s and alert management";

                var shiftPattern = start.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday
                    ? "Weekend shift"
                    : "Weekday shift";

                predictions.Add(new StaffingPrediction(
                    Guid.NewGuid(),
                    cur.Role,
                    DateOnly.FromDateTime(start),
                    DateOnly.FromDateTime(end),
                    shiftPattern,
                    maxP,
                    severity,
                    recommendation,
                    reason,
                    null // aiInsight filled below
                ));

                i2++;
            }

            // Sort by probability descending
            predictions = predictions.OrderByDescending(p => p.Probability).ToList();

            // ── 9. Claude AI summary for top critical/high predictions ─────────
            var apiKey = anthropicOpts.Value.ApiKey;
            if (!string.IsNullOrWhiteSpace(apiKey) && predictions.Any(p => p.Severity is "Critical" or "High"))
            {
                var topItems = predictions.Where(p => p.Severity is "Critical" or "High").Take(5).ToList();
                var summaryList = string.Join("\n", topItems.Select(p =>
                    $"- {p.Role} shortage {p.StartDate:MMM d}–{p.EndDate:MMM d}: {p.Probability:P0} probability ({p.Severity}). Reason: {p.Reason}"));

                var prompt =
                    "You are a healthcare staffing expert. For each predicted shortage below, " +
                    "write a concise 1-sentence AI insight that explains the specific risk in plain English.\n" +
                    "Return ONLY a JSON array, no markdown. Each element:\n" +
                    "{\"id\": \"<index 0-based>\", \"insight\": \"<1 sentence>\"}\n\n" +
                    "Predicted shortages:\n" + summaryList;

                try
                {
                    var requestBody = new
                    {
                        model = "claude-sonnet-4-6",
                        max_tokens = 512,
                        messages = new[] { new { role = "user", content = prompt } }
                    };

                    var client = httpClientFactory.CreateClient("anthropic");
                    using var httpReq = new HttpRequestMessage(HttpMethod.Post, "/v1/messages");
                    httpReq.Headers.Add("x-api-key", apiKey);
                    httpReq.Content = new StringContent(
                        JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

                    var httpResp = await client.SendAsync(httpReq, ct);
                    if (httpResp.IsSuccessStatusCode)
                    {
                        var json = await httpResp.Content.ReadAsStringAsync(ct);
                        using var doc = JsonDocument.Parse(json);
                        var rawText = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "[]";
                        rawText = rawText.Trim();
                        if (rawText.StartsWith("```")) rawText = rawText[(rawText.IndexOf('\n') + 1)..];
                        if (rawText.EndsWith("```")) rawText = rawText[..rawText.LastIndexOf("```")];

                        var aiItems = JsonSerializer.Deserialize<List<AiPredictionInsight>>(rawText.Trim(),
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];

                        // Map insights back to top predictions
                        var topPredList = predictions.Where(p => p.Severity is "Critical" or "High").Take(5).ToList();
                        for (var k = 0; k < Math.Min(aiItems.Count, topPredList.Count); k++)
                        {
                            var idx = predictions.IndexOf(topPredList[k]);
                            if (idx >= 0 && !string.IsNullOrWhiteSpace(aiItems[k].Insight))
                                predictions[idx] = predictions[idx] with { AiInsight = aiItems[k].Insight };
                        }
                    }
                }
                catch
                {
                    // AI unavailable — continue without AI insights
                }
            }

            return Results.Ok(new StaffingPredictionResponse(
                predictions,
                DateOnly.FromDateTime(today),
                DateOnly.FromDateTime(forecastEnd.AddDays(-1))));
        }).RequireAuthorization("Authenticated");

        return v1;
    }
}

// ── Internal record for per-day prediction before grouping ───────────────────
file record RawPrediction(
    DateTime Date, string Role, double Probability, int Required,
    int Scheduled, int ExpectedGap, double SickRate, double ShortageFreq, bool IsSeasonal);

// ── API response contracts ────────────────────────────────────────────────────

public record StaffingPrediction(
    Guid   Id,
    string Role,
    DateOnly StartDate,
    DateOnly EndDate,
    string ShiftPattern,
    double Probability,
    string Severity,       // Low | Medium | High | Critical
    string Recommendation,
    string Reason,
    string? AiInsight
);

public record StaffingPredictionResponse(
    IEnumerable<StaffingPrediction> Predictions,
    DateOnly WindowStart,
    DateOnly WindowEnd
);

internal record AiPredictionInsight(string Id, string Insight);
