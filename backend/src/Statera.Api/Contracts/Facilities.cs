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
