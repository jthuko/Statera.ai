// src/components/PortalShell.tsx
// Staff-facing portal layout
import {
  AppBar, Box, BottomNavigation, BottomNavigationAction, CssBaseline,
  Paper, Toolbar, Typography, IconButton,
} from "@mui/material";
import {
  CalendarMonth, AccessAlarm, BeachAccess, Chat, Receipt, Logout,
} from "@mui/icons-material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const NAV_ITEMS = [
  { label: "Schedule",  icon: <CalendarMonth />, path: "/portal/schedule"  },
  { label: "Time Off",  icon: <BeachAccess />,   path: "/portal/timeoff"   },
  { label: "Clock",     icon: <AccessAlarm />,   path: "/portal/timeclock" },
  { label: "Timesheet", icon: <Receipt />,        path: "/portal/timesheet" },
  { label: "Chat",      icon: <Chat />,           path: "/portal/chat"      },
];

export default function PortalShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentIdx = NAV_ITEMS.findIndex(n => location.pathname.startsWith(n.path));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          background: "linear-gradient(90deg, rgba(0,77,77,.85), rgba(0,100,120,.7))",
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Statera — Staff Portal
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.75, mr: 2 }}>
            {user?.email}
          </Typography>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <Logout fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Content area — push down from AppBar, push up from bottom nav */}
      <Box
        component="main"
        sx={{ flexGrow: 1, pt: "64px", pb: "60px", px: { xs: 1, sm: 2, md: 3 }, maxWidth: 900, mx: "auto", width: "100%" }}
      >
        <Outlet />
      </Box>

      {/* Bottom navigation */}
      <Paper
        elevation={4}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
        }}
      >
        <BottomNavigation
          value={currentIdx === -1 ? 0 : currentIdx}
          onChange={(_, newVal) => navigate(NAV_ITEMS[newVal].path)}
          showLabels
          sx={{ background: "#0b1214", "& .Mui-selected": { color: "primary.light" } }}
        >
          {NAV_ITEMS.map(n => (
            <BottomNavigationAction
              key={n.path}
              label={n.label}
              icon={n.icon}
              sx={{ color: "rgba(255,255,255,0.6)", "&.Mui-selected": { color: "primary.light" } }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
