// src/api/units.ts
import api from "./axios";

/** Optional list for UI selects */
export const UNIT_TYPES = ["ICU", "MedSurg", "ER", "OR", "LTC", "Other"] as const;
export type UnitType = typeof UNIT_TYPES[number];

/** What the backend returns */
export type UnitDto = {
  id: string;
  facilityId: string;
  name: string;
  // keep lenient: backend sends a string; UI can still constrain via UNIT_TYPES
  type?: string | null;
  floor?: string | null;
  capacity?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdOn?: string;
  updatedOn?: string;
};

/** POST body (facilityId is in the URL) */
export type CreateUnitUnderFacilityRequest = {
  name: string;
  type?: string | null;
  floor?: string | null;
  capacity?: number | null;
  notes?: string | null;
  isActive: boolean;
};

/** PUT body */
export type UpdateUnitRequest = Partial<{
  facilityId: string; // only if you allow moving units across facilities
  name: string;
  type: string | null;
  floor: string | null;
  capacity: number | null;
  notes: string | null;
  isActive: boolean;
}>;

/** Normalizer for form values (optional helper) */
export const normalizeUnitPayload = (form: {
  name: string;
  type?: string | null;
  floor?: string | null;
  capacity?: number | string | null;
  notes?: string | null;
  isActive?: boolean;
}): CreateUnitUnderFacilityRequest | UpdateUnitRequest => ({
  name: form.name.trim(),
  type: form.type?.trim() || null,
  floor: form.floor?.trim() || null,
  capacity:
    form.capacity === "" || form.capacity === undefined || form.capacity === null
      ? null
      : Number(form.capacity),
  notes: form.notes?.trim() || null,
  isActive: Boolean(form.isActive ?? true),
});

/* ---------- API calls ---------- */

export async function listUnits(facilityId: string): Promise<UnitDto[]> {
  const { data } = await api.get(`/facilities/${facilityId}/units`);
  return data;
}

export async function getUnit(id: string): Promise<UnitDto> {
  const { data } = await api.get(`/units/${id}`);
  return data;
}

export async function createUnit(
  facilityId: string,
  payload: CreateUnitUnderFacilityRequest
): Promise<UnitDto> {
  const { data } = await api.post(`/facilities/${facilityId}/units`, payload);
  return data;
}

export async function updateUnit(
  id: string,
  payload: UpdateUnitRequest
): Promise<UnitDto> {
  const { data } = await api.put(`/units/${id}`, payload);
  return data;
}

export async function deleteUnit(id: string): Promise<void> {
  await api.delete(`/units/${id}`);
}

/** Friendly alias so components can import `Unit` */
export type Unit = UnitDto;
