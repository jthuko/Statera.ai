import { PropsWithChildren, useState } from "react";
import { AppBar, Box, CssBaseline, Divider, Drawer, IconButton, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from "@mui/material";
import { Dashboard, CalendarMonth, Group, Settings, AutoAwesome, AdminPanelSettings } from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";


const drawerWidth = 260;

export default function AppShell({ children }: PropsWithChildren) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  const { logout, isAuthorized } = useAuth();

  const goto = (to: string) => () => nav(to);

  const items: Array<{ to: string; label: string; icon: JSX.Element; show?: boolean }> = [
    { to: "/dashboard", label: "Dashboard", icon: <Dashboard /> },
    { to: "/shifts", label: "Shift Management", icon: <CalendarMonth /> },
    { to: "/ai", label: "AI Shift Generator", icon: <AutoAwesome /> },
    { to: "/staff", label: "Staff Directory", icon: <Group /> },
    { to: "/settings", label: "Settings", icon: <Settings /> },
    { to: "/admin", label: "Admin", icon: <AdminPanelSettings />, show: isAuthorized(["Owner", "Admin"]) },
  ].filter(i => i.show !== false);

  // store search in URL for pages to consume
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", q.trim());
      window.history.replaceState(null, "", url.toString());
      // pages read q via useSearchParams
    }
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, background: "linear-gradient(90deg, rgba(0,77,77,.7), rgba(0,122,153,.5))" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Statera AI</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, border: "1px solid rgba(255,255,255,.15)", borderRadius: 2, background: "#0c1315" }}>
            <InputBase placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} sx={{ color: "white", px: 1, minWidth: 260 }} />
          </Box>
          <Box sx={{ ml: 2 }}>
            <IconButton color="inherit" onClick={logout} title="Logout">⎋</IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ width: drawerWidth, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box", background: "#0b1214" } }}>
        <Toolbar />
        <Divider />
        <List>
          {items.map((i) => (
            <ListItemButton key={i.to} selected={loc.pathname.startsWith(i.to)} onClick={goto(i.to)}>
              <ListItemIcon sx={{ color: "inherit" }}>{i.icon}</ListItemIcon>
              <ListItemText primary={i.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
