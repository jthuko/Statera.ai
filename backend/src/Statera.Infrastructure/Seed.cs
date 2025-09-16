using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Statera.Domain;

namespace Statera.Infrastructure;

public static class DevDataSeeder
{
    /// <summary>
    /// Drops and recreates the DB (optional) and seeds development data.
    /// Hard-guarded to run only in Development.
    /// </summary>
    public static async Task ResetAndSeedAsync(
        IServiceProvider sp,
        ILogger logger,
        bool isDevelopment,
        bool resetDatabase = true)
    {
        if (!isDevelopment)
        {
            logger.LogInformation("DevDataSeeder: skipped (not development).");
            return;
        }

        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

        // 🔨 (optional) nuke → recreate from current model
        if (resetDatabase)
        {
            logger.LogWarning("DevDataSeeder: resetting database via EnsureDeleted/EnsureCreated...");
            await db.Database.EnsureDeletedAsync();
            await db.Database.EnsureCreatedAsync();
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        // ---- Identity: roles + admin ----
        foreach (var roleName in new[] { "Admin", "Scheduler", "Staff" })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var r = await roleManager.CreateAsync(new AppRole { Name = roleName });
                if (!r.Succeeded)
                    logger.LogWarning("Failed creating role {Role}: {Errors}", roleName, string.Join(", ", r.Errors.Select(e => e.Description)));
            }
        }

        var adminEmail = "admin@statera.local";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new AppUser { UserName = adminEmail, Email = adminEmail, EmailConfirmed = true };
            var created = await userManager.CreateAsync(admin, "Password123!");
            if (!created.Succeeded)
            {
                logger.LogWarning("Failed creating admin user: {Errors}", string.Join(", ", created.Errors.Select(e => e.Description)));
            }
            else
            {
                var addToRole = await userManager.AddToRoleAsync(admin, "Admin");
                if (!addToRole.Succeeded)
                    logger.LogWarning("Failed adding admin to Admin role: {Errors}", string.Join(", ", addToRole.Errors.Select(e => e.Description)));
            }
        }

        // ---- Domain seeds ----

        // Overtime rule
        if (!await db.OvertimeRules.AnyAsync())
        {
            db.OvertimeRules.Add(new OvertimeRule
            {
                WeeklyHoursThreshold = 40,
                HardBlock = false,
                PenaltyWeight = 0.3
            });
        }

        // Facilities (+ Address, City, State, Zip) and Units
        Facility stateraFacility, hudsonFacility;
        if (!await db.Facilities.AnyAsync())
        {
            stateraFacility = new Facility
            {
                Name = "Statera Care Center",
                Address = "100 Demo Rd",     // REQUIRED
                City = "Wichita",            // REQUIRED
                State = "KS",                // REQUIRED
                Zip = "67202"                // REQUIRED
            };
            hudsonFacility = new Facility
            {
                Name = "Hudson Home Care",
                Address = "200 River Ave",   // REQUIRED
                City = "Albany",             // REQUIRED
                State = "NY",                // REQUIRED
                Zip = "12207"                // REQUIRED
            };

            db.Facilities.AddRange(stateraFacility, hudsonFacility);

            db.Units.AddRange(
                new Unit { Name = "ICU", Facility = stateraFacility },
                new Unit { Name = "Med-Surg", Facility = stateraFacility },
                new Unit { Name = "ER", Facility = stateraFacility },
                new Unit { Name = "Rehab", Facility = hudsonFacility },
                new Unit { Name = "Home Visits", Facility = hudsonFacility }
            );
        }
        else
        {
            // Use existing rows if present
            stateraFacility = await db.Facilities.FirstAsync();
            hudsonFacility = await db.Facilities.OrderBy(f => f.Id).Skip(1).FirstOrDefaultAsync() ?? stateraFacility;
        }

        // Staff (+ required Role) with Licenses and Availabilities (explicit Staff back-link)
        if (!await db.Staff.AnyAsync())
        {
            var credentialOptions = new[] { CredentialType.RN, CredentialType.LPN, CredentialType.CNA };
            var rnd = new Random(7);
            var staffBatch = new List<Staff>();

            for (int i = 1; i <= 30; i++)
            {
                var cred = credentialOptions[rnd.Next(credentialOptions.Length)];
                var first = $"{cred}{i}";

                var staff = new Staff
                {
                    Email = $"{first.ToLower()}@statera.local",
                    FirstName = first,
                    LastName = "Demo",
                    EmploymentType = i % 3 == 0 ? EmploymentType.Contract : EmploymentType.FullTime,

                    // REQUIRED in your schema
                    Role = cred.ToString() // "RN" | "LPN" | "CNA"
                };

                staff.Licenses = new List<StaffLicense>
                {
                    new StaffLicense
                    {
                        IssuingState  = i % 2 == 0 ? "KS" : "NY",
                        LicenseType   = cred.ToString(),
                        LicenseNumber = $"LIC{i:00000}",
                        ExpiresOn     = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6 + (i % 6))),
                        IsActive      = true
                    }
                };

                staff.Availabilities = new List<StaffAvailability>
                {
                    new StaffAvailability { Staff = staff, DayOfWeek = DayOfWeek.Monday,    StartLocal = new TimeSpan(7,0,0), EndLocal = new TimeSpan(19,0,0) },
                    new StaffAvailability { Staff = staff, DayOfWeek = DayOfWeek.Wednesday, StartLocal = new TimeSpan(7,0,0), EndLocal = new TimeSpan(19,0,0) },
                    new StaffAvailability { Staff = staff, DayOfWeek = DayOfWeek.Friday,    StartLocal = new TimeSpan(7,0,0), EndLocal = new TimeSpan(19,0,0) }
                };

                staffBatch.Add(staff);
            }

            db.Staff.AddRange(staffBatch);
        }

        await db.SaveChangesAsync();
        logger.LogInformation("DevDataSeeder: seeding complete.");
    }
}
