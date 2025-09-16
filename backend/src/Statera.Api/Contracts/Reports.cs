namespace Statera.Api.Contracts;


public record AuditLogResponse(DateTimeOffset Timestamp, string Actor, string Action, string Entity, string EntityId, string Details);
public record FileResultPayload(byte[] Content, string FileName);