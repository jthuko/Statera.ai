// src/components/AppShell.tsx
import { useState } from "react";
import {
  Alert, AppBar, Avatar, Box, Button, CssBaseline, Divider, Drawer, IconButton,
  InputBase, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Group,
  LocalHospital,
  Apartment,
  Assignment,
  AccessAlarm,
  Rule,
  Work,
  EventNote,
  Chat,
  Logout,
  Search as SearchIcon,
  WbSunny as WbSunnyIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
  WorkHistory as WorkHistoryIcon,
  LockOutlined as LockOutlinedIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { Outlet, Link as RouterLink, useMatch, useResolvedPath } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useColorMode } from "../context/ColorModeContext";
import { usePlanFeatures } from "../auth/usePlanFeatures";
import AppNotificationBell from "./AppNotificationBell";
import AppHelpAssistant from "./AppHelpAssistant";
import StateraLogo from "../assets/statera-logo.png";

const DRAWER_EXPANDED  = 260;
const DRAWER_COLLAPSED = 64;

type NavItem = { to: string; label: string; icon: JSX.Element; show?: boolean; tier?: "growth" };

function getInitials(email: string) {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts.slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase();
}

function DrawerNavItem({
  to, label, icon, locked, collapsed: isCollapsed, onNavigate,
}: NavItem & { locked?: boolean; collapsed?: boolean; onNavigate?: () => void }) {
  const resolved = useResolvedPath(to);
  const match    = useMatch({ path: resolved.pathname, end: to === "/app" });
  const { mode } = useColorMode();
  const isDark   = mode === "dark";

  const button = (
    <ListItemButton
      component={RouterLink}
      to={to}
      selected={!!match}
      onClick={onNavigate}
      sx={{
        mx: 1,
        borderRadius: 1.5,
        mb: 0.25,
        opacity: locked ? 0.5 : 1,
        justifyContent: isCollapsed ? "center" : "flex-start",
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
      <ListItemIcon sx={{ color: "inherit", minWidth: isCollapsed ? 0 : 40, justifyContent: "center" }}>
        {icon}
      </ListItemIcon>
      {!isCollapsed && (
        <>
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: match ? 600 : 400 }}
          />
          {locked && <LockOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />}
        </>
      )}
    </ListItemButton>
  );

  if (isCollapsed) {
    return (
      <Tooltip
        title={locked ? `${label} — Growth plan required` : label}
        placement="right"
        arrow
      >
        {button}
      </Tooltip>
    );
  }
  return button;
}

