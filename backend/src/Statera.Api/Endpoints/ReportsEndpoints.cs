using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Statera.Api.Endpoints;

public static class ReportsEndpoints
{
    public static RouteGroupBuilder MapReportsEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/reports").WithTags("Reports");
        g.MapGet("/", () => Results.Ok(new { ok = true }));
        return v1;
    }
}
