// backend/src/Statera.Infrastructure/EfRepository.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Statera.Application;
using Statera.Domain;

namespace Statera.Infrastructure;

public class EfRepository : IRepository
{
    private readonly AppDbContext _db;
    public EfRepository(AppDbContext db) => _db = db;

    public Task<List<Staff>> GetAllStaffAsync(CancellationToken ct) =>
        _db.Staff
           .Include(s => s.Licenses)
           .Include(s => s.Availabilities)
           .AsNoTracking()
           .ToListAsync(ct);

    public Task<List<Assignment>> GetAssignmentsInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct)
    {
        // Support both Start/End and StartUtc/EndUtc shapes
        var et = _db.Model.FindEntityType(typeof(Assignment));
        bool hasStartUtc = et?.FindProperty(nameof(Assignment.StartUtc)) != null;
        bool hasEndUtc = et?.FindProperty(nameof(Assignment.EndUtc)) != null;
        bool hasStart = et?.FindProperty("Start") != null;
        bool hasEnd = et?.FindProperty("End") != null;

        IQueryable<Assignment> q = _db.Assignments.AsNoTracking();

        if (hasStartUtc && hasEndUtc)
        {
            q = q.Where(a =>
                EF.Property<DateTime>(a, nameof(Assignment.StartUtc)) < endUtc &&
                EF.Property<DateTime>(a, nameof(Assignment.EndUtc)) > startUtc);
        }
        else if (hasStart && hasEnd)
        {
            q = q.Where(a =>
                EF.Property<DateTime>(a, "Start") < endUtc &&
                EF.Property<DateTime>(a, "End") > startUtc);
        }

        return q.ToListAsync(ct);
    }

    public Task<List<TimeOffRequest>> GetTimeOffInRangeAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct)
    {
        var et = _db.Model.FindEntityType(typeof(TimeOffRequest));
        bool hasStartUtc = et?.FindProperty(nameof(TimeOffRequest.StartUtc)) != null;
        bool hasEndUtc = et?.FindProperty(nameof(TimeOffRequest.EndUtc)) != null;
        bool hasStart = et?.FindProperty("Start") != null;
        bool hasEnd = et?.FindProperty("End") != null;

        IQueryable<TimeOffRequest> q = _db.TimeOffRequests.AsNoTracking();

        if (hasStartUtc && hasEndUtc)
        {
            q = q.Where(t =>
                EF.Property<DateTime>(t, nameof(TimeOffRequest.StartUtc)) < endUtc &&
                EF.Property<DateTime>(t, nameof(TimeOffRequest.EndUtc)) > startUtc);
        }
        else if (hasStart && hasEnd)
        {
            q = q.Where(t =>
                EF.Property<DateTime>(t, "Start") < endUtc &&
                EF.Property<DateTime>(t, "End") > startUtc);
        }

        return q.ToListAsync(ct);
    }

    public Task<OvertimeRule?> GetOvertimeRuleAsync(CancellationToken ct) =>
        _db.OvertimeRules.AsNoTracking().FirstOrDefaultAsync(ct);

    public Task<List<ShiftTemplate>> GetShiftTemplatesAsync(Guid facilityId, Guid unitId, CancellationToken ct)
    {
        // Some versions include FacilityId on templates; guard for that
        var et = _db.Model.FindEntityType(typeof(ShiftTemplate));
        bool hasFacilityId = et?.FindProperty(nameof(ShiftTemplate.FacilityId)) != null;

        var q = _db.ShiftTemplates.AsNoTracking().AsQueryable();

        // Always filter by UnitId via EF.Property (avoids compile-time member access)
        q = q.Where(t => EF.Property<Guid>(t, nameof(ShiftTemplate.UnitId)) == unitId);

        if (hasFacilityId)
        {
            q = q.Where(t => EF.Property<Guid>(t, nameof(ShiftTemplate.FacilityId)) == facilityId);
        }

        return q.ToListAsync(ct);
    }

    public Task<List<Schedule>> GetSchedulesAsync(Guid facilityId, Guid unitId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        // Two known shapes:
        // A) FacilityId + UnitId + Start/End (DateOnly)
        // B) FacilityId + WeekOf (DateOnly), no UnitId
        var et = _db.Model.FindEntityType(typeof(Schedule));
        bool hasFacilityId = et?.FindProperty(nameof(Schedule.FacilityId)) != null;
        bool hasUnitId = et?.FindProperty(nameof(Schedule.UnitId)) != null;
        bool hasStart = et?.FindProperty("Start") != null;
        bool hasEnd = et?.FindProperty("End") != null;
        bool hasWeekOf = et?.FindProperty("WeekOf") != null;

        var q = _db.Schedules.AsNoTracking().AsQueryable();

        if (hasFacilityId)
            q = q.Where(s => EF.Property<Guid>(s, nameof(Schedule.FacilityId)) == facilityId);

        if (hasUnitId)
            q = q.Where(s => EF.Property<Guid>(s, nameof(Schedule.UnitId)) == unitId);

        if (hasStart && hasEnd)
        {
            q = q.Where(s =>
                EF.Property<DateOnly>(s, "Start") <= to &&
                EF.Property<DateOnly>(s, "End") >= from);
        }
        else if (hasWeekOf)
        {
            q = q.Where(s =>
                EF.Property<DateOnly>(s, "WeekOf") >= from &&
                EF.Property<DateOnly>(s, "WeekOf") <= to);
        }

        return q.ToListAsync(ct);
    }
}
