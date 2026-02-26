// src/api/openShifts.ts
import api from "./axios";

export interface OpenShiftDto {
  id: string;
  facilityId: string;
  unitId?: string | null;
  role: string;
  startUtc: string;
  endUtc: string;
  notes?: string | null;
  status: string; // Open | Filled | Cancelled
  createdUtc: string;
  requestCount: number;
  myRequestId?: string | null;
  myRequestStatus?: string | null;
}

export interface OpenShiftRequestDto {
  id: string;
  openShiftId: string;
  staffId: string;
  staffName: string;
  status: string; // Pending | Approved | Denied | Withdrawn
  requestedUtc: string;
  reviewedUtc?: string | null;
  notes?: string | null;
}

export interface CreateOpenShiftPayload {
  facilityId: string;
  unitId?: string | null;
  role: string;
  startUtc: string;
  endUtc: string;
  notes?: string | null;
}

export interface UpdateOpenShiftPayload {
  startUtc?: string | null;
  endUtc?: string | null;
  notes?: string | null;
  status?: string | null;
  role?: string | null;
  unitId?: string | null;
}

export interface ListOpenShiftsParams {
  start?: string;
  end?: string;
  role?: string;
  unitId?: string;
  status?: string;
}

export async function listOpenShifts(
  facilityId: string,
  params?: ListOpenShiftsParams
): Promise<OpenShiftDto[]> {
  const res = await api.get<OpenShiftDto[]>(
    `/facilities/${facilityId}/open-shifts`,
    { params }
  );
  return res.data;
}

export async function createOpenShift(
  payload: CreateOpenShiftPayload
): Promise<OpenShiftDto> {
  const res = await api.post<OpenShiftDto>("/open-shifts", payload);
  return res.data;
}

export async function updateOpenShift(
  id: string,
  payload: UpdateOpenShiftPayload
): Promise<OpenShiftDto> {
  const res = await api.patch<OpenShiftDto>(`/open-shifts/${id}`, payload);
  return res.data;
}

export async function deleteOpenShift(id: string): Promise<void> {
  await api.delete(`/open-shifts/${id}`);
}

export async function listRequests(
  shiftId: string
): Promise<OpenShiftRequestDto[]> {
  const res = await api.get<OpenShiftRequestDto[]>(
    `/open-shifts/${shiftId}/requests`
  );
  return res.data;
}

export async function reviewRequest(
  shiftId: string,
  reqId: string,
  action: "Approve" | "Deny"
): Promise<void> {
  await api.patch(`/open-shifts/${shiftId}/requests/${reqId}`, { action });
}

export async function claimShift(shiftId: string): Promise<OpenShiftRequestDto> {
  const res = await api.post<OpenShiftRequestDto>(
    `/open-shifts/${shiftId}/requests`
  );
  return res.data;
}

export async function withdrawRequest(
  shiftId: string,
  reqId: string
): Promise<void> {
  await api.delete(`/open-shifts/${shiftId}/requests/${reqId}`);
}

export async function listMyRequests(): Promise<OpenShiftRequestDto[]> {
  const res = await api.get<OpenShiftRequestDto[]>("/open-shifts/my-requests");
  return res.data;
}
