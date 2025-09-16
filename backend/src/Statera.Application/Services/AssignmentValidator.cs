using System;
using System.Linq;
using System.Collections.Generic;
using Statera.Domain;
namespace Statera.Application;

/// <summary>
/// Simple validators for assignment feasibility.
/// </summary>
public static class AssignmentValidator
{
    public static bool Overlaps(Assignment a, Assignment b)
        => a.StartUtc < b.EndUtc && b.StartUtc < a.EndUtc;

    /// <summary>
    /// Returns true if the candidate overlaps any *Approved* time-off for that staff.
    /// </summary>
    public static bool ConflictsWithApprovedTimeOff(
        Statera.Domain.Assignment candidate,
        IEnumerable<TimeOffRequest> timeOffs)
    {
        var staffId = candidate.StaffId;
        return timeOffs.Any(r =>
            r.StaffId == staffId &&
            string.Equals(r.Status, "Approved", StringComparison.OrdinalIgnoreCase) && // was r.Approved
            r.StartUtc < candidate.EndUtc &&
            r.EndUtc > candidate.StartUtc);
    }
}
