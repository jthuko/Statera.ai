using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Statera.Api.Authorization;
using Statera.Api.Integrations;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class BurnoutEndpoints
{
    public static RouteGroupBuilder MapBurnoutEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/facilities/{facilityId}/burnout").WithTags("Burnout")
            .AddEndpointFilter(async (ctx, next) =>
            {
                if (!TierEnforcement.CanAccessGrowthFeature(ctx.HttpContext))
                    return TierEnforcement.UpgradeRequired();
                return await next(ctx);
            });

        // GET /api/v1/facilities/{facilityId}/burnout
        // Returns per-staff burnout risk scores for the last 4 weeks.
        g.MapGet("/", async (
            Guid facilityId,
            [FromServices] AppDbContext db,
            [FromServices] IHttpClientFactory httpClientFactory,
            [FromServices] IOptions<AnthropicSettings> anthropicOpts,
            CancellationToken ct) =>
        {
            var windowEnd   = DateTime.UtcNow;
            var windowStart = windowEnd.AddDays(-28); // 4 weeks

            // ── Load data ─────────────────────────────────────────────────────
            var assignments = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == facilityId
                         && a.StartUtc >= windowStart
                         && a.StartUtc <= windowEnd)
                .Select(a => new { a.StaffId, a.StartUtc, a.EndUtc })
                .ToListAsync(ct);

            var staffIds = assignments.Select(a => a.StaffId).Distinct().ToList();

            var staffList = await db.Staff
                .AsNoTracking()
                .Where(s => s.FacilityId == facilityId && s.Active)
                .Select(s => new { s.Id, s.FirstName, s.LastName, s.Role })
                .ToListAsync(ct);

            // Sick call-offs: Approved time-off requests of Type "Sick" in last 4 weeks
            var sickCalloffs = await db.TimeOffRequests
                .AsNoTracking()
                .Where(r => r.Staff != null
                         && r.Staff.FacilityId == facilityId
                         && r.Status == "Approved"
                         && (r.Type == "Sick" || r.Type == "sick")
                         && r.StartUtc >= windowStart
                         && r.StartUtc <= windowEnd)
                .GroupBy(r => r.StaffId)
                .Select(g => new { StaffId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.StaffId, x => x.Count, ct);

            // ── Score each staff member ───────────────────────────────────────
            var assignmentsByStaff = assignments.GroupBy(a => a.StaffId)
                .ToDictionary(g => g.Key, g => g.OrderBy(a => a.StartUtc).ToList());

            var results = new List<BurnoutStaffResult>();

            foreach (var staff in staffList)
            {
                var shifts = assignmentsByStaff.GetValueOrDefault(staff.Id, []);

                // Metric 1: Total hours in last 4 weeks
                var totalHours = shifts.Sum(a => (a.EndUtc - a.StartUtc).TotalHours);

                // Metric 2: Weekly overtime (hours over 40 per week)
                var overtimeHours = 0.0;
                for (var wk = 0; wk < 4; wk++)
                {
                    var wkStart = windowEnd.AddDays(-28 + wk * 7);
                    var wkEnd   = wkStart.AddDays(7);
                    var wkHours = shifts
                        .Where(a => a.StartUtc >= wkStart && a.StartUtc < wkEnd)
                        .Sum(a => (a.EndUtc - a.StartUtc).TotalHours);
                    if (wkHours > 40) overtimeHours += wkHours - 40;
                }

                // Metric 3: Maximum consecutive days worked
                var workDays = shifts
                    .Select(a => DateOnly.FromDateTime(a.StartUtc))
                    .Distinct()
                    .OrderBy(d => d)
                    .ToList();

                var maxConsecutive = workDays.Count > 0 ? 1 : 0;
                var streak = 1;
                for (var i = 1; i < workDays.Count; i++)
                {
                    if (workDays[i].DayNumber - workDays[i - 1].DayNumber == 1)
                        streak++;
                    else
                        streak = 1;
                    maxConsecutive = Math.Max(maxConsecutive, streak);
                }

                // Metric 4: Short rest violations (< 10 hours between consecutive shifts)
                var restViolations = 0;
                for (var i = 1; i < shifts.Count; i++)
                {
                    var restHours = (shifts[i].StartUtc - shifts[i - 1].EndUtc).TotalHours;
                    if (restHours >= 0 && restHours < 10)
                        restViolations++;
                }

                // Metric 5: Sick call-offs
                var sickCount = sickCalloffs.GetValueOrDefault(staff.Id, 0);

                // ── Rule-based risk score 0–100 ───────────────────────────────
                var score = 0.0;

                // Consecutive days: 7+ = +35, 5-6 = +20, 4 = +10
                if (maxConsecutive >= 7)      score += 35;
                else if (maxConsecutive >= 5) score += 20;
                else if (maxConsecutive >= 4) score += 10;

                // Overtime hours: +2 per hour over 40/week (cap +30)
                score += Math.Min(30, overtimeHours * 2);

                // Rest violations: +10 each (cap +20)
                score += Math.Min(20, restViolations * 10);

                // Sick call-offs: +15 each (cap +15)
                score += Math.Min(15, sickCount * 15);

                // Total hours: extra weight if > 160h in 4 weeks (equiv. > 40h/wk)
                if (totalHours > 160) score += Math.Min(10, (totalHours - 160) / 8);

                score = Math.Min(100, Math.Round(score, 1));

                var riskLevel = score switch
                {
                    >= 75 => "Critical",
                    >= 50 => "High",
                    >= 25 => "Medium",
                    _     => "Low"
                };

                results.Add(new BurnoutStaffResult(
                    staff.Id,
                    $"{staff.FirstName} {staff.LastName}",
                    staff.Role,
                    score,
                    riskLevel,
                    Math.Round(totalHours, 1),
                    Math.Round(overtimeHours, 1),
                    maxConsecutive,
                    restViolations,
                    sickCount,
                    null,   // aiInsight filled below for High/Critical
                    null    // suggestions filled below
                ));
            }

            // Sort by risk score descending
            results = results.OrderByDescending(r => r.RiskScore).ToList();

            // ── Claude API: narrative insight for High/Critical staff ─────────
            var apiKey = anthropicOpts.Value.ApiKey;
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                var atRisk = results.Where(r => r.RiskLevel is "High" or "Critical").ToList();
                if (atRisk.Count > 0)
                {
                    var staffSummary = string.Join("\n", atRisk.Select(r =>
                        $"- {r.StaffName} ({r.Role}): {r.RiskScore}% risk, " +
                        $"{r.TotalHours}h total, {r.OvertimeHours}h overtime, " +
                        $"{r.ConsecutiveDays} consecutive days, " +
                        $"{r.RestViolations} short rest violations, " +
                        $"{r.SickCalloffs} sick call-offs"));

                    var prompt =
                        "You are a healthcare staffing expert focused on nurse burnout prevention.\n" +
                        "For each staff member below provide:\n" +
                        "1. A 1-2 sentence personalized warning explaining their specific burnout risk\n" +
                        "2. 2-3 concrete actionable suggestions (e.g., schedule recovery day, redistribute shifts, cap overtime)\n\n" +
                        "Return ONLY a JSON array, no markdown, no extra text. Each element:\n" +
                        "{\"staffId\": \"<guid>\", \"insight\": \"<1-2 sentences>\", \"suggestions\": [\"<action1>\", \"<action2>\"]}\n\n" +
                        "Staff at risk:\n" + staffSummary + "\n\n" +
                        "Staff IDs for reference:\n" +
                        string.Join("\n", atRisk.Select(r => $"- {r.StaffName}: {r.StaffId}"));

                    try
                    {
                        var requestBody = new
                        {
                            model = "claude-sonnet-4-6",
                            max_tokens = 1024,
                            messages = new[] { new { role = "user", content = prompt } }
                        };

                        var client = httpClientFactory.CreateClient("anthropic");
                        using var httpReq = new HttpRequestMessage(HttpMethod.Post, "/v1/messages");
                        httpReq.Headers.Add("x-api-key", apiKey);
                        httpReq.Content = new StringContent(
                            JsonSerializer.Serialize(requestBody),
                            Encoding.UTF8,
                            "application/json");

                        var httpResp = await client.SendAsync(httpReq, ct);
                        if (httpResp.IsSuccessStatusCode)
                        {
                            var responseJson = await httpResp.Content.ReadAsStringAsync(ct);
                            using var doc = JsonDocument.Parse(responseJson);
                            var rawText = doc.RootElement
                                .GetProperty("content")[0]
                                .GetProperty("text")
                                .GetString() ?? "[]";

                            rawText = rawText.Trim();
                            if (rawText.StartsWith("```")) rawText = rawText[(rawText.IndexOf('\n') + 1)..];
                            if (rawText.EndsWith("```")) rawText = rawText[..rawText.LastIndexOf("```")];
                            rawText = rawText.Trim();

                            var aiItems = JsonSerializer.Deserialize<List<AiBurnoutItem>>(rawText,
                                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];

                            // Merge AI insights back into results
                            var aiByStaffId = aiItems.ToDictionary(i => i.StaffId);
                            results = results.Select(r =>
                            {
                                if (aiByStaffId.TryGetValue(r.StaffId.ToString(), out var ai))
                                    return r with { AiInsight = ai.Insight, Suggestions = ai.Suggestions };
                                return r;
                            }).ToList();
                        }
                    }
                    catch
                    {
                        // Claude unavailable — continue without AI insights
                    }
                }
            }

            // Fallback rule-based suggestions for all High/Critical still without suggestions
            results = results.Select(r =>
            {
                if (r.Suggestions is not null) return r;
                if (r.RiskLevel is not ("High" or "Critical")) return r;

                var suggs = new List<string>();
                if (r.ConsecutiveDays >= 5) suggs.Add("Schedule a mandatory recovery day after this stretch.");
                if (r.OvertimeHours > 0)   suggs.Add("Cap overtime — do not assign additional shifts this week.");
                if (r.RestViolations > 0)  suggs.Add("Ensure minimum 10-hour rest between shifts going forward.");
                if (r.SickCalloffs > 0)    suggs.Add("Check in with this staff member — frequent sick days may indicate burnout.");
                if (suggs.Count == 0)      suggs.Add("Review scheduling load and consider redistributing shifts.");

                return r with { Suggestions = suggs };
            }).ToList();

            return Results.Ok(new BurnoutDashboardResponse(results, windowStart, windowEnd));
        }).RequireAuthorization("Authenticated");

        return v1;
    }
}

// ── Contracts ────────────────────────────────────────────────────────────────

public record BurnoutStaffResult(
    Guid   StaffId,
    string StaffName,
    string Role,
    double RiskScore,
    string RiskLevel,        // Low | Medium | High | Critical
    double TotalHours,
    double OvertimeHours,
    int    ConsecutiveDays,
    int    RestViolations,
    int    SickCalloffs,
    string? AiInsight,
    IEnumerable<string>? Suggestions
);

public record BurnoutDashboardResponse(
    IEnumerable<BurnoutStaffResult> Staff,
    DateTime WindowStart,
    DateTime WindowEnd
);

internal record AiBurnoutItem(string StaffId, string Insight, List<string> Suggestions);
