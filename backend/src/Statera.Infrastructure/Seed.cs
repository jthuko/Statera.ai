using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging; // <-- add this
using Statera.Domain;
using Statera.Application;
namespace Statera.Infrastructure;

    public static class DevDataSeeder
    {
        public static async Task SeedAsync(IServiceProvider sp, ILogger logger, bool isDevelopment)
        {
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var um = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var rm = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

            if (isDevelopment)
            {
                await db.Database.EnsureCreatedAsync();

                foreach (var r in new[] { "Admin", "Scheduler", "Staff" })
                    if (!await rm.RoleExistsAsync(r))
                        await rm.CreateAsync(new AppRole { Name = r });

                var email = "admin@statera.local";
                var user = await um.FindByEmailAsync(email);
                if (user is null)
                {
                    user = new AppUser { UserName = email, Email = email, EmailConfirmed = true };
                    var created = await um.CreateAsync(user, "Password123!");
                    if (!created.Succeeded)
                    {
                        logger.LogWarning("Failed creating admin user: {Errors}", string.Join(", ", created.Errors.Select(e => e.Description)));
                    }
                    else
                    {
                        await um.AddToRoleAsync(user, "Admin");
                    }
                }

                if (!await db.OvertimeRules.AnyAsync())
                    db.OvertimeRules.Add(new OvertimeRule { WeeklyHoursThreshold = 40, HardBlock = false, PenaltyWeight = 0.3 });

                if (!await db.Facilities.AnyAsync())
                {
                    var fac = new Facility { Name = "Statera Care Center", State = "KS" };
                    var unit = new Unit { Name = "ICU", Facility = fac };
                    db.Facilities.Add(fac);
                    db.Units.Add(unit);

                    for (int i = 1; i <= 8; i++)
                    {
                        var st = new Staff
                        {
                            Email = $"nurse{i}@statera.local",
                            FirstName = $"Nurse{i}",
                            LastName = "Demo",
                            EmploymentType = EmploymentType.FullTime,
                            Licenses = new List<StaffLicense>
                            {
                              new StaffLicense
                                {
                                    IssuingState = "KS",
                                    LicenseType  = (i % 2 == 0 ? CredentialType.RN : CredentialType.LPN).ToString(), // string
                                    LicenseNumber = $"KS{i:00000}",
                                    ExpiresOn     = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),            // DateOnly
                                    IsActive      = true
                                }

                            },
                            Availabilities = new List<StaffAvailability>
                            {
                                new StaffAvailability
                                {
                                    DayOfWeek = DayOfWeek.Monday,
                                    StartLocal = new TimeSpan(8,0,0),
                                    EndLocal = new TimeSpan(20,0,0)
                                }
                            }
                        };
                        db.Staff.Add(st);
                    }
                }

                await db.SaveChangesAsync();
            }
        }
    }


