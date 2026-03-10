import api from "./axios";

// ── Time Clock (admin) ────────────────────────────────────────────────────────

export interface AdminTimeClockEntry {
  id: string;
  staffId: string;
  staffName?: string | null;
  facilityId: string;
  clockInUtc: string;
  clockOutUtc?: string | null;
  lunchOutUtc?: string | null;
  lunchInUtc?: string | null;
  lunchMinutes?: number | null;
  durationMinutes?: number | null;
  status: string;
  notes?: string | null;
  adminNotes?: string | null;
  correctionNotes?: string | null;
  correctedClockInUtc?: string | null;
  correctedClockOutUtc?: string | null;
  correctedLunchOutUtc?: string | null;
  correctedLunchInUtc?: string | null;
}

export async function listAdminTimeClock(params: {
  facilityId?: string; status?: string; page?: number; pageSize?: number;
}): Promise<{ total: number; items: AdminTimeClockEntry[] }> {
  const { data } = await api.get("/timeclock", { params });
  return { total: data.total ?? data.Total ?? 0, items: data.items ?? data.Items ?? [] };
}

export async function reviewTimeClock(
  id: string,
  status: "Approved" | "Denied",
  adminNotes?: string,
): Promise<void> {
  await api.patch(`/timeclock/${id}/review`, { status, adminNotes });
}

export async function getClockedInCount(facilityId: string): Promise<number> {
  const { data } = await api.get<{ count: number }>("/timeclock/clocked-in-count", {
    params: { facilityId },
  });
  return data.count;
}

// ── Time Off (admin) ──────────────────────────────────────────────────────────

export interface AdminTimeOffRequest {
  id: string;
  staffId: string;
  staffName: string;
  staffFacilityId: string;
  type: string;
  status: string;
  startUtc: string;
  endUtc: string;
  reason?: string | null;
}

export async function listAdminTimeOff(params: {
  facilityId?: string; status?: string; page?: number; pageSize?: number;
}): Promise<{ total: number; items: AdminTimeOffRequest[] }> {
  const { data } = await api.get("/timeoff", { params });
  return { total: data.total ?? data.Total ?? 0, items: data.items ?? data.Items ?? [] };
}

export async function reviewTimeOff(
  id: string,
  status: "Approved" | "Denied" | "Cancelled",
): Promise<void> {
  await api.patch(`/timeoff/${id}/status`, { status });
}

// ── Staff directory (admin) ───────────────────────────────────────────────────

export interface StaffDirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  licenseExpiresOn?: string | null;
}

export interface CreateStaffPayload {
  facilityId: string;
  firstName: string;
  lastName: string;
  role: string;
  employmentType: string;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

export interface UpdateStaffPayload {
  firstName?: string;
  lastName?: string;
  role?: string;
  employmentType?: string;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

export async function listStaffDirectory(
  facilityId: string,
  params?: { q?: string; role?: string; active?: boolean },
): Promise<StaffDirectoryEntry[]> {
  const { data } = await api.get<StaffDirectoryEntry[]>(`/facilities/${facilityId}/staff`, { params });
  return data;
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffDirectoryEntry> {
  const { data } = await api.post<StaffDirectoryEntry>("/staff", payload);
  return data;
}

export async function updateStaff(id: string, payload: UpdateStaffPayload): Promise<StaffDirectoryEntry> {
  const { data } = await api.put<StaffDirectoryEntry>(`/staff/${id}`, payload);
  return data;
}

export async function deleteStaff(id: string): Promise<void> {
  await api.delete(`/staff/${id}`);
}

// ── Facilities ────────────────────────────────────────────────────────────────

export interface FacilityItem {
  id: string;
  name: string;
}

export async function listFacilities(): Promise<FacilityItem[]> {
  const { data } = await api.get<FacilityItem[]>("/facilities");
  return data;
}
