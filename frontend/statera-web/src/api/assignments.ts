// src/api/assignments.ts
import axios from "axios";

export interface AssignmentDto {
  id: string;
  facilityId: string;
  unitId: string;
  staffId: string;
  roleId: string;
  start: string;  // ISO
  end: string;    // ISO
  notes?: string | null;
}

export interface CreateAssignmentRequest {
  unitId: string;
  staffId: string;
  roleId: string;
  start: string; // ISO
  end: string;   // ISO
  notes?: string | null;
}

export interface UpdateAssignmentRequest {
  id: string;
  unitId: string;
  staffId: string;
  roleId: string;
  start: string;
  end: string;
  notes?: string | null;
}

export interface ListAssignmentsParams {
  start: string; // ISO date (inclusive)
  end: string;   // ISO date (exclusive or inclusive per API — we’ll use inclusive)
  unitId?: string;
  roleId?: string;
  staffId?: string;
}

const baseURL = import.meta.env.VITE_API_BASEURL ?? "/api/v1";
const http = axios.create({ baseURL });

export async function listAssignments(
  facilityId: string,
  query: ListAssignmentsParams
): Promise<AssignmentDto[]> {
  const res = await http.get<AssignmentDto[]>(
    `/facilities/${facilityId}/assignments`,
    { params: query }
  );
  return res.data;
}

export async function createAssignment(
  facilityId: string,
  payload: CreateAssignmentRequest
): Promise<AssignmentDto> {
  const res = await http.post<AssignmentDto>(
    `/facilities/${facilityId}/assignments`,
    payload
  );
  return res.data;
}

export async function updateAssignment(
  facilityId: string,
  id: string,
  payload: UpdateAssignmentRequest
): Promise<AssignmentDto> {
  const res = await http.put<AssignmentDto>(
    `/facilities/${facilityId}/assignments/${id}`,
    payload
  );
  return res.data;
}

export async function deleteAssignment(
  facilityId: string,
  id: string
): Promise<void> {
  await http.delete(`/facilities/${facilityId}/assignments/${id}`);
}
