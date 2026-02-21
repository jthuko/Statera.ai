// src/api/staff.ts
import axios from "axios";

export interface StaffDto {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  role?: string;
  roles?: { id: string; name: string }[];
  active: boolean;
}

const baseURL = import.meta.env.VITE_API_BASEURL ?? "/api/v1";
const http = axios.create({ baseURL });

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
