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
    const saved = localStorage.getItem("statera:user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("auth/login", { email, password });
    const { accessToken, refreshToken, user } = res.data;

    localStorage.setItem("statera:accessToken", accessToken);
    localStorage.setItem("statera:refreshToken", refreshToken);
    localStorage.setItem("statera:user", JSON.stringify(user));

    setUser(user);
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
