// src/components/AppShell.tsx
import { useState } from "react";
import {
  AppBar, Box, CssBaseline, Divider, Drawer, IconButton, InputBase,
  List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Group,
  LocalHospital,
  Policy,
  Apartment,
  Assignment,
  AccessAlarm,
  Rule,
  Work,
  EventNote,
  Chat,
} from "@mui/icons-material";
import { Outlet, Link as RouterLink, useMatch, useResolvedPath } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import AppNotificationBell from "./AppNotificationBell";
import AppHelpAssistant from "./AppHelpAssistant";


const drawerWidth = 260;

type NavItem = { to: string; label: string; icon: JSX.Element; show?: boolean };

/** Helper that works with MUI typing: uses RouterLink + selected state via useMatch */
function DrawerNavItem({ to, label, icon }: NavItem) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: to === "/" }); // exact match for "/"
  return (
    <ListItemButton
      component={RouterLink}
      to={to}
      selected={!!match}
      sx={{
        "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
      }}
    >
      <ListItemIcon sx={{ color: "inherit" }}>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  );
}

export default function AppShell() {
  const [q, setQ] = useState("");
  const { logout, user } = useAuth();
  const isOwner = user?.systemRole === "Owner";

  const items: NavItem[] = [
    { to: "/",           label: "Dashboard",         icon: <DashboardIcon /> },
    { to: "/scheduler",  label: "Scheduler",         icon: <CalendarMonth /> },
    { to: "/staff",      label: "Staff Directory",   icon: <Group /> },
    { to: "/facilities", label: "Facilities",        icon: <LocalHospital /> },
    { to: "/units",      label: "Units",             icon: <Apartment /> },
    { to: "/assignments", label: "Assignments",      icon: <Assignment /> },
    { to: "/timeoff",     label: "Time Off",         icon: <AccessAlarm /> },
    { to: "/constraints", label: "Constraints & Rules", icon: <Rule /> },
    { to: "/coverage",    label: "Coverage",         icon: <Work /> },
    { to: "/demand-templates", label: "Demand Templates", icon: <EventNote /> },
    { to: "/timeclock",        label: "Time Clock",        icon: <AccessAlarm /> },
    { to: "/chat",             label: "Chat",             icon: <Chat /> },
  ];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", q.trim());
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          background: "linear-gradient(90deg, rgba(0,77,77,.7), rgba(0,122,153,.5))",
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Statera AI</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 1, px: 1,
              border: "1px solid rgba(255,255,255,.15)", borderRadius: 2, background: "#0c1315",
            }}
          >
            <InputBase
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              sx={{ color: "white", px: 1, minWidth: 260 }}
            />
          </Box>
          <AppNotificationBell />
          <AppHelpAssistant />
          <IconButton color="inherit" onClick={logout} title="Logout" sx={{ ml: 1 }}>
            ⎋
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            background: "#0b1214",
            color: "rgba(255,255,255,0.9)",
          },
        }}
      >
        <Toolbar />
        <Divider />
        <List>
          {items
            .filter((i) => i.show !== false)
            .map((i) => (
              <DrawerNavItem key={i.to} {...i} />
            ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto", width: "100%" }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
