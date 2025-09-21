import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../axios"; // ← NOTE: no app/ folder in your project

export type Facility = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  adminUserId?: string;
};

export function useFacilities(q?: string){
  return useQuery({
    queryKey: ["facilities", q ?? ""],
    queryFn: async () => {
      const { data } = await api.get("/facilities", { params: { query: q } });
      return data as Facility[];
    }
  });
}

export function useCreateFacility(){
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Facility>) => api.post("/facilities", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}

export function useUpdateFacility(){
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: Facility) => api.put(`/facilities/${f.id}`, f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}

export function useDeleteFacility(){
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/facilities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });
}
