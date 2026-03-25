using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Statera.Api.Authorization;
using Statera.Api.Integrations;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class SimulationEndpoints
{
    public static RouteGroupBuilder MapSimulationEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/facilities/{facilityId}/simulate").WithTags("Simulation")
            .AddEndpointFilter(async (ctx, next) =>
            {
                if (!TierEnforcement.CanAccessScaleFeature(ctx.HttpContext))
                    return TierEnforcement.UpgradeRequiredScale();
                return await next(ctx);
            });

        // POST /api/v1/facilities/{facilityId}/simulate
        // Runs one of 3 heuristic scenario simulations, then calls Claude for a narrative.
        g.MapPost("/", async (
            Guid facilityId,
            [FromBody] SimulationRequest req,
            [FromServices] AppDbContext db,
            [FromServices] IHttpClientFactory httpClientFactory,
            [FromServices] IOptions<AnthropicSettings> anthropicOpts,
            CancellationToken ct) =>
        {
            var result = req.Type switch
            {
                "ShortStaffed"      => await RunShortStaffedAsync(facilityId, req, db, httpClientFactory, anthropicOpts, ct),
                "CallOff"           => await RunCallOffAsync(facilityId, req, db, httpClientFactory, anthropicOpts, ct),
                "OvertimeReduction" => await RunOvertimeReductionAsync(facilityId, req, db, httpClientFactory, anthropicOpts, ct),
                _ => null
            };

            return result is null
                ? Results.BadRequest(new { error = "Unknown simulation type. Valid: ShortStaffed, CallOff, OvertimeReduction" })
                : Results.Ok(result);
        }).RequireAuthorization("Authenticated");

        return v1;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    static string? CallClaude(IHttpClientFactory http, AnthropicSettings ai, string prompt, CancellationToken ct)
        => null; // placeholder — actual call is inline below for async context

    static async Task<string?> GetAiNarrativeAsync(
        IHttpClientFactory http, AnthropicSettings ai, string prompt, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ai.ApiKey)) return null;
        try
        {
            var body = new
            {
                model = "claude-sonnet-4-6",
                max_tokens = 350,
                messages = new[] { new { role = "user", content = prompt } }
            };
            var client = http.CreateClient("anthropic");
            using var req = new HttpRequestMessage(HttpMethod.Post, "/v1/messages");
            req.Headers.Add("x-api-key", ai.ApiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString();
        }
        catch { return null; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. SHORT-STAFFED SIMULATION
    // "Med Surg is short 2 CNAs on night shift"
    // ─────────────────────────────────────────────────────────────────────────
    static async Task<SimulationResult> RunShortStaffedAsync(
        Guid facilityId, SimulationRequest req, AppDbContext db,
        IHttpClientFactory http, IOptions<AnthropicSettings> ai, CancellationToken ct)
    {
        var simDateOnly = req.SimDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var dayStart    = new DateTime(simDateOnly.Year, simDateOnly.Month, simDateOnly.Day, 0, 0, 0, DateTimeKind.Utc);
        var dayEnd      = dayStart.AddDays(1);
        var weekAgo     = dayStart.AddDays(-7);

        var role    = req.Role ?? "";
        var missing = Math.Max(1, req.MissingCount ?? 1);
        var unitId  = req.UnitId;

        // ── Load data ─────────────────────────────────────────────────────────
        var allRoleStaff = await db.Staff
            .AsNoTracking()
            .Where(s => s.FacilityId == facilityId && s.Active && s.Role == role)
            .Select(s => new { s.Id, s.FirstName, s.LastName, s.UnitId })
            .ToListAsync(ct);

        // Staff scheduled anywhere on simDate
        var dayAssignments = await db.Assignments
            .AsNoTracking()
            .Where(a => a.FacilityId == facilityId && a.StartUtc >= dayStart && a.StartUtc < dayEnd)
            .Select(a => new { a.StaffId, a.UnitId })
            .ToListAsync(ct);

        var scheduledIds = dayAssignments.Select(a => a.StaffId).ToHashSet();

        // Time-off on simDate — explicit JOIN to avoid untranslatable navigation property expression
        var timeOffIds = await db.TimeOffRequests
            .AsNoTracking()
            .Join(db.Staff.Where(s => s.FacilityId == facilityId),
                  r => r.StaffId, s => s.Id, (r, s) => r)
            .Where(r => r.Status == "Approved"
                     && r.StartUtc < dayEnd
                     && r.EndUtc > dayStart)
            .Select(r => r.StaffId)
            .ToListAsync(ct);

        var unavailableIds = scheduledIds.Concat(timeOffIds).ToHashSet();

        // Recent hours per staff (last 7 days) for fatigue scoring
        var recentAssignments = await db.Assignments
            .AsNoTracking()
            .Where(a => a.FacilityId == facilityId && a.StartUtc >= weekAgo && a.StartUtc < dayStart)
            .Select(a => new { a.StaffId, a.StartUtc, a.EndUtc })
            .ToListAsync(ct);

        var recentHours = recentAssignments
            .GroupBy(a => a.StaffId)
            .ToDictionary(g => g.Key, g => g.Sum(a => (a.EndUtc - a.StartUtc).TotalHours));

        // Historical shortage count (last 12 weeks, same unit/role)
        var histStart = dayStart.AddDays(-84);
        var historicalShortages = 0;
        if (unitId.HasValue)
        {
            var histByDate = await db.Assignments
                .AsNoTracking()
                .Where(a => a.FacilityId == facilityId
                         && a.UnitId == unitId.Value
                         && a.StartUtc >= histStart
                         && a.StartUtc < dayStart)
                .Select(a => new { a.StaffId, a.StartUtc })
                .ToListAsync(ct);

            historicalShortages = histByDate
                .GroupBy(a => a.StartUtc.Date)
                .Count(g => g.Select(a => a.StaffId).Distinct().Count() < (missing + 2));
        }

        // ── Classify staff into action pools ─────────────────────────────────

        // Float: same role, different unit, not scheduled, not on time-off
        var floatCandidates = allRoleStaff
            .Where(s => !unavailableIds.Contains(s.Id) && s.UnitId != unitId)
            .OrderBy(s => recentHours.GetValueOrDefault(s.Id, 0)) // least fatigued first
            .Take(missing)
            .ToList();

        // Incentive pool: any qualified staff not scheduled
        var incentivePool = allRoleStaff
            .Where(s => !unavailableIds.Contains(s.Id))
            .ToList();

        // OT candidates: already on unit, below 40h, could extend
        var otCandidates = allRoleStaff
            .Where(s => scheduledIds.Contains(s.Id) && recentHours.GetValueOrDefault(s.Id, 0) < 40)
            .Take(missing)
            .ToList();

        // ── Build options ─────────────────────────────────────────────────────
        var options = new List<SimulationOption>();

        if (floatCandidates.Count > 0)
        {
            var names = string.Join(", ", floatCandidates.Select(s => $"{s.FirstName} {s.LastName}"));
            options.Add(new SimulationOption(
                "Float Internal Staff",
                $"Move {floatCandidates.Count} qualified {role}(s) from other units: {names}. Zero additional cost — shift coverage preserved.",
                "Best",
                EstimatedCost: 0,
                OvertimeRisk: floatCandidates.Any(s => recentHours.GetValueOrDefault(s.Id, 0) > 32) ? "Medium" : "Low",
                FillLikelihood: 0.88,
                CoverageScore: floatCandidates.Count >= missing ? 90 : 75
            ));
        }

        if (incentivePool.Count > 0)
        {
            var bonus = missing * 150;
            options.Add(new SimulationOption(
                "Post Incentive Open Shift",
                $"Offer a ${150} shift bonus to {Math.Min(missing, incentivePool.Count)} qualified {role}(s) from the available pool. Post immediately for fastest fill.",
                "Alternative",
                EstimatedCost: bonus,
                OvertimeRisk: "Low",
                FillLikelihood: 0.70,
                CoverageScore: 80
            ));
        }

        if (otCandidates.Count > 0)
        {
            var names = string.Join(", ", otCandidates.Select(s => $"{s.FirstName} {s.LastName}"));
            var otCost = missing * 8 * 45 * 1.5;
            options.Add(new SimulationOption(
                "Approve Overtime",
                $"Extend shift for lowest-OT-risk staff: {names}. They are below 40h this week — safest OT candidates.",
                "Cheapest (short term)",
                EstimatedCost: otCost,
                OvertimeRisk: "Medium",
                FillLikelihood: 0.94,
                CoverageScore: 85
            ));
        }

        if (missing > 1 && incentivePool.Count > 0)
        {
            options.Add(new SimulationOption(
                "Split Coverage — Redistribute Load",
                $"Redistribute patient assignments across neighboring units for the critical hours. Float 1 {role} for most urgent window only.",
                "Safest",
                EstimatedCost: 0,
                OvertimeRisk: "Low",
                FillLikelihood: 0.78,
                CoverageScore: 70
            ));
        }

        options.Add(new SimulationOption(
            "Agency Staff",
            $"Request {missing} agency {role}(s) as last resort. Highest cost, lowest continuity of care — only if internal options exhausted.",
            "Last Resort",
            EstimatedCost: missing * 12 * 80,
            OvertimeRisk: "None",
            FillLikelihood: 0.60,
            CoverageScore: 62
        ));

        // ── Metrics ───────────────────────────────────────────────────────────
        var coverageScore = floatCandidates.Count >= missing ? 90 :
                            otCandidates.Count >= missing    ? 80 :
                            incentivePool.Count > 0          ? 70 : 50;

        var safetyAlert = missing >= 3
            ? "Patient safety threshold may be breached — escalate to supervisor immediately."
            : null;

        var historicalContext = historicalShortages > 0
            ? $"This unit has experienced {historicalShortages} similar shortage(s) in the past 12 weeks. The most effective response has been floating internal staff within the first 2 hours."
            : "No similar shortage pattern detected for this unit in the past 12 weeks.";

        // ── AI Narrative ──────────────────────────────────────────────────────
        var optSummary = string.Join("\n", options.Select(o =>
            $"- {o.Label} ({o.Tag}): fill {o.FillLikelihood:P0}, cost ${o.EstimatedCost:N0}, coverage {o.CoverageScore}/100"));

        var aiPrompt =
            $"You are a healthcare staffing operations expert.\n" +
            $"Scenario: A {role} unit is short {missing} staff on {simDateOnly:MMMM d, yyyy}.\n" +
            $"Historical context: {historicalContext}\n\n" +
            $"Available options:\n{optSummary}\n\n" +
            $"In 2-3 sentences, recommend the best course of action, explain why, and flag any patient safety concerns. " +
            $"Be direct — this is for a charge nurse or staffing coordinator making a real-time decision.";

        var aiNarrative = await GetAiNarrativeAsync(http, ai.Value, aiPrompt, ct);

        return new SimulationResult(
            Type: "ShortStaffed",
            Title: $"Short-Staffed Simulation — {role} on {simDateOnly:MMM d}",
            Summary: $"{missing} unfilled {role} shift(s) on {simDateOnly:MMMM d}. {options.Count} response option(s) identified.",
            Options: options,
            Metrics: new SimulationMetrics(
                CoverageScore: coverageScore,
                EstimatedCost: options.FirstOrDefault(o => o.Tag == "Best")?.EstimatedCost ?? 0,
                OvertimeImpact: otCandidates.Count > 0 ? $"{otCandidates.Count} staff eligible for OT extension" : "No scheduled OT candidates found",
                FatigueRisk: recentHours.Values.Any(h => h > 36) ? "High" : "Low",
                FillLikelihood: floatCandidates.Count >= missing ? 0.88 : incentivePool.Count > 0 ? 0.70 : 0.55,
                SafetyAlert: safetyAlert
            ),
            HistoricalContext: historicalContext,
            AiNarrative: aiNarrative
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CALL-OFF SIMULATION
    // "What if 2 nurses call off tonight?"
    // ─────────────────────────────────────────────────────────────────────────
    static async Task<SimulationResult> RunCallOffAsync(
        Guid facilityId, SimulationRequest req, AppDbContext db,
        IHttpClientFactory http, IOptions<AnthropicSettings> ai, CancellationToken ct)
    {
        var simDateOnly = req.SimDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var dayStart    = new DateTime(simDateOnly.Year, simDateOnly.Month, simDateOnly.Day, 0, 0, 0, DateTimeKind.Utc);
        var dayEnd      = dayStart.AddDays(1);
        var histStart   = dayStart.AddDays(-84);
        var dow         = (int)simDateOnly.DayOfWeek;

        var role     = req.Role ?? "";
        var callOffs = Math.Max(1, req.MissingCount ?? 1);
        var unitId   = req.UnitId;

        // ── Load data ─────────────────────────────────────────────────────────

        // Scheduled staff for the target date
        var scheduledQuery = db.Assignments
            .AsNoTracking()
            .Where(a => a.FacilityId == facilityId && a.StartUtc >= dayStart && a.StartUtc < dayEnd);
        if (unitId.HasValue)
            scheduledQuery = scheduledQuery.Where(a => a.UnitId == unitId.Value);

        var scheduled = await scheduledQuery
            .Select(a => new { a.StaffId, a.UnitId })
            .ToListAsync(ct);

        var scheduledCount = scheduled.Select(s => s.StaffId).Distinct().Count();
        var scheduledIds   = scheduled.Select(s => s.StaffId).ToHashSet();

        // All qualified backup staff (same role, not already scheduled)
        var backupStaff = await db.Staff
            .AsNoTracking()
            .Where(s => s.FacilityId == facilityId && s.Active && s.Role == role && !scheduledIds.Contains(s.Id))
            .Select(s => new { s.Id, s.FirstName, s.LastName, s.UnitId })
            .ToListAsync(ct);

        // Historical sick call-offs — explicit JOIN + client-side filter for DayOfWeek/Type OR
        var histSickCount = (await db.TimeOffRequests
            .AsNoTracking()
            .Join(db.Staff.Where(s => s.FacilityId == facilityId),
                  r => r.StaffId, s => s.Id, (r, s) => r)
            .Where(r => r.Status == "Approved"
                     && r.StartUtc >= histStart
                     && r.StartUtc < dayStart)
            .Select(r => new { r.Type, r.StartUtc })
            .ToListAsync(ct))
            .Count(r => (r.Type == "Sick" || r.Type == "sick")
                     && (int)r.StartUtc.DayOfWeek == dow);

        // Units scheduled for that day (to identify exposure)
        var allUnitsScheduled = await db.Assignments
            .AsNoTracking()
            .Where(a => a.FacilityId == facilityId && a.StartUtc >= dayStart && a.StartUtc < dayEnd)
            .GroupBy(a => a.UnitId)
            .Select(g => new { UnitId = g.Key, Count = g.Select(a => a.StaffId).Distinct().Count() })
            .ToListAsync(ct);

        var unitNames = await db.Units
            .AsNoTracking()
            .Where(u => u.FacilityId == facilityId && u.IsActive)
            .ToDictionaryAsync(u => u.Id, u => u.Name, ct);

        var exposedUnits = allUnitsScheduled
            .Where(u => u.Count - callOffs < 1)
            .Select(u => u.UnitId.HasValue && unitNames.TryGetValue(u.UnitId.Value, out var n) ? n : u.UnitId?.ToString() ?? "Unknown")
            .ToList();

        // ── Build options ─────────────────────────────────────────────────────
        var options = new List<SimulationOption>();

        if (backupStaff.Count > 0)
        {
            var names = string.Join(", ", backupStaff.Take(callOffs).Select(s => $"{s.FirstName} {s.LastName}"));
            options.Add(new SimulationOption(
                "Activate Backup Staff",
                $"Contact {Math.Min(callOffs, backupStaff.Count)} available {role}(s) from the backup pool: {names}.",
                "Best",
                EstimatedCost: 0,
                OvertimeRisk: "Low",
                FillLikelihood: 0.82,
                CoverageScore: backupStaff.Count >= callOffs ? 88 : 72
            ));
        }

        options.Add(new SimulationOption(
            "Float Pool Activation",
            $"Stage float pool {role}(s) for the affected unit. Post as priority open shift with incentive — target fill within 2 hours.",
            "Alternative",
            EstimatedCost: callOffs * 75,
            OvertimeRisk: "Low",
            FillLikelihood: 0.73,
            CoverageScore: 78
        ));

        if (scheduledCount - callOffs > 0)
        {
            options.Add(new SimulationOption(
                "Redistribute Patient Load",
                $"Assign patients across remaining {scheduledCount - callOffs} staff. Requires charge nurse acuity reassessment. Acceptable for short windows only.",
                "Safest",
                EstimatedCost: 0,
                OvertimeRisk: "Medium",
                FillLikelihood: 1.0,
                CoverageScore: scheduledCount - callOffs >= 2 ? 68 : 45
            ));
        }

        options.Add(new SimulationOption(
            "On-Call Activation",
            $"Activate on-call {role}(s) if the facility maintains an on-call roster. Fastest fill with no agency premium.",
            "Cheapest",
            EstimatedCost: callOffs * 8 * 48,
            OvertimeRisk: "Low",
            FillLikelihood: 0.65,
            CoverageScore: 80
        ));

        options.Add(new SimulationOption(
            "Emergency Agency Fill",
            $"Request {callOffs} agency {role}(s) for emergency cover. High cost — use only if all internal options exhausted.",
            "Last Resort",
            EstimatedCost: callOffs * 12 * 85,
            OvertimeRisk: "None",
            FillLikelihood: 0.58,
            CoverageScore: 63
        ));

        // ── Metrics ───────────────────────────────────────────────────────────
        var coverageScore = backupStaff.Count >= callOffs ? 85 :
                            scheduledCount - callOffs >= 2 ? 65 : 40;

        var safetyAlert = callOffs >= scheduledCount
            ? "All scheduled staff may be absent — supervisor escalation required immediately."
            : callOffs > scheduledCount / 2
                ? "Over 50% of scheduled staff absent — patient safety risk. Escalate to charge nurse."
                : null;

        var historicalContext = histSickCount > 0
            ? $"This role has logged {histSickCount} sick call-off(s) on {simDateOnly.DayOfWeek}s over the last 12 weeks. Consider proactive on-call staging on future {simDateOnly.DayOfWeek}s."
            : $"No significant call-off pattern detected for {role}s on {simDateOnly.DayOfWeek}s historically.";

        var exposedText = exposedUnits.Count > 0
            ? $"Exposed units: {string.Join(", ", exposedUnits)}."
            : "No units fully depleted.";

        // ── AI Narrative ──────────────────────────────────────────────────────
        var aiPrompt =
            $"You are a healthcare staffing operations expert.\n" +
            $"Scenario: {callOffs} {role}(s) call off on {simDateOnly:MMMM d, yyyy}. " +
            $"{scheduledCount} staff originally scheduled. {backupStaff.Count} backup available. {exposedText}\n" +
            $"Historical context: {historicalContext}\n\n" +
            $"In 2-3 sentences, give a direct operational recommendation for the staffing coordinator. " +
            $"Include the fastest path to coverage and any safety escalation needed.";

        var aiNarrative = await GetAiNarrativeAsync(http, ai.Value, aiPrompt, ct);

        return new SimulationResult(
            Type: "CallOff",
            Title: $"Call-Off Simulation — {role} on {simDateOnly:MMM d}",
            Summary: $"{callOffs} {role} call-off(s) simulated on {simDateOnly:MMMM d}. {scheduledCount} originally scheduled, {backupStaff.Count} backup available.",
            Options: options,
            Metrics: new SimulationMetrics(
                CoverageScore: coverageScore,
                EstimatedCost: backupStaff.Count >= callOffs ? 0 : callOffs * 75,
                OvertimeImpact: scheduledCount - callOffs > 0 ? $"Remaining {scheduledCount - callOffs} staff may absorb load — watch for fatigue" : "Critical — insufficient remaining coverage",
                FatigueRisk: callOffs >= 2 ? "High" : "Medium",
                FillLikelihood: backupStaff.Count >= callOffs ? 0.82 : 0.60,
                SafetyAlert: safetyAlert
            ),
            HistoricalContext: historicalContext,
            AiNarrative: aiNarrative
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. OVERTIME REDUCTION SIMULATION
    // "What if we cap all staff at 8 overtime hours this week?"
    // ─────────────────────────────────────────────────────────────────────────
    static async Task<SimulationResult> RunOvertimeReductionAsync(
        Guid facilityId, SimulationRequest req, AppDbContext db,
        IHttpClientFactory http, IOptions<AnthropicSettings> ai, CancellationToken ct)
    {
        var maxOtHours  = req.MaxOtHours  ?? 8.0;
        var windowDays  = req.WindowDays  ?? 7;
        var windowStart = DateTime.UtcNow.Date;
        var windowEnd   = windowStart.AddDays(windowDays);

        // Pro-rated standard hours for the window
        var standardHours = 40.0 * windowDays / 7.0;

        // ── Load data ─────────────────────────────────────────────────────────
        var assignments = await db.Assignments
            .AsNoTracking()
            .Where(a => a.FacilityId == facilityId
                     && a.StartUtc >= windowStart
                     && a.StartUtc < windowEnd)
            .Select(a => new { a.StaffId, a.UnitId, a.StartUtc, a.EndUtc })
            .ToListAsync(ct);

        var staffList = await db.Staff
            .AsNoTracking()
            .Where(s => s.FacilityId == facilityId && s.Active)
            .Select(s => new { s.Id, s.FirstName, s.LastName, s.Role, s.UnitId })
            .ToListAsync(ct);

        var staffMap = staffList.ToDictionary(s => s.Id);

        var unitNames = await db.Units
            .AsNoTracking()
            .Where(u => u.FacilityId == facilityId)
            .ToDictionaryAsync(u => u.Id, u => u.Name, ct);

        // Hours per staff in window
        var hoursByStaff = assignments
            .GroupBy(a => a.StaffId)
            .ToDictionary(g => g.Key, g => g.Sum(a => (a.EndUtc - a.StartUtc).TotalHours));

        // Identify OT staff (above standard + cap)
        var overtimeStaff = hoursByStaff
            .Where(kvp => kvp.Value > standardHours + maxOtHours)
            .Select(kvp =>
            {
                staffMap.TryGetValue(kvp.Key, out var s);
                var unitName = s?.UnitId.HasValue == true && unitNames.TryGetValue(s.UnitId.Value, out var un) ? un : "Unassigned";
                return new
                {
                    StaffId    = kvp.Key,
                    Name       = s != null ? $"{s.FirstName} {s.LastName}" : "Unknown",
                    Role       = s?.Role ?? "",
                    Unit       = unitName,
                    TotalHours = kvp.Value,
                    ExcessHours = kvp.Value - standardHours
                };
            })
            .OrderByDescending(s => s.ExcessHours)
            .ToList();

        // Identify staff under 32h (could absorb redistributed shifts)
        var lowHourStaff = hoursByStaff
            .Where(kvp => kvp.Value < 32)
            .Select(kvp => staffMap.TryGetValue(kvp.Key, out var s) ? $"{s.FirstName} {s.LastName}" : "Unknown")
            .Take(5)
            .ToList();

        // Coverage gap: units where OT staff represent ≥ 50% of assigned headcount
        var staffedByUnit = assignments
            .GroupBy(a => a.UnitId)
            .Where(g => g.Key.HasValue)
            .ToDictionary(g => g.Key!.Value, g => g.Select(a => a.StaffId).Distinct().ToHashSet());

        var otStaffIds = overtimeStaff.Select(o => o.StaffId).ToHashSet();

        var coverageGaps = staffedByUnit
            .Where(kvp =>
            {
                var total = kvp.Value.Count;
                var otInUnit = kvp.Value.Count(sid => otStaffIds.Contains(sid));
                return total > 0 && (double)otInUnit / total >= 0.5;
            })
            .Select(kvp => unitNames.TryGetValue(kvp.Key, out var un) ? un : kvp.Key.ToString())
            .ToList();

        // Financial estimates ($45/hr base, 1.5x OT multiplier)
        const double baseRate  = 45.0;
        const double otMult    = 1.5;
        var currentOtCost      = overtimeStaff.Sum(s => s.ExcessHours * baseRate * otMult);
        var potentialSavings   = overtimeStaff.Sum(s => Math.Max(0, s.ExcessHours - maxOtHours) * baseRate * (otMult - 1.0));

        // ── Build options ─────────────────────────────────────────────────────
        var options = new List<SimulationOption>();

        options.Add(new SimulationOption(
            $"Hard Cap at {maxOtHours}h OT",
            $"Enforce strict {maxOtHours}h OT cap for {overtimeStaff.Count} staff this period. " +
            $"Estimated savings: ${potentialSavings:N0}. {coverageGaps.Count} unit(s) may need backfill.",
            "Cheapest",
            EstimatedCost: -potentialSavings,
            OvertimeRisk: "Eliminated",
            FillLikelihood: coverageGaps.Count == 0 ? 0.92 : 0.65,
            CoverageScore: coverageGaps.Count == 0 ? 90 : 60
        ));

        options.Add(new SimulationOption(
            "PRN / Part-Time Staff First Policy",
            "Before approving OT, require managers to offer shifts to PRN and part-time staff. " +
            $"Reduces OT cost by ~60% (${potentialSavings * 0.6:N0} saved) while maintaining coverage integrity.",
            "Best",
            EstimatedCost: -(potentialSavings * 0.6),
            OvertimeRisk: "Low",
            FillLikelihood: 0.80,
            CoverageScore: 83
        ));

        if (lowHourStaff.Count > 0)
        {
            options.Add(new SimulationOption(
                "Redistribute to Low-Hour Staff",
                $"Shift excess hours from heavy hitters to staff under 32h/week: {string.Join(", ", lowHourStaff)}. " +
                "Maintains full coverage at standard pay rates — best for team equity.",
                "Safest",
                EstimatedCost: 0,
                OvertimeRisk: "None",
                FillLikelihood: 0.76,
                CoverageScore: 87
            ));
        }

        options.Add(new SimulationOption(
            "Phased Cap — Reduce by 50% First",
            $"Immediately cap at {maxOtHours * 2:F0}h OT, then reduce to {maxOtHours:F0}h over 2 weeks. " +
            "Gives staff time to adjust and managers time to build backup coverage. Saves ~${potentialSavings * 0.4:N0} in period 1.",
            "Alternative",
            EstimatedCost: -(potentialSavings * 0.4),
            OvertimeRisk: "Medium",
            FillLikelihood: 0.85,
            CoverageScore: 80
        ));

        // ── Metrics ───────────────────────────────────────────────────────────
        var coverageScore = coverageGaps.Count == 0 ? 90 :
                            coverageGaps.Count <= 2 ? 72 : 55;

        var safetyAlert = coverageGaps.Count >= 3
            ? $"Critical: {coverageGaps.Count} units lose ≥50% coverage if OT hard-capped: {string.Join(", ", coverageGaps.Take(3))}."
            : null;

        var topOtNames = string.Join("; ", overtimeStaff.Take(4).Select(s => $"{s.Name} ({s.ExcessHours:F0}h excess)"));
        var historicalContext = overtimeStaff.Count > 0
            ? $"Top OT staff over next {windowDays} days: {topOtNames}. Total excess: {overtimeStaff.Sum(s => s.ExcessHours):F0}h. Current estimated OT cost: ${currentOtCost:N0}."
            : $"No staff are projected to exceed the {maxOtHours}h OT cap in the next {windowDays} days — no action needed.";

        // ── AI Narrative ──────────────────────────────────────────────────────
        var aiPrompt = overtimeStaff.Count > 0
            ? $"You are a healthcare workforce cost analyst.\n" +
              $"Goal: cap overtime at {maxOtHours}h/week over {windowDays} days.\n" +
              $"Staff over cap (up to 5 shown):\n" +
              string.Join("\n", overtimeStaff.Take(5).Select(s => $"- {s.Name} ({s.Role}, {s.Unit}): {s.TotalHours:F0}h total, {s.ExcessHours:F0}h excess")) +
              $"\nPotential savings: ${potentialSavings:N0}. Coverage gaps: {coverageGaps.Count} unit(s).\n\n" +
              "In 2-3 sentences: is it worth capping OT now? What are the risks? What is the most balanced approach?"
            : $"All staff are within the {maxOtHours}h OT cap for the next {windowDays} days. No overtime reduction needed.";

        var aiNarrative = overtimeStaff.Count > 0
            ? await GetAiNarrativeAsync(http, ai.Value, aiPrompt, ct)
            : "No overtime issues detected in this window — your current staffing plan is within budget.";

        return new SimulationResult(
            Type: "OvertimeReduction",
            Title: $"Overtime Reduction — {windowDays}-Day Window",
            Summary: $"{overtimeStaff.Count} staff projected above {maxOtHours}h OT cap. Potential savings: ${potentialSavings:N0}. {coverageGaps.Count} unit(s) at coverage risk if hard-capped.",
            Options: options,
            Metrics: new SimulationMetrics(
                CoverageScore: coverageScore,
                EstimatedCost: -potentialSavings,
                OvertimeImpact: $"{overtimeStaff.Count} staff above cap — {overtimeStaff.Sum(s => s.ExcessHours):F0} excess hours total",
                FatigueRisk: overtimeStaff.Count > 5 ? "High" : overtimeStaff.Count > 2 ? "Medium" : "Low",
                FillLikelihood: coverageGaps.Count == 0 ? 0.92 : 0.68,
                SafetyAlert: safetyAlert
            ),
            HistoricalContext: historicalContext,
            AiNarrative: aiNarrative
        );
    }
}

// ── Request / Response Contracts ─────────────────────────────────────────────

/// <summary>
/// POST body for all simulation types. Only the fields relevant to the chosen Type are required.
/// </summary>
public record SimulationRequest(
    string    Type,         // ShortStaffed | CallOff | OvertimeReduction
    Guid?     UnitId,       // Target unit (optional for OvertimeReduction)
    string?   Role,         // Role/position string, e.g. "RN" (ShortStaffed, CallOff)
    DateOnly? SimDate,      // Date to simulate (ShortStaffed, CallOff)
    int?      MissingCount, // How many staff are short/calling off (ShortStaffed, CallOff)
    double?   MaxOtHours,   // Max overtime hours per week (OvertimeReduction)
    int?      WindowDays    // Simulation window in days (OvertimeReduction)
);

public record SimulationOption(
    string Label,
    string Description,
    string Tag,             // Best | Cheapest | Safest | Alternative | Last Resort
    double EstimatedCost,   // Negative = savings
    string OvertimeRisk,    // None | Low | Medium | High | Eliminated
    double FillLikelihood,  // 0.0 – 1.0
    int    CoverageScore    // 0 – 100
);

public record SimulationMetrics(
    int     CoverageScore,
    double  EstimatedCost,
    string  OvertimeImpact,
    string  FatigueRisk,    // Low | Medium | High
    double  FillLikelihood,
    string? SafetyAlert
);

public record SimulationResult(
    string                       Type,
    string                       Title,
    string                       Summary,
    IEnumerable<SimulationOption> Options,
    SimulationMetrics            Metrics,
    string                       HistoricalContext,
    string?                      AiNarrative
);
