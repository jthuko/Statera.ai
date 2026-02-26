namespace Statera.Api.Contracts;


public record LoginRequest(string Email, string Password);
public record RefreshTokenRequest(string RefreshToken);
public record LogoutRequest(string RefreshToken);
public record RegisterUserRequest(string Email, string Password, string FirstName, string LastName);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ImpersonateRequest(Guid StaffId);


public record AuthResponse(string AccessToken, string RefreshToken, string TokenType = "Bearer", int ExpiresIn = 3600);

// Returned by GET /auth/me
public record UserInfoResponse(
    string Id,
    string Email,
    string SystemRole,
    IReadOnlyList<string> FacilityIds
);