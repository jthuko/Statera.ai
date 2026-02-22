using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Statera.Domain;
using Statera.Domain.Staffing;

namespace Statera.Application;

/// <summary>
/// Heuristic scheduler: picks active, credentialed staff in the facility/unit,
/// not on approved time-off, not overlapping, and applies RuleConstraints for
/// hard blocks (MaxHoursPerWeek, MinRestBetweenShiftsHours, MaxConsecutiveDays,
/// OvertimeCapHours) and soft bonuses (ShiftPreference).
/// </summary>
public class HeuristicAssignmentSuggestionService
{
    private readonly IRepository _repo;
    private readonly LicensePolicyService _license;

    public HeuristicAssignmentSuggestionService(IRepository repo, LicensePolicyService license)
    {
        _repo = repo;
        _license = license;
    }

    public async Task<IReadOnlyList<(Guid StaffId, double Score, string Reasoning)>> SuggestAsync(
        DateTime startUtc,
        DateTime endUtc,
        Guid unitId,
        CredentialType requiredCredential,
        Guid? facilityId = null,
        CancellationToken ct = default)
    {
        // Load staff scoped to facility when available
        var staff = facilityId.HasValue
            ? await _repo.GetStaffByFacilityAsync(facilityId.Value, ct)
            : await _repo.GetAllStaffAsync(ct);

        var existing    = await _repo.GetAssignmentsInRangeAsync(startUtc, endUtc, ct);
        var timeOff     = await _repo.GetTimeOffInRangeAsync(startUtc, endUtc, ct);
        var rule        = await _repo.GetOvertimeRuleAsync(ct) ?? new OvertimeRule
        {
            DailyHoursThreshold  = 8,
            WeeklyHoursThreshold = 40,
            OvertimeMultiplier   = 1.5
        };

        // Load facility constraints
        var constraints = facilityId.HasValue
            ? await _repo.GetConstraintsByFacilityAsync(facilityId.Value, ct)
            : new List<RuleConstraint>();

        var startDay           = DateOnly.FromDateTime(startUtc);
        var facilityStateForUnit = await _repo.GetFacilityStateForUnitAsync(unitId, ct);

        // Weekly history window
        var weekStart        = startUtc.Date.AddDays(-7);
        var weeklyAssignments = await _repo.GetAssignmentsInRangeAsync(weekStart, startUtc, ct);

        // Resolve constraint thresholds (Role > Unit > Facility > default)
        var credStr          = requiredCredential.ToString();
        double maxHoursWeek  = Resolve(constraints, ConstraintType.MaxHoursPerWeek,            unitId, credStr, rule.WeeklyHoursThreshold);
        double minRestHours  = Resolve(constraints, ConstraintType.MinRestBetweenShiftsHours,  unitId, credStr, 8.0);
        double maxConsDays   = Resolve(constraints, ConstraintType.MaxConsecutiveDays,          unitId, credStr, 6.0);
        double overtimeCap   = Resolve(constraints, ConstraintType.OvertimeCapHours,            unitId, credStr, rule.WeeklyHoursThreshold);

        // LicenseRequired can be explicitly disabled via constraint
        bool licenseRequired = !constraints.Any(c =>
            c.Type == ConstraintType.LicenseRequired &&
            c.Value.Equals("false", StringComparison.OrdinalIgnoreCase));

        var ranked = new List<(Guid StaffId, double Score, string Reasoning)>();

        foreach (var s in staff.Where(s => s.Active))
        {
            // ── Unit scope ────────────────────────────────────────────
            if (s.UnitId.HasValue && s.UnitId.Value != unitId)
                continue;

            var reasons = new List<string>();
            double score = 100.0;

            // ── Credential / license ──────────────────────────────────
            var roleStr           = s.Role ?? string.Empty;
            bool roleMatchesCred  = string.Equals(roleStr, credStr, StringComparison.OrdinalIgnoreCase);
            bool hasLicenseRecords = s.Licenses?.Any() == true;

            if (licenseRequired)
            {
                if (hasLicenseRecords)
                {
                    var fallbackState = s.Licenses!
                        .FirstOrDefault()?.IssuingState?.Trim().ToUpperInvariant() ?? string.Empty;
                    var stateToUse = !string.IsNullOrWhiteSpace(facilityStateForUnit)
                        ? facilityStateForUnit : fallbackState;

                    if (_license.HasValidLicense(s, stateToUse, requiredCredential, startDay))
                    {
                        reasons.Add($"active {credStr} license verified");
                    }
                    else if (roleMatchesCred)
                    {
                        reasons.Add($"role match ({roleStr}) — no valid license on file");
                        score -= 10;
                    }
                    else
                    {
                        continue; // has license records but none valid, role also doesn't match
                    }
                }
                else
                {
                    // No license records — fall back to role match
                    if (!roleMatchesCred)
                        continue;
                    reasons.Add($"role match ({roleStr}) — no license records on file");
                    score -= 5;
                }
            }
            else
            {
                reasons.Add("license check waived by facility constraint");
            }

            // ── Approved time off ─────────────────────────────────────
            if (timeOff.Any(r =>
                    r.StaffId == s.Id &&
                    string.Equals(r.Status, "Approved", StringComparison.OrdinalIgnoreCase) &&
                    r.StartUtc < endUtc && r.EndUtc > startUtc))
                continue;

            // ── Overlapping assignment ────────────────────────────────
            if (existing.Any(a => a.StaffId == s.Id && a.StartUtc < endUtc && a.EndUtc > startUtc))
                continue;

            // ── Weekly hours ──────────────────────────────────────────
            var myWeekly = weeklyAssignments.Where(a => a.StaffId == s.Id).ToList();
            double hrs = myWeekly.Sum(a =>
            {
                var st = a.StartUtc < weekStart ? weekStart : a.StartUtc;
                var en = a.EndUtc   > startUtc  ? startUtc  : a.EndUtc;
                var h  = (en - st).TotalHours;
                return h > 0 ? h : 0;
            });

            if (hrs >= maxHoursWeek)  continue; // hard block
            if (hrs >= overtimeCap)   continue; // overtime cap block

            double penalty = 0;
            if (hrs > rule.WeeklyHoursThreshold)
            {
                var over = hrs - rule.WeeklyHoursThreshold;
                penalty  = over * (rule.OvertimeMultiplier - 1.0);
            }
            score = Math.Max(0, score - hrs - penalty);
            reasons.Add($"{hrs:F1}h worked this week");

            // ── Minimum rest between shifts ───────────────────────────
            var lastEnd = myWeekly
                .Where(a => a.EndUtc <= startUtc)
                .Select(a => a.EndUtc)
                .DefaultIfEmpty(DateTime.MinValue)
                .Max();

            if (lastEnd != DateTime.MinValue)
            {
                var restH = (startUtc - lastEnd).TotalHours;
                if (restH < minRestHours)
                    continue; // hard block
                reasons.Add($"{restH:F0}h rest since last shift");
            }

            // ── Max consecutive days ──────────────────────────────────
            int consecutive = 0;
            for (int d = 1; d <= (int)maxConsDays + 1; d++)
            {
                var day       = startDay.AddDays(-d);
                bool worked   = myWeekly.Any(a =>
                    DateOnly.FromDateTime(a.StartUtc)               == day ||
                    DateOnly.FromDateTime(a.EndUtc.AddSeconds(-1))  == day);
                if (worked) consecutive++;
                else        break;
            }
            if (consecutive >= (int)maxConsDays)
                continue; // hard block
            if (consecutive > 0)
                reasons.Add($"{consecutive} consecutive day(s) worked");

            // ── Shift preference bonus ────────────────────────────────
            var prefConstraint = constraints.FirstOrDefault(c =>
                c.Type == ConstraintType.ShiftPreference &&
                c.Scope == RuleScope.Role &&
                string.Equals(c.Role, roleStr, StringComparison.OrdinalIgnoreCase));
            if (prefConstraint != null && double.TryParse(prefConstraint.Value, out var prefBonus))
            {
                score  += prefBonus;
                reasons.Add($"shift preference +{prefBonus}");
            }

            ranked.Add((s.Id, Math.Max(0, score), string.Join("; ", reasons)));
        }

        ranked.Sort((a, b) => b.Score.CompareTo(a.Score));
        return ranked;
    }

    private static double Resolve(
        List<RuleConstraint> constraints,
        ConstraintType type,
        Guid unitId,
        string role,
        double defaultValue)
    {
        var match =
            constraints.FirstOrDefault(c =>
                c.Type == type && c.Scope == RuleScope.Role &&
                string.Equals(c.Role, role, StringComparison.OrdinalIgnoreCase)) ??
            constraints.FirstOrDefault(c =>
                c.Type == type && c.Scope == RuleScope.Unit && c.UnitId == unitId) ??
            constraints.FirstOrDefault(c =>
                c.Type == type && c.Scope == RuleScope.Facility);

        return match != null && double.TryParse(match.Value, out var v) ? v : defaultValue;
    }
}
