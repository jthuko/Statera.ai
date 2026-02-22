import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/axios";
import type { Facility } from "../api/facilities/types";
import { useAuth } from "../auth/useAuth";

interface FacilityContextValue {
  facilities: Facility[];
  selected: Facility | null;
  setSelectedId: (id: string) => void;
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const FacilityContext = createContext<FacilityContextValue | undefined>(
  undefined
);

export const FacilityProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    localStorage.getItem("statera:facilityId")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!localStorage.getItem("statera:accessToken")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Facility[]>("/facilities");
      // Backend already scopes results by JWT claims — trust the server response
      const visible = res.data;
      setFacilities(visible);

      // Ensure we have a valid selection
      if (!selectedId || !visible.some((f) => f.id === selectedId)) {
        const first = visible[0];
        if (first) {
          setSelectedId(first.id);
          localStorage.setItem("statera:facilityId", first.id);
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  // Re-run whenever the logged-in user changes (covers initial load + post-login)
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setSelectedIdPersist = (id: string) => {
    setSelectedId(id);
    localStorage.setItem("statera:facilityId", id);
  };

  const selected = useMemo(
    () => facilities.find((f) => f.id === selectedId) ?? null,
    [facilities, selectedId]
  );

  const value: FacilityContextValue = {
    facilities,
    selected,
    setSelectedId: setSelectedIdPersist,
    reload,
    loading,
    error,
  };

  return (
    <FacilityContext.Provider value={value}>
      {children}
    </FacilityContext.Provider>
  );
};

export const useFacility = (): FacilityContextValue => {
  const ctx = useContext(FacilityContext);
  if (!ctx) {
    throw new Error("useFacility must be used within FacilityProvider");
  }
  return ctx;
};
