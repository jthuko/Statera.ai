// src/api/endpoints.ts
import api from "./axios";
import { z } from "zod";

/* ===================== AUTH ===================== */

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});
export type TokenPair = z.infer<typeof TokenPair>;

// NOTE: baseURL is /api/v1 so this hits /api/v1/auth/login
export async function login(email: string, password: string): Promise<TokenPair> {
  const res = await api.post(
    "/auth/login",
    { email, password },
    { headers: { "Content-Type": "application/json" } }
  );
  return TokenPair.parse(res.data);
}

/* =================== SCHEDULER =================== */

export const Suggestion = z.object({
  staffId: z.string(),
  score: z.number(),
  reasoning: z.string(),
});
export type Suggestion = z.infer<typeof Suggestion>;

// Hits /api/v1/scheduler/suggest-assignments
export async function suggestAssignments(payload: {
  startUtc: string;
  endUtc: string;
  unitId: string;
  requiredCredential: "RN" | "LPN" | "CNA";
}): Promise<Suggestion[]> {
  const res = await api.post(
    "/scheduler/suggest-assignments",
    payload,
    { headers: { "Content-Type": "application/json" } }
  );
  return z.array(Suggestion).parse(res.data);
}

/* ===================== STAFF ===================== */

// Your API returns GUIDs (strings). Keep them as strings for the grid key.
export type StaffRow = {
  id: string;
  name: string;
  role?: string | null;
  unit?: string | null;
};

function mapStaffItem(x: any): StaffRow {
  const id: string = String(x.id ?? x.staffId ?? x.StaffID ?? x.StaffId);
  const first = x.firstName ?? x.FirstName ?? x.first_name ?? "";
  const last  = x.lastName  ?? x.LastName  ?? x.last_name  ?? "";
  const name  = (x.name || `${first} ${last}`.trim()).trim();
  const role  = x.role?.name ?? x.roleName ?? x.role ?? x.Role ?? null;
  const unit  = x.unit?.name ?? x.unitName ?? x.unit ?? x.Unit ?? null;
  return { id, name, role, unit };
}

// Hits /api/v1/staff
export async function listStaff(): Promise<StaffRow[]> {
  const res = await api.get("/staff");
  const data = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  return data.map(mapStaffItem);
}

export type StaffDetail = Record<string, any>;

// Hits /api/v1/staff/{id}
export async function getStaff(id: string): Promise<StaffDetail> {
  const res = await api.get(`/staff/${id}`);
  return res.data;
}
