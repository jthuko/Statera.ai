import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

interface RequireAuthProps {
  children: React.ReactNode;
  /** If provided, the user must have this system role or they will be redirected to "/" */
  requiredRole?: "Owner" | "FacilityAdmin";
}

export default function RequireAuth({ children, requiredRole }: RequireAuthProps) {
  const { user } = useAuth();
  // Accept either a hydrated user object or a saved token as "authenticated"
  const isAuthed = !!user || !!localStorage.getItem("statera:accessToken");
  const location = useLocation();

  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;

  // If a specific role is required and the user doesn't have it, redirect home
  if (requiredRole && user && user.systemRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
