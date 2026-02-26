using System;
using System.Collections.Generic;

namespace Statera.Application;

public static class TimeZoneHelper
{
    private static readonly Dictionary<string, string[]> StateToTimeZones = new(StringComparer.OrdinalIgnoreCase)
    {
        // Eastern
        ["CT"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["DE"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["FL"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["GA"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["IN"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["KY"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["MA"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["MD"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["ME"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["MI"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["NC"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["NH"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["NJ"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["NY"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["OH"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["PA"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["RI"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["SC"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["TN"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["VT"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["VA"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["WV"] = new[] { "Eastern Standard Time", "America/New_York" },
        ["DC"] = new[] { "Eastern Standard Time", "America/New_York" },

        // Central
        ["AL"] = new[] { "Central Standard Time", "America/Chicago" },
        ["AR"] = new[] { "Central Standard Time", "America/Chicago" },
        ["IA"] = new[] { "Central Standard Time", "America/Chicago" },
        ["IL"] = new[] { "Central Standard Time", "America/Chicago" },
        ["KS"] = new[] { "Central Standard Time", "America/Chicago" },
        ["LA"] = new[] { "Central Standard Time", "America/Chicago" },
        ["MN"] = new[] { "Central Standard Time", "America/Chicago" },
        ["MO"] = new[] { "Central Standard Time", "America/Chicago" },
        ["MS"] = new[] { "Central Standard Time", "America/Chicago" },
        ["ND"] = new[] { "Central Standard Time", "America/Chicago" },
        ["NE"] = new[] { "Central Standard Time", "America/Chicago" },
        ["OK"] = new[] { "Central Standard Time", "America/Chicago" },
        ["SD"] = new[] { "Central Standard Time", "America/Chicago" },
        ["TX"] = new[] { "Central Standard Time", "America/Chicago" },
        ["WI"] = new[] { "Central Standard Time", "America/Chicago" },

        // Mountain
        ["AZ"] = new[] { "Mountain Standard Time", "America/Denver" },
        ["CO"] = new[] { "Mountain Standard Time", "America/Denver" },
        ["ID"] = new[] { "Mountain Standard Time", "America/Denver" },
        ["MT"] = new[] { "Mountain Standard Time", "America/Denver" },
        ["NM"] = new[] { "Mountain Standard Time", "America/Denver" },
        ["UT"] = new[] { "Mountain Standard Time", "America/Denver" },
        ["WY"] = new[] { "Mountain Standard Time", "America/Denver" },

        // Pacific
        ["CA"] = new[] { "Pacific Standard Time", "America/Los_Angeles" },
        ["NV"] = new[] { "Pacific Standard Time", "America/Los_Angeles" },
        ["OR"] = new[] { "Pacific Standard Time", "America/Los_Angeles" },
        ["WA"] = new[] { "Pacific Standard Time", "America/Los_Angeles" },

        // Alaska / Hawaii
        ["AK"] = new[] { "Alaskan Standard Time", "America/Anchorage" },
        ["HI"] = new[] { "Hawaiian Standard Time", "Pacific/Honolulu" },
    };

    public static TimeZoneInfo ResolveForState(string? state)
    {
        if (string.IsNullOrWhiteSpace(state))
            return TimeZoneInfo.Local;

        if (StateToTimeZones.TryGetValue(state.Trim().ToUpperInvariant(), out var ids))
        {
            var tz = FindTimeZone(ids);
            if (tz != null) return tz;
        }

        return TimeZoneInfo.Local;
    }

    public static DateTime ToFacilityLocal(DateTime utc, string? state)
    {
        var tz = ResolveForState(state);
        DateTime safeUtc = utc.Kind switch
        {
            DateTimeKind.Utc => utc,
            DateTimeKind.Local => utc.ToUniversalTime(),
            _ => DateTime.SpecifyKind(utc, DateTimeKind.Utc)
        };
        return TimeZoneInfo.ConvertTimeFromUtc(safeUtc, tz);
    }

    private static TimeZoneInfo? FindTimeZone(string[] ids)
    {
        foreach (var id in ids)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }
        return null;
    }
}
