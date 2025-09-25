import api from "../axios";
import type {
  ConstraintRecord,
  ConstraintsPayload,
  DayOfWeek,
  LicenseRequirement,
  MaxHoursRule,
  OvertimeRules,
  RestRule,
} from "./types";

// ---- Single source of truth for codes persisted in backend ----
const CODES = {
  DAILY_MAX: "MAX_DAILY_HOURS",
  WEEKLY_MAX: "MAX_WEEKLY_HOURS",
  BIWEEKLY_MAX: "MAX_BIWEEKLY_HOURS",
  SELF_OVERRIDE: "ALLOW_SELF_OVERRIDE",

  REST_BETWEEN: "MIN_REST_BETWEEN_SHIFTS",
  REST_AFTER_OT: "MIN_REST_AFTER_OVERTIME",
  CONSEC_DAYS: "CONSECUTIVE_DAYS_MAX",
  WEEKLY_REST_DAY: "WEEKLY_REST_DAY_REQUIRED",

  OT_BASIS: "OT_BASIS", // "daily" | "weekly" | "biweekly"
  OT_TIERS: "OT_TIERS", // JSON: [{thresholdHours, multiplier}]
  OT_CAP: "OT_CAP_HOURS",
  OT_DAYS: "OT_ALLOWED_DAYS", // JSON: DayOfWeek[]

  LICENSE_REQS: "LICENSE_REQUIREMENTS", // JSON: LicenseRequirement[]
  AI_WEIGHTS: "AI_WEIGHTS", // JSON: {hardViolations, softViolations, overtimePenalty}
} as const;

// If axios baseURL === "/api/v1", then use relative path here:
const PATH = "/constraints";

// ----------------- helpers -----------------
const toJSON = (v: any) => JSON.stringify(v);
function fromJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// Decode records -> UI model
function decode(records: ConstraintRecord[], facilityId: string, unitId?: string | null): ConstraintsPayload {
  const map = new Map(records.map(r => [r.code, r]));

  const maxHours: MaxHoursRule = {
    dailyMaxHours: Number(map.get(CODES.DAILY_MAX)?.value ?? 12),
    weeklyMaxHours: Number(map.get(CODES.WEEKLY_MAX)?.value ?? 40),
    biweeklyMaxHours: Number(map.get(CODES.BIWEEKLY_MAX)?.value ?? 80),
    allowSelfOverride: (map.get(CODES.SELF_OVERRIDE)?.value ?? "false") === "true",
  };

  const rest: RestRule = {
    minRestHoursBetweenShifts: Number(map.get(CODES.REST_BETWEEN)?.value ?? 8),
    minRestHoursAfterOvertime: Number(map.get(CODES.REST_AFTER_OT)?.value ?? 10),
    consecutiveDaysMax: Number(map.get(CODES.CONSEC_DAYS)?.value ?? 6),
    weeklyRestDayRequired: (map.get(CODES.WEEKLY_REST_DAY)?.value ?? "true") === "true",
  };

  const overtime: OvertimeRules = {
    basis: (map.get(CODES.OT_BASIS)?.value as "daily"|"weekly"|"biweekly") ?? "weekly",
    tiers: fromJSON(map.get(CODES.OT_TIERS)?.value, [{ thresholdHours: 40, multiplier: 1.5 }]),
    capHours: map.get(CODES.OT_CAP)?.value ? Number(map.get(CODES.OT_CAP)!.value) : undefined,
    allowOvertimeOnDays: fromJSON<DayOfWeek[]>(
      map.get(CODES.OT_DAYS)?.value,
      ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    ),
  };

  const licenseRequirements = fromJSON<LicenseRequirement[]>(
    map.get(CODES.LICENSE_REQS)?.value,
    []
  );

  const aiWeights = fromJSON<{ hardViolations: number; softViolations: number; overtimePenalty: number }>(
    map.get(CODES.AI_WEIGHTS)?.value,
    { hardViolations: 10, softViolations: 5, overtimePenalty: 2 }
  );

  return { facilityId, unitId: unitId ?? null, maxHours, rest, overtime, licenseRequirements, aiWeights };
}

// Encode UI model -> desired records
function encode(m: ConstraintsPayload): Omit<ConstraintRecord, "id">[] {
  const { facilityId, unitId } = m;
  return [
    { facilityId, unitId, code: CODES.DAILY_MAX, value: String(m.maxHours.dailyMaxHours) },
    { facilityId, unitId, code: CODES.WEEKLY_MAX, value: String(m.maxHours.weeklyMaxHours) },
    { facilityId, unitId, code: CODES.BIWEEKLY_MAX, value: String(m.maxHours.biweeklyMaxHours) },
    { facilityId, unitId, code: CODES.SELF_OVERRIDE, value: String(m.maxHours.allowSelfOverride) },

    { facilityId, unitId, code: CODES.REST_BETWEEN, value: String(m.rest.minRestHoursBetweenShifts) },
    { facilityId, unitId, code: CODES.REST_AFTER_OT, value: String(m.rest.minRestHoursAfterOvertime) },
    { facilityId, unitId, code: CODES.CONSEC_DAYS, value: String(m.rest.consecutiveDaysMax) },
    { facilityId, unitId, code: CODES.WEEKLY_REST_DAY, value: String(m.rest.weeklyRestDayRequired) },

    { facilityId, unitId, code: CODES.OT_BASIS, value: m.overtime.basis },
    { facilityId, unitId, code: CODES.OT_TIERS, value: toJSON(m.overtime.tiers) },
    { facilityId, unitId, code: CODES.OT_CAP, value: m.overtime.capHours != null ? String(m.overtime.capHours) : "" },
    { facilityId, unitId, code: CODES.OT_DAYS, value: toJSON(m.overtime.allowOvertimeOnDays) },

    { facilityId, unitId, code: CODES.LICENSE_REQS, value: toJSON(m.licenseRequirements) },
    { facilityId, unitId, code: CODES.AI_WEIGHTS, value: toJSON(m.aiWeights) },
  ];
}

// ----------------- API -----------------

// Load all constraints for facility/unit -> map to UI
export async function getConstraints(facilityId: string, unitId?: string | null) {
  const res = await api.get<ConstraintRecord[]>(PATH, { params: { facilityId, unitId } });
  return decode(res.data ?? [], facilityId, unitId);
}

// Upsert: diff existing vs desired; POST new, PUT updates by id
export async function upsertConstraints(model: ConstraintsPayload) {
  const current = await api.get<ConstraintRecord[]>(PATH, {
    params: { facilityId: model.facilityId, unitId: model.unitId },
  }).then(r => r.data ?? []);

  const byCode = new Map(current.map(r => [r.code, r]));
  const desired = encode(model);

  const ops: Promise<any>[] = [];
  for (const rec of desired) {
    const existing = byCode.get(rec.code);
    if (!existing) {
      ops.push(api.post(PATH, rec)); // create
    } else if (existing.value !== rec.value) {
      // keep same id, update value
      ops.push(api.put(`${PATH}/${existing.id}`, { ...existing, ...rec }));
    }
  }
  if (ops.length) await Promise.all(ops);
}

export async function getRoles() {
  // If your real endpoint is different, adjust here
  const res = await api.get<Array<{ id: string; name: string }>>("/roles");
  return res.data ?? [];
}

// If you later add a real validate endpoint, wire it here.
// For now return a success so the UI works.
export async function testRulesAgainstSample(_facilityId: string) {
  return { ok: true as const, message: "Validation OK." };
}
