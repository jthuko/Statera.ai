// backend/src/Statera.Domain/Staffing/DemandTemplate.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Statera.Domain.Staffing;

public enum DemandTemplateStatus
{
    Draft = 0,
    Review = 1,
    Approved = 2,
    Published = 3
}

public class DemandTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FacilityId { get; set; }
    public Guid? UnitId { get; set; }
    public string Name { get; set; } = default!;
    public string? Role { get; set; }
    public string? Notes { get; set; }

    public DemandTemplateStatus Status { get; set; } = DemandTemplateStatus.Draft;

    public List<DemandTemplateDay> Days { get; set; } = new();

    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedOn { get; set; }

    [Timestamp]                       // optimistic concurrency
    public byte[]? RowVersion { get; set; }
}

public class DemandTemplateDay
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DemandTemplateId { get; set; }
    public DemandTemplate Template { get; set; } = default!;

    /// <summary>0 = Sun ... 6 = Sat</summary>
    [Range(0, 6)]
    public int Day { get; set; }

    [Range(0, 10000)]
    public int Required { get; set; }
}
