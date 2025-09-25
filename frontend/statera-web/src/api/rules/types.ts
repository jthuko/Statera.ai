// Backend record shape from /api/v1/constraints
export type ConstraintRecord = {
  id: string;
  facilityId: string;
  unitId?: string | null;
  code: string;   // e.g. "MAX_DAILY_HOURS"
  value: string;  // store numbers/arrays/objects as JSON string if needed
};

// ===== UI model (used by the page/components) =====
export type DayOfWeek =
  | "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export type LicenseRequirement = {
  id?: string;
  roleId: string;
  roleName: string;
  requiredLicenses: string[];
};

export type RestRule = {
  minRestHoursBetweenShifts: number;
  minRestHoursAfterOvertime: number;
  consecutiveDaysMax: number;
  weeklyRestDayRequired: boolean;
};

export type MaxHoursRule = {
  dailyMaxHours: number;
  weeklyMaxHours: number;
  biweeklyMaxHours: number;
  allowSelfOverride: boolean;
};

export type OvertimeTier = {
  id?: string;
  thresholdHours: number;
  multiplier: number;
};

export type OvertimeRules = {
  basis: "daily" | "weekly" | "biweekly";
  tiers: OvertimeTier[];
  capHours?: number;
  allowOvertimeOnDays: DayOfWeek[];
};

export type ConstraintsPayload = {
  facilityId: string;
  unitId?: string | null;
  maxHours: MaxHoursRule;
  rest: RestRule;
  overtime: OvertimeRules;
  licenseRequirements: LicenseRequirement[];
  aiWeights: {
    hardViolations: number;
    softViolations: number;
    overtimePenalty: number;
  };
};
