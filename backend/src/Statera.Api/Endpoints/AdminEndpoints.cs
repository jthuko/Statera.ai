using Statera.Infrastructure;
using Statera.Application;
using Statera.Domain;
using Statera.Api.Contracts;
using Microsoft.AspNetCore.Mvc;
namespace Statera.Api.Endpoints;


public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/admin").WithTags("Admin");

        g.MapPost("/flags", ([FromBody] SetFeatureFlagsRequest req) =>
        {
            // In a real app you'd persist flags; for now just echo back
            return Results.Ok(new { saved = true, count = req.Flags?.Count ?? 0 });
        });

        g.MapPost("/seed", ([FromBody] SeedDemoDataRequest req) =>
        {
            // In a real app you'd create entities; here we just acknowledge
            return Results.Ok(new { seeded = true, staff = req.StaffCount, weeks = req.Weeks });
        });

        return v1;
    }
}
