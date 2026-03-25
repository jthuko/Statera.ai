import api from "./axios";

// ── Request ───────────────────────────────────────────────────────────────────

export type SimulationType = "ShortStaffed" | "CallOff" | "OvertimeReduction";

export interface SimulationRequest {
  type: SimulationType;
  unitId?: string;
  role?: string;
  simDate?: string;       // ISO date "YYYY-MM-DD"
  missingCount?: number;
  maxOtHours?: number;
  windowDays?: number;
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface SimulationOption {
  label: string;
  description: string;
  tag: string;            // "Best" | "Cheapest" | "Safest" | "Alternative" | "Last Resort"
  estimatedCost: number;  // negative = savings
  overtimeRisk: string;
  fillLikelihood: number; // 0–1
  coverageScore: number;  // 0–100
}

export interface SimulationMetrics {
  coverageScore: number;
  estimatedCost: number;
  overtimeImpact: string;
  fatigueRisk: string;
  fillLikelihood: number;
  safetyAlert: string | null;
}

export interface SimulationResult {
  type: SimulationType;
  title: string;
  summary: string;
  options: SimulationOption[];
  metrics: SimulationMetrics;
  historicalContext: string;
  aiNarrative: string | null;
}

// ── API call ──────────────────────────────────────────────────────────────────

export function runSimulation(facilityId: string, req: SimulationRequest) {
  return api.post<SimulationResult>(`/facilities/${facilityId}/simulate`, req);
}
