using FluentAssertions;
using Statera.Api.Application;
using Statera.Api.Domain;
public class HeuristicTests
{
    private class FakeRepo : IRepository
    {
        public Task<List<Assignment>> GetAssignmentsInRangeAsync(DateTime s, DateTime e, System.Threading.CancellationToken ct) => Task.FromResult(new List<Assignment>());
        public Task<List<TimeOffRequest>> GetTimeOffInRangeAsync(DateTime s, DateTime e, System.Threading.CancellationToken ct) => Task.FromResult(new List<TimeOffRequest>());
        public Task<OvertimeRule?> GetOvertimeRuleAsync(System.Threading.CancellationToken ct) => Task.FromResult<OvertimeRule?>(new OvertimeRule{ WeeklyHoursThreshold=40, HardBlock=false, PenaltyWeight=0.3});
        public Task<List<Staff>> GetAllStaffAsync(System.Threading.CancellationToken ct) => Task.FromResult(new List<Staff>{ new Staff{ Id=1, Licenses={ new List<StaffLicense>{ new StaffLicense{ IsActive=true, ExpirationDate=DateTime.UtcNow.AddDays(30), LicenseType=CredentialType.RN, IssuingState="KS"} } }, Availabilities={ new List<StaffAvailability>{ new StaffAvailability{ DayOfWeek=DateTime.UtcNow.ToLocalTime().DayOfWeek, StartLocal=new TimeSpan(8,0,0), EndLocal=new TimeSpan(20,0,0)} } } } });
    }
    [Fact]
    public async Task Suggest_Returns_Scored_Results()
    {
        var svc = new HeuristicAssignmentSuggestionService(new FakeRepo());
        var start = DateTime.UtcNow.Date.AddHours(13);
        var res = await svc.SuggestAsync(new ScheduleContextDto(start, start.AddHours(8), 1, CredentialType.RN), default);
        res.Should().NotBeEmpty();
        res[0].Score.Should().BeGreaterThan(0);
    }
}
