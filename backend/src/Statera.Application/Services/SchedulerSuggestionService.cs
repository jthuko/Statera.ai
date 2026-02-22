// backend/src/Statera.Application/Services/SchedulerSuggestionService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Statera.Application;
using Statera.Domain;

namespace Statera.Application.Services
{
    public class SchedulerSuggestionService
    {
        private readonly HeuristicAssignmentSuggestionService _heuristic;

        public SchedulerSuggestionService(IRepository repo, LicensePolicyService license)
        {
            _heuristic = new HeuristicAssignmentSuggestionService(repo, license);
        }

        public async Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(
            ScheduleContextDto ctx,
            CancellationToken ct = default)
        {
            if (!Enum.TryParse<CredentialType>(ctx.RequiredLicenseType, ignoreCase: true, out var cred))
                throw new ArgumentException($"Unknown credential type '{ctx.RequiredLicenseType}'.", nameof(ctx.RequiredLicenseType));

            var tuples = await _heuristic.SuggestAsync(
                ctx.StartUtc, ctx.EndUtc, ctx.UnitId, cred,
                facilityId: ctx.FacilityId,
                ct: ct);

            return tuples
                .Select(t => new AssignmentSuggestionDto(t.StaffId, t.Score, t.Reasoning))
                .ToList();
        }

        public Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(
            DateTime startUtc,
            DateTime endUtc,
            Guid unitId,
            string requiredLicenseType,
            Guid? facilityId = null,
            CancellationToken ct = default)
        {
            var ctx = new ScheduleContextDto(startUtc, endUtc, unitId, requiredLicenseType, facilityId);
            return SuggestAsync(ctx, ct);
        }
    }
}
