import api from "./axios";

export type TimeClockStatus = "ClockedIn" | "ClockedOut" | "Approved" | "Denied" | "Adjusted";

export interface TimeClockEntryDto {
  id: string;
  staffId: string;
  staffName?: string;
  facilityId: string;
  unitId?: string | null;
  clockInUtc: string;   // ISO
  clockOutUtc?: string | null; // ISO
  isManual: boolean;
  status: TimeClockStatus;
  notes?: string | null;
  adminNotes?: string | null;
  reviewedByUserId?: string | null;
  reviewedUtc?: string | null;
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
  clockOutUtc?: string;
  notes?: string;
}

export async function adjustTimeClockEntry(id: string, payload: AdjustTimeClockPayload): Promise<TimeClockEntryDto> {
  const { data } = await api.put<TimeClockEntryDto>(`/timeclock/${id}`, payload);
  return data;
}

export interface ReviewTimeClockPayload {
  action: "Approve" | "Deny";
  adminNotes?: string;
  clockInUtc?: string;
  clockOutUtc?: string;
}

export async function reviewTimeClockEntry(id: string, payload: ReviewTimeClockPayload): Promise<TimeClockEntryDto> {
  const { data } = await api.patch<TimeClockEntryDto>(`/timeclock/${id}/review`, payload);
  return data;
}
