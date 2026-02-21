import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./axios";

export type FacilityAdmin = {
  userId: string;
  email: string;
  facilityRole: string;
  assignedUtc: string;
};

export type AvailableUser = {
  id: string;
  email: string | null;
  userName: string | null;
  systemRole: string;
};

export function useFacilityAdmins(facilityId: string | undefined) {
  return useQuery({
    queryKey: ["facilityAdmins", facilityId],
    queryFn: async () => {
      if (!facilityId) return [] as FacilityAdmin[];
      const { data } = await api.get<FacilityAdmin[]>(
        `/facilities/${facilityId}/admins`
      );
      return data;
    },
    enabled: !!facilityId,
  });
}

export function useAvailableUsers(facilityId: string | undefined) {
  return useQuery({
    queryKey: ["availableUsers", facilityId],
    queryFn: async () => {
      const params = facilityId ? { excludeFacilityId: facilityId } : {};
      const { data } = await api.get<AvailableUser[]>("/users", { params });
      return data;
    },
    enabled: !!facilityId,
  });
}

export function useAssignFacilityAdmin(facilityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post(`/facilities/${facilityId}/admins`, { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facilityAdmins", facilityId] });
      qc.invalidateQueries({ queryKey: ["availableUsers", facilityId] });
    },
  });
}

export function useRemoveFacilityAdmin(facilityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/facilities/${facilityId}/admins/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facilityAdmins", facilityId] });
      qc.invalidateQueries({ queryKey: ["availableUsers", facilityId] });
    },
  });
}
