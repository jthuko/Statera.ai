using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Statera.Domain; // make sure this points to your Domain entities (Staff, Facility, Unit, Assignment, etc.)

namespace Statera.Infrastructure;

public static class DevDataSeeder
{
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

        // 🔨 (optional) reset DB
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

        // Owner user — global super-admin
        var adminEmail = "admin@statera.local";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new AppUser { UserName = adminEmail, Email = adminEmail, EmailConfirmed = true, SystemRole = "Owner" };
            var created = await userManager.CreateAsync(admin, "Password123!");
            if (created.Succeeded)
            {
                var addToRole = await userManager.AddToRoleAsync(admin, "Admin");
                if (!addToRole.Succeeded)
                    logger.LogWarning("Failed adding admin to Admin role: {Errors}", string.Join(", ", addToRole.Errors.Select(e => e.Description)));
            }
        }
        else if (admin.SystemRole != "Owner")
        {
            admin.SystemRole = "Owner";
            await userManager.UpdateAsync(admin);
        }

        // Demo FacilityAdmin — scoped to one facility (Statera Care Center)
        var fadminEmail = "fadmin@statera.local";
        var fadmin = await userManager.FindByEmailAsync(fadminEmail);
        if (fadmin is null)
        {
            fadmin = new AppUser { UserName = fadminEmail, Email = fadminEmail, EmailConfirmed = true, SystemRole = "FacilityAdmin" };
            var created = await userManager.CreateAsync(fadmin, "Password123!");
            if (!created.Succeeded)
                logger.LogWarning("Failed creating fadmin: {Errors}", string.Join(", ", created.Errors.Select(e => e.Description)));
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

        // Facilities + Units
        Facility stateraFacility, hudsonFacility;
        if (!await db.Facilities.AnyAsync())
        {
            stateraFacility = new Facility
            {
                Name = "Statera Care Center",
                Address = "100 Demo Rd",
                City = "Wichita",
                State = "KS",
                Zip = "67202"
            };
            hudsonFacility = new Facility
            {
                Name = "Hudson Home Care",
                Address = "200 River Ave",
                City = "Albany",
                State = "NY",
                Zip = "12207"
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
            stateraFacility = await db.Facilities.FirstAsync();
            hudsonFacility = await db.Facilities.OrderBy(f => f.Id).Skip(1).FirstOrDefaultAsync() ?? stateraFacility;
        }

        // Staff
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
                    FacilityId = i % 2 == 0 ? stateraFacility.Id : hudsonFacility.Id,
                    EmploymentType = i % 3 == 0 ? EmploymentType.Contract : EmploymentType.FullTime,
                    Role = cred.ToString(),
                    Active = true // ✅ make seeded staff active
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

        // ---- UserFacilityRole: assign fadmin to Statera Care Center ----
        if (fadmin is not null && !await db.UserFacilityRoles.AnyAsync(ufr => ufr.UserId == fadmin.Id))
        {
            db.UserFacilityRoles.Add(new UserFacilityRole
            {
                Id = Guid.NewGuid(),
                UserId = fadmin.Id,
                FacilityId = stateraFacility.Id,
                FacilityRole = "FacilityAdmin",
                AssignedByUserId = admin?.Id,
                AssignedUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            logger.LogInformation("DevDataSeeder: assigned fadmin to '{Facility}'.", stateraFacility.Name);
        }

        // ---- Assignments ----
        try
        {
            var primaryFacility = await db.Facilities.OrderBy(f => f.Name).FirstAsync();
            string facilityState = (primaryFacility.State ?? "KS").Trim().ToUpperInvariant();
            if (facilityState.Length > 2) facilityState = facilityState[..2];

            var unit = await db.Units
                .Where(u => u.FacilityId == primaryFacility.Id)
                .OrderBy(u => u.Name)
                .FirstOrDefaultAsync();

            var staff = await db.Staff
                .OrderBy(s => s.FirstName)
                .Take(6)
                .ToListAsync();

            bool hasAssignments = await db.Assignments.AnyAsync(a => a.FacilityId == primaryFacility.Id);
            if (!hasAssignments && staff.Any())
            {
                DateTime utcToday = DateTime.UtcNow.Date;
                int daysFromMonday = ((int)utcToday.DayOfWeek + 6) % 7; // Monday=0
                DateTime weekStartUtc = utcToday.AddDays(-daysFromMonday);

                Assignment Shift(Guid staffId, int dayOffset, int startHourUtc, int durationHours, string note)
                {
                    var start = weekStartUtc.AddDays(dayOffset).AddHours(startHourUtc);
                    var end = start.AddHours(durationHours);
                    return new Assignment
                    {
                        Id = Guid.NewGuid(),
                        StaffId = staffId,
                        FacilityId = primaryFacility.Id,
                        UnitId = unit?.Id,
                        FacilityState = facilityState,
                        StartUtc = start,
                        EndUtc = end,
                        Notes = note,
                        RowVersion = Array.Empty<byte>()
                    };
                }

                var items = new List<Assignment>();

                // s0: Mon–Fri 07–15
                if (staff.Count >= 1)
                    for (int d = 0; d < 5; d++) items.Add(Shift(staff[0].Id, d, 7, 8, "Day shift"));

                // s1: Mon–Fri 15–23
                if (staff.Count >= 2)
                    for (int d = 0; d < 5; d++) items.Add(Shift(staff[1].Id, d, 15, 8, "Evening shift"));

                // s2: Mon–Fri 23–07
                if (staff.Count >= 3)
                    for (int d = 0; d < 5; d++) items.Add(Shift(staff[2].Id, d, 23, 8, "Night shift"));

                // s3: Sat–Sun 07–19
                if (staff.Count >= 4)
                {
                    items.Add(Shift(staff[3].Id, 5, 7, 12, "Weekend long day"));
                    items.Add(Shift(staff[3].Id, 6, 7, 12, "Weekend long day"));
                }

                // s4: Tue/Thu 06–14
                if (staff.Count >= 5)
                {
                    items.Add(Shift(staff[4].Id, 1, 6, 8, "Tue AM"));
                    items.Add(Shift(staff[4].Id, 3, 6, 8, "Thu AM"));
                }

                // s5: Wed/Fri 10–18
                if (staff.Count >= 6)
                {
                    items.Add(Shift(staff[5].Id, 2, 10, 8, "Wed mid"));
                    items.Add(Shift(staff[5].Id, 4, 10, 8, "Fri mid"));
                }

                db.Assignments.AddRange(items);
                await db.SaveChangesAsync();

                logger.LogInformation("DevDataSeeder: seeded {Count} assignments for {Facility}.",
                    items.Count, primaryFacility.Name);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DevDataSeeder: error while seeding assignments.");
        }

        logger.LogInformation("DevDataSeeder: seeding complete.");
    }
}
