// backend/src/Statera.Api/Endpoints/RolesEndpoints.cs
using System;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;
using Statera.Api.Contracts;
using DomRole = Statera.Domain.Role;

namespace Statera.Api.Endpoints;

public static class RolesEndpoints
{
    public static RouteGroupBuilder MapRolesEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/roles").WithTags("Roles");

        // GET /api/v1/roles
        g.MapGet("/", async ([FromServices] AppDbContext db) =>
        {
            var list = await db.Set<DomRole>().AsNoTracking().ToListAsync();
            var rows = list
                .Select(r => new
                {
                    Id = GetIdBoxed(r),
                    Name = GetName(r),
                    Description = GetDescription(r)
                })
                .OrderBy(r => r.Name ?? string.Empty)
                .ToList();

            return Results.Ok(rows);
        });

        // GET /api/v1/roles/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var role = await db.Set<DomRole>().AsNoTracking().FirstOrDefaultAsync(r => ObjectIdEquals(r, id));
            if (role is null) return Results.NotFound();

            return Results.Ok(new
            {
                Id = GetIdBoxed(role),
                Name = GetName(role),
                Description = GetDescription(role)
            });
        });

        // POST /api/v1/roles
        g.MapPost("/", async ([FromBody] CreateRoleRequest req, [FromServices] AppDbContext db) =>
        {
            var desiredName = (req.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(desiredName))
                return Results.BadRequest(new { error = "Role name is required." });

            // Check duplicates in-memory using computed names
            var existing = await db.Set<DomRole>().AsNoTracking().ToListAsync();
            if (existing.Any(r => string.Equals(GetName(r) ?? "", desiredName, StringComparison.OrdinalIgnoreCase)))
                return Results.Conflict(new { error = "A role with that name already exists." });

            // Instantiate and set properties reflectively
            var role = Activator.CreateInstance<DomRole>();
            if (role is null)
                return Results.BadRequest(new { error = "Unable to create Role instance. Ensure a public parameterless constructor exists." });

            var setAny = false;

            // Id
            var idProp = GetIdProperty();
            if (idProp?.CanWrite == true && idProp.PropertyType == typeof(Guid))
            {
                idProp.SetValue(role, Guid.NewGuid());
                setAny = true;
            }

            // Name-like
            var nameProp = GetNameProperty();
            if (nameProp?.CanWrite == true)
            {
                nameProp.SetValue(role, desiredName);
                setAny = true;
            }

            // Description (optional)
            var descProp = GetDescriptionProperty();
            if (descProp?.CanWrite == true)
            {
                descProp.SetValue(role, req.Description?.Trim());
            }

            if (!setAny)
                return Results.BadRequest(new
                {
                    error = "Your Role model doesn’t expose writable properties for Id and/or Name/Code/Key/Title. Add one of those string properties and try again."
                });

            db.Add(role);
            await db.SaveChangesAsync();

            return Results.Created($"/api/v1/roles/{GetIdBoxed(role)}", new
            {
                Id = GetIdBoxed(role),
                Name = GetName(role),
                Description = GetDescription(role)
            });
        });

        // PUT /api/v1/roles/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateRoleRequest req, [FromServices] AppDbContext db) =>
        {
            var role = await db.Set<DomRole>().FirstOrDefaultAsync(r => ObjectIdEquals(r, id));
            if (role is null) return Results.NotFound();

            // Name update
            if (!string.IsNullOrWhiteSpace(req.Name))
            {
                var desiredName = req.Name!.Trim();

                // Duplicate check
                var others = await db.Set<DomRole>().AsNoTracking().Where(r => !ObjectIdEquals(r, id)).ToListAsync();
                if (others.Any(r => string.Equals(GetName(r) ?? "", desiredName, StringComparison.OrdinalIgnoreCase)))
                    return Results.Conflict(new { error = "A role with that name already exists." });

                var nameProp = GetNameProperty();
                if (nameProp?.CanWrite == true)
                {
                    nameProp.SetValue(role, desiredName);
                }
                else
                {
                    return Results.BadRequest(new { error = "Role name property is not writable on your Domain model." });
                }
            }

            // Description update
            if (req.Description is not null)
            {
                var descProp = GetDescriptionProperty();
                if (descProp?.CanWrite == true)
                {
                    descProp.SetValue(role, req.Description.Trim());
                }
                // else silently ignore if model lacks Description
            }

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                Id = GetIdBoxed(role),
                Name = GetName(role),
                Description = GetDescription(role)
            });
        });

        // DELETE /api/v1/roles/{id}
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var role = await db.Set<DomRole>().FirstOrDefaultAsync(r => ObjectIdEquals(r, id));
            if (role is null) return Results.NotFound();

            db.Remove(role);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return v1;
    }

    // ----------------- helpers (reflection-safe) -----------------
    private static PropertyInfo? GetIdProperty()
    {
        var t = typeof(DomRole);
        return t.GetProperty("Id") ?? t.GetProperty("ID") ?? t.GetProperty("RoleId") ?? t.GetProperty("RoleID");
    }
    private static object? GetIdBoxed(object role)
    {
        var p = GetIdProperty();
        return p?.GetValue(role);
    }
    private static bool ObjectIdEquals(object role, Guid id)
    {
        var val = GetIdBoxed(role);
        return val is Guid g && g == id;
    }

    private static PropertyInfo? GetNameProperty()
    {
        var t = typeof(DomRole);
        // Try common name-like fields
        return t.GetProperty("Name")
            ?? t.GetProperty("Code")
            ?? t.GetProperty("Key")
            ?? t.GetProperty("Title");
    }
    private static string? GetName(object role)
    {
        var p = GetNameProperty();
        var v = p?.GetValue(role);
        return v as string;
    }

    private static PropertyInfo? GetDescriptionProperty()
    {
        var t = typeof(DomRole);
        return t.GetProperty("Description")
            ?? t.GetProperty("Notes")
            ?? t.GetProperty("Detail");
    }
    private static string? GetDescription(object role)
    {
        var p = GetDescriptionProperty();
        var v = p?.GetValue(role);
        return v as string;
    }
}
