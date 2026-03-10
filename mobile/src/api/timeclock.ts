import api from "./axios";

export interface TimeClockEntryDto {
  id: string;
  staffId: string;
  facilityId: string;
  clockInUtc: string;
  clockOutUtc?: string | null;
  lunchOutUtc?: string | null;
  lunchInUtc?: string | null;
  lunchMinutes?: number | null;
  status: "ClockedIn" | "OnLunch" | "ClockedOut" | "Approved" | "Denied" | "Adjusted" | "PendingCorrection";
  adminNotes?: string | null;
}

export async function clockIn(facilityId: string, staffId?: string): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>("/timeclock/clockin", { facilityId, staffId });
  return data;
}

export async function clockOut(staffId?: string): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>("/timeclock/clockout", { staffId });
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
  const { data } = await api.get<TimeClockEntryDto | null>("/timeclock/active", {
    params: staffId ? { staffId } : undefined,
  });
  return data;
}

export async function listTimeClockEntries(params: {
  staffId?: string; page?: number; pageSize?: number;
}): Promise<{ total: number; items: TimeClockEntryDto[] }> {
  const { data } = await api.get("/timeclock", { params });
  return data;
}

export async function submitCorrection(id: string, payload: {
  notes?: string; clockInUtc?: string; clockOutUtc?: string | null;
  lunchOutUtc?: string | null; lunchInUtc?: string | null;
}): Promise<TimeClockEntryDto> {
  const { data } = await api.post<TimeClockEntryDto>(`/timeclock/${id}/correction`, payload);
  return data;
}
