using System;
using Statera.Domain.Staffing;

namespace Statera.Api.Contracts;

public record ConstraintDto(
    Guid Id,
    Guid FacilityId,
    RuleScope Scope,
    Guid? UnitId,
    string? Role,
    ConstraintType Type,
    string Value,
    bool IsActive,
    string? Notes,
    DateTime CreatedOn,
    DateTime? UpdatedOn
);

public record CreateConstraintRequest(
    RuleScope Scope,
    Guid? UnitId,
    string? Role,
    ConstraintType Type,
    string Value,
    bool IsActive,
    string? Notes
);

public record UpdateConstraintRequest(
    RuleScope Scope,
    Guid? UnitId,
    string? Role,
    ConstraintType Type,
    string Value,
    bool IsActive,
    string? Notes
);
