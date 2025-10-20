// backend/src/Statera.Api/Contracts/Dtos.cs
using System;

namespace Statera.Api.Contracts;

// ---------- Staff ----------
public record CreateStaffRequest(
    string FirstName,
    string LastName,
    string? Email,
    Guid FacilityId,
    Guid? UnitId,
    string Role,
    string EmploymentType, // "FullTime","PartTime","PerDiem","Contract"
    bool Active
);

public record UpdateStaffRequest(
    string? FirstName,
    string? LastName,
    string? Email,
    Guid? FacilityId,
    Guid? UnitId,
    string? Role,
    string? EmploymentType,
    bool? Active
);

// ---------- Assignments (replaces Shifts; time-based) ----------
public record CreateAssignmentRequest(
    Guid StaffId,
    Guid FacilityId,
    Guid? UnitId,
    string FacilityState,   // e.g., "TX"
    DateTime StartUtc,
    DateTime EndUtc,
    string? Notes
);

public record UpdateAssignmentRequest(
    Guid? StaffId,
    Guid? FacilityId,
    Guid? UnitId,
    string? FacilityState,
    DateTime? StartUtc,
    DateTime? EndUtc,
    string? Notes
);

// ---------- Shift Templates (TimeSpan to match domain) ----------
public record CreateShiftTemplateRequest(
    Guid FacilityId,
    Guid UnitId,
    string Name,
    string Type,
    TimeSpan StartLocal,
    TimeSpan EndLocal,
    int RequiredCount,
    string? QualificationsCsv
);

public record UpdateShiftTemplateRequest(
    Guid? FacilityId,
    Guid? UnitId,
    string? Name,
    string? Type,
    TimeSpan? StartLocal,
    TimeSpan? EndLocal,
    int? RequiredCount,
    string? QualificationsCsv
);

// ---------- Schedules (Unit-based) ----------
public record CreateScheduleRequest(Guid FacilityId, Guid UnitId, string Name, DateOnly Start, DateOnly End);
public record UpdateScheduleRequest(Guid? FacilityId, Guid? UnitId, string? Name, DateOnly? Start, DateOnly? End);

// ---------- Time Off ----------
public record CreateTimeOffRequest(Guid StaffId, string Type, DateTime StartUtc, DateTime EndUtc, string? Reason);
public record UpdateTimeOffRequest(Guid? StaffId, string? Type, string? Status, DateTime? StartUtc, DateTime? EndUtc, string? Reason);


// ---------- Users (ASP.NET Identity) ----------
public record CreateIdentityUserRequest(string Email, string Password, string? UserName);
public record UpdateIdentityUserRequest(string? Email, string? UserName, bool? LockoutEnabled);
