// src/components/AppShell.tsx
import { useState } from "react";
import {
  AppBar, Box, CssBaseline, Divider, Drawer, IconButton, InputBase,
  List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Group,
  LocalHospital,
  RuleSharp,
  Policy,
} from "@mui/icons-material";
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const drawerWidth = 260;

type NavItem = { to: string; label: string; icon: JSX.Element; show?: boolean };

export default function AppShell() {
  const [q, setQ] = useState("");
  const { logout } = useAuth();

  const items: NavItem[] = [
    { to: "/",          label: "Dashboard",       icon: <DashboardIcon /> },
    { to: "/scheduler", label: "Scheduler",       icon: <CalendarMonth /> },
    { to: "/staff",     label: "Staff Directory", icon: <Group /> },
    { label: "Facilities", to: "/facilities", icon: <LocalHospital /> },
    { to: "/constraints", label: "Constraints & Rules", icon: <Policy /> },
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
          <IconButton color="inherit" onClick={logout} title="Logout" sx={{ ml: 2 }}>
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
          {items.map((i) => (
            <ListItemButton
              key={i.to}
              // Use NavLink for navigation + active state
              component={NavLink}
              to={i.to}
              // MUI selected style when route is active
              sx={{
                "&.active": {
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>{i.icon}</ListItemIcon>
              <ListItemText primary={i.label} />
            </ListItemButton>
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
