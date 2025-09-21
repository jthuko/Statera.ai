// src/auth/RequireAuth.tsx
import { Navigate } from "react-router-dom";
import { PropsWithChildren } from "react";
import { useAuth } from "../auth/useAuth"; // adjust path if you use alias

type Role = "Owner" | "Admin" | "Manager" | "Scheduler" | "Viewer";

type RequireAuthProps = PropsWithChildren<{
  roles?: Role[];
}>;

export default function RequireAuth({ roles, children }: RequireAuthProps) {
  const { user, isAuthorized } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !isAuthorized(roles)) return <Navigate to="/403" replace />;

  return <>{children}</>;
}
