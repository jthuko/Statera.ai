import api from "./axios";

export type TimeClockStatus =
  | "ClockedIn"
  | "OnLunch"
  | "ClockedOut"
  | "Approved"
  | "Denied"
  | "Adjusted"
  | "PendingCorrection";

export interface TimeClockEntryDto {
  id: string;
  staffId: string;
  staffName?: string;
  facilityId: string;
  unitId?: string | null;
  clockInUtc: string;
  clockOutUtc?: string | null;
  lunchOutUtc?: string | null;
  lunchInUtc?: string | null;
  durationMinutes?: number | null;
  lunchMinutes?: number | null;
  isManual: boolean;
  status: TimeClockStatus;
  notes?: string | null;
  adminNotes?: string | null;
  reviewedByUserId?: string | null;
  reviewedUtc?: string | null;
  correctionNotes?: string | null;
  correctedClockInUtc?: string | null;
  correctedClockOutUtc?: string | null;
  correctedLunchOutUtc?: string | null;
  correctedLunchInUtc?: string | null;
}

export interface PageResponse<T> { total: number; items: T[] }

// ── Staff actions ─────────────────────────────────────────────────────────────

export async function clockIn(facilityId: string, staffId?: string, unitId?: string, notes?: string): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>("/timeclock/clockin", { facilityId, staffId, unitId, notes });
  return data;
}

export async function clockOut(staffId?: string, notes?: string): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>("/timeclock/clockout", { staffId, notes });
  return data;
}

export async function lunchOut(staffId?: string): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>("/timeclock/lunch-out", { staffId });
  return data;
}

export async function lunchReturn(staffId?: string): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>("/timeclock/lunch-return", { staffId });
  return data;
}

export async function getActiveEntry(staffId?: string): Promise<TimeClockEntryDto | null> {
  const { data } = await api.get<TimeClockEntryDto | null>("/timeclock/active", { params: staffId ? { staffId } : undefined });
  return data;
}

// ── Admin / shared list ───────────────────────────────────────────────────────

export interface ListTimeClockParams {
  facilityId?: string;
  staffId?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listTimeClockEntries(params: ListTimeClockParams): Promise<PageResponse<TimeClockEntryDto>> {
  const { data } = await api.get<PageResponse<TimeClockEntryDto>>("/timeclock", { params });
  return data;
}

export interface AdjustTimeClockPayload {
  clockInUtc: string;
  clockOutUtc?: string | null;
  lunchOutUtc?: string | null;
  lunchInUtc?: string | null;
  adminNotes?: string;
}

export async function adjustTimeClockEntry(id: string, payload: AdjustTimeClockPayload): Promise<TimeClockEntryDto> {
  const { data } = await api.put<TimeClockEntryDto>(`/timeclock/${id}`, payload);
  return data;
}

export interface CorrectionPayload {
  notes?: string;
  clockInUtc?: string;
  clockOutUtc?: string | null;
  lunchOutUtc?: string | null;
  lunchInUtc?: string | null;
}

export async function submitCorrection(id: string, payload: CorrectionPayload): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>(`/timeclock/${id}/correction`, payload);
  return data;
}

export async function reviewTimeClockEntry(id: string, status: "Approved" | "Denied", adminNotes?: string): Promise<void> {
  await api.patch(`/timeclock/${id}/review`, { status, adminNotes });
}
