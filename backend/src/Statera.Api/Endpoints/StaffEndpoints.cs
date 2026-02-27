// backend/src/Statera.Api/Endpoints/StaffEndpoints.cs
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Http;
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

            var hasAdminAccount  = false;
            var hasPortalAccount = false;
            if (!string.IsNullOrWhiteSpace(e.Email))
            {
                var appUser = await db.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Email == e.Email);
                if (appUser is not null)
                {
                    hasAdminAccount = await db.UserFacilityRoles
                        .AnyAsync(ufr => ufr.UserId == appUser.Id && ufr.FacilityId == e.FacilityId);
                    hasPortalAccount = appUser.SystemRole == "Staff";
                }
            }

            return Results.Ok(new
            {
                e.Id, e.FirstName, e.LastName, e.Email,
                e.FacilityId, e.UnitId, e.Role, e.EmploymentType, e.Active,
                e.Phone, e.Address1, e.Address2, e.City, e.State, e.Zip,
                e.DateOfBirth, e.EmergencyContactName, e.EmergencyContactPhone,
                e.PhotoUrl,
                e.GustoEmployeeId, e.QuickBooksEmployeeId,
                HasAdminAccount  = hasAdminAccount,
                HasPortalAccount = hasPortalAccount,
            });
        });

        // GET /api/v1/staff/me — staff self profile
        g.MapGet("/me", async (HttpContext ctx, [FromServices] AppDbContext db) =>
        {
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            if (!Guid.TryParse(staffIdStr, out var staffId)) return Results.Unauthorized();

            var e = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.Id == staffId);
            if (e is null) return Results.NotFound();

            return Results.Ok(new
            {
                e.Id, e.FirstName, e.LastName, e.Email,
                e.FacilityId, e.UnitId, e.Role, e.EmploymentType, e.Active,
                e.Phone, e.Address1, e.Address2, e.City, e.State, e.Zip,
                e.DateOfBirth, e.EmergencyContactName, e.EmergencyContactPhone,
                e.PhotoUrl,
                e.GustoEmployeeId, e.QuickBooksEmployeeId,
            });
        })
        .RequireAuthorization("Authenticated");

        // PUT /api/v1/staff/me/profile — staff updates profile/demographics
        g.MapPut("/me/profile", async (
            HttpContext ctx,
            [FromBody] UpdateStaffProfileRequest req,
            [FromServices] AppDbContext db) =>
        {
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            if (!Guid.TryParse(staffIdStr, out var staffId)) return Results.Unauthorized();

            var e = await db.Staff.FirstOrDefaultAsync(s => s.Id == staffId);
            if (e is null) return Results.NotFound();

            e.Phone = req.Phone?.Trim();
            e.Address1 = req.Address1?.Trim();
            e.Address2 = req.Address2?.Trim();
            e.City = req.City?.Trim();
            e.State = req.State?.Trim();
            e.Zip = req.Zip?.Trim();
            e.DateOfBirth = req.DateOfBirth;
            e.EmergencyContactName = req.EmergencyContactName?.Trim();
            e.EmergencyContactPhone = req.EmergencyContactPhone?.Trim();
            e.PhotoUrl = req.PhotoUrl?.Trim();

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                e.Id, e.FirstName, e.LastName, e.Email,
                e.FacilityId, e.UnitId, e.Role, e.EmploymentType, e.Active,
                e.Phone, e.Address1, e.Address2, e.City, e.State, e.Zip,
                e.DateOfBirth, e.EmergencyContactName, e.EmergencyContactPhone,
                e.PhotoUrl,
                e.GustoEmployeeId, e.QuickBooksEmployeeId,
            });
        })
        .RequireAuthorization("Authenticated");

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
                Active = req.Active,
                Phone = req.Phone?.Trim(),
                Address1 = req.Address1?.Trim(),
                Address2 = req.Address2?.Trim(),
                City = req.City?.Trim(),
                State = req.State?.Trim(),
                Zip = req.Zip?.Trim(),
                DateOfBirth = req.DateOfBirth,
                EmergencyContactName = req.EmergencyContactName?.Trim(),
                EmergencyContactPhone = req.EmergencyContactPhone?.Trim(),
                PhotoUrl = req.PhotoUrl?.Trim(),
                GustoEmployeeId = req.GustoEmployeeId?.Trim(),
                QuickBooksEmployeeId = req.QuickBooksEmployeeId?.Trim(),
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
                e.Phone, e.Address1, e.Address2, e.City, e.State, e.Zip,
                e.DateOfBirth, e.EmergencyContactName, e.EmergencyContactPhone,
                e.PhotoUrl,
                e.GustoEmployeeId, e.QuickBooksEmployeeId,
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

            if (req.Phone is not null) e.Phone = req.Phone?.Trim();
            if (req.Address1 is not null) e.Address1 = req.Address1?.Trim();
            if (req.Address2 is not null) e.Address2 = req.Address2?.Trim();
            if (req.City is not null) e.City = req.City?.Trim();
            if (req.State is not null) e.State = req.State?.Trim();
            if (req.Zip is not null) e.Zip = req.Zip?.Trim();
            if (req.DateOfBirth.HasValue) e.DateOfBirth = req.DateOfBirth;
            if (req.EmergencyContactName is not null) e.EmergencyContactName = req.EmergencyContactName?.Trim();
            if (req.EmergencyContactPhone is not null) e.EmergencyContactPhone = req.EmergencyContactPhone?.Trim();
            if (req.PhotoUrl is not null) e.PhotoUrl = req.PhotoUrl?.Trim();
            if (req.GustoEmployeeId is not null) e.GustoEmployeeId = req.GustoEmployeeId?.Trim();
            if (req.QuickBooksEmployeeId is not null) e.QuickBooksEmployeeId = req.QuickBooksEmployeeId?.Trim();

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

        // GET /api/v1/staff/{id}/availability
        g.MapGet("/{id:guid}/availability", async (Guid id, [FromServices] AppDbContext db) =>
        {
            var rows = await db.StaffAvailabilities.AsNoTracking()
                .Where(a => a.StaffId == id)
                .OrderBy(a => a.DayOfWeek).ThenBy(a => a.StartLocal)
                .ToListAsync();
            return Results.Ok(rows.Select(a => new
            {
                a.Id, a.StaffId,
                DayOfWeek = (int)a.DayOfWeek,
                StartLocal = a.StartLocal.ToString(@"hh\:mm"),
                EndLocal   = a.EndLocal.ToString(@"hh\:mm"),
            }));
        });

        // PUT /api/v1/staff/{id}/availability  — full replace
        g.MapPut("/{id:guid}/availability", async (
            Guid id,
            [FromBody] List<AvailabilityEntry> entries,
            [FromServices] AppDbContext db) =>
        {
            var staffExists = await db.Staff.AnyAsync(s => s.Id == id);
            if (!staffExists) return Results.NotFound();

            // Remove existing
            var existing = db.StaffAvailabilities.Where(a => a.StaffId == id);
            db.StaffAvailabilities.RemoveRange(existing);

            // Add new
            foreach (var e in entries)
            {
                if (!TimeSpan.TryParse(e.StartLocal, out var start)) continue;
                if (!TimeSpan.TryParse(e.EndLocal, out var end)) continue;
                if (end <= start) continue;
                db.StaffAvailabilities.Add(new Statera.Domain.StaffAvailability
                {
                    Id         = Guid.NewGuid(),
                    StaffId    = id,
                    DayOfWeek  = (DayOfWeek)e.DayOfWeek,
                    StartLocal = start,
                    EndLocal   = end,
                });
            }
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // POST /api/v1/staff/{id}/create-portal-account
        // Creates a Staff-role login account for a staff member (for the Staff Portal).
        g.MapPost("/{id:guid}/create-portal-account", async (
            Guid id,
            [FromServices] AppDbContext db,
            [FromServices] UserManager<AppUser> um) =>
        {
            var staff = await db.Staff.FirstOrDefaultAsync(s => s.Id == id);
            if (staff is null) return Results.NotFound();

            if (string.IsNullOrWhiteSpace(staff.Email))
                return Results.BadRequest(new { error = "Staff member must have an email address." });

            var existing = await um.FindByEmailAsync(staff.Email);
            if (existing is not null)
                return Results.Conflict(new { error = "A login account already exists for this email." });

            var tempPassword = "TempPass123!";
            var appUser = new AppUser
            {
                UserName       = staff.Email,
                Email          = staff.Email,
                EmailConfirmed = true,
                SystemRole     = "Staff"
            };
            var result = await um.CreateAsync(appUser, tempPassword);
            if (!result.Succeeded)
            {
                var errs = string.Join(", ", result.Errors.Select(e => e.Description));
                return Results.BadRequest(new { error = errs });
            }

            return Results.Ok(new { email = staff.Email, tempPassword, staffId = staff.Id });
        });

        // POST /api/v1/staff/{id}/reset-password
        // Resets the portal account password for a staff member and returns a new temp password.
        g.MapPost("/{id:guid}/reset-password", async (
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

            // Generate new temp password
            var newPassword = "TempPass123!";
            var token = await um.GeneratePasswordResetTokenAsync(appUser);
            var result = await um.ResetPasswordAsync(appUser, token, newPassword);
            if (!result.Succeeded)
            {
                var errs = string.Join(", ", result.Errors.Select(e => e.Description));
                return Results.BadRequest(new { error = errs });
            }

            return Results.Ok(new { email = staff.Email, tempPassword = newPassword });
        });

        // POST /api/v1/staff/import?facilityId={guid}
        // Accepts a multipart form with a single "file" field (.csv or .xlsx).
        // Validates and creates each row; returns a summary of successes and per-row errors.
        g.MapPost("/import", async (
            [FromQuery] Guid facilityId,
            HttpRequest request,
            [FromServices] AppDbContext db) =>
        {
            if (facilityId == Guid.Empty)
                return Results.BadRequest(new { error = "facilityId query parameter is required." });

            if (!await db.Facilities.AnyAsync(f => f.Id == facilityId))
                return Results.BadRequest(new { error = "Facility not found." });

            if (!request.HasFormContentType || !request.Form.Files.Any())
                return Results.BadRequest(new { error = "Upload a CSV or Excel (.xlsx) file." });

            var file = request.Form.Files[0];
            var ext  = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".csv" && ext != ".xlsx")
                return Results.BadRequest(new { error = "Only .csv and .xlsx files are supported." });

            // ── Parse rows ──────────────────────────────────────────────────
            var rawRows = new List<Dictionary<string, string>>();
            try
            {
                if (ext == ".csv")
                {
                    using var reader = new StreamReader(file.OpenReadStream());
                    var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                        { HeaderValidated = null, MissingFieldFound = null };
                    using var csv = new CsvReader(reader, config);
                    await csv.ReadAsync();
                    csv.ReadHeader();
                    var headers = csv.HeaderRecord!.Select(h => h.Trim()).ToArray();
                    while (await csv.ReadAsync())
                    {
                        var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        foreach (var h in headers)
                            row[h] = csv.GetField(h)?.Trim() ?? "";
                        rawRows.Add(row);
                    }
                }
                else // .xlsx
                {
                    using var ms = new MemoryStream();
                    await file.CopyToAsync(ms);
                    ms.Position = 0;
                    using var wb = new XLWorkbook(ms);
                    var ws = wb.Worksheets.First();
                    var headerRow = ws.Row(1);
                    var headers = headerRow.CellsUsed()
                        .Select(c => c.GetString().Trim())
                        .ToArray();
                    foreach (var row in ws.RowsUsed().Skip(1))
                    {
                        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < headers.Length; i++)
                            dict[headers[i]] = row.Cell(i + 1).GetString().Trim();
                        rawRows.Add(dict);
                    }
                }
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = $"Failed to parse file: {ex.Message}" });
            }

            if (rawRows.Count == 0)
                return Results.BadRequest(new { error = "The file contains no data rows." });

            // ── Helper: resolve a column by multiple possible names ──────────
            static string? Col(Dictionary<string, string> row, params string[] names)
            {
                foreach (var n in names)
                    if (row.TryGetValue(n, out var v) && !string.IsNullOrWhiteSpace(v))
                        return v.Trim();
                return null;
            }

            // Normalise employment type variants: "full-time", "Full Time" → "FullTime"
            static string NormaliseEmploymentType(string raw) =>
                raw.Replace("-", "").Replace(" ", "").Replace("_", "");

            // ── Pre-load existing emails to detect duplicates ─────────────────
            var existingEmailsList = await db.Staff.AsNoTracking()
                .Where(s => s.Email != null)
                .Select(s => s.Email!.ToLower())
                .ToListAsync();
            var existingEmails = new HashSet<string>(existingEmailsList, StringComparer.OrdinalIgnoreCase);

            // ── Validate & build entities ─────────────────────────────────────
            var errors  = new List<object>();
            var toAdd   = new List<DomStaff>();
            var batchEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (int i = 0; i < rawRows.Count; i++)
            {
                int rowNum = i + 2; // 1-based; row 1 is header
                var r = rawRows[i];

                var firstName      = Col(r, "firstName", "first_name", "First Name", "FirstName");
                var lastName       = Col(r, "lastName", "last_name", "Last Name", "LastName");
                var email          = Col(r, "email", "Email");
                var role           = Col(r, "role", "Role");
                var employmentType = Col(r, "employmentType", "employment_type", "Employment Type", "EmploymentType");
                var unitIdRaw      = Col(r, "unitId", "unit_id", "Unit Id", "UnitId");
                var activeRaw      = Col(r, "active", "Active");

                // Required field checks
                if (string.IsNullOrWhiteSpace(firstName))
                { errors.Add(new { row = rowNum, message = "firstName is required." }); continue; }
                if (string.IsNullOrWhiteSpace(lastName))
                { errors.Add(new { row = rowNum, message = "lastName is required." }); continue; }
                if (string.IsNullOrWhiteSpace(role))
                { errors.Add(new { row = rowNum, message = "role is required." }); continue; }
                if (string.IsNullOrWhiteSpace(employmentType))
                { errors.Add(new { row = rowNum, message = "employmentType is required." }); continue; }

                if (!Enum.TryParse<EmploymentType>(NormaliseEmploymentType(employmentType), ignoreCase: true, out var et))
                {
                    var allowed = string.Join(", ", Enum.GetNames(typeof(EmploymentType)));
                    errors.Add(new { row = rowNum, message = $"Invalid employmentType '{employmentType}'. Allowed: {allowed}." });
                    continue;
                }

                // Email uniqueness
                if (!string.IsNullOrWhiteSpace(email))
                {
                    var emailLower = email.ToLower();
                    if (existingEmails.Contains(emailLower))
                    { errors.Add(new { row = rowNum, message = $"Email '{email}' is already in use." }); continue; }
                    if (!batchEmails.Add(emailLower))
                    { errors.Add(new { row = rowNum, message = $"Email '{email}' appears more than once in the file." }); continue; }
                }

                // Unit resolution
                Guid? unitId = null;
                if (!string.IsNullOrWhiteSpace(unitIdRaw))
                {
                    if (Guid.TryParse(unitIdRaw, out var parsedUnitId))
                    {
                        if (!await db.Units.AnyAsync(u => u.Id == parsedUnitId && u.FacilityId == facilityId))
                        { errors.Add(new { row = rowNum, message = $"Unit '{unitIdRaw}' not found in this facility." }); continue; }
                        unitId = parsedUnitId;
                    }
                    else
                    {
                        // Try name lookup
                        var unit = await db.Units.AsNoTracking()
                            .FirstOrDefaultAsync(u => u.FacilityId == facilityId && u.Name == unitIdRaw);
                        if (unit is null)
                        { errors.Add(new { row = rowNum, message = $"Unit '{unitIdRaw}' not found. Provide a valid unit name or GUID." }); continue; }
                        unitId = unit.Id;
                    }
                }

                bool active = true;
                if (!string.IsNullOrWhiteSpace(activeRaw))
                    bool.TryParse(activeRaw, out active);

                toAdd.Add(new DomStaff
                {
                    Id             = Guid.NewGuid(),
                    FirstName      = firstName,
                    LastName       = lastName,
                    Email          = string.IsNullOrWhiteSpace(email) ? null : email,
                    FacilityId     = facilityId,
                    UnitId         = unitId,
                    Role           = role,
                    EmploymentType = et,
                    Active         = active,
                });
            }

            // ── Save all valid rows together ──────────────────────────────────
            if (toAdd.Count > 0)
            {
                db.Staff.AddRange(toAdd);
                await db.SaveChangesAsync();
            }

            return Results.Ok(new
            {
                successCount = toAdd.Count,
                errorCount   = errors.Count,
                errors,
            });
        })
        .DisableAntiforgery()
        .RequireAuthorization();

        return v1;
    }

    private record AvailabilityEntry(int DayOfWeek, string StartLocal, string EndLocal);
}
