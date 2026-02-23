// src/components/AppNotificationBell.tsx
import React, { useState } from "react";
import {
  Badge, IconButton, Popover, Box, Typography, List, ListItem,
  ListItemText, Button, Divider, Chip,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useNotifications } from "../context/NotificationContext";

dayjs.extend(relativeTime);

const typeColor: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
  info: "info", success: "success", warning: "warning", error: "error",
};

export default function AppNotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  function open(e: React.MouseEvent<HTMLButtonElement>) {
    setAnchor(e.currentTarget);
    markAllRead();
  }

  return (
    <>
      <IconButton color="inherit" onClick={open} title="Notifications" sx={{ ml: 1 }}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxHeight: 480 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle1" fontWeight={600}>Notifications</Typography>
          {notifications.length > 0 && (
            <Button size="small" onClick={clearAll}>Clear all</Button>
          )}
        </Box>
        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">No notifications yet.</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ overflowY: "auto", maxHeight: 380 }}>
            {notifications.map(n => (
              <React.Fragment key={n.id}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip label={n.type} size="small" color={typeColor[n.type] ?? "default"} />
                        <Typography variant="body2">{n.message}</Typography>
                      </Box>
                    }
                    secondary={dayjs(n.createdAt).fromNow()}
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
