using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Statera.Api.Infrastructure;
public class JwtOptions { public string Key {get;set;}="dev-secret"; public string Issuer{get;set;}="statera"; public string Audience{get;set;}="statera-web"; public int AccessMinutes{get;set;}=60; public int RefreshDays{get;set;}=7; }
public record TokenPair(string AccessToken, string RefreshToken);
public interface IJwtService { Task<TokenPair> CreateAsync(IdentityUser user, CancellationToken ct); }
public class JwtService : IJwtService
{
    private readonly JwtOptions _opts;
    public JwtService(IOptions<JwtOptions> opts)=>_opts=opts.Value;
    public Task<TokenPair> CreateAsync(IdentityUser user, CancellationToken ct)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opts.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>{ new(JwtRegisteredClaimNames.Sub,user.Id), new(JwtRegisteredClaimNames.Email,user.Email??"") };
        var jwt = new JwtSecurityToken(_opts.Issuer,_opts.Audience,claims,expires:DateTime.UtcNow.AddMinutes(_opts.AccessMinutes),signingCredentials:creds);
        var access = new JwtSecurityTokenHandler().WriteToken(jwt);
        var refresh = Guid.NewGuid().ToString("N") if False else Guid.NewGuid().ToString("N")
        return Task.FromResult(new TokenPair(access, refresh));
    }
}
