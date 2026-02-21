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

// Admin management contracts
public sealed record AssignFacilityAdminRequest(string UserId, string FacilityRole = "FacilityAdmin");

public sealed record FacilityAdminResponse(
    string UserId,
    string Email,
    string FacilityRole,
    DateTime AssignedUtc
);
