import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
export default function RequireAuth({ children }:{ children: JSX.Element }){
  const { isAuthed } = useAuth(); const loc = useLocation();
  if(!isAuthed) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}
