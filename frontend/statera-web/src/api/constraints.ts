// src/api/constraints.ts
import api from "./axios";

// Use the shared authenticated axios instance (handles JWT + refresh)
const http = api;

export type Guid = string;

// ---------- Enums & Types ----------
// ⛔ These names must match the C# enums (JsonStringEnumConverter) exactly (case-sensitive).
export enum ConstraintType {
  MaxHoursPerWeek = "MaxHoursPerWeek",
  MinRestBetweenShiftsHours = "MinRestBetweenShiftsHours",
  MaxConsecutiveDays = "MaxConsecutiveDays",
  OvertimeCapHours = "OvertimeCapHours",
  LicenseRequired = "LicenseRequired",
  UnitCoverageRatio = "UnitCoverageRatio",
  ShiftPreference = "ShiftPreference",
}

export type RuleScope = "Facility" | "Unit" | "Role";

export interface ConstraintDto {
  id: Guid;
  facilityId: Guid;
  scope: RuleScope;
  unitId?: Guid | null;
  role?: string | null;
  type: ConstraintType;
  value: string;
  isActive: boolean;
  notes?: string | null;
  createdOn: string;
  updatedOn?: string | null;
}

export interface CreateConstraintRequest {
  scope: RuleScope;
  unitId?: Guid | null;
  role?: string | null;
  type: ConstraintType;
  value: string;
  isActive: boolean;
  notes?: string | null;
}

export interface UpdateConstraintRequest extends CreateConstraintRequest {}

// ---------- Small runtime asserts ----------
function assertGuid(id: Guid, label: string) {
  if (!id || typeof id !== "string" || id.length < 36) {
    throw new Error(`Invalid ${label}: "${id}"`);
  }
}

// ---------- API Calls ----------
export async function listConstraints(facilityId: Guid): Promise<ConstraintDto[]> {
  assertGuid(facilityId, "facilityId");
  const { data } = await http.get<ConstraintDto[]>(`/facilities/${facilityId}/constraints`);
  return data;
}

export async function createConstraint(
  facilityId: Guid,
  payload: CreateConstraintRequest
): Promise<ConstraintDto> {
  assertGuid(facilityId, "facilityId");
  const body = normalizePayload(payload);
  const { data } = await http.post<ConstraintDto>(`/facilities/${facilityId}/constraints`, body);
  return data;
}

export async function updateConstraint(
  facilityId: Guid,
  id: Guid,
  payload: UpdateConstraintRequest
): Promise<ConstraintDto> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  const body = normalizePayload(payload);
  const { data } = await http.put<ConstraintDto>(`/facilities/${facilityId}/constraints/${id}`, body);
  return data;
}

export async function deleteConstraint(facilityId: Guid, id: Guid): Promise<void> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  await http.delete(`/facilities/${facilityId}/constraints/${id}`);
}

// Only send fields relevant to the chosen scope (mirrors backend validation)
function normalizePayload<T extends CreateConstraintRequest | UpdateConstraintRequest>(p: T): T {
  const copy: any = { ...p };
  if (p.scope === "Facility") {
    copy.unitId = null;
    copy.role = null;
  } else if (p.scope === "Unit") {
    copy.role = null;
  } else if (p.scope === "Role") {
    copy.unitId = null;
  }
  return copy as T;
}

// ---------- Helper constants for UI ----------
export const RULE_SCOPES: RuleScope[] = ["Facility", "Unit", "Role"];

export const CONSTRAINT_OPTIONS: { value: ConstraintType; label: string; hint?: string }[] = [
  { value: ConstraintType.MaxHoursPerWeek,            label: "Max hours / week",                   hint: "e.g. 36 or 40" },
  { value: ConstraintType.MinRestBetweenShiftsHours,  label: "Min rest between shifts (hrs)",       hint: "e.g. 8, 10, 12" },
  { value: ConstraintType.MaxConsecutiveDays,          label: "Max consecutive days",                hint: "e.g. 3, 5, 6" },
  { value: ConstraintType.OvertimeCapHours,            label: "Overtime cap (hrs)",                  hint: "e.g. 12" },
  { value: ConstraintType.LicenseRequired,             label: "License required",                    hint: "true or false" },
  { value: ConstraintType.UnitCoverageRatio,           label: "Unit coverage ratio",                 hint: `e.g. 0.8` },
  { value: ConstraintType.ShiftPreference,             label: "Shift preference bonus",              hint: "e.g. 5 (score bonus)" },
];
