// backend/src/Statera.Api/Mapping/DemandTemplateMapping.cs
using Statera.Api.Contracts;
using Statera.Domain.Staffing;

namespace Statera.Api.Mapping;

public static class DemandTemplateMapping
{
    public static DemandTemplateDto ToDto(this DemandTemplate e) =>
        new(
            e.Id,
            e.FacilityId,
            e.UnitId,
            e.Name,
            e.Role,
            e.Notes,
            e.Status,
            e.Days
                .OrderBy(d => d.Day)
                .Select(d => new DemandDayDto(d.Day, d.Required))
                .ToList(),
            e.CreatedOn,
            e.UpdatedOn,
            e.RowVersion is null ? null : Convert.ToBase64String(e.RowVersion)
        );

    public static void Apply(this DemandTemplate e, UpdateDemandTemplateRequest r)
    {
        if (!string.IsNullOrWhiteSpace(r.Name)) e.Name = r.Name.Trim();
        if (r.Role is not null) e.Role = string.IsNullOrWhiteSpace(r.Role) ? null : r.Role.Trim();
        if (r.UnitId.HasValue) e.UnitId = r.UnitId;
        if (r.Notes is not null) e.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();

        if (r.Days is not null)
        {
            // Replace all (simplest approach; alternative: diff/merge)
            e.Days.Clear();
            foreach (var d in r.Days)
            {
                if (d.Day < 0 || d.Day > 6) throw new ArgumentOutOfRangeException(nameof(d.Day));
                e.Days.Add(new DemandTemplateDay
                {
                    DemandTemplateId = e.Id,
                    Day = d.Day,
                    Required = Math.Max(0, d.Required)
                });
            }
        }

        e.UpdatedOn = DateTime.UtcNow;
    }
}
