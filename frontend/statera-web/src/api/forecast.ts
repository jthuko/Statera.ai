// src/api/forecast.ts
import api from "./axios";

export interface DemandPoint {
  date: string;
  requiredHeads: number;
  historicalAvgHeads: number;
  confidence: number;
}

export interface DemandForecastResponse {
  points: DemandPoint[];
}

export interface BurnoutPoint {
  staffId: string;
  staffName: string;
  riskScore: number;
  hoursLast4Wk: number;
  consecutiveDays: number;
  shiftsLast4Wk: number;
}

export interface BurnoutRiskResponse {
  points: BurnoutPoint[];
}

export interface WhatIfEffect {
  day: string;
  currentCoverage: number;
  projectedCoverage: number;
}

export interface WhatIfResponse {
  scenario: string;
  currentAvgCoverage: number;
  projectedAvgCoverage: number;
  gapDays: number;
  overtimeRisk: boolean;
  dayEffects: WhatIfEffect[];
  recommendations: string[];
}

export interface AiInsight {
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
}

export interface ForecastSummary {
  avgCoverageRate: number;
  understaffedDays: number;
  overtimeDays: number;
  peakDemandDay: number;
  peakDayOfWeek: string;
}

export interface ForecastInsightsResponse {
  summary: ForecastSummary;
  insights: AiInsight[];
  tokensUsed?: string | null;
}

export const forecastApi = {
  getDemand: (facilityId: string, unitId: string, from: string, to: string) =>
    api.post<DemandForecastResponse>("/forecast/demand", { facilityId, unitId, from, to }),

  getBurnout: (facilityId: string, from: string, to: string) =>
    api.post<BurnoutRiskResponse>("/forecast/burnout", { facilityId, from, to }),

  getWhatIf: (facilityId: string, unitId: string, scenario: string, from: string, to: string) =>
    api.post<WhatIfResponse>("/forecast/whatif", { facilityId, unitId, scenario, from, to }),

  getInsights: (facilityId: string, unitId: string | null, from: string, to: string) =>
    api.post<ForecastInsightsResponse>("/forecast/insights", { facilityId, unitId, from, to }),
};
