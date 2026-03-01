namespace Statera.Api.Contracts;


public record LoginRequest(string Email, string Password);
public record RefreshTokenRequest(string RefreshToken);
public record LogoutRequest(string RefreshToken);
public record RegisterUserRequest(string Email, string Password, string FirstName, string LastName);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ImpersonateRequest(Guid StaffId);

// Self-service facility signup (free 7-day trial)
public record SignupRequest(
    string FacilityName,
    string FacilityAddress,
    string FacilityCity,
    string FacilityState,
    string FacilityZip,
    string FirstName,
    string LastName,
    string Email,
    string Password
);

public record AuthResponse(string AccessToken, string RefreshToken, string TokenType = "Bearer", int ExpiresIn = 3600);

// Returned by GET /auth/me
public record UserInfoResponse(
    string Id,
    string Email,
    string SystemRole,
    IReadOnlyList<string> FacilityIds
);