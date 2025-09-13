using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Statera.Api.Domain;
using Statera.Api.Application;

namespace Statera.Api.Infrastructure;
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
        b.Entity<Staff>(e => {
            e.Property(s => s.EmploymentType).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(s => s.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
        });
        b.Entity<Role>(e => { e.Property(r => r.Position).HasMaxLength(50); e.HasIndex(r => r.Position).IsUnique(); });
        b.Entity<StaffLicense>(e => {
            e.Property(l => l.IssuingState).HasMaxLength(2).IsRequired();
            e.Property(l => l.LicenseNumber).HasMaxLength(32);
            e.Property(l => l.VerificationUrl).HasMaxLength(256);
            e.HasIndex(l => new { l.StaffId, l.IssuingState, l.LicenseType, l.IsActive });
        });
        b.Entity<StaffAvailability>(e => {
            e.Property(a => a.StartLocal).HasConversion<long>();
            e.Property(a => a.EndLocal).HasConversion<long>();
            e.HasCheckConstraint("CK_Availability_EndAfterStart", "[EndLocal] > [StartLocal]");
            e.HasIndex(a => new { a.StaffId, a.DayOfWeek, a.StartLocal });
        });
        b.Entity<Assignment>(e => {
            e.Property(a => a.FacilityState).HasMaxLength(2).IsRequired();
            e.Property(a => a.Notes).HasMaxLength(256);
            e.HasCheckConstraint("CK_Assignment_EndAfterStart", "[EndUtc] > [StartUtc]");
            e.HasIndex(a => new { a.StaffId, a.StartUtc });
            e.Property(a => a.RowVersion).IsRowVersion();
        });
        b.Entity<TimeOffRequest>(e => {
            e.HasCheckConstraint("CK_TimeOff_EndAfterStart", "[EndUtc] > [StartUtc]");
            e.HasIndex(t => new { t.StaffId, t.StartUtc });
        });
    }
}
public class EfRepository : IRepository
{
    private readonly AppDbContext _db;
    public EfRepository(AppDbContext db) => _db = db;
    public Task<List<Staff>> GetAllStaffAsync(CancellationToken ct) =>
        _db.Staff.Include(s => s.Licenses).Include(s => s.Availabilities).ToListAsync(ct);
    public Task<List<Assignment>> GetAssignmentsInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct) =>
        _db.Assignments.Where(a => a.StartUtc < endUtc && a.EndUtc > startUtc).ToListAsync(ct);
    public Task<List<TimeOffRequest>> GetTimeOffInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct) =>
        _db.TimeOffRequests.Where(t => t.StartUtc < endUtc && t.EndUtc > startUtc).ToListAsync(ct);
    public Task<OvertimeRule?> GetOvertimeRuleAsync(CancellationToken ct) => _db.OvertimeRules.FirstOrDefaultAsync(ct);
}
