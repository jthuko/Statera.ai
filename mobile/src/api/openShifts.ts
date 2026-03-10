import api from "./axios";

export interface OpenShiftDto {
  id: string;
  facilityId: string;
  unitId?: string | null;
  role: string;
  startUtc: string;
  endUtc: string;
  notes?: string | null;
  status: string;
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
  status: string;
  requestedUtc: string;
}

export async function listOpenShifts(
  facilityId: string,
  params?: { start?: string; end?: string; status?: string }
): Promise<OpenShiftDto[]> {
  const { data } = await api.get<OpenShiftDto[]>(`/facilities/${facilityId}/open-shifts`, { params });
  return data;
}

export async function claimShift(shiftId: string): Promise<OpenShiftRequestDto> {
  const { data } = await api.post<OpenShiftRequestDto>(`/open-shifts/${shiftId}/requests`);
  return data;
}

export async function withdrawRequest(shiftId: string, reqId: string): Promise<void> {
  await api.delete(`/open-shifts/${shiftId}/requests/${reqId}`);
}

export async function listMyRequests(): Promise<OpenShiftRequestDto[]> {
  const { data } = await api.get<OpenShiftRequestDto[]>("/open-shifts/my-requests");
  return data;
}
