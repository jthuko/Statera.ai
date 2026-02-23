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

        logger.LogInformation("DevDataSeeder: seeding complete.");
    }
}
