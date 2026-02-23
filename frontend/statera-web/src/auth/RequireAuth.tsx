import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import type { SystemRole } from "./AuthContext";

interface RequireAuthProps {
  children: React.ReactNode;
  requiredRole?: SystemRole;
  /** If true, only Staff-role users can access this route */
  staffOnly?: boolean;
}

export default function RequireAuth({ children, requiredRole, staffOnly }: RequireAuthProps) {
  const { user } = useAuth();
  const isAuthed = !!user || !!localStorage.getItem("statera:accessToken");
  const location = useLocation();

  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;

  if (user) {
    // Staff users cannot access admin routes
    if (!staffOnly && user.systemRole === "Staff" && !location.pathname.startsWith("/portal")) {
      return <Navigate to="/portal" replace />;
    }

    // Portal routes are staff-only
    if (staffOnly && user.systemRole !== "Staff") {
      return <Navigate to="/" replace />;
    }

    // Role gate for admin routes
    if (requiredRole && user.systemRole !== requiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
