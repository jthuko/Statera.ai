using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Contracts;
using Statera.Infrastructure;

namespace Statera.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder v1)
    {
        var g = v1.MapGroup("/auth").WithTags("Auth");

        g.MapPost("/login", async (
            [FromBody] LoginRequest req,
            [FromServices] UserManager<AppUser> um,
            [FromServices] SignInManager<AppUser> sm,
            [FromServices] IJwtService jwt,
            [FromServices] AppDbContext db,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return Results.BadRequest(new { error = "Missing credentials" });

            var user = await um.FindByEmailAsync(req.Email);
            if (user is null) return Results.Unauthorized();

            var result = await sm.CheckPasswordSignInAsync(user, req.Password, lockoutOnFailure: false);
            if (!result.Succeeded) return Results.Unauthorized();

            // Owners get all facility IDs; others get only their assigned ones
            List<Guid> facilityIds;
            if (user.SystemRole == "Owner")
            {
                facilityIds = await db.Facilities.Select(f => f.Id).ToListAsync(ct);
            }
            else
            {
                facilityIds = await db.UserFacilityRoles
                    .Where(ufr => ufr.UserId == user.Id)
                    .Select(ufr => ufr.FacilityId)
                    .ToListAsync(ct);
            }

            // For Staff portal users embed their Staff record ID
            Guid? staffId = null;
            if (user.SystemRole == "Staff" && !string.IsNullOrWhiteSpace(user.Email))
            {
                var staffRecord = await db.Staff.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Email == user.Email, ct);
                staffId = staffRecord?.Id;
                // Staff can only access their own facility
                if (staffRecord != null && !facilityIds.Contains(staffRecord.FacilityId))
                    facilityIds = new List<Guid> { staffRecord.FacilityId };
            }

            var tokens = await jwt.CreateAsync(user, facilityIds, ct, staffId);
            return Results.Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
        });

        // Returns the current user's identity decoded from the Bearer token
        g.MapGet("/me", async (HttpContext ctx, [FromServices] AppDbContext db, CancellationToken ct) =>
        {
            var userId    = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var email     = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Email);
            var sysRole   = ctx.User.FindFirstValue("system_role") ?? "FacilityAdmin";
            var staffIdStr = ctx.User.FindFirstValue("staff_id");
            var fidClaims = ctx.User.FindAll("facility_id")
                                    .Select(c => c.Value)
                                    .ToList();

            if (userId is null) return Results.Unauthorized();

            // Attach trial info from the user's primary facility (first one)
            string? planStatus = null;
            DateTime? trialEndsUtc = null;
            if (fidClaims.Count > 0 && Guid.TryParse(fidClaims[0], out var primaryFacilityId))
            {
                var facility = await db.Facilities.AsNoTracking()
                    .Where(f => f.Id == primaryFacilityId)
                    .Select(f => new { f.PlanStatus, f.TrialEndsUtc })
                    .FirstOrDefaultAsync(ct);
                if (facility != null)
                {
                    planStatus    = facility.PlanStatus.ToString();
                    trialEndsUtc  = facility.TrialEndsUtc;
                }
            }

            return Results.Ok(new
            {
                Id           = userId,
                Email        = email ?? "",
                SystemRole   = sysRole,
                FacilityIds  = fidClaims,
                StaffId      = staffIdStr,
                PlanStatus   = planStatus,
                TrialEndsUtc = trialEndsUtc
            });
        })
        .RequireAuthorization();

        g.MapPost("/refresh", ([FromBody] RefreshTokenRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Results.BadRequest(new { error = "Missing refresh token" });
            // TODO: validate stored refresh token server-side for production
            return Results.Unauthorized();
        });

        g.MapPost("/logout", ([FromBody] LogoutRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Results.BadRequest(new { error = "Missing refresh token" });
            return Results.Ok(new { ok = true });
        });

        // POST /api/v1/auth/change-password
        g.MapPost("/change-password", async (
            HttpContext ctx,
            [FromBody] ChangePasswordRequest req,
            [FromServices] UserManager<AppUser> um) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (userId is null) return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(req.CurrentPassword) || string.IsNullOrWhiteSpace(req.NewPassword))
                return Results.BadRequest(new { error = "CurrentPassword and NewPassword are required" });

            var user = await um.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            var result = await um.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
            if (!result.Succeeded)
            {
                var errs = string.Join(", ", result.Errors.Select(e => e.Description));
                return Results.BadRequest(new { error = errs });
            }

            return Results.Ok(new { ok = true });
        })
        .RequireAuthorization();

        // POST /api/v1/auth/impersonate
        g.MapPost("/impersonate", async (
            HttpContext ctx,
            [FromBody] ImpersonateRequest req,
            [FromServices] UserManager<AppUser> um,
            [FromServices] AppDbContext db,
            [FromServices] IJwtService jwt,
            CancellationToken ct) =>
        {
            var userId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var sysRole = ctx.User.FindFirstValue("system_role") ?? "FacilityAdmin";

            if (userId is null) return Results.Unauthorized();
            if (sysRole != "Owner" && sysRole != "FacilityAdmin")
                return Results.Json(new { error = "Impersonation not allowed for this role" }, statusCode: StatusCodes.Status403Forbidden);

            var staff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.Id == req.StaffId, ct);
            if (staff is null) return Results.NotFound(new { error = "Staff not found" });

            if (sysRole != "Owner")
            {
                var allowedIds = ctx.User.FindAll("facility_id").Select(c => c.Value).ToHashSet();
                if (!allowedIds.Contains(staff.FacilityId.ToString()))
                    return Results.Json(new { error = "No access to staff facility" }, statusCode: StatusCodes.Status403Forbidden);
            }

            var impersonated = new AppUser
            {
                Id = userId,
                Email = staff.Email ?? "staff@impersonated.local",
                UserName = staff.Email ?? "staff@impersonated.local",
                SystemRole = "Staff"
            };

            var tokens = await jwt.CreateAsync(impersonated, new List<Guid> { staff.FacilityId }, ct, staff.Id);
            return Results.Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
        })
        .RequireAuthorization();

        g.MapPost("/register", ([FromBody] RegisterUserRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) ||
                string.IsNullOrWhiteSpace(req.Password) ||
                string.IsNullOrWhiteSpace(req.FirstName) ||
                string.IsNullOrWhiteSpace(req.LastName))
            {
                return Results.BadRequest(new { error = "All fields are required" });
            }
            return Results.Ok(new { registered = true, email = req.Email });
        });

        // POST /api/v1/auth/signup — self-service facility signup (7-day free trial)
        g.MapPost("/signup", async (
            [FromBody] SignupRequest req,
            [FromServices] UserManager<AppUser> um,
            [FromServices] AppDbContext db,
            [FromServices] IJwtService jwt,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) ||
                string.IsNullOrWhiteSpace(req.Password) ||
                string.IsNullOrWhiteSpace(req.FirstName) ||
                string.IsNullOrWhiteSpace(req.LastName) ||
                string.IsNullOrWhiteSpace(req.FacilityName) ||
                string.IsNullOrWhiteSpace(req.FacilityState))
            {
                return Results.BadRequest(new { error = "All required fields must be provided" });
            }

            if (await um.FindByEmailAsync(req.Email) != null)
                return Results.Conflict(new { error = "An account with this email already exists" });

            var now = DateTime.UtcNow;
            var facility = new Statera.Domain.Facility
            {
                Id            = Guid.NewGuid(),
                Name          = req.FacilityName.Trim(),
                Address       = (req.FacilityAddress ?? "").Trim(),
                City          = (req.FacilityCity ?? "").Trim(),
                State         = req.FacilityState.Trim().ToUpper(),
                Zip           = (req.FacilityZip ?? "").Trim(),
                PlanStatus    = Statera.Domain.PlanStatus.Trial,
                TrialStartUtc = now,
                TrialEndsUtc  = now.AddDays(7)
            };
            db.Facilities.Add(facility);

            var user = new AppUser
            {
                UserName       = req.Email.Trim(),
                Email          = req.Email.Trim(),
                EmailConfirmed = true,
                SystemRole     = "Owner"
            };
            var createResult = await um.CreateAsync(user, req.Password);
            if (!createResult.Succeeded)
            {
                var errs = string.Join(", ", createResult.Errors.Select(e => e.Description));
                return Results.BadRequest(new { error = errs });
            }

            db.UserFacilityRoles.Add(new UserFacilityRole
            {
                Id           = Guid.NewGuid(),
                UserId       = user.Id,
                FacilityId   = facility.Id,
                FacilityRole = "Owner",
                AssignedUtc  = now
            });

            await db.SaveChangesAsync(ct);

            var tokens = await jwt.CreateAsync(user, new List<Guid> { facility.Id }, ct, null);
            return Results.Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
        });

        // GET /api/v1/auth/users  — list all AppUsers for chat DM picker
        g.MapGet("/users", async (
            [FromServices] UserManager<AppUser> um,
            [FromServices] AppDbContext db,
            HttpContext ctx) =>
        {
            var currentId = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var users = um.Users
                .Where(u => u.Id != currentId)
                .Select(u => new { u.Id, u.Email, u.SystemRole })
                .ToList();

            // Enrich with staff names where available (matched by email)
            var emails = users.Select(u => u.Email).Where(e => e != null).ToList();
            var staffNames = await db.Staff.AsNoTracking()
                .Where(s => s.Email != null && emails.Contains(s.Email))
                .Select(s => new { s.Email, Name = s.FirstName + " " + s.LastName })
                .ToListAsync();
            var nameMap = staffNames.ToDictionary(s => s.Email!, s => s.Name);

            return Results.Ok(users.Select(u => new
            {
                u.Id,
                u.Email,
                u.SystemRole,
                DisplayName = u.Email != null && nameMap.TryGetValue(u.Email, out var n) ? n : u.Email,
            }));
        })
        .RequireAuthorization();

        return v1;
    }
}
