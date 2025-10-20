// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

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
import AssignmentsPage from "./pages/assignments";
import { FacilityProvider } from "./context/facility";
import TimeOffPage from "./pages/timeoff";
import ConstraintsPage from "./pages/constraints";
import CoveragePage from "./pages/coverage";

// If you already created the Time Off page, uncomment the next line:
// import TimeOffPage from "./pages/timeoff";

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
            {/* Date/time pickers need this provider at or above the pages that use them */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              {/* Facility context available to all nested routes */}
              <FacilityProvider>
                <AppShell />
              </FacilityProvider>
            </LocalizationProvider>
          </RequireAuth>
        }
      >
        {/* Children (relative paths) */}
        <Route index element={<Dashboard />} />
        <Route path="scheduler" element={<Scheduler />} />
        <Route path="staff" element={<Staff />} />
        <Route path="staff/:id" element={<StaffDetail />} />
        <Route path="facilities" element={<FacilitiesPage />} />
        <Route path="constraints" element={<ConstraintsRulesPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="timeoff" element={<TimeOffPage/>} />
        <Route path="/constraints" element={<ConstraintsPage />} />
        <Route path="/coverage" element={<CoveragePage/>} />                           
        <Route path="dashboard" element={<Navigate to="/" replace />} />

        {/* Fallback for unknown routes under the shell */}
        <Route path="*" element={<Navigate to="/assignments" replace />} />
      </Route>

      {/* Final catch-all for anything outside "/" tree */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
