using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Statera.Api.Endpoints;

public static class HealthEndpoints
{
    public static RouteGroupBuilder MapHealthEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/health").WithTags("Health");
        g.MapGet("/live", () => Results.Ok(new { status = "alive" }));
        g.MapGet("/ready", () => Results.Ok(new { status = "ready" }));
        return v1;
    }
}
