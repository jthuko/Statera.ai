namespace Statera.Api.Contracts;

// POST /api/v1/facilities/{facilityId}/units
public sealed record CreateUnitUnderFacilityRequest(
    string Name,
    string? Type,
    string? Floor,
    int? Capacity,
    string? Notes,
    bool IsActive = true
);

// PUT /api/v1/units/{id}
public sealed record UpdateUnitRequest(
    Guid? FacilityId,
    string? Name,
    string? Type,
    string? Floor,
    int? Capacity,
    string? Notes,
    bool? IsActive
);

// (Keep if used elsewhere)
public sealed record CreateUnitRequest(
    Guid FacilityId,
    string Name
);

// DTO returned to the frontend
public sealed class UnitDto
{
    public Guid Id { get; set; }
    public Guid FacilityId { get; set; }
    public string Name { get; set; } = "";
    public string? Type { get; set; }
    public string? Floor { get; set; }
    public int? Capacity { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
}
