// backend/src/Statera.Api/Domain/Entities.cs
using System;
using System.Collections.Generic;

namespace Statera.Domain;

public enum EmploymentType
{
    FullTime,
    PartTime,
    PerDiem,
    Contract
}

public class Staff
{
    public Guid Id { get; set; }

    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string? Email { get; set; }   // unique index (nullable allowed in model, filtered index in DbContext)

    public Guid FacilityId { get; set; }
    public Guid? UnitId { get; set; }

    public string Role { get; set; } = default!;

    // Stored as string via .HasConversion<string>().HasMaxLength(20)
    public EmploymentType EmploymentType { get; set; }

    public bool Active { get; set; }

    // Navs
    public ICollection<StaffLicense> Licenses { get; set; } = new List<StaffLicense>();
    public ICollection<StaffAvailability> Availabilities { get; set; } = new List<StaffAvailability>();
}

public class Role
{
    public Guid Id { get; set; }

    // Unique with max length 50
    public string Position { get; set; } = default!;

    public string? Description { get; set; }
}

public class StaffLicense
{
    public Guid Id { get; set; }

    public Guid StaffId { get; set; }
    public Staff Staff { get; set; } = default!;

    // max len 2, required
    public string IssuingState { get; set; } = default!;   // e.g., "TX"

    // you indexed LicenseType; keeping as string keeps it flexible
    public string LicenseType { get; set; } = default!;    // e.g., "RN", "LPN"

    // optional; max len 32
    public string? LicenseNumber { get; set; }

    public DateOnly? IssuedOn { get; set; }
    public DateOnly? ExpiresOn { get; set; }

    public bool IsActive { get; set; } = true;

    // optional; max len 256
    public string? VerificationUrl { get; set; }
}

public class StaffAvailability
{
    public Guid Id { get; set; }

    public Guid StaffId { get; set; }
    public Staff Staff { get; set; } = default!;

    // Indexed with StartLocal
    public DayOfWeek DayOfWeek { get; set; }

    // Mapped to SQL 'time' (you called e.Property(...); EF maps TimeSpan to 'time')
    public TimeSpan StartLocal { get; set; }
    public TimeSpan EndLocal { get; set; }
}

public class Assignment
{
    public Guid Id { get; set; }

    public Guid StaffId { get; set; }
    public Guid FacilityId { get; set; }
    public Guid? UnitId { get; set; }

    // max len 2, required
    public string FacilityState { get; set; } = default!;  // e.g., "TX"

    public DateTime StartUtc { get; set; } // check constraint EndUtc > StartUtc
    public DateTime EndUtc { get; set; }

    // optional; max len 256
    public string? Notes { get; set; }

    // Concurrency token
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public class TimeOffRequest
{
    public Guid Id { get; set; }

    public Guid StaffId { get; set; }
    public Staff? Staff { get; set; }

    // free-form keeps it flexible ("Vacation", "Sick", "Personal", etc.)
    public string Type { get; set; } = default!;
    public string Status { get; set; } = "Pending"; // "Pending", "Approved", "Denied"

    public DateTime StartUtc { get; set; } // check constraint EndUtc > StartUtc
    public DateTime EndUtc { get; set; }

    public string? Reason { get; set; }
}

public class Facility
{
    public Guid Id { get; set; }

    public string Name { get; set; } = default!;
    public string Address { get; set; } = default!;
    public string City { get; set; } = default!;
    public string State { get; set; } = default!; // e.g., "TX"
    public string Zip { get; set; } = default!;

    public ICollection<Unit> Units { get; set; } = new List<Unit>();
}

public class Unit
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }
    public Facility Facility { get; set; } = default!;

    public string Name { get; set; } = default!;

    // ✅ New fields used by the frontend
    public string? Type { get; set; }
    public string? Floor { get; set; }
    public int? Capacity { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}
public class ShiftTemplate
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }
    public Guid UnitId { get; set; }

    public string Name { get; set; } = default!;
    public string Type { get; set; } = default!; // e.g., "Day", "Night"

    // store as SQL 'time'
    public TimeSpan StartLocal { get; set; }
    public TimeSpan EndLocal { get; set; }
    
    public int RequiredCount { get; set; }

    // keep simple; if you want qualifications later, add a JSON-converted property
    public string? QualificationsCsv { get; set; }
}

public class Schedule
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }
    public Guid UnitId { get; set; }

    public string Name { get; set; } = default!;

    public DateOnly Start { get; set; } // mapped to 'date' in DbContext if needed
    public DateOnly End { get; set; }
}

public class OvertimeRule
{
    public Guid Id { get; set; }

    // existing fields
    public int DailyHoursThreshold { get; set; } = 8;
    public int WeeklyHoursThreshold { get; set; } = 40;
    public double OvertimeMultiplier { get; set; } = 1.5;

    // add these two to satisfy Seed.cs + tests
    public bool HardBlock { get; set; } = false;     // if true, block creating assignments over thresholds
    public double PenaltyWeight { get; set; } = 0.3; // used by heuristic scoring when not hard-blocking
}


public class ShiftSwap
{
    public Guid Id { get; set; }

    public Guid ShiftId { get; set; }
    public Guid FromStaffId { get; set; }
    public Guid ToStaffId { get; set; }

    public DateTime RequestedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedUtc { get; set; }

    public string Status { get; set; } = "Pending"; // "Pending","Approved","Rejected","Canceled"
}

public class AuditLog
{
    public Guid Id { get; set; }

    public string ActorUserId { get; set; } = default!; // from Identity (string key)
    public string Action { get; set; } = default!; // e.g., "CreateAssignment"
    public string EntityType { get; set; } = default!; // e.g., "Assignment"
    public Guid? EntityId { get; set; }

    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

    // optional JSON payload with before/after, request info, etc.
    public string? DataJson { get; set; }
    public string? IpAddress { get; set; }
}
public class Constraint
{
    public Guid Id { get; set; }
    public Guid? FacilityId { get; set; }
    public Guid? UnitId { get; set; }

    public string Code { get; set; } = default!;   // e.g., "MaxHoursPerWeek"
    public string Value { get; set; } = default!;  // e.g., "40"
}

