using Statera.Api.Domain;
namespace Statera.Api.Application;
public interface IDateTimeProvider { DateTime UtcNow { get; } }
public class SystemDateTimeProvider : IDateTimeProvider { public DateTime UtcNow => DateTime.UtcNow; }
public interface ICurrentUserService { string? UserId { get; } string? UserEmail { get; } }
public record AssignmentSuggestionDto(int StaffId, double Score, string Reasoning);
public record ScheduleContextDto(DateTime StartUtc, DateTime EndUtc, int UnitId, CredentialType RequiredCredential);
public interface IAssignmentSuggestionService { Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(ScheduleContextDto ctx, CancellationToken ct); }
