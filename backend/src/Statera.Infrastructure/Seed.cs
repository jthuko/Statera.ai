using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Statera.Domain;
using Statera.Domain.Staffing;

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
        var db          = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

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

        // ── Identity roles ────────────────────────────────────────────────────
        foreach (var roleName in new[] { "Admin", "Scheduler", "Staff" })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var r = await roleManager.CreateAsync(new AppRole { Name = roleName });
                if (!r.Succeeded)
                    logger.LogWarning("Failed creating role {Role}: {Errors}", roleName,
                        string.Join(", ", r.Errors.Select(e => e.Description)));
            }
        }

        // Owner user
        var adminEmail = "admin@statera.local";
        var admin      = await userManager.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new AppUser { UserName = adminEmail, Email = adminEmail, EmailConfirmed = true, SystemRole = "Owner" };
            var created = await userManager.CreateAsync(admin, "Password123!");
            if (created.Succeeded)
            {
                var addToRole = await userManager.AddToRoleAsync(admin, "Admin");
                if (!addToRole.Succeeded)
                    logger.LogWarning("Failed adding admin to Admin role: {Errors}",
                        string.Join(", ", addToRole.Errors.Select(e => e.Description)));
            }
        }
        else if (admin.SystemRole != "Owner")
        {
            admin.SystemRole = "Owner";
            await userManager.UpdateAsync(admin);
        }

        // Demo FacilityAdmin
        var fadminEmail = "fadmin@statera.local";
        var fadmin      = await userManager.FindByEmailAsync(fadminEmail);
        if (fadmin is null)
        {
            fadmin = new AppUser { UserName = fadminEmail, Email = fadminEmail, EmailConfirmed = true, SystemRole = "FacilityAdmin" };
            var created = await userManager.CreateAsync(fadmin, "Password123!");
            if (!created.Succeeded)
                logger.LogWarning("Failed creating fadmin: {Errors}",
                    string.Join(", ", created.Errors.Select(e => e.Description)));
        }

        // ── Overtime rule ─────────────────────────────────────────────────────
        if (!await db.OvertimeRules.AnyAsync())
        {
            db.OvertimeRules.Add(new OvertimeRule
            {
                WeeklyHoursThreshold = 40,
                HardBlock            = false,
                PenaltyWeight        = 0.3
            });
        }

        // ── Facilities + Units ────────────────────────────────────────────────
        Facility stateraFacility, hudsonFacility;
        if (!await db.Facilities.AnyAsync())
        {
            stateraFacility = new Facility { Name = "Statera Care Center", Address = "100 Demo Rd",   City = "Wichita", State = "KS", Zip = "67202" };
            hudsonFacility  = new Facility { Name = "Hudson Home Care",    Address = "200 River Ave", City = "Albany",  State = "NY", Zip = "12207" };

            db.Facilities.AddRange(stateraFacility, hudsonFacility);
            db.Units.AddRange(
                new Unit { Name = "ICU",         Facility = stateraFacility },
                new Unit { Name = "Med-Surg",    Facility = stateraFacility },
                new Unit { Name = "ER",          Facility = stateraFacility },
                new Unit { Name = "Rehab",       Facility = hudsonFacility  },
                new Unit { Name = "Home Visits", Facility = hudsonFacility  }
            );
            await db.SaveChangesAsync(); // persist so IDs are available
        }
        else
        {
            var all     = await db.Facilities.OrderBy(f => f.Name).ToListAsync();
            hudsonFacility  = all[0]; // "Hudson Home Care"  (H < S)
            stateraFacility = all.Count > 1 ? all[1] : all[0]; // "Statera Care Center"
        }

        // ── Load unit references ──────────────────────────────────────────────
        var stateraUnits   = await db.Units.Where(u => u.FacilityId == stateraFacility.Id).ToListAsync();
        var hudsonUnits    = await db.Units.Where(u => u.FacilityId == hudsonFacility.Id).ToListAsync();
        var icuUnit        = stateraUnits.FirstOrDefault(u => u.Name == "ICU");
        var medSurgUnit    = stateraUnits.FirstOrDefault(u => u.Name == "Med-Surg");
        var erUnit         = stateraUnits.FirstOrDefault(u => u.Name == "ER");
        var rehabUnit      = hudsonUnits.FirstOrDefault(u => u.Name == "Rehab");
        var homeVisitsUnit = hudsonUnits.FirstOrDefault(u => u.Name == "Home Visits");

        // ── Constraints ───────────────────────────────────────────────────────
        if (!await db.RuleConstraints.AnyAsync())
        {
            var now = DateTime.UtcNow;
            db.RuleConstraints.AddRange(
                // --- Statera Care Center ---
                new RuleConstraint { FacilityId = stateraFacility.Id, Scope = RuleScope.Facility, Type = ConstraintType.MaxHoursPerWeek,           Value = "40",   IsActive = true, Notes = "Standard weekly cap",              CreatedOn = now },
                new RuleConstraint { FacilityId = stateraFacility.Id, Scope = RuleScope.Facility, Type = ConstraintType.MinRestBetweenShiftsHours,  Value = "8",    IsActive = true, Notes = "Min rest between shifts",           CreatedOn = now },
                new RuleConstraint { FacilityId = stateraFacility.Id, Scope = RuleScope.Facility, Type = ConstraintType.MaxConsecutiveDays,          Value = "5",    IsActive = true, Notes = "No more than 5 consecutive days",   CreatedOn = now },
                new RuleConstraint { FacilityId = stateraFacility.Id, Scope = RuleScope.Facility, Type = ConstraintType.LicenseRequired,             Value = "true", IsActive = true, Notes = "Active license required",           CreatedOn = now },
                new RuleConstraint { FacilityId = stateraFacility.Id, Scope = RuleScope.Unit,     Type = ConstraintType.MaxConsecutiveDays,          Value = "4",    IsActive = true, Notes = "ER: max 4 consecutive days", UnitId = erUnit?.Id, CreatedOn = now },
                new RuleConstraint { FacilityId = stateraFacility.Id, Scope = RuleScope.Role,     Type = ConstraintType.OvertimeCapHours,            Value = "12",   IsActive = true, Notes = "RN overtime cap",            Role = "RN",         CreatedOn = now },
                // --- Hudson Home Care ---
                new RuleConstraint { FacilityId = hudsonFacility.Id,  Scope = RuleScope.Facility, Type = ConstraintType.MaxHoursPerWeek,           Value = "40",   IsActive = true, Notes = "Standard weekly cap",              CreatedOn = now },
                new RuleConstraint { FacilityId = hudsonFacility.Id,  Scope = RuleScope.Facility, Type = ConstraintType.MinRestBetweenShiftsHours,  Value = "10",   IsActive = true, Notes = "Extended rest for home care staff", CreatedOn = now },
                new RuleConstraint { FacilityId = hudsonFacility.Id,  Scope = RuleScope.Facility, Type = ConstraintType.MaxConsecutiveDays,          Value = "5",    IsActive = true, Notes = "Max 5 consecutive days",           CreatedOn = now },
                new RuleConstraint { FacilityId = hudsonFacility.Id,  Scope = RuleScope.Facility, Type = ConstraintType.LicenseRequired,             Value = "true", IsActive = true, Notes = "License required for all",         CreatedOn = now },
                new RuleConstraint { FacilityId = hudsonFacility.Id,  Scope = RuleScope.Unit,     Type = ConstraintType.MinRestBetweenShiftsHours,  Value = "12",   IsActive = true, Notes = "Rehab: extended rest", UnitId = rehabUnit?.Id,  CreatedOn = now }
            );
            await db.SaveChangesAsync();
        }

        // ── Staff ─────────────────────────────────────────────────────────────
        if (!await db.Staff.AnyAsync())
        {
            int counter = 0;

            var WD  = new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday };
            var MWF = new[] { DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday };
            var TTH = new[] { DayOfWeek.Tuesday, DayOfWeek.Thursday };

            Staff Make(string first, string last, Guid facilityId, Guid? unitId,
                       string role, EmploymentType emp, string state,
                       DayOfWeek[] days, int startH = 7, int endH = 19)
            {
                counter++;
                var email = $"{first.ToLower()}.{last.ToLower()}{counter}@statera.local";
                var s = new Staff
                {
                    FirstName      = first, LastName = last, Email = email,
                    FacilityId     = facilityId, UnitId = unitId,
                    Role           = role, EmploymentType = emp, Active = true
                };
                s.Licenses = new List<StaffLicense>
                {
                    new()
                    {
                        IssuingState  = state,
                        LicenseType   = role,
                        LicenseNumber = $"LIC{counter:D5}",
                        ExpiresOn     = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(8 + counter % 10)),
                        IsActive      = true
                    }
                };
                s.Availabilities = days
                    .Select(d => new StaffAvailability
                    {
                        Staff      = s,
                        DayOfWeek  = d,
                        StartLocal = TimeSpan.FromHours(startH),
                        EndLocal   = TimeSpan.FromHours(endH)
                    })
                    .ToList();
                return s;
            }

            // ══════════════════════════════════════════════════════════════════
            // STATERA CARE CENTER — 50 staff  (KS)
            // ══════════════════════════════════════════════════════════════════
            var sId = stateraFacility.Id;

            var staffBatch = new List<Staff>
            {
                // ── ICU (14) ──────────────────────────────────────────────────
                Make("Jessica",    "Smith",     sId, icuUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Michael",    "Johnson",   sId, icuUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Sarah",      "Brown",     sId, icuUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  15, 23),
                Make("David",      "Williams",  sId, icuUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  15, 23),
                Make("Emily",      "Davis",     sId, icuUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  19),
                Make("James",      "Martinez",  sId, icuUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  19),
                Make("Patricia",   "Garcia",    sId, icuUnit?.Id, "LPN", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Robert",     "Rodriguez", sId, icuUnit?.Id, "LPN", EmploymentType.PartTime,  "KS", MWF, 7,  15),
                Make("Linda",      "Lopez",     sId, icuUnit?.Id, "LPN", EmploymentType.PartTime,  "KS", WD,  15, 23),
                Make("Barbara",    "Wilson",    sId, icuUnit?.Id, "CNA", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Elizabeth",  "Anderson",  sId, icuUnit?.Id, "CNA", EmploymentType.PartTime,  "KS", WD,  15, 23),
                Make("Susan",      "Thomas",    sId, icuUnit?.Id, "CNA", EmploymentType.PerDiem,   "KS", MWF, 7,  19),
                Make("Jennifer",   "Taylor",    sId, icuUnit?.Id, "NP",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("William",    "Moore",     sId, icuUnit?.Id, "NP",  EmploymentType.FullTime,  "KS", WD,  7,  15),

                // ── Med-Surg (24) ─────────────────────────────────────────────
                Make("Karen",      "Jackson",   sId, medSurgUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Nancy",      "Martin",    sId, medSurgUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Betty",      "Lee",       sId, medSurgUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Margaret",   "Perez",     sId, medSurgUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  15, 23),
                Make("Sandra",     "Thompson",  sId, medSurgUnit?.Id, "RN",  EmploymentType.PartTime,  "KS", WD,  15, 23),
                Make("Ashley",     "White",     sId, medSurgUnit?.Id, "RN",  EmploymentType.PartTime,  "KS", WD,  7,  19),
                Make("Dorothy",    "Harris",    sId, medSurgUnit?.Id, "RN",  EmploymentType.PartTime,  "KS", WD,  7,  19),
                Make("Kimberly",   "Sanchez",   sId, medSurgUnit?.Id, "RN",  EmploymentType.PartTime,  "KS", MWF, 7,  15),
                Make("Anna",       "Clark",     sId, medSurgUnit?.Id, "RN",  EmploymentType.PerDiem,   "KS", TTH, 7,  15),
                Make("Donna",      "Ramirez",   sId, medSurgUnit?.Id, "RN",  EmploymentType.PerDiem,   "KS", MWF, 15, 23),
                Make("Michelle",   "Lewis",     sId, medSurgUnit?.Id, "LPN", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Carol",      "Robinson",  sId, medSurgUnit?.Id, "LPN", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Amanda",     "Walker",    sId, medSurgUnit?.Id, "LPN", EmploymentType.FullTime,  "KS", WD,  15, 23),
                Make("Melissa",    "Young",     sId, medSurgUnit?.Id, "LPN", EmploymentType.PartTime,  "KS", WD,  15, 23),
                Make("Deborah",    "Allen",     sId, medSurgUnit?.Id, "LPN", EmploymentType.PartTime,  "KS", WD,  7,  19),
                Make("Stephanie",  "King",      sId, medSurgUnit?.Id, "LPN", EmploymentType.PartTime,  "KS", MWF, 7,  15),
                Make("Rebecca",    "Wright",    sId, medSurgUnit?.Id, "LPN", EmploymentType.PerDiem,   "KS", TTH, 7,  15),
                Make("Sharon",     "Scott",     sId, medSurgUnit?.Id, "CNA", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Laura",      "Torres",    sId, medSurgUnit?.Id, "CNA", EmploymentType.FullTime,  "KS", WD,  15, 23),
                Make("Cynthia",    "Nguyen",    sId, medSurgUnit?.Id, "CNA", EmploymentType.FullTime,  "KS", WD,  7,  19),
                Make("Kathleen",   "Hill",      sId, medSurgUnit?.Id, "CNA", EmploymentType.PartTime,  "KS", MWF, 7,  15),
                Make("Angela",     "Flores",    sId, medSurgUnit?.Id, "CNA", EmploymentType.PartTime,  "KS", TTH, 15, 23),
                Make("Shirley",    "Green",     sId, medSurgUnit?.Id, "CNA", EmploymentType.PerDiem,   "KS", MWF, 7,  15),
                Make("Christopher","Adams",     sId, medSurgUnit?.Id, "MD",  EmploymentType.FullTime,  "KS", WD,  7,  15),

                // ── ER (12) ───────────────────────────────────────────────────
                Make("Mark",       "Nelson",    sId, erUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Richard",    "Baker",     sId, erUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  15, 23),
                Make("Charles",    "Hall",      sId, erUnit?.Id, "RN",  EmploymentType.FullTime,  "KS", WD,  7,  19),
                Make("Joseph",     "Rivera",    sId, erUnit?.Id, "RN",  EmploymentType.PartTime,  "KS", MWF, 7,  15),
                Make("Thomas",     "Campbell",  sId, erUnit?.Id, "RN",  EmploymentType.PartTime,  "KS", TTH, 15, 23),
                Make("Daniel",     "Mitchell",  sId, erUnit?.Id, "RN",  EmploymentType.PerDiem,   "KS", MWF, 7,  19),
                Make("Matthew",    "Carter",    sId, erUnit?.Id, "LPN", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Anthony",    "Roberts",   sId, erUnit?.Id, "LPN", EmploymentType.PartTime,  "KS", WD,  15, 23),
                Make("Donald",     "Turner",    sId, erUnit?.Id, "LPN", EmploymentType.PerDiem,   "KS", TTH, 7,  15),
                Make("Steven",     "Phillips",  sId, erUnit?.Id, "PA",  EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Paul",       "Evans",     sId, erUnit?.Id, "CNA", EmploymentType.FullTime,  "KS", WD,  7,  15),
                Make("Andrew",     "Parker",    sId, erUnit?.Id, "CNA", EmploymentType.PartTime,  "KS", WD,  15, 23),
            };

            // ══════════════════════════════════════════════════════════════════
            // HUDSON HOME CARE — 50 staff  (NY)
            // ══════════════════════════════════════════════════════════════════
            var hId = hudsonFacility.Id;
            staffBatch.AddRange(new[]
            {
                // ── Rehab (25) ────────────────────────────────────────────────
                Make("Mary",       "Collins",     hId, rehabUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Linda",      "Edwards",     hId, rehabUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Barbara",    "Stewart",     hId, rehabUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  15, 23),
                Make("Patricia",   "Flores",      hId, rehabUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  15, 23),
                Make("Susan",      "Morris",      hId, rehabUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Karen",      "Nguyen",      hId, rehabUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("Nancy",      "Rivera",      hId, rehabUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", TTH, 7,  19),
                Make("Betty",      "Cook",        hId, rehabUnit?.Id, "RN",  EmploymentType.PerDiem,   "NY", MWF, 7,  19),
                Make("James",      "Rogers",      hId, rehabUnit?.Id, "LPN", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Michael",    "Reed",        hId, rehabUnit?.Id, "LPN", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Robert",     "Morgan",      hId, rehabUnit?.Id, "LPN", EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("William",    "Bell",        hId, rehabUnit?.Id, "LPN", EmploymentType.PartTime,  "NY", WD,  7,  19),
                Make("David",      "Murphy",      hId, rehabUnit?.Id, "LPN", EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Richard",    "Bailey",      hId, rehabUnit?.Id, "LPN", EmploymentType.PerDiem,   "NY", TTH, 7,  15),
                Make("Jessica",    "Cooper",      hId, rehabUnit?.Id, "CNA", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Jennifer",   "Richardson",  hId, rehabUnit?.Id, "CNA", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Sarah",      "Cox",         hId, rehabUnit?.Id, "CNA", EmploymentType.FullTime,  "NY", WD,  15, 23),
                Make("Emily",      "Howard",      hId, rehabUnit?.Id, "CNA", EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Donna",      "Ward",        hId, rehabUnit?.Id, "CNA", EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("Michelle",   "Torres",      hId, rehabUnit?.Id, "CNA", EmploymentType.PartTime,  "NY", WD,  7,  19),
                Make("Carol",      "Peterson",    hId, rehabUnit?.Id, "CNA", EmploymentType.PerDiem,   "NY", MWF, 7,  15),
                Make("Amanda",     "Gray",        hId, rehabUnit?.Id, "CNA", EmploymentType.PerDiem,   "NY", TTH, 7,  15),
                Make("Margaret",   "Ramirez",     hId, rehabUnit?.Id, "NP",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Sandra",     "James",       hId, rehabUnit?.Id, "NP",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Dorothy",    "Watson",      hId, rehabUnit?.Id, "MD",  EmploymentType.FullTime,  "NY", WD,  7,  15),

                // ── Home Visits (25) ──────────────────────────────────────────
                Make("Ashley",     "Brooks",      hId, homeVisitsUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Kimberly",   "Kelly",       hId, homeVisitsUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Melissa",    "Sanders",     hId, homeVisitsUnit?.Id, "RN",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Deborah",    "Price",       hId, homeVisitsUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Stephanie",  "Bennett",     hId, homeVisitsUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", TTH, 7,  15),
                Make("Rebecca",    "Wood",        hId, homeVisitsUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("Sharon",     "Barnes",      hId, homeVisitsUnit?.Id, "RN",  EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("Laura",      "Ross",        hId, homeVisitsUnit?.Id, "RN",  EmploymentType.PerDiem,   "NY", MWF, 7,  19),
                Make("Thomas",     "Henderson",   hId, homeVisitsUnit?.Id, "LPN", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Mark",       "Coleman",     hId, homeVisitsUnit?.Id, "LPN", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Richard",    "Jenkins",     hId, homeVisitsUnit?.Id, "LPN", EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Charles",    "Perry",       hId, homeVisitsUnit?.Id, "LPN", EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("Joseph",     "Powell",      hId, homeVisitsUnit?.Id, "LPN", EmploymentType.PerDiem,   "NY", TTH, 7,  15),
                Make("Daniel",     "Long",        hId, homeVisitsUnit?.Id, "CNA", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Matthew",    "Patterson",   hId, homeVisitsUnit?.Id, "CNA", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Anthony",    "Hughes",      hId, homeVisitsUnit?.Id, "CNA", EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Donald",     "Flores",      hId, homeVisitsUnit?.Id, "CNA", EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Steven",     "Washington",  hId, homeVisitsUnit?.Id, "CNA", EmploymentType.PartTime,  "NY", TTH, 7,  15),
                Make("Paul",       "Butler",      hId, homeVisitsUnit?.Id, "CNA", EmploymentType.PartTime,  "NY", WD,  15, 23),
                Make("Andrew",     "Simmons",     hId, homeVisitsUnit?.Id, "CNA", EmploymentType.PerDiem,   "NY", MWF, 7,  15),
                Make("Kenneth",    "Foster",      hId, homeVisitsUnit?.Id, "CNA", EmploymentType.PerDiem,   "NY", TTH, 7,  15),
                Make("Kevin",      "Gonzalez",    hId, homeVisitsUnit?.Id, "NP",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("Brian",      "Alexander",   hId, homeVisitsUnit?.Id, "NP",  EmploymentType.FullTime,  "NY", WD,  7,  15),
                Make("George",     "Russell",     hId, homeVisitsUnit?.Id, "NP",  EmploymentType.PartTime,  "NY", MWF, 7,  15),
                Make("Timothy",    "Griffin",     hId, homeVisitsUnit?.Id, "MD",  EmploymentType.FullTime,  "NY", WD,  7,  15),
            });

            db.Staff.AddRange(staffBatch);
            await db.SaveChangesAsync();
            logger.LogInformation("DevDataSeeder: seeded {Count} staff members.", staffBatch.Count);
        }

        // ── Time-Off Requests ─────────────────────────────────────────────────
        if (!await db.TimeOffRequests.AnyAsync())
        {
            var today    = DateTime.UtcNow.Date;
            var allStaff = await db.Staff.ToListAsync();

            Staff? Find(string first, string last) =>
                allStaff.FirstOrDefault(s => s.FirstName == first && s.LastName == last);

            var timeOffs = new List<TimeOffRequest>();

            void AddOff(string first, string last, string type, DateTime start, DateTime end, string status)
            {
                var s = Find(first, last);
                if (s is null) return;
                timeOffs.Add(new TimeOffRequest
                {
                    Id       = Guid.NewGuid(),
                    StaffId  = s.Id,
                    Type     = type,
                    StartUtc = start,
                    EndUtc   = end,
                    Status   = status,
                    Reason   = $"{type} leave"
                });
            }

            // Statera Care Center
            AddOff("Jessica",   "Smith",    "Vacation", today.AddDays(7),   today.AddDays(14),  "Approved");
            AddOff("Karen",     "Jackson",  "Personal", today.AddDays(2),   today.AddDays(4),   "Pending");
            AddOff("Ashley",    "White",    "Sick",     today.AddDays(-2),  today.AddDays(2),   "Approved");
            AddOff("Dorothy",   "Harris",   "Personal", today.AddDays(5),   today.AddDays(7),   "Pending");
            AddOff("Mark",      "Nelson",   "Sick",     today.AddDays(-1),  today.AddDays(3),   "Approved");
            AddOff("Cynthia",   "Nguyen",   "Vacation", today.AddDays(14),  today.AddDays(21),  "Approved");
            AddOff("Steven",    "Phillips", "Vacation", today.AddDays(10),  today.AddDays(17),  "Pending");
            AddOff("Stephanie", "King",     "Personal", today.AddDays(3),   today.AddDays(4),   "Pending");

            // Hudson Home Care
            AddOff("Mary",      "Collins",     "Vacation", today.AddDays(7),  today.AddDays(14), "Approved");
            AddOff("Michael",   "Reed",        "Sick",     today.AddDays(-1), today.AddDays(3),  "Approved");
            AddOff("Jennifer",  "Richardson",  "Personal", today.AddDays(2),  today.AddDays(3),  "Pending");
            AddOff("Kevin",     "Gonzalez",    "Vacation", today.AddDays(14), today.AddDays(21), "Pending");
            AddOff("Rebecca",   "Wood",        "Sick",     today.AddDays(-2), today.AddDays(2),  "Approved");
            AddOff("Daniel",    "Long",        "Vacation", today.AddDays(21), today.AddDays(28), "Approved");
            AddOff("Laura",     "Torres",      "Personal", today.AddDays(4),  today.AddDays(5),  "Pending");

            if (timeOffs.Any())
            {
                db.TimeOffRequests.AddRange(timeOffs);
                await db.SaveChangesAsync();
                logger.LogInformation("DevDataSeeder: seeded {Count} time-off requests.", timeOffs.Count);
            }
        }

        // ── UserFacilityRole: fadmin → Statera Care Center ────────────────────
        if (fadmin is not null && !await db.UserFacilityRoles.AnyAsync(ufr => ufr.UserId == fadmin.Id))
        {
            db.UserFacilityRoles.Add(new UserFacilityRole
            {
                Id               = Guid.NewGuid(),
                UserId           = fadmin.Id,
                FacilityId       = stateraFacility.Id,
                FacilityRole     = "FacilityAdmin",
                AssignedByUserId = admin?.Id,
                AssignedUtc      = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            logger.LogInformation("DevDataSeeder: assigned fadmin to '{Facility}'.", stateraFacility.Name);
        }

        // ── Demo Staff portal account ─────────────────────────────────────────────
        // jessica.smith1@statera.local is the first seeded staff member (ICU RN, Statera Care Center)
        var demoStaffEmail = "jessica.smith1@statera.local";
        var demoStaffUser  = await userManager.FindByEmailAsync(demoStaffEmail);
        if (demoStaffUser is null)
        {
            demoStaffUser = new AppUser
            {
                UserName       = demoStaffEmail,
                Email          = demoStaffEmail,
                EmailConfirmed = true,
                SystemRole     = "Staff"
            };
            var r = await userManager.CreateAsync(demoStaffUser, "Password123!");
            if (r.Succeeded)
                logger.LogInformation("DevDataSeeder: created staff portal account for {Email}.", demoStaffEmail);
            else
                logger.LogWarning("DevDataSeeder: failed to create staff portal account: {Errors}",
                    string.Join(", ", r.Errors.Select(e => e.Description)));
        }

        // ── Assignments ───────────────────────────────────────────────────────
        try
        {
            if (!await db.Assignments.AnyAsync())
            {
                var utcToday    = DateTime.UtcNow.Date;
                var daysFromMon = ((int)utcToday.DayOfWeek + 6) % 7;
                var weekStart   = utcToday.AddDays(-daysFromMon);
                var allStaff    = await db.Staff.ToListAsync();

                Assignment Shift(Guid staffId, Guid facilityId, Guid? unitId, string state,
                                 string roleId, int dayOffset, int startH, int hours, string note)
                {
                    var start = weekStart.AddDays(dayOffset).AddHours(startH);
                    return new Assignment
                    {
                        Id            = Guid.NewGuid(),
                        StaffId       = staffId,
                        FacilityId    = facilityId,
                        UnitId        = unitId,
                        FacilityState = state,
                        RoleId        = roleId,
                        StartUtc      = start,
                        EndUtc        = start.AddHours(hours),
                        Notes         = note,
                        RowVersion    = Array.Empty<byte>()
                    };
                }

                Staff? Get(Guid fac, string first, string last) =>
                    allStaff.FirstOrDefault(s => s.FacilityId == fac && s.FirstName == first && s.LastName == last);

                var items = new List<Assignment>();

                // ── Statera Care Center ────────────────────────────────────────
                var sId = stateraFacility.Id;

                // ICU – 3 shifts/day Mon–Fri
                for (int d = 0; d < 5; d++)
                {
                    var s = new[]
                    {
                        (Get(sId,"Jessica","Smith"),    "RN",  7,  "ICU Day RN"),
                        (Get(sId,"Michael","Johnson"),  "RN",  7,  "ICU Day RN"),
                        (Get(sId,"Sarah","Brown"),      "RN",  15, "ICU Eve RN"),
                        (Get(sId,"David","Williams"),   "RN",  15, "ICU Eve RN"),
                        (Get(sId,"Patricia","Garcia"),  "LPN", 7,  "ICU Day LPN"),
                        (Get(sId,"Barbara","Wilson"),   "CNA", 7,  "ICU Day CNA"),
                    };
                    foreach (var (st, role, h, note) in s)
                        if (st != null) items.Add(Shift(st.Id, sId, icuUnit?.Id, "KS", role, d, h, 8, note));
                }

                // Med-Surg – 3 shifts/day Mon–Fri
                for (int d = 0; d < 5; d++)
                {
                    var s = new[]
                    {
                        (Get(sId,"Karen","Jackson"),    "RN",  7,  "Med-Surg Day RN"),
                        (Get(sId,"Nancy","Martin"),     "RN",  7,  "Med-Surg Day RN"),
                        (Get(sId,"Margaret","Perez"),   "RN",  15, "Med-Surg Eve RN"),
                        (Get(sId,"Michelle","Lewis"),   "LPN", 7,  "Med-Surg Day LPN"),
                        (Get(sId,"Carol","Robinson"),   "LPN", 7,  "Med-Surg Day LPN"),
                        (Get(sId,"Sharon","Scott"),     "CNA", 7,  "Med-Surg Day CNA"),
                        (Get(sId,"Laura","Torres"),     "CNA", 15, "Med-Surg Eve CNA"),
                    };
                    foreach (var (st, role, h, note) in s)
                        if (st != null) items.Add(Shift(st.Id, sId, medSurgUnit?.Id, "KS", role, d, h, 8, note));
                }

                // ER – 3 shifts/day Mon–Fri
                for (int d = 0; d < 5; d++)
                {
                    var s = new[]
                    {
                        (Get(sId,"Mark","Nelson"),      "RN",  7,  "ER Day RN"),
                        (Get(sId,"Richard","Baker"),    "RN",  15, "ER Eve RN"),
                        (Get(sId,"Matthew","Carter"),   "LPN", 7,  "ER Day LPN"),
                        (Get(sId,"Steven","Phillips"),  "PA",  7,  "ER Day PA"),
                        (Get(sId,"Paul","Evans"),       "CNA", 7,  "ER Day CNA"),
                    };
                    foreach (var (st, role, h, note) in s)
                        if (st != null) items.Add(Shift(st.Id, sId, erUnit?.Id, "KS", role, d, h, 8, note));
                }

                // ── Hudson Home Care ───────────────────────────────────────────
                var hId = hudsonFacility.Id;

                // Rehab – 2 shifts/day Mon–Fri
                for (int d = 0; d < 5; d++)
                {
                    var s = new[]
                    {
                        (Get(hId,"Mary","Collins"),    "RN",  7,  "Rehab Day RN"),
                        (Get(hId,"Linda","Edwards"),   "RN",  7,  "Rehab Day RN"),
                        (Get(hId,"Barbara","Stewart"), "RN",  15, "Rehab Eve RN"),
                        (Get(hId,"James","Rogers"),    "LPN", 7,  "Rehab Day LPN"),
                        (Get(hId,"Jessica","Cooper"),  "CNA", 7,  "Rehab Day CNA"),
                        (Get(hId,"Sarah","Cox"),       "CNA", 15, "Rehab Eve CNA"),
                    };
                    foreach (var (st, role, h, note) in s)
                        if (st != null) items.Add(Shift(st.Id, hId, rehabUnit?.Id, "NY", role, d, h, 8, note));
                }

                // Home Visits – Tue, Thu, Fri
                foreach (var d in new[] { 1, 3, 4 })
                {
                    var s = new[]
                    {
                        (Get(hId,"Ashley","Brooks"),    "RN",  8,  "Home Visit RN"),
                        (Get(hId,"Kimberly","Kelly"),   "RN",  8,  "Home Visit RN"),
                        (Get(hId,"Thomas","Henderson"), "LPN", 8,  "Home Visit LPN"),
                        (Get(hId,"Daniel","Long"),      "CNA", 8,  "Home Visit CNA"),
                    };
                    foreach (var (st, role, h, note) in s)
                        if (st != null) items.Add(Shift(st.Id, hId, homeVisitsUnit?.Id, "NY", role, d, h, 8, note));
                }

                if (items.Any())
                {
                    db.Assignments.AddRange(items);
                    await db.SaveChangesAsync();
                    logger.LogInformation("DevDataSeeder: seeded {Count} assignments across both facilities.", items.Count);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DevDataSeeder: error while seeding assignments.");
        }

        // ── Help Articles ─────────────────────────────────────────────────────
        if (!await db.HelpArticles.AnyAsync())
        {
            static string Tags(params string[] tags) =>
                System.Text.Json.JsonSerializer.Serialize(tags);

            static string Sections(params (string? Heading, string Body)[] sections) =>
                System.Text.Json.JsonSerializer.Serialize(
                    sections.Select(s => new { s.Heading, s.Body }));

            db.HelpArticles.AddRange(
                // ── Scheduler ─────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Scheduler", Title = "Using the Scheduler", SortOrder = 1,
                    TagsJson = Tags("schedule", "calendar", "shifts", "auto-generate", "week"),
                    SectionsJson = Sections(
                        (null, "The Scheduler gives you a weekly/monthly calendar view of all staff shifts. Select a facility at the top and use the arrows to navigate between weeks."),
                        ("Auto-generating a schedule", "1. Set up Demand Templates for each unit first.\n2. Open Scheduler, choose a facility and date range.\n3. Click Auto-Generate. The system fills shifts based on templates, staff availability, credentials, and constraint rules."),
                        ("Adding a shift manually", "Click any empty cell in the calendar grid. A dialog appears — pick the staff member, unit, start/end times, and save."),
                        ("Editing or removing a shift", "Click an existing shift block to open the edit dialog. Modify times or click Delete to remove the shift."))
                },
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Scheduler", Title = "Scheduling Conflicts & Blocks", SortOrder = 2,
                    TagsJson = Tags("conflict", "availability", "time off", "vacation", "block", "error"),
                    SectionsJson = Sections(
                        (null, "The system prevents scheduling staff in these situations when assigning manually:"),
                        ("Approved time off", "If a staff member has approved time off covering any part of the shift, the assignment is blocked with an error: 'Staff has approved time off during this shift.'"),
                        ("Availability windows", "If a staff member has defined availability (e.g., Mon–Fri 7 am–3 pm only), shifts outside those windows are blocked. Auto-scheduling skips unavailable staff instead of blocking."),
                        ("Overlapping shifts", "A staff member cannot be assigned to two shifts that overlap in time."))
                },
                // ── Staff ──────────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Staff", Title = "Managing Staff", SortOrder = 1,
                    TagsJson = Tags("staff", "employee", "hire", "add", "edit", "deactivate", "profile"),
                    SectionsJson = Sections(
                        (null, "The Staff Directory lists all staff members. Use the search bar to filter by name or role. Click a row to open the full profile."),
                        ("Adding a new staff member", "Click Add Staff. Fill in first name, last name, role (RN, CNA, etc.), facility, and unit. Save to create the profile."),
                        ("Editing a profile", "Click on a staff member's name to open their detail page. Edit personal info, credentials, licenses, and availability windows."),
                        ("Deactivating staff", "On the staff detail page, toggle the Active switch off. Inactive staff are hidden from scheduling suggestions but their history is preserved."))
                },
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Staff", Title = "Setting Staff Availability", SortOrder = 2,
                    TagsJson = Tags("availability", "schedule", "days", "hours", "windows"),
                    SectionsJson = Sections(
                        (null, "Availability windows define when a staff member is able to work. If no windows are set, the system treats them as available at any time."),
                        ("Adding availability", "Open Staff Directory → click a staff member → Availability section → Add Window. Select day of week, start time, and end time."),
                        ("How it affects scheduling", "Auto-Scheduling: staff outside their availability window are skipped silently.\nManual Assignment: blocked with an error message so you don't accidentally schedule them."))
                },
                // ── Time Off ───────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Time Off", Title = "Reviewing Time-Off Requests (Admin)", SortOrder = 1,
                    TagsJson = Tags("time off", "approve", "deny", "vacation", "leave", "request"),
                    SectionsJson = Sections(
                        (null, "The Time Off page lists all staff requests. Filter by facility, status, or date range."),
                        ("Approving or denying", "Find the request and click Approve or Deny. Approved time off is immediately enforced — the system will block any new assignments that overlap with the approved period."),
                        ("Viewing by status", "Use the Status filter to see only Pending, Approved, or Denied requests."))
                },
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Time Off", Title = "Requesting Time Off (Staff Portal)", SortOrder = 2,
                    TagsJson = Tags("time off", "request", "vacation", "portal", "leave"),
                    SectionsJson = Sections(
                        (null, "From the Staff Portal, go to Time Off to submit and track your requests."),
                        ("Submitting a request", "Click Request Time Off. Choose start date, end date, type (Vacation, Sick, etc.), and add a note if needed. Submit — your manager will be notified."),
                        ("Checking status", "Your requests show as Pending until a manager acts. Once Approved or Denied you'll see the updated status on this page."))
                },
                // ── Time Clock ─────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Time Clock", Title = "Clocking In & Out (Staff Portal)", SortOrder = 1,
                    TagsJson = Tags("clock in", "clock out", "lunch", "portal", "timeclock"),
                    SectionsJson = Sections(
                        (null, "The Clock page in the Staff Portal manages your daily time tracking."),
                        ("Starting your shift", "Click Clock In when you arrive. Your start time is recorded automatically."),
                        ("Lunch break", "Click Start Lunch when you leave for lunch. Click End Lunch when you return. This time is subtracted from your net hours."),
                        ("Ending your shift", "Click Clock Out. Any open lunch break is automatically closed. Your net hours (excluding lunch) are calculated."),
                        ("Viewing recent entries", "A calendar below the buttons shows daily hours for the current month. Click on a day to see details."))
                },
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Time Clock", Title = "Submitting a Time Correction (Staff Portal)", SortOrder = 2,
                    TagsJson = Tags("correction", "adjust", "fix", "wrong time", "timesheet", "portal"),
                    SectionsJson = Sections(
                        (null, "If your clock-in or clock-out time is wrong, you can submit a correction request for admin approval."),
                        ("How to submit", "On the Clock page, find the completed entry. Click Request Correction. Enter the correct clock-in, clock-out, and lunch times, add a note explaining the reason, and submit."),
                        ("What happens next", "The entry status changes to 'Pending Correction'. An admin will review it and either Approve (applying your corrected times) or Deny it."))
                },
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Time Clock", Title = "Managing Time Entries (Admin)", SortOrder = 3,
                    TagsJson = Tags("admin", "timeclock", "adjust", "approve", "deny", "correction", "payroll", "csv"),
                    SectionsJson = Sections(
                        (null, "The Time Clock admin page lets you view, adjust, and approve all staff time entries."),
                        ("Filtering entries", "Use the Facility, Staff, Date Range, and Status filters to narrow down entries. Load up to 200 entries at once."),
                        ("Adjusting an entry", "Click Adjust on any entry. You can edit clock-in, clock-out, lunch start, lunch end, and add an admin note. Save to apply changes — the entry becomes 'Adjusted'."),
                        ("Approving corrections", "Entries with status 'Pending Correction' show the staff member's requested times and reason. Click Approve to apply those times, or Deny to reject them."),
                        ("Downloading for payroll", "Click Download CSV. The file includes: Staff, Date, Day, Clock In, Clock Out, Lunch Start, Lunch End, Lunch (hrs), Net Hours, Status, and Admin Notes — ready for payroll processing."))
                },
                // ── Assignments ────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Assignments", Title = "Managing Assignments", SortOrder = 1,
                    TagsJson = Tags("assignment", "shift", "manual", "add", "edit", "delete"),
                    SectionsJson = Sections(
                        (null, "The Assignments page lists every scheduled shift. You can filter by facility, unit, date range, or staff member."),
                        ("Adding a manual assignment", "Click Add Assignment. Select staff, unit, start date/time, and end date/time. The system checks for time-off conflicts and availability before saving."),
                        ("Editing or deleting", "Click the edit icon on a row to modify times or staff. Use the delete icon to remove an assignment."))
                },
                // ── Coverage ───────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Coverage", Title = "Filling Coverage Gaps", SortOrder = 1,
                    TagsJson = Tags("coverage", "gap", "open shift", "understaffed", "fill"),
                    SectionsJson = Sections(
                        (null, "The Coverage page shows a daily heat map of your staffing level vs. demand by unit. Red cells mean you're understaffed."),
                        ("Filling an open shift", "Click on an understaffed cell. A panel opens showing available staff for that unit and time. Click a staff member to assign them, or use the manual form to set custom times."),
                        ("Understanding colors", "Green = fully staffed or over.\nYellow = slightly understaffed.\nRed = significantly understaffed.\nGray = no demand set."))
                },
                // ── Constraints ────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Constraints & Rules", Title = "Setting Up Constraint Rules", SortOrder = 1,
                    TagsJson = Tags("constraints", "rules", "hours", "overtime", "rest", "consecutive", "preference"),
                    SectionsJson = Sections(
                        (null, "Constraints & Rules let you enforce scheduling policies. They are applied during auto-scheduling and manual assignments."),
                        ("MaxHoursPerWeek", "Hard blocks a staff member from being scheduled if they've already worked this many hours in the past 7 days. Default: 40h."),
                        ("MinRestBetweenShifts", "Requires a minimum number of hours off between two shifts. Default: 8h."),
                        ("MaxConsecutiveDays", "Prevents scheduling staff for more than N consecutive days. Default: 6 days."),
                        ("OvertimeCapHours", "A secondary hard cap — blocks scheduling once this overtime threshold is reached. Default: same as weekly hours threshold."),
                        ("ShiftPreference", "A soft bonus applied to certain roles/shifts during auto-scheduling. Higher value = more likely to be selected."),
                        ("Scope", "Rules can be scoped to the whole Facility, a specific Unit, or a specific Role. More specific scopes override broader ones."))
                },
                // ── Demand Templates ───────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Demand Templates", Title = "Creating Demand Templates", SortOrder = 1,
                    TagsJson = Tags("demand", "template", "staffing plan", "rn", "cna", "auto-schedule"),
                    SectionsJson = Sections(
                        (null, "Demand Templates define how many staff of each role are needed per day and shift. They're the blueprint for auto-scheduling."),
                        ("Creating a template", "Go to Demand Templates → New Template. Give it a name, select the facility, and fill in the daily demand grid (rows = days, columns = credential type)."),
                        ("Status lifecycle", "Draft → Validated → Approved → Published.\nOnly Published templates are used by the auto-scheduler."),
                        ("Validating and publishing", "Open a template and click Validate to check for inconsistencies. Once valid, click Approve then Publish to make it active."),
                        ("Applying to a date range", "On a published template, click Apply to Range. Choose the start and end dates. The system generates shift demands for that period."))
                },
                // ── Facilities ─────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Facilities", Title = "Managing Facilities", SortOrder = 1,
                    TagsJson = Tags("facility", "location", "admin", "owner", "facility admin"),
                    SectionsJson = Sections(
                        (null, "The Facilities page is available to Owners only. It lets you create and configure each physical location."),
                        ("Adding a facility", "Click Add Facility. Enter name, address, state, and contact info."),
                        ("Assigning Facility Admins", "Click on a facility → Admins tab → Add Admin. Enter the user's email. They'll have full management access to that facility."),
                        ("Facility Admin vs Owner", "Owners can see and manage all facilities.\nFacility Admins only see their assigned facility and cannot manage other facilities or users."))
                },
                // ── Units ──────────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Units", Title = "Managing Units", SortOrder = 1,
                    TagsJson = Tags("unit", "department", "ward", "floor", "icu"),
                    SectionsJson = Sections(
                        (null, "Units are departments within a facility (e.g., ICU, Med-Surg, ER). Staff and shifts are organized by unit."),
                        ("Adding a unit", "Go to Units → Add Unit. Enter unit name and select the parent facility."),
                        ("Assigning staff to units", "Open Staff Directory → staff profile → set the Unit field. Staff can be assigned to one primary unit."))
                },
                // ── Chat ───────────────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Chat", Title = "Using Chat", SortOrder = 1,
                    TagsJson = Tags("chat", "message", "dm", "direct message", "group", "communication"),
                    SectionsJson = Sections(
                        (null, "Chat lets staff and admins communicate within Statera without leaving the app."),
                        ("Starting a direct message", "Open Chat → click New Message → search for a user by name → Start conversation."),
                        ("Group rooms", "Click New Group Room → give it a name and add members. All members can send and read messages."),
                        ("Sending messages", "Type in the input box and press Enter to send. Messages are ordered by most recent."))
                },
                // ── Staff Portal ───────────────────────────────────────────────
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Staff Portal", Title = "Staff Portal Overview", SortOrder = 1,
                    TagsJson = Tags("portal", "staff", "schedule", "timeoff", "clock", "timesheet", "chat"),
                    SectionsJson = Sections(
                        (null, "The Staff Portal (/portal) is the staff-facing side of Statera. It provides everything a staff member needs to manage their work."),
                        ("Navigation", "Use the bottom navigation bar to switch between:\n• Schedule — view your upcoming shifts\n• Time Off — request and track leave\n• Clock — clock in/out and lunch\n• Timesheet — monthly summary + payroll download\n• Chat — messaging"),
                        ("Logging out", "Tap the logout icon in the top-right corner."))
                },
                new HelpArticle
                {
                    Id = Guid.NewGuid(), Category = "Staff Portal", Title = "Viewing Your Timesheet", SortOrder = 2,
                    TagsJson = Tags("timesheet", "payroll", "hours", "csv", "download", "monthly", "portal"),
                    SectionsJson = Sections(
                        (null, "The Timesheet page shows a monthly summary of all your clock-in/out entries including lunch and net hours."),
                        ("Navigating months", "Use the left/right arrows next to the month name to go back or forward."),
                        ("Calendar view", "Each day shows your net hours worked (in green) and lunch hours (in blue). Click a day to see the full entry details."),
                        ("Downloading for payroll", "Click Download CSV. The file includes all entries for the month with: Date, Day, Clock In, Clock Out, Lunch Start, Lunch End, Lunch (hrs), Net Hours Worked. The last row shows the monthly total."))
                }
            );
            await db.SaveChangesAsync();
            logger.LogInformation("DevDataSeeder: seeded help articles.");
        }

        // ── Supplemental help articles (added after initial seed) ────────────
        const string importTitle = "Bulk Importing Staff (CSV / Excel)";
        if (!await db.HelpArticles.AnyAsync(a => a.Title == importTitle))
        {
            static string J(params string[] tags) =>
                System.Text.Json.JsonSerializer.Serialize(tags);
            static string S(params (string? Heading, string Body)[] sections) =>
                System.Text.Json.JsonSerializer.Serialize(
                    sections.Select(s => new { s.Heading, s.Body }));

            db.HelpArticles.Add(new HelpArticle
            {
                Id           = Guid.NewGuid(),
                Category     = "Staff",
                Title        = importTitle,
                SortOrder    = 3,
                TagsJson     = J("import", "csv", "excel", "bulk", "upload", "staff"),
                SectionsJson = S(
                    (null, "The Import feature lets you add many staff members at once by uploading a .csv or .xlsx file. This saves time when onboarding a new facility or adding a large group of employees."),
                    ("Opening the dialog", "Go to Staff Directory. Click the Import button (next to New Staff). The Import dialog opens."),
                    ("Downloading the template", "Click 'Download Template CSV' inside the dialog to get a pre-formatted file. Open it in Excel or any spreadsheet app to fill in your data."),
                    ("Required columns", "• firstName — staff member's first name\n• lastName — staff member's last name\n• role — job role (e.g. RN, LPN, CNA, Manager)\n• employmentType — one of: FullTime, PartTime, PerDiem, Contract"),
                    ("Optional columns", "• email — must be unique across the facility; leave blank to skip\n• unitId — GUID or unit name to assign the staff member to a unit\n• active — true or false (defaults to true if omitted)"),
                    ("Running the import", "1. Fill in the template (or create your own file with matching column headers).\n2. Save as .csv or .xlsx.\n3. Click the upload area in the dialog and select your file.\n4. Click Import. The system processes each row and creates valid staff records."),
                    ("Reviewing results", "After import completes, a summary shows how many staff were created successfully and how many rows had errors. Each failed row is listed with its row number and a description of the problem (e.g. duplicate email, invalid employmentType). Fix those rows and re-upload as needed."),
                    ("Partial imports", "Valid rows are always saved even if some rows fail. You do not need to re-upload rows that already succeeded."))
            });
            await db.SaveChangesAsync();
            logger.LogInformation("DevDataSeeder: added '{Title}' help article.", importTitle);
        }

        const string openShiftsTitle = "Open Shifts & Shift Marketplace";
        if (!await db.HelpArticles.AnyAsync(a => a.Title == openShiftsTitle))
        {
            static string JO(params string[] tags) =>
                System.Text.Json.JsonSerializer.Serialize(tags);
            static string SO(params (string? Heading, string Body)[] sections) =>
                System.Text.Json.JsonSerializer.Serialize(
                    sections.Select(s => new { s.Heading, s.Body }));

            db.HelpArticles.Add(new HelpArticle
            {
                Id           = Guid.NewGuid(),
                Category     = "Staff",
                Title        = openShiftsTitle,
                SortOrder    = 4,
                TagsJson     = JO("open shift", "marketplace", "coverage", "claim", "request", "shift"),
                SectionsJson = SO(
                    (null, "Open Shifts is a shift marketplace that lets admins post unfilled shifts and staff volunteer to cover them. Admins approve or deny each request, and approved shifts are automatically added to the staff member's schedule."),
                    ("Posting an open shift (Admin)", "1. Go to Open Shifts in the sidebar.\n2. Click Post Shift.\n3. Fill in the role, date, start/end time, unit (optional), and notes.\n4. Save — the shift is now visible to eligible staff in their portal."),
                    ("Browsing open shifts (Staff)", "Open the Staff Portal and tap Open Shifts. You will only see shifts that match your role and fit within your availability windows. Shifts outside your availability or role are not shown."),
                    ("Requesting a shift (Staff)", "Tap the Request button on any open shift card. Your request is sent to the admin with a 'Pending' status. You can have multiple pending requests at once."),
                    ("Withdrawing a request (Staff)", "If you change your mind before the admin reviews it, tap Withdraw on the pending card. You can only withdraw Pending requests — not ones already Approved or Denied."),
                    ("Approving or denying a request (Admin)", "On the Open Shifts page, click View Requests on a shift. You will see all staff who requested it. Click Approve to assign the shift — this automatically creates a schedule assignment and denies all other pending requests for that shift. Click Deny to decline a specific request without affecting others."),
                    ("Constraint enforcement", "All scheduling constraints apply:\n• Role match — staff must have the matching role.\n• Availability — shift must fall within the staff member's availability windows.\n• No overlapping assignments — staff cannot be double-booked.\n• Approved time off — blocked if time off covers the shift.\n• Weekly hours limit and overtime cap.\n• Minimum rest between shifts.\n• Maximum consecutive working days.\nIf a constraint is violated, the request or approval is blocked with a clear error message."))
            });
            await db.SaveChangesAsync();
            logger.LogInformation("DevDataSeeder: added '{Title}' help article.", openShiftsTitle);
        }

        logger.LogInformation("DevDataSeeder: seeding complete.");
    }
}
