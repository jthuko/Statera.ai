import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scheduler from "./pages/Scheduler";
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./components/AppShell";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Routes that need auth + shell */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell>
              <Dashboard />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/scheduler"
        element={
          <RequireAuth>
            <AppShell>
              <Scheduler />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* you can add more like /staff, /facilities, /constraints */}
    </Routes>
  );
}
