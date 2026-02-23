using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Statera.Infrastructure
{
    public class JwtOptions
    {
        public string Key { get; set; } = "dev-secret-please-change-to-32-bytes-minimum";
        public string Issuer { get; set; } = "statera";
        public string Audience { get; set; } = "statera-web";
        public int AccessMinutes { get; set; } = 60;
        public int RefreshDays { get; set; } = 7;
    }

    public record TokenPair(string AccessToken, string RefreshToken);

    public interface IJwtService
    {
        Task<TokenPair> CreateAsync(AppUser user, IList<Guid> facilityIds, CancellationToken ct, Guid? staffId = null);
    }

    public class JwtService : IJwtService
    {
        private readonly JwtOptions _opts;

        public JwtService(IOptions<JwtOptions> opts)
        {
            _opts = opts.Value;
        }

        public Task<TokenPair> CreateAsync(AppUser user, IList<Guid> facilityIds, CancellationToken ct, Guid? staffId = null)
        {
            // signing key & creds
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opts.Key));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // claims
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                // Drives Owner vs FacilityAdmin gate throughout the API
                new("system_role", user.SystemRole ?? "FacilityAdmin"),
            };

            // One claim per facility this user is allowed to access
            foreach (var fid in facilityIds)
                claims.Add(new Claim("facility_id", fid.ToString()));

            // For Staff portal users: embed their Staff record ID
            if (staffId.HasValue)
                claims.Add(new Claim("staff_id", staffId.Value.ToString()));

            // jwt
            var jwt = new JwtSecurityToken(
                issuer: _opts.Issuer,
                audience: _opts.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(_opts.AccessMinutes),
                signingCredentials: creds
            );

            var accessToken = new JwtSecurityTokenHandler().WriteToken(jwt);

            // opaque refresh token (persist & validate server-side for production)
            var refreshToken = Guid.NewGuid().ToString("N");

            return Task.FromResult(new TokenPair(accessToken, refreshToken));
        }
    }
}
