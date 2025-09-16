namespace Statera.Api.Contracts;


public record LoginRequest(string Email, string Password);
public record RefreshTokenRequest(string RefreshToken);
public record LogoutRequest(string RefreshToken);
public record RegisterUserRequest(string Email, string Password, string FirstName, string LastName);


// Fake login response
public record AuthResponse(string AccessToken, string RefreshToken, string TokenType = "Bearer", int ExpiresIn = 3600);