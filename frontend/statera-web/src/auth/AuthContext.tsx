import React, { createContext, useEffect, useState } from "react";
import api from "../api/axios";

type Role = "Owner" | "Admin" | "Manager" | "Scheduler" | "Viewer";

interface User {
  id: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthorized: (roles?: Role[]) => boolean;
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
    // Ensure leading slash so the axios base "/api/v1" resolves correctly
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken } = res.data ?? {};

    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("No access token received");
    }
    localStorage.setItem("statera:accessToken", accessToken);
    if (typeof refreshToken === "string" && refreshToken) {
      localStorage.setItem("statera:refreshToken", refreshToken);
    }

    // Prefer any existing user in storage
    const existing = localStorage.getItem("statera:user");
    if (existing && existing !== "undefined" && existing !== "null") {
      try {
        const parsed = JSON.parse(existing) as User;
        setUser(parsed);
        return;
      } catch {
        localStorage.removeItem("statera:user");
      }
    }

    // Fallback: set a minimal user so guards depending on `user` pass
    const fallback: User = { id: "self", email, role: "Viewer" };
    localStorage.setItem("statera:user", JSON.stringify(fallback));
    setUser(fallback);
  }

  function logout() {
    localStorage.removeItem("statera:accessToken");
    localStorage.removeItem("statera:refreshToken");
    localStorage.removeItem("statera:user");
    setUser(null);
  }

  function isAuthorized(roles?: Role[]) {
    if (!roles?.length) return true;
    return !!user && roles.includes(user.role);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthorized }}>
      {children}
    </AuthContext.Provider>
  );
}
