// backend/src/Statera.Api/Endpoints/StaffEndpoints.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Infrastructure;          // AppDbContext, AppUser
using Statera.Api.Contracts;          // CreateStaffRequest, UpdateStaffRequest
using Statera.Domain;                 // Staff, EmploymentType
using DomStaff = Statera.Domain.Staff;

namespace Statera.Api.Endpoints;

public static class StaffEndpoints
{
    /// <summary>
    /// Maps staff endpoints under the provided v1 route group (e.g., /api/v1).
    /// </summary>
    public static RouteGroupBuilder MapStaffEndpoints(this RouteGroupBuilder v1)
    {
        // ----- Facility-scoped shorthand: /api/v1/facilities/{facilityId}/staff  -----
        // Mirrors GET /api/v1/staff?facilityId=...
        v1.MapGet("/facilities/{facilityId:guid}/staff", async (
            Guid facilityId,
            Guid? unitId,
            bool? active,
            string? role,
            string? q,
            [FromServices] AppDbContext db) =>
        {
            var query = db.Staff.AsNoTracking().AsQueryable();

            // Required facility filter for this route:
            query = query.Where(s => s.FacilityId == facilityId);

            if (unitId.HasValue) query = query.Where(s => s.UnitId == unitId.Value);
            if (active.HasValue) query = query.Where(s => s.Active == active.Value);
            if (!string.IsNullOrWhiteSpace(role))
            {
                var r = role.Trim();
                query = query.Where(s => s.Role == r);
            }
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(s =>
                    (s.FirstName != null && s.FirstName.Contains(term)) ||
                    (s.LastName != null && s.LastName.Contains(term)) ||
                    (s.Email != null && s.Email.Contains(term)));
            }

            var rows = await query
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName)
                .ToListAsync();

            return Results.Ok(rows);
        })
        .WithTags("Staff");

        // ----- Original /api/v1/staff group -----
        var g = v1.MapGroup("/staff").WithTags("Staff");

        // GET /api/v1/staff?facilityId=&unitId=&active=&role=&q=
        g.MapGet("/", async (
            Guid? facilityId,
            Guid? unitId,
            bool? active,
            string? role,
            string? q,
            [FromServices] AppDbContext db) =>
        {
            var query = db.Staff.AsNoTracking().AsQueryable();

            if (facilityId.HasValue) query = query.Where(s => s.FacilityId == facilityId.Value);
            if (unitId.HasValue) query = query.Where(s => s.UnitId == unitId.Value);
            if (active.HasValue) query = query.Where(s => s.Active == active.Value);

            if (!string.IsNullOrWhiteSpace(role))
            {
                var r = role.Trim();
                query = query.Where(s => s.Role == r);
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(s =>
                    (s.FirstName != null && s.FirstName.Contains(term)) ||
                    (s.LastName != null && s.LastName.Contains(term)) ||
                    (s.Email != null && s.Email.Contains(term)));
            }

            var rows = await query
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName)
                .ToListAsync();

            return Results.Ok(rows);
        });

        // GET /api/v1/staff/{id}
        g.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if (e is null) return Results.NotFound();

            // hasAdminAccount = they have an AppUser AND an active UserFacilityRole for this facility
            var hasAdminAccount = false;
            if (!string.IsNullOrWhiteSpace(e.Email))
            {
                var appUser = await db.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Email == e.Email);
                if (appUser is not null)
                {
                    hasAdminAccount = await db.UserFacilityRoles
                        .AnyAsync(ufr => ufr.UserId == appUser.Id && ufr.FacilityId == e.FacilityId);
                }
            }

            return Results.Ok(new
            {
                e.Id, e.FirstName, e.LastName, e.Email,
                e.FacilityId, e.UnitId, e.Role, e.EmploymentType, e.Active,
                HasAdminAccount = hasAdminAccount
            });
        });

        // POST /api/v1/staff
        g.MapPost("/", async (
            [FromBody] CreateStaffRequest req,
            [FromServices] AppDbContext db,
            [FromServices] UserManager<AppUser> um) =>
        {
            if (req.FacilityId == Guid.Empty)
                return Results.BadRequest(new { error = "FacilityId is required" });

            if (!await db.Facilities.AnyAsync(f => f.Id == req.FacilityId))
                return Results.BadRequest(new { error = "Facility not found" });

            if (req.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == req.UnitId.Value))
                return Results.BadRequest(new { error = "Unit not found" });

            if (string.IsNullOrWhiteSpace(req.FirstName) ||
                string.IsNullOrWhiteSpace(req.LastName) ||
                string.IsNullOrWhiteSpace(req.Role) ||
                string.IsNullOrWhiteSpace(req.EmploymentType))
            {
                return Results.BadRequest(new { error = "FirstName, LastName, Role, EmploymentType are required" });
            }

            if (!Enum.TryParse<EmploymentType>(req.EmploymentType, ignoreCase: true, out var et))
            {
                var allowed = string.Join(", ", Enum.GetNames(typeof(EmploymentType)));
                return Results.BadRequest(new { error = $"EmploymentType must be one of: {allowed}" });
            }

            // Enforce unique email if provided
            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var email = req.Email.Trim();
                var exists = await db.Staff.AnyAsync(s => s.Email != null && s.Email == email);
                if (exists) return Results.Conflict(new { error = "A staff member with that email already exists." });
            }

            var e = new DomStaff
            {
                Id = Guid.NewGuid(),
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim(),
                FacilityId = req.FacilityId,
                UnitId = req.UnitId,
                Role = req.Role.Trim(),
                EmploymentType = et,
                Active = req.Active
            };

            db.Staff.Add(e);
            await db.SaveChangesAsync();

            // Only create a login account when AdminAccess is explicitly requested
            string? tempPassword = null;
            if (req.AdminAccess && !string.IsNullOrWhiteSpace(e.Email))
            {
                var existingUser = await um.FindByEmailAsync(e.Email);
                if (existingUser is null)
                {
                    tempPassword = "TempPass123!";
                    var appUser = new AppUser
                    {
                        UserName       = e.Email,
                        Email          = e.Email,
                        EmailConfirmed = true,
                        SystemRole     = "FacilityAdmin"
                    };
                    await um.CreateAsync(appUser, tempPassword);
                }
            }

            return Results.Created($"/api/v1/staff/{e.Id}", new
            {
                e.Id,
                e.FirstName,
                e.LastName,
                e.Email,
                e.FacilityId,
                e.UnitId,
                e.Role,
                e.Active,
                LoginCreated = tempPassword is not null,
                TempPassword = tempPassword
            });
        });

        // PUT /api/v1/staff/{id}
        g.MapPut("/{id:guid}", async (Guid id, [FromBody] UpdateStaffRequest req, [FromServices] AppDbContext db) =>
        {
            var e = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (e is null) return Results.NotFound();

            if (req.FacilityId.HasValue)
            {
                var fid = req.FacilityId.Value;
                if (!await db.Facilities.AnyAsync(f => f.Id == fid))
                    return Results.BadRequest(new { error = "Facility not found" });
                e.FacilityId = fid;
            }

            if (req.UnitId.HasValue)
            {
                var uid = req.UnitId.Value;
                if (!await db.Units.AnyAsync(u => u.Id == uid))
                    return Results.BadRequest(new { error = "Unit not found" });
                e.UnitId = uid;
            }

            if (!string.IsNullOrWhiteSpace(req.FirstName)) e.FirstName = req.FirstName.Trim();
            if (!string.IsNullOrWhiteSpace(req.LastName)) e.LastName = req.LastName.Trim();
            if (!string.IsNullOrWhiteSpace(req.Role)) e.Role = req.Role.Trim();

            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var email = req.Email.Trim();
                var exists = await db.Staff.AnyAsync(s => s.Id != id && s.Email != null && s.Email == email);
                if (exists) return Results.Conflict(new { error = "A staff member with that email already exists." });
                e.Email = email;
            }

            if (!string.IsNullOrWhiteSpace(req.EmploymentType))
            {
                if (!Enum.TryParse<EmploymentType>(req.EmploymentType, ignoreCase: true, out var et))
                {
                    var allowed = string.Join(", ", Enum.GetNames(typeof(EmploymentType)));
                    return Results.BadRequest(new { error = $"EmploymentType must be one of: {allowed}" });
                }
                e.EmploymentType = et;
            }

            if (req.Active.HasValue) e.Active = req.Active.Value;

            await db.SaveChangesAsync();
            return Results.Ok(e);
        });

        // DELETE /api/v1/staff/{id}
        g.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var e = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (e is null) return Results.NotFound();

            db.Staff.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // POST /api/v1/staff/{id}/grant-admin
        // Creates a FacilityAdmin login account for an existing staff member
        // and auto-assigns them to their facility. Safe to call multiple times.
        g.MapPost("/{id:guid}/grant-admin", async (
            Guid id,
            [FromServices] AppDbContext db,
            [FromServices] UserManager<AppUser> um) =>
        {
            var staff = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff is null) return Results.NotFound();

            if (string.IsNullOrWhiteSpace(staff.Email))
                return Results.BadRequest(new { error = "Staff member must have an email to grant admin access." });

            var existingUser = await um.FindByEmailAsync(staff.Email);
            if (existingUser is not null)
                return Results.Conflict(new { error = "A login account already exists for this email." });

            var tempPassword = "TempPass123!";
            var appUser = new AppUser
            {
                UserName       = staff.Email,
                Email          = staff.Email,
                EmailConfirmed = true,
                SystemRole     = "FacilityAdmin"
            };
            var result = await um.CreateAsync(appUser, tempPassword);
            if (!result.Succeeded)
            {
                var errs = string.Join(", ", result.Errors.Select(e => e.Description));
                return Results.BadRequest(new { error = errs });
            }

            // Auto-assign to the staff member's facility
            var alreadyAssigned = await db.UserFacilityRoles
                .AnyAsync(ufr => ufr.UserId == appUser.Id && ufr.FacilityId == staff.FacilityId);
            if (!alreadyAssigned)
            {
                db.UserFacilityRoles.Add(new UserFacilityRole
                {
                    Id           = Guid.NewGuid(),
                    UserId       = appUser.Id,
                    FacilityId   = staff.FacilityId,
                    FacilityRole = "FacilityAdmin",
                    AssignedUtc  = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }

            return Results.Ok(new { email = staff.Email, tempPassword });
        });

        // DELETE /api/v1/staff/{id}/grant-admin
        // Revokes facility admin access for a staff member (removes their UserFacilityRole).
        // The AppUser login account is kept so history/audit trail is preserved.
        g.MapDelete("/{id:guid}/grant-admin", async (
            Guid id,
            [FromServices] AppDbContext db,
            [FromServices] UserManager<AppUser> um) =>
        {
            var staff = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff is null) return Results.NotFound();

            if (string.IsNullOrWhiteSpace(staff.Email))
                return Results.BadRequest(new { error = "Staff member has no email." });

            var appUser = await um.FindByEmailAsync(staff.Email);
            if (appUser is null)
                return Results.BadRequest(new { error = "No login account found for this staff member." });

            var ufr = await db.UserFacilityRoles
                .FirstOrDefaultAsync(r => r.UserId == appUser.Id && r.FacilityId == staff.FacilityId);

            if (ufr is not null)
            {
                db.UserFacilityRoles.Remove(ufr);
                await db.SaveChangesAsync();
            }

            return Results.NoContent();
        });

        return v1;
    }
}
