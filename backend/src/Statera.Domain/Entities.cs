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

    // Demographics / profile
    public string? Phone { get; set; }
    public string? Address1 { get; set; }
    public string? Address2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? PhotoUrl { get; set; }

    // Payroll integration identifiers
    public string? GustoEmployeeId { get; set; }
    public string? QuickBooksEmployeeId { get; set; }

    // Licensing & certifications
    public string? LicenseNumber { get; set; }
    public DateOnly? LicenseExpiresOn { get; set; }
    public DateOnly? CprExpiresOn { get; set; }

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

    // optional role for this shift (e.g., "rn", "lpn", "cna")
    public string? RoleId { get; set; }

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

public enum PlanStatus { Trial, Active, Expired, Cancelled }
public enum PlanTier { Starter, Growth, Scale, Enterprise }

public class Facility
{
    public Guid Id { get; set; }

    public string Name { get; set; } = default!;
    public string Address { get; set; } = default!;
    public string City { get; set; } = default!;
    public string State { get; set; } = default!; // e.g., "TX"
    public string Zip { get; set; } = default!;

    // ── Subscription / trial ──────────────────────────────────────────────
    public PlanStatus PlanStatus { get; set; } = PlanStatus.Trial;
    public PlanTier PlanTier { get; set; } = PlanTier.Growth; // default Growth so trial users get full access
    public DateTime? TrialStartUtc { get; set; }
    public DateTime? TrialEndsUtc { get; set; }

    // ── Stripe billing ────────────────────────────────────────────────────
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }

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

    public string Code { get; set; } = default!;
    public string Value { get; set; } = default!;
}

// ─── Time Clock ───────────────────────────────────────────────────────────────

public class TimeClockEntry
{
    public Guid Id { get; set; }
    public Guid StaffId { get; set; }
    public Staff? Staff { get; set; }
    public Guid FacilityId { get; set; }
    public Guid? UnitId { get; set; }
    public DateTime ClockInUtc { get; set; }
    public DateTime? ClockOutUtc { get; set; }
    // Lunch break window
    public DateTime? LunchOutUtc { get; set; }
    public DateTime? LunchInUtc { get; set; }
    public bool IsManual { get; set; } = false;
    // "ClockedIn" | "OnLunch" | "ClockedOut" | "Approved" | "Denied" | "Adjusted" | "PendingCorrection"
    public string Status { get; set; } = "ClockedIn";
    public string? Notes { get; set; }
    public string? AdminNotes { get; set; }
    public string? ReviewedByUserId { get; set; }
    public DateTime? ReviewedUtc { get; set; }
    // Staff-submitted correction fields
    public string? CorrectionNotes { get; set; }
    public DateTime? CorrectedClockInUtc { get; set; }
    public DateTime? CorrectedClockOutUtc { get; set; }
    public DateTime? CorrectedLunchOutUtc { get; set; }
    public DateTime? CorrectedLunchInUtc { get; set; }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

public class ChatRoom
{
    public Guid Id { get; set; }
    public Guid FacilityId { get; set; }
    public string? Name { get; set; }
    public string Type { get; set; } = "Direct"; // "Direct" | "Group"
    public string CreatedByUserId { get; set; } = default!;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public ICollection<ChatRoomMember> Members { get; set; } = new List<ChatRoomMember>();
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}

public class ChatRoomMember
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public ChatRoom Room { get; set; } = default!;
    public string UserId { get; set; } = default!;
    public DateTime JoinedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastReadUtc { get; set; }
}

public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public ChatRoom Room { get; set; } = default!;
    public string SenderUserId { get; set; } = default!;
    public string Content { get; set; } = default!;
    public DateTime SentUtc { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
}

// ── Help Documentation ────────────────────────────────────────────────────────

/// <summary>
/// A single help/documentation article shown in the in-app Help center.
/// Tags and Sections are stored as JSON strings for simplicity.
/// </summary>
public class HelpArticle
{
    public Guid Id { get; set; }

    /// <summary>Display group, e.g. "Scheduler", "Time Clock".</summary>
    public string Category { get; set; } = "";

    public string Title { get; set; } = "";

    /// <summary>JSON array of strings used for full-text filtering, e.g. ["clock in","lunch"].</summary>
    public string TagsJson { get; set; } = "[]";

    /// <summary>JSON array of {Heading?, Body} objects.</summary>
    public string SectionsJson { get; set; } = "[]";

    /// <summary>Ascending sort position within the category.</summary>
    public int SortOrder { get; set; }
}

// ── Facility Integrations ───────────────────────────────────────────────────

/// <summary>
/// Stores per-facility OAuth tokens for payroll integrations (e.g., Gusto, QuickBooks).
/// </summary>
public class FacilityIntegration
{
    public Guid Id { get; set; }
    public Guid FacilityId { get; set; }
    public string Provider { get; set; } = ""; // "Gusto" | "QuickBooks"
    public string AccessToken { get; set; } = "";
    public string? RefreshToken { get; set; }
    public DateTime? ExpiresUtc { get; set; }
    public string? ExternalCompanyId { get; set; } // e.g., QuickBooks realmId
    public string? MetadataJson { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;
}

// ── Open Shifts ───────────────────────────────────────────────────────────────

/// <summary>
/// An open/unfilled shift posted by an admin that staff can request.
/// Status: Open | Filled | Cancelled
/// </summary>
public class OpenShift
{
    public Guid Id { get; set; }
    public Guid FacilityId { get; set; }
    public Guid? UnitId { get; set; }
    public string Role { get; set; } = default!;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "Open";
    public string CreatedByUserId { get; set; } = default!;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public ICollection<OpenShiftRequest> Requests { get; set; } = new List<OpenShiftRequest>();
}

/// <summary>
/// A staff member's request to fill an OpenShift.
/// Status: Pending | Approved | Denied | Withdrawn
/// </summary>
public class OpenShiftRequest
{
    public Guid Id { get; set; }
    public Guid OpenShiftId { get; set; }
    public OpenShift OpenShift { get; set; } = default!;
    public Guid StaffId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime RequestedUtc { get; set; } = DateTime.UtcNow;
    public string? ReviewedByUserId { get; set; }
    public DateTime? ReviewedUtc { get; set; }
    public string? Notes { get; set; }
}

// placeholder - will edit below
