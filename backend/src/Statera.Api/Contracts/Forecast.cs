// backend/src/Statera.Api/Contracts/ForecastDtos.cs
using System;

namespace Statera.Api.Contracts;

public record DemandForecastRequest(Guid FacilityId, Guid UnitId, DateOnly From, DateOnly To);
public record BurnoutRiskRequest(Guid FacilityId, DateOnly From, DateOnly To);
public record WhatIfScenarioRequest(Guid FacilityId, Guid UnitId, string Scenario);

public record DemandForecastResponse(IEnumerable<DemandPoint> Points);
public record DemandPoint(DateOnly Date, int RequiredHeads);

public record BurnoutRiskResponse(IEnumerable<BurnoutPoint> Points);
public record BurnoutPoint(Guid StaffId, double RiskScore);

public record WhatIfResponse(string Scenario, IEnumerable<string> Effects);
