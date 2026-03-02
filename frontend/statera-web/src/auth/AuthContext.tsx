import React, { createContext, useEffect, useState } from "react";
import api from "../api/axios";

export type SystemRole = "Owner" | "FacilityAdmin" | "Staff";
export type PlanStatus = "Trial" | "Active" | "Expired" | "Cancelled";

export interface User {
  id: string;
  email: string;
  systemRole: SystemRole;
  facilityIds: string[];
  staffId?: string | null; // set for Staff-role users
  planStatus?: PlanStatus | null;
  planTier?: string | null;
  trialEndsUtc?: string | null;
}

export interface SignupData {
  facilityName: string;
  facilityAddress?: string;
  facilityCity?: string;
  facilityState: string;
  facilityZip?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  impersonate: (staffId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  isImpersonating: boolean;
  isAuthorized: (roles?: SystemRole[]) => boolean;
  hasFacilityAccess: (facilityId: string) => boolean;
  isTrialExpired: () => boolean;
  trialDaysLeft: () => number | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(() => {
    return !!localStorage.getItem("statera:impersonatorAccessToken");
  });

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

  function setUserPersist(next: User | null) {
    if (next) {
      localStorage.setItem("statera:user", JSON.stringify(next));
    } else {
      localStorage.removeItem("statera:user");
    }
    setUser(next);
  }

  async function loadMeAndSet(fallbackEmail?: string) {
    try {
      const meRes = await api.get<{
        id: string;
        email: string;
        systemRole: string;
        facilityIds: string[];
        staffId?: string | null;
        planStatus?: string | null;
        planTier?: string | null;
        trialEndsUtc?: string | null;
      }>("/auth/me");

      const { id, email: userEmail, systemRole, facilityIds, staffId, planStatus, planTier, trialEndsUtc } = meRes.data;
      const parsed: User = {
        id,
        email: userEmail,
        systemRole: (systemRole as SystemRole) ?? "FacilityAdmin",
        facilityIds: facilityIds ?? [],
        staffId: staffId ?? null,
        planStatus: (planStatus as PlanStatus) ?? null,
        planTier: planTier ?? null,
        trialEndsUtc: trialEndsUtc ?? null,
      };

      setUserPersist(parsed);
      return parsed;
    } catch {
      if (!fallbackEmail) throw new Error("Failed to load user");
      const fallback: User = {
        id: "self",
        email: fallbackEmail,
        systemRole: "FacilityAdmin",
        facilityIds: [],
      };
      setUserPersist(fallback);
      return fallback;
    }
  }

  async function signup(data: SignupData) {
    const res = await api.post("/auth/signup", {
      facilityName:    data.facilityName,
      facilityAddress: data.facilityAddress ?? "",
      facilityCity:    data.facilityCity ?? "",
      facilityState:   data.facilityState,
      facilityZip:     data.facilityZip ?? "",
      firstName:       data.firstName,
      lastName:        data.lastName,
      email:           data.email,
      password:        data.password,
    });
    const { accessToken, refreshToken } = res.data ?? {};
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("No access token received");
    }
    localStorage.setItem("statera:accessToken", accessToken);
    if (typeof refreshToken === "string" && refreshToken) {
      localStorage.setItem("statera:refreshToken", refreshToken);
    }
    await loadMeAndSet(data.email);
  }

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

    localStorage.removeItem("statera:impersonatorAccessToken");
    localStorage.removeItem("statera:impersonatorRefreshToken");
    localStorage.removeItem("statera:impersonatorUser");
    setIsImpersonating(false);

    await loadMeAndSet(email);
  }

  async function impersonate(staffId: string) {
    const currentAccess = localStorage.getItem("statera:accessToken");
    const currentRefresh = localStorage.getItem("statera:refreshToken");
    const currentUser = localStorage.getItem("statera:user");

    if (currentAccess && !localStorage.getItem("statera:impersonatorAccessToken")) {
      localStorage.setItem("statera:impersonatorAccessToken", currentAccess);
      if (currentRefresh) localStorage.setItem("statera:impersonatorRefreshToken", currentRefresh);
      if (currentUser) localStorage.setItem("statera:impersonatorUser", currentUser);
    }

    const res = await api.post("/auth/impersonate", { staffId });
    const { accessToken, refreshToken } = res.data ?? {};

    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("No access token received");
    }

    localStorage.setItem("statera:accessToken", accessToken);
    if (typeof refreshToken === "string" && refreshToken) {
      localStorage.setItem("statera:refreshToken", refreshToken);
    } else {
      localStorage.removeItem("statera:refreshToken");
    }

    setIsImpersonating(true);
    await loadMeAndSet();
  }

  async function stopImpersonation() {
    const originalAccess = localStorage.getItem("statera:impersonatorAccessToken");
    const originalRefresh = localStorage.getItem("statera:impersonatorRefreshToken");
    const originalUser = localStorage.getItem("statera:impersonatorUser");

    if (originalAccess) {
      localStorage.setItem("statera:accessToken", originalAccess);
    } else {
      localStorage.removeItem("statera:accessToken");
    }

    if (originalRefresh) {
      localStorage.setItem("statera:refreshToken", originalRefresh);
    } else {
      localStorage.removeItem("statera:refreshToken");
    }

    localStorage.removeItem("statera:impersonatorAccessToken");
    localStorage.removeItem("statera:impersonatorRefreshToken");
    localStorage.removeItem("statera:impersonatorUser");
    setIsImpersonating(false);

    if (originalUser) {
      try {
        const parsed = JSON.parse(originalUser) as User;
        setUserPersist(parsed);
        return;
      } catch {
        // fall through
      }
    }

    if (originalAccess) {
      await loadMeAndSet();
    } else {
      setUserPersist(null);
    }
  }

  function logout() {
    localStorage.removeItem("statera:accessToken");
    localStorage.removeItem("statera:refreshToken");
    localStorage.removeItem("statera:user");
    localStorage.removeItem("statera:impersonatorAccessToken");
    localStorage.removeItem("statera:impersonatorRefreshToken");
    localStorage.removeItem("statera:impersonatorUser");
    setUser(null);
    setIsImpersonating(false);
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

  function isTrialExpired(): boolean {
    if (!user) return false;
    if (user.planStatus === "Active") return false;
    if (user.planStatus === "Expired" || user.planStatus === "Cancelled") return true;
    if (user.planStatus === "Trial" && user.trialEndsUtc) {
      return new Date(user.trialEndsUtc) < new Date();
    }
    return false;
  }

  function trialDaysLeft(): number | null {
    if (!user?.trialEndsUtc || user.planStatus !== "Trial") return null;
    const diff = new Date(user.trialEndsUtc).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, impersonate, stopImpersonation, isImpersonating, isAuthorized, hasFacilityAccess, isTrialExpired, trialDaysLeft }}>
      {children}
    </AuthContext.Provider>
  );
}
