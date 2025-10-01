// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scheduler from "./pages/Scheduler";
import Staff from "./pages/Staff";
import StaffDetail from "./pages/StaffDetail";
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./components/AppShell";
import FacilitiesPage from "./pages/Facilities";
import ConstraintsRulesPage from "./pages/constraints";
import UnitsPage from "./pages/units/_Page";
import { FacilityProvider } from "./context/facility"; // ✅ add
import AssignmentsPage from "./pages/assignments";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Private layout: everything inside renders within <AppShell /> via <Outlet /> */}
      <Route
        path="/"
        element={
          <RequireAuth>
            {/* ✅ wrap the shell + its children so useFacility is available */}
            <FacilityProvider>
              <AppShell />
            </FacilityProvider>
          </RequireAuth>
        }
      >
        {/* children use RELATIVE paths */}
        <Route index element={<Dashboard />} />
        <Route path="scheduler" element={<Scheduler />} />
        <Route path="staff" element={<Staff />} />
        <Route path="staff/:id" element={<StaffDetail />} />
        <Route path="facilities" element={<FacilitiesPage />} />
        <Route path="constraints" element={<ConstraintsRulesPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="*" element={<Navigate to="/assignments" replace />} />

        {/* redirect any old /dashboard links */}
        <Route path="dashboard" element={<Navigate to="/" replace />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
