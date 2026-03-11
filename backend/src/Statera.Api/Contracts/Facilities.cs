namespace Statera.Api.Contracts;

public sealed record CreateFacilityRequest(
    string Name,
    string Address,
    string City,
    string State,
    string Zip
);

public sealed record UpdateFacilityRequest(
    string? Name,
    string? Address,
    string? City,
    string? State,
    string? Zip
);

public sealed record BrandingUpdateRequest(
    string? LogoUrl,
    string? PrimaryColor
);

// Admin management contracts
public sealed record AssignFacilityAdminRequest(string UserId, string FacilityRole = "FacilityAdmin");

// Facility-scoped assignment contracts
public sealed record FacilityAssignmentCreateRequest(
    Guid StaffId,
    Guid? UnitId,
    string? RoleId,
    string Start,   // ISO 8601
    string End,     // ISO 8601
    string? Notes
);

public sealed record FacilityAssignmentUpdateRequest(
    Guid? StaffId,
    Guid? UnitId,
    string? RoleId,
    string? Start,
    string? End,
    string? Notes
);

public sealed record FacilityAdminResponse(
    string UserId,
    string Email,
    string FacilityRole,
    DateTime AssignedUtc
);
