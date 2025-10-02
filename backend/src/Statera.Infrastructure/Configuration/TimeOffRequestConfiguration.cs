using System;


namespace Statera.Api.Contracts;


public record TimeOffRequestDto(
Guid Id,
Guid StaffId,
string StaffName,
Guid? StaffUnitId,
Guid StaffFacilityId,
string Type,
string Status,
DateTime StartUtc,
DateTime EndUtc,
string? Reason
);


public record CreateTimeOffRequestRequest
{
    public Guid StaffId { get; init; }
    public string Type { get; init; } = "Vacation";
    public DateTime StartUtc { get; init; }
    public DateTime EndUtc { get; init; }
    public string? Reason { get; init; }
}


public record UpdateTimeOffRequestRequest
{
    public string Type { get; init; } = "Vacation";
    public DateTime StartUtc { get; init; }
    public DateTime EndUtc { get; init; }
    public string? Reason { get; init; }
}


public record ChangeTimeOffStatusRequest
{
    public string Status { get; init; } = "Approved"; // Approved | Denied | Cancelled
    public string? ReviewedBy { get; init; }
}


public record TimeOffRequestPageResponse(int Total, IReadOnlyList<TimeOffRequestDto> Items);