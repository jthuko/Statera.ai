// backend/src/Statera.Application/Abstractions.cs
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Statera.Domain;   // Staff, Assignment, TimeOffRequest, OvertimeRule, ShiftTemplate, Schedule
// CredentialType enum

namespace Statera.Application;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}

public class SystemDateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}

public interface ICurrentUserService
{
    string? UserId { get; }
    string? UserEmail { get; }
}

public record AssignmentSuggestionDto(Guid StaffId, double Score, string Reasoning);

public record ScheduleContextDto(
    DateTime StartUtc,
    DateTime EndUtc,
    Guid UnitId,
     string RequiredLicenseType
);

public interface IRepository
{
    Task<List<Staff>> GetAllStaffAsync(CancellationToken ct);
    Task<List<Assignment>> GetAssignmentsInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct);
    Task<List<TimeOffRequest>> GetTimeOffInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct);
    Task<OvertimeRule?> GetOvertimeRuleAsync(CancellationToken ct);

    Task<List<ShiftTemplate>> GetShiftTemplatesAsync(Guid facilityId, Guid unitId, CancellationToken ct);
    Task<List<Schedule>> GetSchedulesAsync(Guid facilityId, Guid unitId, DateOnly from, DateOnly to, CancellationToken ct);
    // Returns the two-letter state (e.g. "TX") for the facility that owns the given unit,
    // or null if not found. Used by license validation in suggestion logic.
    Task<string?> GetFacilityStateForUnitAsync(Guid unitId, CancellationToken ct);
}

public interface IAssignmentSuggestionService
{
    Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(ScheduleContextDto ctx, CancellationToken ct);
}
