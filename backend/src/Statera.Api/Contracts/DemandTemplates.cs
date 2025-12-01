// backend/src/Statera.Api/Contracts/DemandTemplates.cs
using Statera.Domain.Staffing;

namespace Statera.Api.Contracts;

public record DemandDayDto(
    int Day,        // 0-6
    int Required
);

public record DemandTemplateDto(
    Guid Id,
    Guid FacilityId,
    Guid? UnitId,
    string Name,
    string? Role,
    string? Notes,
    DemandTemplateStatus Status,
    IReadOnlyList<DemandDayDto> Days,
    DateTime CreatedOn,
    DateTime? UpdatedOn,
    string? RowVersion // base64
);

public record CreateDemandTemplateRequest(
    Guid FacilityId,
    string Name,
    string? Role,
    Guid? UnitId,
    string? Notes,
    IReadOnlyList<DemandDayDto> Days
);

public record UpdateDemandTemplateRequest(
    string? Name,
    string? Role,
    Guid? UnitId,
    string? Notes,
    IReadOnlyList<DemandDayDto>? Days,
    string? RowVersion
);

public record ValidationIssue(
    string Code,
    string Message,
    string Severity, // "info" | "warning" | "error"
    string? Field = null
);

public record ApplyToRangeRequest(
    string StartDate,  // YYYY-MM-DD
    string EndDate,    // YYYY-MM-DD
    bool? Overwrite,
    Guid? TargetUnitId,
    string? TargetRole
);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total);
