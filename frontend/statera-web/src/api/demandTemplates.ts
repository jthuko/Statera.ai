// src/api/demandTemplates.ts

import api from "./axios";
const http = api;

export type Guid = string;

// ─── Enums / Unions ───────────────────────────────────────────────────────────

export type DemandTemplateStatus = "Draft" | "Review" | "Approved" | "Published";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface DemandDayDto {
  day: number;      // 0=Sun … 6=Sat
  required: number; // headcount
}

/** Alias so both DemandDay and DemandDayDto work */
export type DemandDay = DemandDayDto;

export interface DemandTemplateDto {
  id: Guid;
  facilityId: Guid;
  unitId?: Guid | null;
  name: string;
  role?: string | null;
  notes?: string | null;
  status: DemandTemplateStatus;
  days: DemandDayDto[];
  createdOn: string;         // ISO
  updatedOn?: string | null; // ISO
  rowVersion?: string | null;
}

/** Convenience alias used throughout the UI */
export type DemandTemplate = DemandTemplateDto;

export interface ValidationIssue {
  code: string;
  message: string;
  severity: string; // "Error" | "Warning" | "Info"
  field?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface CreateDemandTemplateRequest {
  facilityId: Guid;
  name: string;
  role?: string | null;
  unitId?: Guid | null;
  notes?: string | null;
  days?: DemandDayDto[];
}

export interface UpdateDemandTemplateRequest {
  name: string;
  role?: string | null;
  unitId?: Guid | null;
  notes?: string | null;
  days?: DemandDayDto[];
}

export interface ApplyToRangeRequest {
  startDate: string;          // "YYYY-MM-DD"
  endDate: string;            // "YYYY-MM-DD"
  overwrite?: boolean;
  targetUnitId?: Guid | null;
  targetRole?: string | null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

// GET /api/v1/facilities/{facilityId}/demand-templates?q=&status=&page=&pageSize=
export async function listDemandTemplates(
  facilityId: Guid,
  q?: string,
  status?: DemandTemplateStatus,
  page = 1,
  pageSize = 10
): Promise<PagedResult<DemandTemplate>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (q) params.q = q;
  if (status) params.status = status;
  const { data } = await http.get<PagedResult<DemandTemplate>>(
    `/facilities/${facilityId}/demand-templates`,
    { params }
  );
  return data;
}

// GET /api/v1/demand-templates/{id}
export async function getDemandTemplate(id: Guid): Promise<DemandTemplate> {
  const { data } = await http.get<DemandTemplate>(`/demand-templates/${id}`);
  return data;
}

// POST /api/v1/demand-templates
export async function createDemandTemplate(
  payload: CreateDemandTemplateRequest
): Promise<DemandTemplate> {
  const { data } = await http.post<DemandTemplate>(`/demand-templates`, payload);
  return data;
}

// PUT /api/v1/demand-templates/{id}
export async function updateDemandTemplate(
  id: Guid,
  payload: UpdateDemandTemplateRequest
): Promise<DemandTemplate> {
  const { data } = await http.put<DemandTemplate>(`/demand-templates/${id}`, payload);
  return data;
}

// DELETE /api/v1/demand-templates/{id}
export async function deleteDemandTemplate(id: Guid): Promise<void> {
  await http.delete(`/demand-templates/${id}`);
}

// ─── Lifecycle actions ────────────────────────────────────────────────────────

// POST /api/v1/demand-templates/{id}:validate  → ValidationIssue[]
export async function validateDemandTemplate(id: Guid): Promise<ValidationIssue[]> {
  const { data } = await http.post<ValidationIssue[]>(`/demand-templates/${id}:validate`);
  return data;
}

// POST /api/v1/demand-templates/{id}:approve  → DemandTemplateDto
export async function approveDemandTemplate(id: Guid): Promise<DemandTemplate> {
  const { data } = await http.post<DemandTemplate>(`/demand-templates/${id}:approve`);
  return data;
}

// POST /api/v1/demand-templates/{id}:publish  → DemandTemplateDto
export async function publishDemandTemplate(id: Guid): Promise<DemandTemplate> {
  const { data } = await http.post<DemandTemplate>(`/demand-templates/${id}:publish`);
  return data;
}

// POST /api/v1/demand-templates/{id}:apply
export async function applyTemplateToRange(
  id: Guid,
  payload: ApplyToRangeRequest
): Promise<void> {
  await http.post(`/demand-templates/${id}:apply`, payload);
}
