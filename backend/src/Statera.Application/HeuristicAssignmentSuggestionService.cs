using Statera.Api.Domain;
namespace Statera.Api.Application;
public class HeuristicAssignmentSuggestionService : IAssignmentSuggestionService
{
    private readonly IRepository _repo;
    public HeuristicAssignmentSuggestionService(IRepository repo) => _repo = repo;
    public async Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(ScheduleContextDto ctx, CancellationToken ct)
    {
        var staff = await _repo.GetAllStaffAsync(ct);
        var assignments = await _repo.GetAssignmentsInRangeAsync(ctx.StartUtc, ctx.EndUtc, ct);
        var timeOff = await _repo.GetTimeOffInRangeAsync(ctx.StartUtc, ctx.EndUtc, ct);
        var ot = await _repo.GetOvertimeRuleAsync(ct) ?? new OvertimeRule();
        var results = new List<AssignmentSuggestionDto>();
        foreach (var s in staff)
        {
            double score = 0; var reasons = new List<string>();
            var tzStart = ctx.StartUtc.ToLocalTime().TimeOfDay;
            var tzEnd = ctx.EndUtc.ToLocalTime().TimeOfDay;
            var dow = ctx.StartUtc.ToLocalTime().DayOfWeek;
            var avail = s.Availabilities.Any(a => a.DayOfWeek == dow && a.StartLocal <= tzStart && a.EndLocal >= tzEnd);
            if (avail) { score += 0.4; reasons.Add("Available"); } else reasons.Add("Limited availability");
            var hasCred = s.Licenses.Any(l => l.IsActive && l.ExpirationDate > DateTime.UtcNow && l.LicenseType == ctx.RequiredCredential);
            if (hasCred) { score += 0.2; reasons.Add("Credential match"); } else reasons.Add("Credential mismatch");
            var weekStart = ctx.StartUtc.Date.AddDays(-(int)ctx.StartUtc.ToLocalTime().DayOfWeek); var weekEnd = weekStart.AddDays(7);
            var staffWeek = assignments.Where(a => a.StaffId == s.Id && a.StartUtc >= weekStart && a.EndUtc <= weekEnd).Sum(a => (a.EndUtc - a.StartUtc).TotalHours);
            if (staffWeek < 40) { score += 0.2; reasons.Add("Under weekly hours"); }
            var toConflict = timeOff.Any(t => t.StaffId == s.Id && t.Approved && t.StartUtc < ctx.EndUtc && t.EndUtc > ctx.StartUtc);
            if (!toConflict) { score += 0.1; reasons.Add("No time-off conflict"); } else reasons.Add("Has time-off");
            var overlap = assignments.Any(a => a.StaffId == s.Id && a.StartUtc < ctx.EndUtc && a.EndUtc > ctx.StartUtc);
            if (!overlap) { score += 0.1; reasons.Add("No overlap"); } else reasons.Add("Overlaps existing shift");
            if (ot.HardBlock && staffWeek >= ot.WeeklyHoursThreshold) continue;
            if (staffWeek >= ot.WeeklyHoursThreshold) { score -= ot.PenaltyWeight; reasons.Add($"Overtime penalty ({ot.PenaltyWeight})"); }
            score = Math.Clamp(score, 0, 1);
            results.Add(new AssignmentSuggestionDto(s.Id, score, string.Join("; ", reasons)));
        }
        return results.OrderByDescending(r => r.Score).ToList();
    }
}
public interface IRepository
{
    Task<List<Staff>> GetAllStaffAsync(CancellationToken ct);
    Task<List<Assignment>> GetAssignmentsInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct);
    Task<List<TimeOffRequest>> GetTimeOffInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct);
    Task<OvertimeRule?> GetOvertimeRuleAsync(CancellationToken ct);
}
