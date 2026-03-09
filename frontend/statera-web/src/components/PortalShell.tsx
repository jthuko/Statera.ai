// src/components/PortalShell.tsx
// Staff-facing portal layout
import { useState } from "react";
import {
  AppBar, Avatar, Box, BottomNavigation, BottomNavigationAction, CssBaseline, Divider,
  Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Paper, Toolbar, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import {
  CalendarMonth, AccessAlarm, BeachAccess, Chat, Receipt, Logout,
  WbSunny as WbSunnyIcon, DarkMode as DarkModeIcon,
  WorkHistory as WorkHistoryIcon, AccountCircle, SwitchAccount,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  Dashboard as DashboardIcon,
} from "@mui/icons-material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useColorMode } from "../context/ColorModeContext";
import AppHelpAssistant from "./AppHelpAssistant";
import StateraLogo from "../assets/statera-logo.png";

const DRAWER_EXPANDED  = 220;
const DRAWER_COLLAPSED = 64;

const NAV_ITEMS = [
  { label: "Dashboard", icon: <DashboardIcon />,    path: "/portal"             },
  { label: "Schedule",  icon: <CalendarMonth />,    path: "/portal/schedule"    },
  { label: "Time Off",  icon: <BeachAccess />,      path: "/portal/timeoff"     },
  { label: "Clock",     icon: <AccessAlarm />,      path: "/portal/timeclock"   },
  { label: "Timesheet", icon: <Receipt />,           path: "/portal/timesheet"   },
  { label: "Open Shifts", icon: <WorkHistoryIcon />, path: "/portal/open-shifts" },
  { label: "Chat",      icon: <Chat />,              path: "/portal/chat"        },
  { label: "Profile",   icon: <AccountCircle />,    path: "/portal/profile"     },
];

// Bottom nav excludes Dashboard (index route — handled by "/" in bottom nav)
const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter(n => n.path !== "/portal");

function getInitials(email: string) {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts.slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase();
}

export default function PortalShell() {
  const { logout, user, isImpersonating, stopImpersonation } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const isDark   = mode === "dark";
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)");

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem("statera:portalNavCollapsed") === "true"
  );

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("statera:portalNavCollapsed", String(next));
  }

  const desktopWidth  = collapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;
  const currentIdx    = BOTTOM_NAV_ITEMS.findIndex(n => location.pathname.startsWith(n.path));
  const userEmail     = user?.email ?? "";
  const initials      = userEmail ? getInitials(userEmail) : "?";
  const displayName   = userEmail.split("@")[0];

  function isActive(path: string) {
    if (path === "/portal") return location.pathname === "/portal";
    return location.pathname.startsWith(path);
  }

  const sidebarContent = (
    <>
      <Toolbar />
      <Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)", mx: 2 }} />

      {(!collapsed) && (
        <Typography
          variant="caption"
          sx={{
            px: 2.5, pt: 2, pb: 0.5,
            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)",
            fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontSize: 10,
            display: "block",
          }}
        >
          Navigation
        </Typography>
      )}

      <List sx={{ px: 0, pt: collapsed ? 1 : 0.5 }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path);
          const button = (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1, borderRadius: 1.5, mb: 0.25,
                justifyContent: collapsed ? "center" : "flex-start",
                "&.Mui-selected": {
                  bgcolor: "rgba(0,137,123,0.18)",
                  borderLeft: "3px solid #4db6ac",
                  color: "#4db6ac",
                  "& .MuiListItemIcon-root": { color: "#4db6ac" },
                },
                "&.Mui-selected:hover": { bgcolor: "rgba(0,137,123,0.25)" },
                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: collapsed ? 0 : 40, justifyContent: "center" }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 400 }}
                />
              )}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right" arrow>
              {button}
            </Tooltip>
          ) : button;
        })}
      </List>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Collapse toggle */}
      <Box sx={{ display: "flex", justifyContent: collapsed ? "center" : "flex-end", px: 1, py: 0.5 }}>
        <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
          <IconButton
            onClick={toggleCollapsed}
            size="small"
            sx={{
              color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
              "&:hover": {
                color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)",
                bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              },
            }}
          >
            {collapsed
              ? <ChevronRightIcon sx={{ fontSize: 18 }} />
              : <ChevronLeftIcon  sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)", mx: 2 }} />

      {/* User info */}
      {!collapsed ? (
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{
            width: 32, height: 32, fontSize: 12, fontWeight: 700,
            bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac",
            border: "1px solid rgba(0,137,123,0.3)",
          }}>
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)" }} noWrap>
              {displayName}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)", lineHeight: 1.2 }} noWrap>
              Staff
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton
              onClick={logout}
              size="small"
              sx={{
                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)",
                "&:hover": { color: "#ef9a9a" },
              }}
            >
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{ p: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, pb: 1.5 }}>
          <Tooltip title={displayName} placement="right">
            <Avatar sx={{
              width: 32, height: 32, fontSize: 12, fontWeight: 700,
              bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac",
              border: "1px solid rgba(0,137,123,0.3)", cursor: "default",
            }}>
              {initials}
            </Avatar>
          </Tooltip>
          <Tooltip title="Sign out" placement="right">
            <IconButton
              onClick={logout}
              size="small"
              sx={{
                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)",
                "&:hover": { color: "#ef9a9a" },
              }}
            >
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
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
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.25, flexGrow: 1, cursor: "pointer" }}
            onClick={() => navigate("/portal")}
          >
            <Box
              component="img"
              src={StateraLogo}
              alt="Statera"
              sx={{
                height: 32,
                width: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 0 10px rgba(0,137,123,0.35))",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                textTransform: "uppercase", color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.25)", borderRadius: 0.75,
                px: 0.75, py: 0.25, lineHeight: 1.4, display: { xs: "none", sm: "block" },
              }}
            >
              Staff Portal
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.75, mr: 1, display: { xs: "none", sm: "block" } }}>
            {user?.email}
          </Typography>

          {isImpersonating && (
            <Tooltip title="Return to admin">
              <IconButton
                onClick={async () => { await stopImpersonation(); navigate("/app"); }}
                size="small"
                color="inherit"
                sx={{
                  mr: 0.5, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 1.5, p: 0.75,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                <SwitchAccount sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              onClick={toggleMode}
              size="small"
              color="inherit"
              sx={{
                mr: 0.5, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 1.5, p: 0.75,
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
                ml: 0.5, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 1.5, p: 0.75,
                "&:hover": { color: "#ef9a9a", borderColor: "rgba(239,154,154,0.4)", bgcolor: "rgba(239,154,154,0.08)" },
              }}
            >
              <Logout sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: desktopWidth,
            flexShrink: 0,
            transition: "width 220ms ease",
            "& .MuiDrawer-paper": {
              width: desktopWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: "width 220ms ease",
              background: isDark ? "#0a1214" : "#ffffff",
              color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)",
              borderRight: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: "64px",
          pb: isMobile ? "60px" : 2,
          px: { xs: 1, sm: 2, md: 3 },
          maxWidth: 900,
          mx: "auto",
          width: "100%",
          transition: "margin 220ms ease",
        }}
      >
        <Outlet />
      </Box>

      {/* Bottom navigation — mobile only */}
      {isMobile && (
        <Paper
          elevation={4}
          sx={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: (t) => t.zIndex.appBar,
            borderRadius: 0,
          }}
        >
          <BottomNavigation
            value={currentIdx === -1 ? false : currentIdx}
            onChange={(_, newVal) => navigate(BOTTOM_NAV_ITEMS[newVal].path)}
            showLabels
            sx={{
              background: isDark ? "#0a1214" : "#ffffff",
              borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
            }}
          >
            {BOTTOM_NAV_ITEMS.map(n => (
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
      )}
    </Box>
  );
}
