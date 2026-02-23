// src/pages/portal/PortalDashboard.tsx
// Staff portal home / dashboard
import { useEffect, useState } from "react";
import {
  Alert, Box, Card, CardActionArea, CardContent, Chip, CircularProgress, Stack, Typography,
} from "@mui/material";
import { CalendarMonth, BeachAccess, AccessAlarm, Chat } from "@mui/icons-material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { listTimeOff } from "../../api/timeoff";
import { getActiveEntry } from "../../api/timeclock";
import { listRooms } from "../../api/chat";
import api from "../../api/axios";

export default function PortalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nextShift, setNextShift] = useState<string | null>(null);
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.staffId) { setLoading(false); return; }
    (async () => {
      try {
        const [assignments, timeOff, activeEntry, rooms] = await Promise.all([
          api.get("/assignments", {
            params: { staffId: user.staffId, start: dayjs().toISOString(), end: dayjs().add(7, "day").toISOString() },
          }).then(r => r.data as { startUtc: string }[]).catch(() => []),
          listTimeOff({ staffId: user.staffId ?? undefined, status: "Pending", page: 1, pageSize: 5 }).catch(() => ({ items: [] })),
          getActiveEntry(user.staffId ?? undefined).catch(() => null),
          listRooms().catch(() => []),
        ]);

        const upcoming = assignments
          .filter((a) => dayjs(a.startUtc).isAfter(dayjs()))
          .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
        if (upcoming.length > 0) setNextShift(dayjs(upcoming[0].startUtc).format("ddd, MMM D · h:mm a"));

        setPendingTimeOff(timeOff.items.length);
        setIsClockedIn(!!activeEntry);
        setUnreadMessages(rooms.reduce((sum: number, r: { unreadCount: number }) => sum + r.unreadCount, 0));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.staffId]);

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;

  const cards = [
    {
      icon: <CalendarMonth sx={{ fontSize: 40, color: "primary.light" }} />,
      title: "Schedule",
      detail: nextShift ? `Next: ${nextShift}` : "No upcoming shifts",
      path: "/portal/schedule",
    },
    {
      icon: <BeachAccess sx={{ fontSize: 40, color: "warning.light" }} />,
      title: "Time Off",
      detail: pendingTimeOff > 0 ? `${pendingTimeOff} pending request(s)` : "No pending requests",
      badge: pendingTimeOff,
      path: "/portal/timeoff",
    },
    {
      icon: <AccessAlarm sx={{ fontSize: 40, color: isClockedIn ? "success.light" : "text.secondary" }} />,
      title: "Time Clock",
      detail: isClockedIn ? "Currently clocked in" : "Not clocked in",
      path: "/portal/timeclock",
    },
    {
      icon: <Chat sx={{ fontSize: 40, color: unreadMessages > 0 ? "error.light" : "text.secondary" }} />,
      title: "Chat",
      detail: unreadMessages > 0 ? `${unreadMessages} unread message(s)` : "No new messages",
      badge: unreadMessages,
      path: "/portal/chat",
    },
  ];

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Hello, {user?.email?.split("@")[0] ?? "Staff"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {dayjs().format("dddd, MMMM D, YYYY")}
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        {cards.map(c => (
          <Card key={c.path} variant="outlined">
            <CardActionArea onClick={() => navigate(c.path)}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  {c.icon}
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700}>{c.title}</Typography>
                      {c.badge ? <Chip label={c.badge} size="small" color="error" /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{c.detail}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
