import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // accept either a user or a saved token as "authed"
  const isAuthed = !!user || !!localStorage.getItem("statera:accessToken");
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}
