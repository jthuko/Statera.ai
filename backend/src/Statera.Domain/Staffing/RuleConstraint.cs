using System;

namespace Statera.Domain.Staffing;

public enum ConstraintType
{
    MaxHoursPerWeek,
    MinRestBetweenShiftsHours,
    MaxConsecutiveDays,
    OvertimeCapHours,
    LicenseRequired,
    UnitCoverageRatio,
    ShiftPreference
}

public enum RuleScope
{
    Facility,
    Unit,
    Role
}

public class RuleConstraint
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FacilityId { get; set; }
    public RuleScope Scope { get; set; }
    public Guid? UnitId { get; set; }
    public string? Role { get; set; }
    public ConstraintType Type { get; set; }
    public string Value { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedOn { get; set; }
}
