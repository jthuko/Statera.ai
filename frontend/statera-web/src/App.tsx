// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scheduler from "./pages/Scheduler";
import Staff from "./pages/Staff";
import StaffDetail from "./pages/StaffDetail";
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./components/AppShell";
import PortalShell from "./components/PortalShell";
import FacilitiesPage from "./pages/Facilities";
import ConstraintsRulesPage from "./pages/constraints";
import UnitsPage from "./pages/units/_Page";
import AssignmentsPage from "./pages/assignments";
import { FacilityProvider } from "./context/facility";
import TimeOffPage from "./pages/timeoff";
import CoveragePage from "./pages/coverage";
import DemandTemplatesListPage from "./pages/demand-templates";
import DemandTemplateEditorPage from "./pages/demand-templates/editor";
import FacilityAdminPage from "./pages/facilities/FacilityAdminPage";
import ChatPage from "./pages/ChatPage";
import AdminTimeClock from "./pages/AdminTimeClock";
import OpenShiftsPage from "./pages/OpenShifts";

// Portal pages (staff)
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalSchedule from "./pages/portal/PortalSchedule";
import PortalTimeOff from "./pages/portal/PortalTimeOff";
import PortalTimeClock from "./pages/portal/PortalTimeClock";
import PortalTimesheet from "./pages/portal/PortalTimesheet";
import PortalChat from "./pages/portal/PortalChat";
import PortalOpenShifts from "./pages/portal/PortalOpenShifts";
import PortalProfile from "./pages/portal/PortalProfile";

export default function App() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* ── Staff Portal (staffOnly) ── */}
      <Route
        path="/portal"
        element={
          <RequireAuth staffOnly>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <PortalShell />
            </LocalizationProvider>
          </RequireAuth>
        }
      >
        <Route index element={<PortalDashboard />} />
        <Route path="schedule" element={<PortalSchedule />} />
        <Route path="timeoff" element={<PortalTimeOff />} />
        <Route path="timeclock" element={<PortalTimeClock />} />
        <Route path="timesheet" element={<PortalTimesheet />} />
        <Route path="chat" element={<PortalChat />} />
        <Route path="open-shifts" element={<PortalOpenShifts />} />
        <Route path="profile" element={<PortalProfile />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>

      {/* ── Admin layout ── */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <FacilityProvider>
                <AppShell />
              </FacilityProvider>
            </LocalizationProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="scheduler" element={<Scheduler />} />
        <Route path="staff" element={<Staff />} />
        <Route path="staff/:id" element={<StaffDetail />} />
        <Route path="facilities" element={<FacilitiesPage />} />
        <Route path="facilities/:facilityId" element={<FacilityAdminPage />} />
        <Route path="constraints" element={<ConstraintsRulesPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="timeoff" element={<TimeOffPage />} />
        <Route path="coverage" element={<CoveragePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="timeclock" element={<AdminTimeClock />} />
        <Route path="open-shifts" element={<OpenShiftsPage />} />
        <Route path="demand-templates" element={<DemandTemplatesListPage />} />
        <Route path="demand-templates/:id" element={<DemandTemplateEditorPage />} />
        <Route path="dashboard" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app/assignments" replace />} />
      </Route>

      {/* Final catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
