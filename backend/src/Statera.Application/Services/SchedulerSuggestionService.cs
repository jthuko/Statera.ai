// backend/src/Statera.Application/Services/SchedulerSuggestionService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Statera.Application;                // your DTOs (AssignmentSuggestionDto, ScheduleContextDto) + IRepository
using Statera.Domain;                    // CredentialType

namespace Statera.Application.Services
{
    public class SchedulerSuggestionService
    {
        private readonly HeuristicAssignmentSuggestionService _heuristic;

        public SchedulerSuggestionService(IRepository repo, LicensePolicyService license)
        {
            _heuristic = new HeuristicAssignmentSuggestionService(repo, license);
        }

        // Uses your ScheduleContextDto (RequiredLicenseType is string)
        public async Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(
            ScheduleContextDto ctx,
            CancellationToken ct = default)
        {
            if (!Enum.TryParse<CredentialType>(ctx.RequiredLicenseType, ignoreCase: true, out var cred))
                throw new ArgumentException($"Unknown credential type '{ctx.RequiredLicenseType}'.", nameof(ctx.RequiredLicenseType));

            var tuples = await _heuristic.SuggestAsync(ctx.StartUtc, ctx.EndUtc, ctx.UnitId, cred, ct);

            var list = tuples
                .Select(t => new AssignmentSuggestionDto(t.StaffId, t.Score, Reasoning: "heuristic"))
                .ToList();

            return list; // List<T> is fine for IReadOnlyList<T>
        }

        // Convenience overload that takes raw params and forwards to the context-based version
        public Task<IReadOnlyList<AssignmentSuggestionDto>> SuggestAsync(
            DateTime startUtc,
            DateTime endUtc,
            Guid unitId,
            string requiredLicenseType,
            CancellationToken ct = default)
        {
            var ctx = new ScheduleContextDto(startUtc, endUtc, unitId, requiredLicenseType);
            return SuggestAsync(ctx, ct); // already returns Task<IReadOnlyList<...>>
        }
    }
}