export default function AppShell() {
  const [q, setQ]           = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(() =>
    localStorage.getItem("statera:navCollapsed") === "true"
  );

  const { logout, user, trialDaysLeft } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const { isGrowthPlus }     = usePlanFeatures();
  const isDark   = mode === "dark";
  const isOwner  = user?.systemRole === "Owner";
  const isMobile = useMediaQuery("(max-width: 900px)");

  const desktopWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("statera:navCollapsed", String(next));
  }

  const items: NavItem[] = [
    { to: "/app",                    label: "Dashboard",           icon: <DashboardIcon /> },
    { to: "/app/scheduler",          label: "Scheduler",           icon: <CalendarMonth /> },
    { to: "/app/staff",              label: "Staff Directory",     icon: <Group /> },
    { to: "/app/facilities",         label: "Facilities",          icon: <LocalHospital />, show: isOwner },
    { to: "/app/units",              label: "Units",               icon: <Apartment /> },
    { to: "/app/assignments",        label: "Assignments",         icon: <Assignment /> },
    { to: "/app/open-shifts",        label: "Open Shifts",         icon: <WorkHistoryIcon /> },
    { to: "/app/timeoff",            label: "Time Off",            icon: <AccessAlarm /> },
    { to: "/app/constraints",        label: "Constraints & Rules", icon: <Rule /> },
    { to: "/app/coverage",           label: "Coverage",            icon: <Work />,      tier: "growth" },
    { to: "/app/demand-templates",   label: "Demand Templates",    icon: <EventNote />, tier: "growth" },
    { to: "/app/timeclock",          label: "Time Clock",          icon: <AccessAlarm /> },
    { to: "/app/chat",               label: "Chat",                icon: <Chat />,      tier: "growth" },
  ];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", q.trim());
      window.history.replaceState(null, "", url.toString());
    }
  };

  const userEmail   = user?.email ?? "";
  const initials    = userEmail ? getInitials(userEmail) : "?";
  const displayName = userEmail.split("@")[0];

  const drawerContent = (
    <>
      <Toolbar />
      <Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)", mx: 2 }} />

      {/* Nav label — hide when collapsed */}
      {(!collapsed || isMobile) && (
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

      <List sx={{ px: 0, pt: collapsed && !isMobile ? 1 : 0.5 }}>
        {items
          .filter((i) => i.show !== false)
          .map((i) => (
            <DrawerNavItem
              key={i.to}
              {...i}
              locked={i.tier === "growth" && !isGrowthPlus}
              collapsed={!isMobile && collapsed}
              onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
            />
          ))}
      </List>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <Box
          sx={{
            display: "flex",
            justifyContent: collapsed ? "center" : "flex-end",
            px: 1,
            py: 0.5,
          }}
        >
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
      )}

      <Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)", mx: 2 }} />

      {/* User info */}
      {(isMobile || !collapsed) ? (
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
              {isOwner ? "Owner" : "Admin"}
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
        /* Collapsed desktop: avatar + logout stacked */
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
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          background: isDark
            ? "linear-gradient(90deg, rgba(0,55,55,0.97) 0%, rgba(0,80,100,0.95) 100%)"
            : "linear-gradient(90deg, #00695c 0%, #0277bd 100%)",
          borderBottom: isDark
            ? "1px solid rgba(0,137,123,0.2)"
            : "1px solid rgba(0,105,92,0.3)",
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {/* Hamburger (mobile only) */}
          {isMobile && (
            <IconButton
              color="inherit"
              onClick={() => setMobileOpen(true)}
              size="small"
              sx={{ mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
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
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Search — hidden on mobile */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5, px: 1.5, py: 0.5,
              border: "1px solid rgba(255,255,255,0.18)", borderRadius: 2,
              background: "rgba(0,0,0,0.2)", minWidth: 220,
              "&:focus-within": { borderColor: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.3)" },
            }}
          >
            <SearchIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />
            <InputBase
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              sx={{ color: "white", fontSize: 13.5, flex: 1 }}
            />
          </Box>

          {/* Dark/Light toggle */}
          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              onClick={toggleMode}
              size="small"
              sx={{
                color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 1.5,
                p: 0.75,
                "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.4)", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              {isDark ? <WbSunnyIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>

          {/* Notifications + Help */}
          <AppNotificationBell />
          <AppHelpAssistant />

          {/* User + Logout */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1,
            pl: 1.5, ml: 0.5,
            borderLeft: "1px solid rgba(255,255,255,0.1)",
          }}>
            <Avatar sx={{
              width: 30, height: 30, fontSize: 11, fontWeight: 700,
              bgcolor: "rgba(0,137,123,0.3)", color: "#4db6ac",
              border: "1px solid rgba(0,137,123,0.4)",
            }}>
              {initials}
            </Avatar>
            <Typography
              variant="body2"
              sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", display: { xs: "none", md: "block" } }}
            >
              {displayName}
            </Typography>
            <Tooltip title="Sign out">
              <IconButton
                onClick={logout}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 1.5,
                  p: 0.75,
                  "&:hover": {
                    color: "#ef9a9a",
                    borderColor: "rgba(239,154,154,0.4)",
                    bgcolor: "rgba(239,154,154,0.08)",
                  },
                }}
              >
                <Logout sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: { md: desktopWidth },
          flexShrink: 0,
          transition: "width 220ms ease",
          "& .MuiDrawer-paper": {
            width: isMobile ? DRAWER_EXPANDED : desktopWidth,
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
        {drawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          maxWidth: 1400,
          mx: "auto",
          width: "100%",
          transition: "margin 220ms ease",
        }}
      >
        <Toolbar />
        {/* Trial countdown banner */}
        {user?.planStatus === "Trial" && trialDaysLeft() !== null && (
          <Alert
            severity={trialDaysLeft()! <= 2 ? "warning" : "info"}
            action={
              <Button
                size="small"
                color="inherit"
                href="mailto:hello@statera.ai?subject=Upgrade%20to%20Paid%20Plan"
                sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
              >
                Upgrade now
              </Button>
            }
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {trialDaysLeft()! === 0
              ? "Your free trial expires today."
              : `Free trial: ${trialDaysLeft()} day${trialDaysLeft()! === 1 ? "" : "s"} remaining.`}{" "}
            Upgrade to keep full access.
          </Alert>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}
