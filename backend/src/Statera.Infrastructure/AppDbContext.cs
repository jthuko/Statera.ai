// backend/src/Statera.Infrastructure/AppDbContext.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Statera.Domain;
using Statera.Domain.Staffing;

namespace Statera.Infrastructure;

public class AppUser : IdentityUser
{
    // "Owner" = global super-admin, "FacilityAdmin" = scoped to assigned facilities
    public string SystemRole { get; set; } = "FacilityAdmin";
}

public class AppRole : IdentityRole { }

public class UserFacilityRole
{
    public Guid Id { get; set; }

    // FK → AspNetUsers (string PK)
    public string UserId { get; set; } = default!;
    public AppUser User { get; set; } = default!;

    // FK → Facilities
    public Guid FacilityId { get; set; }
    public Facility Facility { get; set; } = default!;

    // "FacilityAdmin" for now; extensible to "Scheduler", "Viewer" later
    public string FacilityRole { get; set; } = "FacilityAdmin";

    public DateTime AssignedUtc { get; set; } = DateTime.UtcNow;

    // Who assigned this (null = seeded by system)
    public string? AssignedByUserId { get; set; }
}

public class AppDbContext : IdentityDbContext<AppUser, AppRole, string>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Role> RolesCatalog => Set<Role>();
    public DbSet<StaffLicense> StaffLicenses => Set<StaffLicense>();
    public DbSet<StaffAvailability> StaffAvailabilities => Set<StaffAvailability>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<TimeOffRequest> TimeOffRequests => Set<TimeOffRequest>();
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();
    public DbSet<Schedule> Schedules => Set<Schedule>();
    public DbSet<OvertimeRule> OvertimeRules => Set<OvertimeRule>();
    public DbSet<ShiftSwap> ShiftSwaps => Set<ShiftSwap>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RuleConstraint> RuleConstraints => Set<RuleConstraint>();

    // Demand Templates (rich)
    public DbSet<DemandTemplate> DemandTemplates => Set<DemandTemplate>();
    public DbSet<DemandTemplateDay> DemandTemplateDays => Set<DemandTemplateDay>();

    // User-Facility permission assignments
    public DbSet<UserFacilityRole> UserFacilityRoles => Set<UserFacilityRole>();

    // Time Clock
    public DbSet<TimeClockEntry> TimeClockEntries => Set<TimeClockEntry>();

    // Chat
    public DbSet<ChatRoom> ChatRooms => Set<ChatRoom>();
    public DbSet<ChatRoomMember> ChatRoomMembers => Set<ChatRoomMember>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    // Help documentation
    public DbSet<HelpArticle> HelpArticles => Set<HelpArticle>();

    // Open Shifts / Shift Marketplace
    public DbSet<OpenShift> OpenShifts => Set<OpenShift>();
    public DbSet<OpenShiftRequest> OpenShiftRequests => Set<OpenShiftRequest>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // AppUser – SystemRole column
        b.Entity<AppUser>(entity =>
        {
            entity.Property(u => u.SystemRole).HasMaxLength(20).HasDefaultValue("FacilityAdmin");
        });

        // UserFacilityRole – maps a user to a facility with a role
        b.Entity<UserFacilityRole>(entity =>
        {
            entity.HasKey(ufr => ufr.Id);

            entity.HasOne(ufr => ufr.User)
                  .WithMany()
                  .HasForeignKey(ufr => ufr.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ufr => ufr.Facility)
                  .WithMany()
                  .HasForeignKey(ufr => ufr.FacilityId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(ufr => ufr.FacilityRole).HasMaxLength(30).IsRequired();
            entity.Property(ufr => ufr.AssignedByUserId).HasMaxLength(450);

            // One role entry per user per facility
            entity.HasIndex(ufr => new { ufr.UserId, ufr.FacilityId }).IsUnique();
        });

        // Staff
        b.Entity<Staff>(entity =>
        {
            entity.Property(s => s.EmploymentType).HasConversion<string>().HasMaxLength(20);
            entity.Property(s => s.FirstName).IsRequired();
            entity.Property(s => s.LastName).IsRequired();
            entity.HasIndex(s => s.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
            entity.HasIndex(s => s.UnitId);
        });

        // Role catalog (domain role)
        b.Entity<Role>(entity =>
        {
            entity.Property(r => r.Position).HasMaxLength(50).IsRequired();
            entity.HasIndex(r => r.Position).IsUnique();
        });

        // StaffLicense
        b.Entity<StaffLicense>(entity =>
        {
            entity.Property(l => l.IssuingState).HasMaxLength(2).IsRequired();
            entity.Property(l => l.LicenseNumber).HasMaxLength(32);
            entity.Property(l => l.VerificationUrl).HasMaxLength(256);
            entity.HasIndex(l => new { l.StaffId, l.IssuingState, l.LicenseType, l.IsActive });
        });

        // StaffAvailability
        b.Entity<StaffAvailability>(entity =>
        {
            entity.Property(a => a.StartLocal);
            entity.Property(a => a.EndLocal);
            entity.ToTable(t => t.HasCheckConstraint("CK_Availability_EndAfterStart", "[EndLocal] > [StartLocal]"));
            entity.HasIndex(a => new { a.StaffId, a.DayOfWeek, a.StartLocal });
        });

        // Assignment
        b.Entity<Assignment>(entity =>
        {
            entity.Property(a => a.FacilityState).HasMaxLength(2).IsRequired();
            entity.Property(a => a.RoleId).HasMaxLength(20);
            entity.Property(a => a.Notes).HasMaxLength(256);
            entity.Property(a => a.RowVersion).IsRowVersion();
            entity.ToTable(t => t.HasCheckConstraint("CK_Assignment_EndAfterStart", "[EndUtc] > [StartUtc]"));
            entity.HasIndex(a => a.UnitId);
            entity.HasIndex(a => new { a.StaffId, a.StartUtc });
        });

        // TimeOffRequest
        b.Entity<TimeOffRequest>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint("CK_TimeOff_EndAfterStart", "[EndUtc] > [StartUtc]"));
            entity.HasIndex(t => new { t.StaffId, t.StartUtc });
        });

        // Facility
        b.Entity<Facility>(entity =>
        {
            entity.Property(f => f.Name).IsRequired();
            entity.Property(f => f.State).IsRequired();
        });

        // Unit (single, consolidated mapping)
        b.Entity<Unit>(entity =>
        {
            entity.ToTable("Units");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(100);
            entity.Property(x => x.Floor).HasMaxLength(50);
            entity.Property(x => x.Capacity);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.IsActive).HasDefaultValue(true);

            entity.HasOne(x => x.Facility)
                .WithMany(f => f.Units)
                .HasForeignKey(x => x.FacilityId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.FacilityId, x.Name });
        });

        // ShiftTemplate
        b.Entity<ShiftTemplate>(entity =>
        {
            entity.Property(t => t.Name).IsRequired();
            entity.Property(t => t.Type).IsRequired();
            entity.Property(t => t.StartLocal);
            entity.Property(t => t.EndLocal);
            entity.HasIndex(t => t.UnitId);

            entity.HasOne<Unit>()
                .WithMany()
                .HasForeignKey(t => t.UnitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Schedule
        b.Entity<Schedule>(entity =>
        {
            entity.Property(s => s.Name).IsRequired();
            entity.HasIndex(s => s.UnitId);

            entity.HasOne<Facility>()
                .WithMany()
                .HasForeignKey(s => s.FacilityId);
        });

        // DemandTemplate (rich, single mapping; no V2)
        b.Entity<DemandTemplate>(e =>
        {
            e.ToTable("DemandTemplates");                       // keep same table name
            e.Property(x => x.Status).HasConversion<int>();
            e.Property(x => x.RowVersion).IsRowVersion();
            e.Property(x => x.Role).HasMaxLength(100);
            e.Property(x => x.Notes).HasMaxLength(1000);

            e.HasMany(x => x.Days)
             .WithOne(d => d.Template)
             .HasForeignKey(d => d.DemandTemplateId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // DemandTemplateDay
        b.Entity<DemandTemplateDay>(e =>
        {
            e.ToTable("DemandTemplateDays");
            e.HasIndex(x => new { x.DemandTemplateId, x.Day }).IsUnique();
        });

        // Simple registrations for these domain types (defaults are fine)
        b.Entity<OvertimeRule>();
        b.Entity<ShiftSwap>();
        b.Entity<AuditLog>();

        // TimeClockEntry
        b.Entity<TimeClockEntry>(e =>
        {
            e.HasIndex(x => new { x.StaffId, x.ClockInUtc });
            e.HasIndex(x => x.FacilityId);
            e.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("ClockedIn");
            e.Property(x => x.Notes).HasMaxLength(500);
            e.Property(x => x.AdminNotes).HasMaxLength(500);
        });

        // ChatRoom
        b.Entity<ChatRoom>(e =>
        {
            e.Property(x => x.Type).HasMaxLength(10).HasDefaultValue("Direct");
            e.Property(x => x.Name).HasMaxLength(100);
            e.HasMany(x => x.Members).WithOne(m => m.Room).HasForeignKey(m => m.RoomId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Messages).WithOne(m => m.Room).HasForeignKey(m => m.RoomId).OnDelete(DeleteBehavior.Cascade);
        });

        // ChatRoomMember
        b.Entity<ChatRoomMember>(e =>
        {
            e.HasIndex(x => new { x.RoomId, x.UserId }).IsUnique();
        });

        // ChatMessage
        b.Entity<ChatMessage>(e =>
        {
            e.Property(x => x.Content).HasMaxLength(4000).IsRequired();
            e.HasIndex(x => new { x.RoomId, x.SentUtc });
        });

        // HelpArticle
        b.Entity<HelpArticle>(e =>
        {
            e.Property(x => x.Category).HasMaxLength(80).IsRequired();
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.TagsJson).HasColumnType("nvarchar(max)").HasDefaultValue("[]");
            e.Property(x => x.SectionsJson).HasColumnType("nvarchar(max)").HasDefaultValue("[]");
            e.HasIndex(x => new { x.Category, x.SortOrder });
        });

        // OpenShift
        b.Entity<OpenShift>(e =>
        {
            e.ToTable("OpenShifts", "staff");
            e.Property(x => x.Role).HasMaxLength(64).IsRequired();
            e.Property(x => x.Notes).HasMaxLength(512);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired().HasDefaultValue("Open");
            e.Property(x => x.CreatedByUserId).HasMaxLength(450).IsRequired();
            e.ToTable(t => t.HasCheckConstraint("CK_OpenShift_EndAfterStart", "[EndUtc] > [StartUtc]"));
            e.HasIndex(x => new { x.FacilityId, x.StartUtc });
            e.HasIndex(x => x.Status);
            e.HasMany(x => x.Requests)
             .WithOne(r => r.OpenShift)
             .HasForeignKey(r => r.OpenShiftId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // OpenShiftRequest
        b.Entity<OpenShiftRequest>(e =>
        {
            e.ToTable("OpenShiftRequests", "staff");
            e.Property(x => x.Status).HasMaxLength(20).IsRequired().HasDefaultValue("Pending");
            e.Property(x => x.ReviewedByUserId).HasMaxLength(450);
            e.Property(x => x.Notes).HasMaxLength(512);
            e.HasIndex(x => new { x.OpenShiftId, x.StaffId }).IsUnique();
            e.HasIndex(x => x.StaffId);
        });
    }
}
