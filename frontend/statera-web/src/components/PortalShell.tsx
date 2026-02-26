// src/components/PortalShell.tsx
// Staff-facing portal layout
import {
  AppBar, Box, BottomNavigation, BottomNavigationAction, CssBaseline,
  IconButton, Paper, Toolbar, Tooltip, Typography,
} from "@mui/material";
import {
  CalendarMonth, AccessAlarm, BeachAccess, Chat, Receipt, Logout,
  WbSunny as WbSunnyIcon, DarkMode as DarkModeIcon,
  WorkHistory as WorkHistoryIcon, AccountCircle, SwitchAccount,
} from "@mui/icons-material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useColorMode } from "../context/ColorModeContext";
import AppHelpAssistant from "./AppHelpAssistant";

const NAV_ITEMS = [
  { label: "Schedule",  icon: <CalendarMonth />,   path: "/portal/schedule"    },
  { label: "Time Off",  icon: <BeachAccess />,     path: "/portal/timeoff"     },
  { label: "Clock",     icon: <AccessAlarm />,     path: "/portal/timeclock"   },
  { label: "Timesheet", icon: <Receipt />,          path: "/portal/timesheet"   },
  { label: "Shifts",    icon: <WorkHistoryIcon />, path: "/portal/open-shifts" },
  { label: "Profile",   icon: <AccountCircle />,  path: "/portal/profile"     },
  { label: "Chat",      icon: <Chat />,             path: "/portal/chat"        },
];

export default function PortalShell() {
  const { logout, user, isImpersonating, stopImpersonation } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === "dark";
  const navigate = useNavigate();
  const location = useLocation();

  const currentIdx = NAV_ITEMS.findIndex(n => location.pathname.startsWith(n.path));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: isDark
            ? "linear-gradient(90deg, rgba(0,77,77,.85), rgba(0,100,120,.7))"
            : "linear-gradient(90deg, #00695c, #0277bd)",
          borderBottom: isDark ? "none" : "1px solid rgba(0,105,92,0.3)",
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1, cursor: "pointer" }}
            onClick={() => navigate("/portal")}>
            Statera — Staff Portal
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.75, mr: 1, display: { xs: "none", sm: "block" } }}>
            {user?.email}
          </Typography>

          {isImpersonating && (
            <Tooltip title="Return to admin">
              <IconButton
                onClick={async () => {
                  await stopImpersonation();
                  navigate("/");
                }}
                size="small"
                color="inherit"
                sx={{
                  mr: 0.5,
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 1.5,
                  p: 0.75,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                <SwitchAccount sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Dark/Light toggle */}
          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              onClick={toggleMode}
              size="small"
              color="inherit"
              sx={{
                mr: 0.5,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 1.5,
                p: 0.75,
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              {isDark ? <WbSunnyIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Tooltip>

          <AppHelpAssistant staffOnly />

          <Tooltip title="Sign out">
            <IconButton
              color="inherit"
              onClick={logout}
              size="small"
              sx={{
                ml: 0.5,
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 1.5,
                p: 0.75,
                "&:hover": { color: "#ef9a9a", borderColor: "rgba(239,154,154,0.4)", bgcolor: "rgba(239,154,154,0.08)" },
              }}
            >
              <Logout sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
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
          borderRadius: 0,
        }}
      >
        <BottomNavigation
          value={currentIdx === -1 ? 0 : currentIdx}
          onChange={(_, newVal) => navigate(NAV_ITEMS[newVal].path)}
          showLabels
          sx={{
            background: isDark ? "#0a1214" : "#ffffff",
            borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {NAV_ITEMS.map(n => (
            <BottomNavigationAction
              key={n.path}
              label={n.label}
              icon={n.icon}
              sx={{
                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                "&.Mui-selected": { color: "#4db6ac" },
                fontSize: 11,
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
