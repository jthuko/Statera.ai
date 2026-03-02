// backend/src/Statera.Api/Contracts/Forecast.cs
namespace Statera.Api.Contracts;

// ── Demand ──────────────────────────────────────────────────────────────────
public record DemandForecastRequest(Guid FacilityId, Guid UnitId, DateOnly From, DateOnly To);
public record DemandPoint(DateOnly Date, int RequiredHeads, int HistoricalAvgHeads, double Confidence);
public record DemandForecastResponse(IEnumerable<DemandPoint> Points);

// ── Burnout ──────────────────────────────────────────────────────────────────
public record BurnoutRiskRequest(Guid FacilityId, DateOnly From, DateOnly To);
public record BurnoutPoint(Guid StaffId, string StaffName, double RiskScore,
    double HoursLast4Wk, int ConsecutiveDays, int ShiftsLast4Wk);
public record BurnoutRiskResponse(IEnumerable<BurnoutPoint> Points);

// ── What-if ──────────────────────────────────────────────────────────────────
public record WhatIfScenarioRequest(Guid FacilityId, Guid UnitId, string Scenario,
    DateOnly From, DateOnly To);
public record WhatIfEffect(string Day, double CurrentCoverage, double ProjectedCoverage);
public record WhatIfResponse(string Scenario, double CurrentAvgCoverage,
    double ProjectedAvgCoverage, int GapDays, bool OvertimeRisk,
    IEnumerable<WhatIfEffect> DayEffects, IEnumerable<string> Recommendations);

// ── AI Insights ──────────────────────────────────────────────────────────────
public record ForecastInsightsRequest(Guid FacilityId, Guid? UnitId, DateOnly From, DateOnly To);
public record AiInsight(string Title, string Body, string Severity); // info | warning | critical
public record ForecastSummary(double AvgCoverageRate, int UnderstaffedDays,
    int OvertimeDays, double PeakDemandDay, string PeakDayOfWeek);
public record ForecastInsightsResponse(ForecastSummary Summary,
    IEnumerable<AiInsight> Insights, string? TokensUsed);
