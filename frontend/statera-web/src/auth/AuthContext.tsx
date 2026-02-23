import React, { createContext, useEffect, useState } from "react";
import api from "../api/axios";

export type SystemRole = "Owner" | "FacilityAdmin" | "Staff";

export interface User {
  id: string;
  email: string;
  systemRole: SystemRole;
  facilityIds: string[];
  staffId?: string | null; // set for Staff-role users
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthorized: (roles?: SystemRole[]) => boolean;
  hasFacilityAccess: (facilityId: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("statera:user");
    if (raw && raw !== "undefined" && raw !== "null") {
      try {
        setUser(JSON.parse(raw) as User);
      } catch {
        localStorage.removeItem("statera:user");
      }
    }
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken } = res.data ?? {};

    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("No access token received");
    }
    localStorage.setItem("statera:accessToken", accessToken);
    if (typeof refreshToken === "string" && refreshToken) {
      localStorage.setItem("statera:refreshToken", refreshToken);
    }

    try {
      const meRes = await api.get<{
        id: string;
        email: string;
        systemRole: string;
        facilityIds: string[];
        staffId?: string | null;
      }>("/auth/me");

      const { id, email: userEmail, systemRole, facilityIds, staffId } = meRes.data;
      const parsed: User = {
        id,
        email: userEmail,
        systemRole: (systemRole as SystemRole) ?? "FacilityAdmin",
        facilityIds: facilityIds ?? [],
        staffId: staffId ?? null,
      };

      localStorage.setItem("statera:user", JSON.stringify(parsed));
      setUser(parsed);
    } catch {
      const fallback: User = {
        id: "self",
        email,
        systemRole: "FacilityAdmin",
        facilityIds: [],
      };
      localStorage.setItem("statera:user", JSON.stringify(fallback));
      setUser(fallback);
    }
  }

  function logout() {
    localStorage.removeItem("statera:accessToken");
    localStorage.removeItem("statera:refreshToken");
    localStorage.removeItem("statera:user");
    setUser(null);
  }

  function isAuthorized(roles?: SystemRole[]) {
    if (!roles?.length) return true;
    return !!user && roles.includes(user.systemRole);
  }

  function hasFacilityAccess(facilityId: string): boolean {
    if (!user) return false;
    if (user.systemRole === "Owner") return true;
    return user.facilityIds.includes(facilityId);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthorized, hasFacilityAccess }}>
      {children}
    </AuthContext.Provider>
  );
}
