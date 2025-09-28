// file-scoped
namespace Statera.Api.Contracts;

public sealed record FacilityItemResponse(
    System.Guid Id,
    string Name,
    string Address,
    string City,
    string State,
    string Zip
);

public sealed record UnitItemResponse(
    System.Guid Id,
    System.Guid FacilityId,
    string Name
);

// Roles may not have Name/Description on your Domain model;
// keep them nullable so we can still shape responses.
public sealed record RoleItemResponse(
    System.Guid Id,
    string? Name,
    string? Description
);
