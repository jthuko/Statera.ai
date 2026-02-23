// src/pages/portal/PortalSchedule.tsx
// Staff portal: weekly calendar view of own schedule
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Chip, CircularProgress, IconButton, Paper,
  Stack, Tooltip, Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
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
  RN:    "#1976d2",
  LPN:   "#7b1fa2",
  CNA:   "#388e3c",
  MD:    "#c62828",
  PA:    "#f57c00",
  NP:    "#0097a7",
  CRNA:  "#5d4037",
  RRT:   "#455a64",
  EMT:   "#6a1b9a",
};
function roleColor(role?: string | null) {
  return role ? (ROLE_COLORS[role] ?? "#546e7a") : "#546e7a";
}

export default function PortalSchedule() {
  const { user } = useAuth();
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
          end: weekEnd.toISOString(),
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

  // 7 days for the current week
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));

  const isCurrentWeek = weekStart.format("YYYY-MM-DD") === dayjs().startOf("week").format("YYYY-MM-DD");

  return (
    <Box sx={{ pt: 2 }}>
      {/* ── Header / Navigation ── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>My Schedule</Typography>
        <Tooltip title="Previous week">
          <IconButton size="small" onClick={() => setWeekStart(w => w.subtract(1, "week"))}>
            <ChevronLeftIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160, textAlign: "center" }}>
          {weekStart.format("MMM D")} – {weekEnd.format("MMM D, YYYY")}
        </Typography>
        <Tooltip title="Next week">
          <IconButton size="small" onClick={() => setWeekStart(w => w.add(1, "week"))}>
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
        {!isCurrentWeek && (
          <Tooltip title="Jump to today">
            <IconButton size="small" onClick={() => setWeekStart(dayjs().startOf("week"))}>
              <TodayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Calendar Grid ── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          overflowX: "auto",
        }}
      >
        {days.map(day => {
          const dateStr = day.format("YYYY-MM-DD");
          const isToday = dateStr === today;
          const shifts = byDate[dateStr] ?? [];

          return (
            <Paper
              key={dateStr}
              elevation={isToday ? 3 : 1}
              sx={{
                minHeight: 140,
                p: 1,
                borderRadius: 1.5,
                border: isToday ? "2px solid" : "1px solid",
                borderColor: isToday ? "primary.main" : "divider",
                background: isToday ? "rgba(0,150,180,0.06)" : "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                minWidth: 100,
              }}
            >
              {/* Day header */}
              <Box sx={{ mb: 0.5 }}>
                <Typography
                  variant="caption"
                  color={isToday ? "primary" : "text.secondary"}
                  fontWeight={600}
                  display="block"
                >
                  {day.format("ddd").toUpperCase()}
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight={isToday ? 800 : 400}
                  color={isToday ? "primary" : "text.primary"}
                  lineHeight={1.2}
                >
                  {day.format("D")}
                </Typography>
                {isToday && (
                  <Chip label="Today" size="small" color="primary" sx={{ height: 16, fontSize: 10, mt: 0.25 }} />
                )}
              </Box>

              {/* Loading spinner */}
              {loading && shifts.length === 0 && (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CircularProgress size={16} />
                </Box>
              )}

              {/* Shifts */}
              {shifts.length > 0 ? (
                shifts.map(s => (
                  <Tooltip
                    key={s.id}
                    title={s.notes ?? ""}
                    disableHoverListener={!s.notes}
                  >
                    <Box
                      sx={{
                        borderRadius: 1,
                        px: 0.75,
                        py: 0.5,
                        background: roleColor(s.roleId),
                        color: "#fff",
                        fontSize: 11,
                        cursor: s.notes ? "pointer" : "default",
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} display="block" noWrap sx={{ fontSize: 11, color: "inherit" }}>
                        {s.roleId ?? "Shift"}
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ fontSize: 10, opacity: 0.9, color: "inherit" }}>
                        {dayjs(s.startUtc).format("h:mm a")}
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ fontSize: 10, opacity: 0.9, color: "inherit" }}>
                        {dayjs(s.endUtc).format("h:mm a")}
                      </Typography>
                    </Box>
                  </Tooltip>
                ))
              ) : !loading ? (
                <Typography variant="caption" color="text.disabled" sx={{ mt: "auto", textAlign: "center", pb: 1 }}>
                  Off
                </Typography>
              ) : null}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
