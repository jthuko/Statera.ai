import api from "./axios";

export interface TimeOffRequestDto {
  id: string;
  staffId: string;
  type: string;
  status: "Pending" | "Approved" | "Denied" | "Cancelled";
  startUtc: string;
  endUtc: string;
  reason?: string | null;
}

export async function listTimeOff(params: { staffId?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get<{ total: number; items: TimeOffRequestDto[] }>("/timeoff", { params });
  return data;
}

export async function createTimeOff(payload: {
  staffId: string; type: string; startUtc: string; endUtc: string; reason?: string | null;
}) {
  const { data } = await api.post<{ id: string }>("/timeoff", payload);
  return data;
}
