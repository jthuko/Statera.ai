// src/pages/portal/PortalSchedule.tsx
// Staff portal: weekly calendar view of own schedule
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress,
  IconButton, Stack, Tooltip, Typography, useTheme,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useAuth } from "../../auth/useAuth";
import api from "../../api/axios";

dayjs.extend(isoWeek);

interface AssignmentDto {
  id: string;
  startUtc: string;
  endUtc: string;
  roleId?: string | null;
  unitId?: string | null;
  notes?: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  RN:    "#1565c0",
  LPN:   "#6a1b9a",
  CNA:   "#2e7d32",
  MD:    "#c62828",
  PA:    "#f57c00",
  NP:    "#0097a7",
  CRNA:  "#5d4037",
  RRT:   "#455a64",
  EMT:   "#6a1b9a",
};
function roleColor(role?: string | null) {
  return role ? (ROLE_COLORS[role] ?? "#00897b") : "#00897b";
}

export default function PortalSchedule() {
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [weekStart, setWeekStart] = useState<Dayjs>(() => dayjs().startOf("week"));
  const [items, setItems] = useState<AssignmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = weekStart.endOf("week");
  const today = dayjs().format("YYYY-MM-DD");

  const load = useCallback(async () => {
    if (!user?.staffId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AssignmentDto[]>("/assignments", {
        params: {
          staffId: user.staffId,
          start: weekStart.toISOString(),
          end:   weekEnd.toISOString(),
        },
      });
      setItems(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [user?.staffId, weekStart]);

  useEffect(() => { load(); }, [load]);

  // Group assignments by date
  const byDate: Record<string, AssignmentDto[]> = {};
  for (const a of items) {
    const d = dayjs(a.startUtc).format("YYYY-MM-DD");
    (byDate[d] ??= []).push(a);
  }

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
  const isCurrentWeek = weekStart.format("YYYY-MM-DD") === dayjs().startOf("week").format("YYYY-MM-DD");
  const totalShifts = items.length;

  return (
    <Box sx={{ pt: 1 }}>
      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
              }}>
                <CalendarMonthIcon sx={{ color: "#4db6ac", fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>My Schedule</Typography>
                <Typography variant="caption" color="text.secondary">
                  {weekStart.format("MMM D")} – {weekEnd.format("MMM D, YYYY")}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {totalShifts > 0 && (
                <Chip label={`${totalShifts} shift${totalShifts !== 1 ? "s" : ""}`} size="small"
                  sx={{ bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.3)", height: 22, fontSize: 11 }} />
              )}
              <Tooltip title="Previous week">
                <IconButton size="small" onClick={() => setWeekStart(w => w.subtract(1, "week"))}
                  sx={{ color: "text.secondary", "&:hover": { color: "#4db6ac" } }}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {!isCurrentWeek && (
                <Tooltip title="Jump to today">
                  <IconButton size="small" onClick={() => setWeekStart(dayjs().startOf("week"))}
                    sx={{ color: "text.secondary", "&:hover": { color: "#4db6ac" } }}>
                    <TodayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Next week">
                <IconButton size="small" onClick={() => setWeekStart(w => w.add(1, "week"))}
                  sx={{ color: "text.secondary", "&:hover": { color: "#4db6ac" } }}>
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* ── Calendar Grid ── */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(110px, 1fr))",
        gap: 0.75,
        overflowX: "auto",
        pb: 0.5,
      }}>
        {days.map(day => {
          const dateStr = day.format("YYYY-MM-DD");
          const isToday = dateStr === today;
          const shifts  = byDate[dateStr] ?? [];

          return (
            <Card
              key={dateStr}
              variant="outlined"
              sx={{
                minHeight: 150,
                borderRadius: 1.5,
                border: isToday ? "1px solid #4db6ac" : `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)"}`,
                background: isToday ? "rgba(0,137,123,0.1)" : "transparent",
                display: "flex",
                flexDirection: "column",
                minWidth: 90,
              }}
            >
              <CardContent sx={{ p: 1, "&:last-child": { pb: 1 }, flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Day header */}
                <Box sx={{ mb: 0.75 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, fontSize: 10, color: isToday ? "#4db6ac" : (isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)"), letterSpacing: 0.5 }}
                    display="block"
                  >
                    {day.format("ddd").toUpperCase()}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: isToday ? 800 : 400, fontSize: 18, lineHeight: 1.2, color: isToday ? "#4db6ac" : "text.primary" }}
                  >
                    {day.format("D")}
                  </Typography>
                  {isToday && (
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#4db6ac", mt: 0.25 }} />
                  )}
                </Box>

                {/* Loading spinner */}
                {loading && shifts.length === 0 && (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={14} sx={{ color: "#4db6ac" }} />
                  </Box>
                )}

                {/* Shifts */}
                <Box sx={{ flex: 1 }}>
                  {shifts.length > 0 ? (
                    shifts.map(s => {
                      const rc = roleColor(s.roleId);
                      return (
                        <Tooltip key={s.id} title={s.notes ?? ""} disableHoverListener={!s.notes}>
                          <Box sx={{
                            borderRadius: 1, px: 0.75, py: 0.5, mb: 0.5,
                            background: `${rc}22`,
                            border: `1px solid ${rc}55`,
                            borderLeft: `3px solid ${rc}`,
                            cursor: s.notes ? "pointer" : "default",
                          }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: rc, lineHeight: 1.2 }}>
                              {s.roleId ?? "Shift"}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)", lineHeight: 1.2 }}>
                              {dayjs(s.startUtc).format("h:mm a")}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", lineHeight: 1.2 }}>
                              {dayjs(s.endUtc).format("h:mm a")}
                            </Typography>
                          </Box>
                        </Tooltip>
                      );
                    })
                  ) : !loading ? (
                    <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", pb: 1 }}>
                      <EventBusyIcon sx={{ fontSize: 16, color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)" }} />
                    </Box>
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
