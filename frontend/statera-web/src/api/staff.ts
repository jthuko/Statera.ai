// src/api/staff.ts
import api from "./axios";

export interface StaffDto {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  email?: string | null;
  role?: string;
  unitId?: string | null;
  roles?: { id: string; name: string }[];
  active: boolean;
}

const http = api;

export async function listStaff(facilityId: string): Promise<StaffDto[]> {
  // Fetch ALL staff visible to this facility (per your requirement)
  const res = await http.get<StaffDto[]>(`/facilities/${facilityId}/staff`);
  return res.data;
}

export type CreateStaffPayload = {
  firstName: string;
  lastName: string;
  email?: string | null;
  facilityId: string;
  unitId?: string | null;
  role: string;
  employmentType: "FullTime" | "PartTime" | "PerDiem" | "Contract";
  active: boolean;
  adminAccess?: boolean;
};

export interface CreateStaffResult extends StaffDto {
  loginCreated?: boolean;
  tempPassword?: string;
}

export async function createStaff(payload: CreateStaffPayload): Promise<CreateStaffResult> {
  const { data } = await http.post<CreateStaffResult>(`/staff`, payload);
  return data;
}

export type UpdateStaffPayload = {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  unitId?: string | null;
  role?: string;
  employmentType?: "FullTime" | "PartTime" | "PerDiem" | "Contract";
  active?: boolean;
};

export interface FullStaffDto extends StaffDto {
  email?: string | null;
  facilityId?: string;
  unitId?: string | null;
  role?: string;
  employmentType?: string;
  hasAdminAccount?: boolean;
  hasPortalAccount?: boolean;
}

export async function getStaffById(id: string): Promise<FullStaffDto> {
  const { data } = await http.get<FullStaffDto>(`/staff/${id}`);
  return data;
}

export async function updateStaff(id: string, payload: UpdateStaffPayload): Promise<FullStaffDto> {
  const { data } = await http.put<FullStaffDto>(`/staff/${id}`, payload);
  return data;
}

export async function grantAdminAccess(staffId: string): Promise<{ email: string; tempPassword: string }> {
  const { data } = await http.post(`/staff/${staffId}/grant-admin`);
  return data;
}

export async function revokeAdminAccess(staffId: string): Promise<void> {
  await http.delete(`/staff/${staffId}/grant-admin`);
}

export async function deleteStaff(staffId: string): Promise<void> {
  await http.delete(`/staff/${staffId}`);
}

// ── Availability ──────────────────────────────────────────────────────────────

export interface AvailabilityDto {
  id: string;
  staffId: string;
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  startLocal: string; // "HH:mm"
  endLocal: string;   // "HH:mm"
}

export async function getStaffAvailability(staffId: string): Promise<AvailabilityDto[]> {
  const { data } = await http.get<AvailabilityDto[]>(`/staff/${staffId}/availability`);
  return data;
}

export async function updateStaffAvailability(staffId: string, entries: { dayOfWeek: number; startLocal: string; endLocal: string }[]): Promise<AvailabilityDto[]> {
  const { data } = await http.put<AvailabilityDto[]>(`/staff/${staffId}/availability`, entries);
  return data;
}

// ── Portal account ────────────────────────────────────────────────────────────

export interface PortalAccountResult {
  email: string;
  tempPassword: string;
  staffId: string;
}

export async function createPortalAccount(staffId: string): Promise<PortalAccountResult> {
  const { data } = await http.post<PortalAccountResult>(`/staff/${staffId}/create-portal-account`);
  return data;
}

export async function resetPortalPassword(staffId: string): Promise<{ email: string; tempPassword: string }> {
  const { data } = await http.post<{ email: string; tempPassword: string }>(`/staff/${staffId}/reset-password`);
  return data;
}

// ── Bulk import ───────────────────────────────────────────────────────────────

export interface StaffImportError {
  row: number;
  message: string;
}

export interface StaffImportResult {
  successCount: number;
  errorCount: number;
  errors: StaffImportError[];
}

export async function importStaff(facilityId: string, file: File): Promise<StaffImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post<StaffImportResult>("/staff/import", form, {
    params: { facilityId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
