using System.ComponentModel.DataAnnotations;

namespace Statera.Api.Domain;
public enum EmploymentType { FullTime, PartTime, PerDiem }
public enum CredentialType { RN, LPN, CNA }
public enum AssignmentSource { Manual, AI, Swap }
public enum AssignmentStatus { Active, Cancelled }
public enum ScheduleStatus { Draft, Published, Archived }
public class BaseEntity { public int Id {get;set;} public DateTime CreatedUtc {get;set;}=DateTime.UtcNow; public DateTime? UpdatedUtc{get;set;} }
public class Staff:BaseEntity{ public string? Email{get;set;} public string FirstName{get;set;}="" ; public string LastName{get;set;}=""; public EmploymentType EmploymentType{get;set;} ; public ICollection<StaffLicense> Licenses{get;set;}=new List<StaffLicense>(); public ICollection<StaffAvailability> Availabilities{get;set;}=new List<StaffAvailability>();}
public class Role:BaseEntity{ [MaxLength(50)] public string Position{get;set;}="" ;}
public class StaffLicense:BaseEntity{ public int StaffId{get;set;} public Staff Staff{get;set;}=default!; public CredentialType LicenseType{get;set;} public string IssuingState{get;set;}="" ; public string LicenseNumber{get;set;}="" ; public bool IsActive{get;set;}=true; public DateTime ExpirationDate{get;set;} public DateTime? LastVerifiedOn{get;set;} public string? VerificationUrl{get;set;} }
public class StaffAvailability:BaseEntity{ public int StaffId{get;set;} public Staff Staff{get;set;}=default!; public DayOfWeek DayOfWeek{get;set;} public TimeSpan StartLocal{get;set;} public TimeSpan EndLocal{get;set;} }
public class Facility:BaseEntity{ public string Name{get;set;}="" ; public string State{get;set;}="" ; public ICollection<Unit> Units{get;set;}=new List<Unit>();}
public class Unit:BaseEntity{ public int FacilityId{get;set;} public Facility Facility{get;set;}=default!; public string Name{get;set;}="" ;}
public class ShiftTemplate:BaseEntity{ public int UnitId{get;set;} public Unit Unit{get;set;}=default!; public TimeSpan StartLocal{get;set;} public TimeSpan EndLocal{get;set;} public CredentialType RequiredCredential{get;set;} }
public class Schedule:BaseEntity{ public int FacilityId{get;set;} public Facility Facility{get;set;}=default!; public DateOnly WeekOf{get;set;} public ScheduleStatus Status{get;set;} }
public class OvertimeRule:BaseEntity{ public int WeeklyHoursThreshold{get;set;}=40; public bool HardBlock{get;set;}=false; public double PenaltyWeight{get;set;}=0.3; }
public class Assignment:BaseEntity{ public int StaffId{get;set;} public Staff Staff{get;set;}=default!; public int UnitId{get;set;} public Unit Unit{get;set;}=default!; [MaxLength(2)] public string FacilityState{get;set;}="" ; public DateTime StartUtc{get;set;} public DateTime EndUtc{get;set;} public AssignmentSource Source{get;set;} public AssignmentStatus Status{get;set;}=AssignmentStatus.Active; [Timestamp] public byte[]? RowVersion{get;set;} [MaxLength(256)] public string? Notes{get;set;} }
public class TimeOffRequest:BaseEntity{ public int StaffId{get;set;} public Staff Staff{get;set;}=default!; public DateTime StartUtc{get;set;} public DateTime EndUtc{get;set;} public bool Approved{get;set;} }
public class ShiftSwap:BaseEntity{ public int FromAssignmentId{get;set;} public int ToAssignmentId{get;set;} public AssignmentSource Source{get;set;}=AssignmentSource.Swap; }
public class AuditLog:BaseEntity{ public string UserId{get;set;}="" ; public string Action{get;set;}="" ; public string? Details{get;set;} public string CorrelationId{get;set;}=Guid.NewGuid().ToString(); }
