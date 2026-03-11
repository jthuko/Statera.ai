import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../axios";

export type Facility = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  adminUserId?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

const base = "/facilities"; // axios.baseURL already includes /api/v1

export function useFacilities(q?: string, page = 1, pageSize = 10) {
  const term = q?.trim();
  return useQuery({
    queryKey: ["facilities", { term: term ?? "", page, pageSize }],
    queryFn: async () => {
      const params: Record<string, any> = { page, pageSize };
      if (term) params.search = term; // only send when not empty
      const { data } = await api.get(base, { params });
      // Normalize array vs paged result to always return Facility[]
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
    staleTime: 30_000,
  });
}

export function useCreateFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Facility>) => api.post(base, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}

export function useUpdateFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: Facility) => api.put(`${base}/${f.id}`, f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}

export function useDeleteFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${base}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, logoUrl, primaryColor }: { id: string; logoUrl?: string | null; primaryColor?: string | null }) =>
      api.put(`${base}/${id}/branding`, { logoUrl, primaryColor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}
