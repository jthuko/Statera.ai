// src/api/demandTemplates.ts

import { http } from "./constraints"; // reuse the same axios instance you already use

export type Guid = string;

export interface DemandTemplateDto {
  id: Guid;
  facilityId: Guid;
  name: string;
  description?: string | null;
  type: string;
  isActive: boolean;
  createdOn: string;        // ISO
  updatedOn?: string | null;// ISO
}

// Requests that match backend contracts today
export interface CreateDemandTemplateRequest {
  name: string;
  description?: string | null;
  type: string;
}

export interface UpdateDemandTemplateRequest {
  name: string;
  description?: string | null;
  type: string;
  isActive: boolean;
}

// Apply-to-range payload (keep loose for now so UI compiles)
export interface ApplyTemplateToRangeRequest {
  startDate: string;   // ISO date
  endDate: string;     // ISO date
  unitIds?: Guid[];    // optional: which units to apply to
  daysOfWeek?: number[]; // optional: 0–6 for Sun–Sat
}

// --- Small runtime assert
function assertGuid(id: Guid, label: string) {
  if (!id || typeof id !== "string" || id.length < 36) {
    throw new Error(`Invalid ${label}: "${id}"`);
  }
}

// --- API calls that mirror your endpoints exactly ---

// GET /api/v1/facilities/{facilityId}/demand-templates
export async function listDemandTemplates(
  facilityId: Guid
): Promise<DemandTemplateDto[]> {
  assertGuid(facilityId, "facilityId");
  const { data } = await http.get<DemandTemplateDto[]>(
    `/facilities/${facilityId}/demand-templates`
  );
  return data;
}

// GET /api/v1/facilities/{facilityId}/demand-templates/{id}
export async function getDemandTemplate(
  facilityId: Guid,
  id: Guid
): Promise<DemandTemplateDto> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  const { data } = await http.get<DemandTemplateDto>(
    `/facilities/${facilityId}/demand-templates/${id}`
  );
  return data;
}

// POST /api/v1/facilities/{facilityId}/demand-templates
export async function createDemandTemplate(
  facilityId: Guid,
  payload: CreateDemandTemplateRequest
): Promise<DemandTemplateDto> {
  assertGuid(facilityId, "facilityId");
  const { data } = await http.post<DemandTemplateDto>(
    `/facilities/${facilityId}/demand-templates`,
    payload
  );
  return data;
}

// PUT /api/v1/facilities/{facilityId}/demand-templates/{id}
export async function updateDemandTemplate(
  facilityId: Guid,
  id: Guid,
  payload: UpdateDemandTemplateRequest
): Promise<DemandTemplateDto> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  const { data } = await http.put<DemandTemplateDto>(
    `/facilities/${facilityId}/demand-templates/${id}`,
    payload
  );
  return data;
}

// DELETE /api/v1/facilities/{facilityId}/demand-templates/{id}
export async function deleteDemandTemplate(
  facilityId: Guid,
  id: Guid
): Promise<void> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  await http.delete(
    `/facilities/${facilityId}/demand-templates/${id}`
  );
}

// --- Workflow / lifecycle actions ---
// These match what your editor imports: validate, approve, publish, apply-to-range

// POST /api/v1/facilities/{facilityId}/demand-templates/{id}/validate
export async function validateDemandTemplate(
  facilityId: Guid,
  id: Guid
): Promise<void> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  await http.post(
    `/facilities/${facilityId}/demand-templates/${id}/validate`
  );
}

// POST /api/v1/facilities/{facilityId}/demand-templates/{id}/approve
export async function approveDemandTemplate(
  facilityId: Guid,
  id: Guid
): Promise<void> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  await http.post(
    `/facilities/${facilityId}/demand-templates/${id}/approve`
  );
}

// POST /api/v1/facilities/{facilityId}/demand-templates/{id}/publish
export async function publishDemandTemplate(
  facilityId: Guid,
  id: Guid
): Promise<void> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  await http.post(
    `/facilities/${facilityId}/demand-templates/${id}/publish`
  );
}

// POST /api/v1/facilities/{facilityId}/demand-templates/{id}/apply-to-range
export async function applyTemplateToRange(
  facilityId: Guid,
  id: Guid,
  payload: ApplyTemplateToRangeRequest
): Promise<void> {
  assertGuid(facilityId, "facilityId");
  assertGuid(id, "id");
  await http.post(
    `/facilities/${facilityId}/demand-templates/${id}/apply-to-range`,
    payload
  );
}
