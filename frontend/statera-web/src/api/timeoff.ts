import api from "./axios";

const http = api;


export type TimeOffStatus = "Pending" | "Approved" | "Denied" | "Cancelled";


export interface TimeOffRequestDto {
id: string;
staffId: string;
staffName: string;
staffUnitId?: string | null;
staffFacilityId: string;
type: string;
status: TimeOffStatus;
startUtc: string; // ISO
endUtc: string; // ISO
reason?: string | null;
}


export interface PageResponse<T> { total: number; items: T[] }


export interface ListParams {
facilityId?: string; unitId?: string; staffId?: string; status?: string;
from?: string; to?: string; q?: string; page?: number; pageSize?: number;
}


export async function listTimeOff(params: ListParams) {
const res = await http.get<PageResponse<TimeOffRequestDto>>("/timeoff", { params });
return res.data;
}


export interface CreateTimeOffRequest {
staffId: string;
type: string;
startUtc: string; // ISO UTC
endUtc: string; // ISO UTC
reason?: string | null;
}


export async function createTimeOff(payload: CreateTimeOffRequest) {
const res = await http.post<{ id: string }>("/timeoff", payload);
return res.data;
}


export interface UpdateTimeOffRequest { type: string; startUtc: string; endUtc: string; reason?: string | null; }
export async function updateTimeOff(id: string, payload: UpdateTimeOffRequest) {
await http.put(`/timeoff/${id}`, payload);
}


export async function changeTimeOffStatus(id: string, status: TimeOffStatus, reviewedBy?: string) {
await http.patch(`/timeoff/${id}/status`, { status, reviewedBy });
}


export async function deleteTimeOff(id: string) { await http.delete(`/timeoff/${id}`); }