using System;
using System.Linq;
using Statera.Domain;
namespace Statera.Application;

/// <summary>
/// Validates that a staff member holds an active, unexpired license
/// for the specified state and credential type.
/// </summary>
public class LicensePolicyService
{
    /// <param name="staff">The staff member to check.</param>
    /// <param name="facilityState">Two-letter state code (e.g., "TX").</param>
    /// <param name="requiredType">Credential type required (enum).</param>
    /// <param name="onDate">Optional date to evaluate against; defaults to today (UTC).</param>
    public bool HasValidLicense(
        Staff staff,
        string facilityState,
        CredentialType requiredType,
        DateOnly? onDate = null)
    {
        if (staff is null) return false;
        if (string.IsNullOrWhiteSpace(facilityState)) return false;

        var today = onDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        return staff.Licenses.Any(l =>
        {
            if (!l.IsActive) return false;

            // State must match (case-insensitive)
            if (!facilityState.Equals(l.IssuingState, StringComparison.OrdinalIgnoreCase))
                return false;

            // License type stored as string -> parse to enum
            if (!Enum.TryParse<CredentialType>(l.LicenseType, ignoreCase: true, out var licType))
                return false;
            if (licType != requiredType)
                return false;

            // Not expired (null expiry treated as valid)
            if (l.ExpiresOn is DateOnly exp && exp < today)
                return false;

            return true;
        });
    }

    /// <summary>
    /// Overload that accepts the required credential as a string code (e.g., "RN").
    /// </summary>
    public bool HasValidLicense(
        Staff staff,
        string facilityState,
        string requiredTypeCode,
        DateOnly? onDate = null)
    {
        if (!Enum.TryParse<CredentialType>(requiredTypeCode, true, out var ct))
            return false;

        return HasValidLicense(staff, facilityState, ct, onDate);
    }
}
