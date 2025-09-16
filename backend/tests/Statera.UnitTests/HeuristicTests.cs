using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using Statera.Application; // IRepository, ScheduleContextDto, HeuristicAssignmentSuggestionService
using Statera.Domain;      // Staff, StaffLicense, StaffAvailability, EmploymentType, Assignment, TimeOffRequest, OvertimeRule, ShiftTemplate, Schedule

public class HeuristicTests
{
    private class FakeRepo : IRepository
    {
        public Task<List<Assignment>> GetAssignmentsInRangeAsync(DateTime s, DateTime e, CancellationToken ct)
            => Task.FromResult(new List<Assignment>());

        public Task<List<TimeOffRequest>> GetTimeOffInRangeAsync(DateTime s, DateTime e, CancellationToken ct)
            => Task.FromResult(new List<TimeOffRequest>());

        public Task<OvertimeRule?> GetOvertimeRuleAsync(CancellationToken ct)
            => Task.FromResult<OvertimeRule?>(new OvertimeRule
            {
                DailyHoursThreshold = 8,
                WeeklyHoursThreshold = 40,
                OvertimeMultiplier = 1.5
            });

        public Task<List<Staff>> GetAllStaffAsync(CancellationToken ct)
        {
            var unitId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var staff = new Staff
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"),
                FirstName = "Test",
                LastName = "Nurse",
                Email = "nurse@test.local",
                FacilityId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"),
                UnitId = unitId,
                Role = "RN",
                EmploymentType = EmploymentType.FullTime,
                Active = true,
                Licenses = new List<StaffLicense>
                {
                    new StaffLicense
                    {
                        IssuingState   = "TX",
                        LicenseType    = "RN", // string-based license type
                        LicenseNumber  = "TX12345",
                        IssuedOn       = null,
                        ExpiresOn      = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
                        IsActive       = true,
                        VerificationUrl = null
                    }
                },
                Availabilities = new List<StaffAvailability>
                {
                    new StaffAvailability
                    {
                        DayOfWeek  = DateTime.UtcNow.ToLocalTime().DayOfWeek,
                        StartLocal = new TimeSpan(8, 0, 0),
                        EndLocal   = new TimeSpan(20, 0, 0)
                    }
                }
            };

            return Task.FromResult(new List<Staff> { staff });
        }

        public Task<List<ShiftTemplate>> GetShiftTemplatesAsync(Guid facilityId, Guid unitId, CancellationToken ct)
            => Task.FromResult(new List<ShiftTemplate>()); // not needed for this test

        public Task<List<Schedule>> GetSchedulesAsync(Guid facilityId, Guid unitId, DateOnly from, DateOnly to, CancellationToken ct)
            => Task.FromResult(new List<Schedule>()); // not needed for this test
    }

    [Fact]
    public async Task Suggest_Returns_Scored_Results()
    {
        var heuristic = new HeuristicAssignmentSuggestionService(new FakeRepo(), new LicensePolicyService());

        var unitId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var start = DateTime.UtcNow.Date.AddHours(13);

        // If your heuristic expects an enum, convert string -> enum here as needed
        // Assuming you kept enum CredentialType, map "RN" -> CredentialType.RN
        var res = await heuristic.SuggestAsync(
            startUtc: start,
            endUtc: start.AddHours(8),
            unitId: unitId,
            requiredCredential: CredentialType.RN,
            ct: CancellationToken.None
        );

        res.Should().NotBeEmpty();
        res[0].Score.Should().BeGreaterThan(0);
    }
}
