using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class HelpEndpoints
{
    public static RouteGroupBuilder MapHelpEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/help").WithTags("Help").RequireAuthorization();

        // GET /api/v1/help/articles — returns all articles ordered by category + sort order
        g.MapGet("/articles", async ([FromServices] AppDbContext db) =>
        {
            var rows = await db.HelpArticles
                .AsNoTracking()
                .OrderBy(a => a.Category)
                .ThenBy(a => a.SortOrder)
                .ThenBy(a => a.Title)
                .ToListAsync();

            var result = rows.Select(a => new
            {
                a.Id,
                a.Category,
                a.Title,
                a.SortOrder,
                Tags     = JsonSerializer.Deserialize<string[]>(a.TagsJson)     ?? Array.Empty<string>(),
                Sections = JsonSerializer.Deserialize<ArticleSection[]>(a.SectionsJson) ?? Array.Empty<ArticleSection>(),
            });

            return Results.Ok(result);
        });

        return v1;
    }

    private record ArticleSection(string? Heading, string Body);
}
