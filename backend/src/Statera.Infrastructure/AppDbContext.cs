// backend/src/Statera.Infrastructure/AppDbContext.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Statera.Domain;

namespace Statera.Infrastructure;

public class AppUser : IdentityUser { }
public class AppRole : IdentityRole { }

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

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<Staff>(entity =>
        {
            entity.Property(s => s.EmploymentType).HasConversion<string>().HasMaxLength(20);
            entity.Property(s => s.FirstName).IsRequired();
            entity.Property(s => s.LastName).IsRequired();
            entity.HasIndex(s => s.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
            entity.HasIndex(s => s.UnitId);
        });

        b.Entity<Role>(entity =>
        {
            entity.Property(r => r.Position).HasMaxLength(50).IsRequired();
            entity.HasIndex(r => r.Position).IsUnique();
        });

        b.Entity<StaffLicense>(entity =>
        {
            entity.Property(l => l.IssuingState).HasMaxLength(2).IsRequired();
            entity.Property(l => l.LicenseNumber).HasMaxLength(32);
            entity.Property(l => l.VerificationUrl).HasMaxLength(256);
            entity.HasIndex(l => new { l.StaffId, l.IssuingState, l.LicenseType, l.IsActive });
        });

        b.Entity<StaffAvailability>(entity =>
        {
            entity.Property(a => a.StartLocal);
            entity.Property(a => a.EndLocal);
            entity.ToTable(t => t.HasCheckConstraint("CK_Availability_EndAfterStart", "[EndLocal] > [StartLocal]"));
            entity.HasIndex(a => new { a.StaffId, a.DayOfWeek, a.StartLocal });
        });

        b.Entity<Assignment>(entity =>
        {
            entity.Property(a => a.FacilityState).HasMaxLength(2).IsRequired();
            entity.Property(a => a.Notes).HasMaxLength(256);
            entity.Property(a => a.RowVersion).IsRowVersion();
            entity.ToTable(t => t.HasCheckConstraint("CK_Assignment_EndAfterStart", "[EndUtc] > [StartUtc]"));
            entity.HasIndex(a => a.UnitId);
            entity.HasIndex(a => new { a.StaffId, a.StartUtc });
        });

        b.Entity<TimeOffRequest>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint("CK_TimeOff_EndAfterStart", "[EndUtc] > [StartUtc]"));
            entity.HasIndex(t => new { t.StaffId, t.StartUtc });
        });

        b.Entity<Facility>(entity =>
        {
            entity.Property(f => f.Name).IsRequired();
            entity.Property(f => f.State).IsRequired();
        });

        b.Entity<Unit>(entity =>
        {
            entity.Property(u => u.Name).IsRequired();
            entity.HasOne(u => u.Facility)
                  .WithMany(f => f.Units)
                  .HasForeignKey(u => u.FacilityId);
        });

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

        b.Entity<Schedule>(entity =>
        {
            entity.Property(s => s.Name).IsRequired();
            entity.HasIndex(s => s.UnitId);
            entity.HasOne<Facility>()
                  .WithMany()
                  .HasForeignKey(s => s.FacilityId);
        });

        b.Entity<Unit>(entity => {
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

        b.Entity<OvertimeRule>();
        b.Entity<ShiftSwap>();
        b.Entity<AuditLog>();
    }
}
