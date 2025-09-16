using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Statera.Api.Endpoints;

public static class PingEndpoints
{
    public static RouteGroupBuilder MapPingEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/ping").WithTags("Ping");
        g.MapGet("/", () => Results.Ok(new { pong = true }));
        return v1;
    }
}
