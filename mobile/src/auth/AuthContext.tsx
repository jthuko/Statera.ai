import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login as apiLogin, getMe } from "../api/auth";
import { TOKEN_KEY } from "../api/axios";

export interface User {
  id: string;
  email: string;
  systemRole: "Owner" | "FacilityAdmin" | "Staff";
  facilityIds: string[];
  staffId: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub ?? "",
      email: payload.email ?? "",
      systemRole: (payload.system_role ?? "Staff") as User["systemRole"],
      facilityIds: payload.facility_id
        ? Array.isArray(payload.facility_id) ? payload.facility_id : [payload.facility_id]
        : [],
      staffId: payload.staff_id ?? null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const me = await getMe();
          setUser({
            id: me.id,
            email: me.email,
            systemRole: me.systemRole,
            facilityIds: me.facilityIds ?? [],
            staffId: me.staffId ?? null,
          });
        } catch {
          const partial = decodeToken(token);
          if (partial) setUser(partial);
          else await AsyncStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { accessToken } = await apiLogin(email, password);
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    let me: User;
    try {
      const data = await getMe();
      me = {
        id: data.id,
        email: data.email,
        systemRole: data.systemRole,
        facilityIds: data.facilityIds ?? [],
        staffId: data.staffId ?? null,
      };
    } catch {
      me = decodeToken(accessToken) ?? { id: "", email, systemRole: "Staff", facilityIds: [], staffId: null };
    }
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
