// src/pages/portal/PortalDashboard.tsx
// Staff portal home / dashboard
import { useEffect, useState } from "react";
import {
  Box, Card, CardActionArea, CardContent, Chip, CircularProgress,
  Skeleton, Stack, Typography,
} from "@mui/material";
import {
  CalendarMonth, BeachAccess, AccessAlarm, Chat, Receipt,
  WbSunny, WbTwilight, NightsStay,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { listTimeOff } from "../../api/timeoff";
import { getActiveEntry } from "../../api/timeclock";
import { listRooms } from "../../api/chat";
import api from "../../api/axios";

function getGreeting() {
  const h = dayjs().hour();
  if (h < 12) return { text: "Good morning", icon: <WbSunny sx={{ fontSize: 18, color: "#ffd54f" }} /> };
  if (h < 17) return { text: "Good afternoon", icon: <WbTwilight sx={{ fontSize: 18, color: "#ffb74d" }} /> };
  return { text: "Good evening", icon: <NightsStay sx={{ fontSize: 18, color: "#90caf9" }} /> };
}

const CARD_DEFS = [
  {
    key: "/portal/schedule",
    icon: <CalendarMonth sx={{ fontSize: 28 }} />,
    title: "Schedule",
    accent: "#00897b",
    bg: "rgba(0,137,123,0.12)",
    border: "rgba(0,137,123,0.3)",
    iconColor: "#4db6ac",
  },
  {
    key: "/portal/timeoff",
    icon: <BeachAccess sx={{ fontSize: 28 }} />,
    title: "Time Off",
    accent: "#f57c00",
    bg: "rgba(245,124,0,0.1)",
    border: "rgba(245,124,0,0.25)",
    iconColor: "#ffb74d",
  },
  {
    key: "/portal/timeclock",
    icon: <AccessAlarm sx={{ fontSize: 28 }} />,
    title: "Time Clock",
    accent: "#2e7d32",
    bg: "rgba(46,125,50,0.1)",
    border: "rgba(46,125,50,0.25)",
    iconColor: "#81c784",
  },
  {
    key: "/portal/timesheet",
    icon: <Receipt sx={{ fontSize: 28 }} />,
    title: "Timesheet",
    accent: "#1565c0",
    bg: "rgba(21,101,192,0.1)",
    border: "rgba(21,101,192,0.25)",
    iconColor: "#90caf9",
  },
  {
    key: "/portal/chat",
    icon: <Chat sx={{ fontSize: 28 }} />,
    title: "Chat",
    accent: "#6a1b9a",
    bg: "rgba(106,27,154,0.1)",
    border: "rgba(106,27,154,0.25)",
    iconColor: "#ce93d8",
  },
];

export default function PortalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const greeting = getGreeting();
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

  const displayName = user?.email?.split("@")[0] ?? "Staff";

  const detailMap: Record<string, { detail: string; badge?: number }> = {
    "/portal/schedule": {
      detail: nextShift ? `Next: ${nextShift}` : "No upcoming shifts",
    },
    "/portal/timeoff": {
      detail: pendingTimeOff > 0 ? `${pendingTimeOff} pending request(s)` : "No pending requests",
      badge: pendingTimeOff,
    },
    "/portal/timeclock": {
      detail: isClockedIn ? "Currently clocked in" : "Not clocked in",
    },
    "/portal/timesheet": {
      detail: dayjs().format("MMMM YYYY"),
    },
    "/portal/chat": {
      detail: unreadMessages > 0 ? `${unreadMessages} unread message(s)` : "No new messages",
      badge: unreadMessages,
    },
  };

  return (
    <Box sx={{ pt: 1 }}>
      {/* ── Greeting banner ── */}
      <Card variant="outlined" sx={{
        mb: 3,
        background: "linear-gradient(135deg, rgba(0,77,77,0.5) 0%, rgba(0,55,70,0.35) 100%)",
        borderColor: "rgba(0,137,123,0.3)",
      }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            {greeting.icon}
            <Typography variant="h5" fontWeight={700}>
              {greeting.text}, {displayName}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {dayjs().format("dddd, MMMM D, YYYY")}
          </Typography>
          {isClockedIn && (
            <Chip
              label="Clocked In"
              size="small"
              color="success"
              sx={{ mt: 1, height: 20, fontSize: 11 }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Quick access cards ── */}
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontSize: 10, mb: 1, display: "block" }}>
        Quick Access
      </Typography>
      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
        gap: 1.5,
      }}>
        {CARD_DEFS.map(c => {
          const info = detailMap[c.key];
          return (
            <Card
              key={c.key}
              variant="outlined"
              sx={{
                borderColor: c.border,
                background: c.bg,
                transition: "transform 0.15s, box-shadow 0.15s",
                "&:hover": { transform: "translateY(-2px)", boxShadow: `0 4px 20px ${c.border}` },
              }}
            >
              <CardActionArea onClick={() => navigate(c.key)} sx={{ height: "100%" }}>
                <CardContent sx={{ pb: "12px !important" }}>
                  {loading ? (
                    <>
                      <Skeleton variant="rounded" width={28} height={28} sx={{ mb: 1 }} />
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="80%" />
                    </>
                  ) : (
                    <>
                      <Box sx={{ color: c.iconColor, mb: 1 }}>{c.icon}</Box>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{c.title}</Typography>
                        {info?.badge ? (
                          <Chip label={info.badge} size="small" color="error"
                            sx={{ height: 16, fontSize: 10, "& .MuiChip-label": { px: 0.75 } }} />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3 }}>
                        {info?.detail}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
