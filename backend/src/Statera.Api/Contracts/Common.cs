namespace Statera.Api.Contracts;


public record Paged<T>(IEnumerable<T> Items, int Page, int PageSize, int TotalCount);


// Core domain models (simplified)
public record User(Guid Id, string Email, string FirstName, string LastName, string Role, bool Active);
public record Facility(Guid Id, string Name, string Address, string City, string State, string Zip);
public record Department(Guid Id, Guid FacilityId, string Name);
public record Staff(Guid Id, Guid FacilityId, Guid DepartmentId, string FirstName, string LastName, string Role, bool Active);
public record Shift(Guid Id, Guid FacilityId, Guid DepartmentId, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Type, int RequiredCount, Guid? AssignedStaffId);
public record Schedule(Guid Id, Guid FacilityId, Guid DepartmentId, string Name, DateOnly Start, DateOnly End);
public record Assignment(Guid Id, Guid ShiftId, Guid StaffId);
public record TimeOffRequest(Guid Id, Guid StaffId, string Type, string Status, DateTimeOffset From, DateTimeOffset To, string? Reason);
public record ShiftTemplate(Guid Id, Guid FacilityId, Guid DepartmentId, string Name, string Type, TimeOnly Start, TimeOnly End, int RequiredCount, IEnumerable<string>? RequiredQualifications);
public record Constraint(Guid Id, Guid? FacilityId, Guid? DepartmentId, string Code, string Value);


public record ConflictResponse(string Code, string Message, Guid? ShiftId, Guid? StaffId);