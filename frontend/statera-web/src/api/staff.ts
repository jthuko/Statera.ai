// src/api/staff.ts
import axios from "axios";

export interface StaffDto {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  roles?: { id: string; name: string }[];
  active: boolean;
}

const baseURL = import.meta.env.VITE_API_BASEURL ?? "/api/v1";
const http = axios.create({ baseURL });

export async function listStaff(facilityId: string): Promise<StaffDto[]> {
  // Fetch ALL staff visible to this facility (per your requirement)
  const res = await http.get<StaffDto[]>(`/facilities/${facilityId}/staff`);
  return res.data;
}
