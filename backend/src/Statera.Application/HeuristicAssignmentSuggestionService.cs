using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Statera.Domain;

               // CredentialType

namespace Statera.Application;

/// <summary>
/// Very simple heuristic: pick active staff in the unit with a valid license,
/// not on approved time off, then score by lighter weekly hours.
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

    /// <param name="startUtc">Candidate assignment start (UTC).</param>
    /// <param name="endUtc">Candidate assignment end (UTC).</param>
    /// <param name="unitId">Target Unit (Guid) � was int.</param>
    /// <param name="requiredCredential">Credential required (enum).</param>
    public async Task<IReadOnlyList<(Guid StaffId, double Score)>> SuggestAsync(
        DateTime startUtc,
        DateTime endUtc,
        Guid unitId,                               // FIX: was int
        CredentialType requiredCredential,
        CancellationToken ct = default)
    {
        var staff = await _repo.GetAllStaffAsync(ct);
        var existing = await _repo.GetAssignmentsInRangeAsync(startUtc, endUtc, ct);
        var timeOff = await _repo.GetTimeOffInRangeAsync(startUtc, endUtc, ct);
        var rule = await _repo.GetOvertimeRuleAsync(ct) ?? new OvertimeRule
        {
            DailyHoursThreshold = 8,
            WeeklyHoursThreshold = 40,
            OvertimeMultiplier = 1.5
        };

        var startDay = DateOnly.FromDateTime(startUtc);
        var nowDay = DateOnly.FromDateTime(DateTime.UtcNow);

        // Determine facility state for the target unit (preferred) so license checks use the facility's issuing state.
        var facilityStateForUnit = await _repo.GetFacilityStateForUnitAsync(unitId, ct);

        // Candidates: active, in unit (or no unit filter), valid license, no approved time off, no overlap
        var candidates = staff
            .Where(s => s.Active && (!s.UnitId.HasValue || s.UnitId.Value == unitId))
            .Where(s =>
            {
                // LicenseValidation: prefer the facility's state (real scenario).
                // Fall back to the staff license issuing state if the facility state is not available.
                var fallbackState = s.Licenses?.FirstOrDefault()?.IssuingState?.Trim().ToUpperInvariant() ?? string.Empty;
                var stateToUse = !string.IsNullOrWhiteSpace(facilityStateForUnit) ? facilityStateForUnit : fallbackState;
                return _license.HasValidLicense(s, facilityState: stateToUse, requiredType: requiredCredential, onDate: startDay);
            })
            .Where(s =>
            {
                // Not on approved time off overlapping window
                return !timeOff.Any(r =>
                    r.StaffId == s.Id &&
                    string.Equals(r.Status, "Approved", StringComparison.OrdinalIgnoreCase) && // FIX: was r.Approved
                    r.StartUtc < endUtc &&
                    r.EndUtc > startUtc);
            })
            .Where(s =>
            {
                // No overlapping assignment already
                return !existing.Any(a => a.StaffId == s.Id && a.StartUtc < endUtc && a.EndUtc > startUtc);
            })
            .ToList();

        // Score: fewer hours in the last 7 days gets a higher score; apply soft penalty using OvertimeRule thresholds.
        var weekStart = startUtc.Date.AddDays(-7);
        var weekEnd = startUtc;

        var weeklyAssignments = await _repo.GetAssignmentsInRangeAsync(weekStart, weekEnd, ct);

        List<(Guid StaffId, double Score)> ranked = new();

        foreach (var s in candidates)
        {
            var hrs = weeklyAssignments
                .Where(a => a.StaffId == s.Id)
                .Select(a =>
                {
                    var st = a.StartUtc < weekStart ? weekStart : a.StartUtc;
                    var en = a.EndUtc > weekEnd ? weekEnd : a.EndUtc;
                    var h = (en - st).TotalHours;
                    return h > 0 ? h : 0;
                })
                .Sum();

            // Soft penalty once past weekly threshold (no HardBlock / PenaltyWeight in your domain)
            double penalty = 0.0;
            if (hrs > rule.WeeklyHoursThreshold)
            {
                var over = hrs - rule.WeeklyHoursThreshold;
                penalty = over * (rule.OvertimeMultiplier - 1.0); // simple soft penalty
            }

            // Higher score is better
            var score = Math.Max(0, 100.0 - hrs - penalty);
            ranked.Add((s.Id, score));
        }

        // High to low
        ranked.Sort((a, b) => b.Score.CompareTo(a.Score));
        return ranked;
    }
}
