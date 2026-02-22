// src/api/assignments.ts
import api from "./axios";

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
  unitId?: string; // omitted = no unit assigned
  staffId: string;
  roleId: string;
  start: string; // ISO
  end: string;   // ISO
  notes?: string | null;
}

export interface UpdateAssignmentRequest {
  id: string;
  unitId?: string;
  staffId: string;
  roleId: string;
  start: string;
  end: string;
  notes?: string | null;
}

export interface ListAssignmentsParams {
  start: string; // ISO date (inclusive)
  end: string;   // ISO date (exclusive)
  unitId?: string;
  roleId?: string;
  staffId?: string;
}

export async function listAssignments(
  facilityId: string,
  query: ListAssignmentsParams
): Promise<AssignmentDto[]> {
  const res = await api.get<AssignmentDto[]>(
    `/facilities/${facilityId}/assignments`,
    { params: query }
  );
  return res.data;
}

export async function createAssignment(
  facilityId: string,
  payload: CreateAssignmentRequest
): Promise<AssignmentDto> {
  const res = await api.post<AssignmentDto>(
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
  const res = await api.put<AssignmentDto>(
    `/facilities/${facilityId}/assignments/${id}`,
    payload
  );
  return res.data;
}

export async function deleteAssignment(
  facilityId: string,
  id: string
): Promise<void> {
  await api.delete(`/facilities/${facilityId}/assignments/${id}`);
}
