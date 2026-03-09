import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./useAuth";
import type { SystemRole } from "./AuthContext";

interface RequireAuthProps {
  children: React.ReactNode;
  requiredRole?: SystemRole;
  /** If true, only Staff-role users can access this route */
  staffOnly?: boolean;
}

export default function RequireAuth({ children, requiredRole, staffOnly }: RequireAuthProps) {
  const { user, loading, isTrialExpired } = useAuth();
  const location = useLocation();

  // Wait for the initial user load from localStorage before making routing decisions
  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#4db6ac" }} />
      </Box>
    );
  }

  const isAuthed = !!user || !!localStorage.getItem("statera:accessToken");

  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;

  // Block access (except staff portal) when trial has expired
  if (user && isTrialExpired() && !staffOnly && location.pathname !== "/trial-expired") {
    return <Navigate to="/trial-expired" replace />;
  }

  if (user) {
    // Staff users cannot access admin routes
    if (!staffOnly && user.systemRole === "Staff" && !location.pathname.startsWith("/portal")) {
      return <Navigate to="/portal" replace />;
    }

    // Portal routes are staff-only
    if (staffOnly && user.systemRole !== "Staff") {
      return <Navigate to="/app" replace />;
    }

    // Role gate for admin routes
    if (requiredRole && user.systemRole !== requiredRole) {
      return <Navigate to="/app" replace />;
    }
  }

  return <>{children}</>;
}
