// src/pages/portal/PortalOpenShifts.tsx
// Staff portal: browse open shifts in a weekly calendar and request/withdraw
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, IconButton, Stack, Tooltip, Typography, useTheme,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import WorkHistoryIcon from "@mui/icons-material/WorkHistory";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useAuth } from "../../auth/useAuth";
import {
  listOpenShifts, claimShift, withdrawRequest, listMyRequests,
  OpenShiftDto, OpenShiftRequestDto,
} from "../../api/openShifts";

dayjs.extend(isoWeek);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Pending:   { bg: "rgba(245,124,0,0.15)",  border: "rgba(245,124,0,0.4)",  text: "#f57c00" },
  Approved:  { bg: "rgba(46,125,50,0.15)",  border: "rgba(46,125,50,0.4)",  text: "#2e7d32" },
  Denied:    { bg: "rgba(97,97,97,0.15)",   border: "rgba(97,97,97,0.4)",   text: "#757575" },
  Withdrawn: { bg: "rgba(158,158,158,0.1)", border: "rgba(158,158,158,0.3)", text: "#9e9e9e" },
};

// ─── Shift Card ───────────────────────────────────────────────────────────────

interface ShiftCardProps {
  shift: OpenShiftDto;
  onClaim: (shift: OpenShiftDto) => void;
  onWithdraw: (shift: OpenShiftDto) => void;
  claimBusy: boolean;
}

function ShiftCard({ shift, onClaim, onWithdraw, claimBusy }: ShiftCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const myStatus = shift.myRequestStatus;

  const sc = myStatus ? STATUS_COLORS[myStatus] : null;

  return (
    <Box sx={{
      borderRadius: 1,
      px: 0.75,
      py: 0.6,
      mb: 0.5,
      background: sc ? sc.bg : (isDark ? "rgba(0,137,123,0.1)" : "rgba(0,137,123,0.07)"),
      border: `1px solid ${sc ? sc.border : "rgba(0,137,123,0.3)"}`,
      borderLeft: `3px solid ${sc ? sc.text : "#4db6ac"}`,
    }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={0.5}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: sc ? sc.text : "#4db6ac", lineHeight: 1.2 }}>
            {shift.role}
          </Typography>
          <Typography sx={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)", lineHeight: 1.2 }}>
            {dayjs(shift.startUtc).format("h:mm a")}
          </Typography>
          <Typography sx={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", lineHeight: 1.2 }}>
            {dayjs(shift.endUtc).format("h:mm a")}
          </Typography>
        </Box>
      </Stack>

      {/* Action area */}
      <Box sx={{ mt: 0.5 }}>
        {!myStatus && (
          <Button
            size="small"
            variant="contained"
            disabled={claimBusy}
            onClick={() => onClaim(shift)}
            sx={{
              fontSize: 10, py: 0.2, px: 0.75, minWidth: 0, height: 20,
              bgcolor: "#00897b", "&:hover": { bgcolor: "#00695c" },
              textTransform: "none", fontWeight: 600,
            }}
          >
            {claimBusy ? <CircularProgress size={10} /> : "Request"}
          </Button>
        )}
        {myStatus === "Pending" && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip label="Pending" size="small" sx={{ fontSize: 9, height: 18, bgcolor: "rgba(245,124,0,0.15)", color: "#f57c00", border: "1px solid rgba(245,124,0,0.4)" }} />
            <Button
              size="small"
              disabled={claimBusy}
              onClick={() => onWithdraw(shift)}
              sx={{ fontSize: 9, py: 0, px: 0.5, minWidth: 0, height: 18, color: "text.secondary", textTransform: "none" }}
            >
              Withdraw
            </Button>
          </Stack>
        )}
        {myStatus === "Approved" && (
          <Chip label="Approved" size="small" sx={{ fontSize: 9, height: 18, bgcolor: "rgba(46,125,50,0.15)", color: "#2e7d32", border: "1px solid rgba(46,125,50,0.4)" }} />
        )}
        {myStatus === "Denied" && (
          <Chip label="Denied" size="small" sx={{ fontSize: 9, height: 18, bgcolor: "rgba(97,97,97,0.12)", color: "#757575", border: "1px solid rgba(97,97,97,0.3)" }} />
        )}
      </Box>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortalOpenShifts() {
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [weekStart, setWeekStart] = useState<Dayjs>(() => dayjs().startOf("week"));
  const [shifts, setShifts]       = useState<OpenShiftDto[]>([]);
  const [myRequests, setMyRequests] = useState<OpenShiftRequestDto[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null); // shiftId
  const [claimError, setClaimError] = useState<string | null>(null);

  const weekEnd = weekStart.endOf("week");
  const today = dayjs().format("YYYY-MM-DD");
  const isCurrentWeek = weekStart.format("YYYY-MM-DD") === dayjs().startOf("week").format("YYYY-MM-DD");

  const load = useCallback(async () => {
    const facilityId = user?.facilityIds?.[0];
    if (!facilityId) return;
    setLoading(true); setError(null);
    try {
      const [data, reqs] = await Promise.all([
        listOpenShifts(facilityId, {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
          status: "Open",
        }),
        listMyRequests(),
      ]);
      setShifts(data);
      setMyRequests(reqs);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load open shifts.");
    } finally {
      setLoading(false);
    }
  }, [user?.facilityIds, weekStart]);

  useEffect(() => { load(); }, [load]);

  async function handleClaim(shift: OpenShiftDto) {
    setClaimBusy(shift.id); setClaimError(null);
    try {
      await claimShift(shift.id);
      await load();
    } catch (e: any) {
      setClaimError(e?.response?.data?.detail ?? "Failed to request shift.");
    } finally {
      setClaimBusy(null);
    }
  }

  async function handleWithdraw(shift: OpenShiftDto) {
    if (!shift.myRequestId) return;
    setClaimBusy(shift.id); setClaimError(null);
    try {
      await withdrawRequest(shift.id, shift.myRequestId);
      await load();
    } catch (e: any) {
      setClaimError(e?.response?.data?.detail ?? "Failed to withdraw request.");
    } finally {
      setClaimBusy(null);
    }
  }

  // Group open shifts by calendar date
  const byDate: Record<string, OpenShiftDto[]> = {};
  for (const s of shifts) {
    const d = dayjs(s.startUtc).format("YYYY-MM-DD");
    (byDate[d] ??= []).push(s);
  }

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));

  // My requests sorted by date (all time, not just this week)
  const sortedMyRequests = [...myRequests].sort(
    (a, b) => new Date(b.requestedUtc).getTime() - new Date(a.requestedUtc).getTime()
  );

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
                <WorkHistoryIcon sx={{ color: "#4db6ac", fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Open Shifts</Typography>
                <Typography variant="caption" color="text.secondary">
                  {weekStart.format("MMM D")} – {weekEnd.format("MMM D, YYYY")}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.75} alignItems="center">
              {shifts.length > 0 && (
                <Chip
                  label={`${shifts.length} available`}
                  size="small"
                  sx={{ bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.3)", height: 22, fontSize: 11 }}
                />
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
      {claimError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setClaimError(null)}>{claimError}</Alert>}

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
          const dayShifts = byDate[dateStr] ?? [];

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

                {/* Loading */}
                {loading && dayShifts.length === 0 && (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={14} sx={{ color: "#4db6ac" }} />
                  </Box>
                )}

                {/* Shifts */}
                <Box sx={{ flex: 1 }}>
                  {dayShifts.length > 0 ? (
                    dayShifts.map(s => (
                      <ShiftCard
                        key={s.id}
                        shift={s}
                        onClaim={handleClaim}
                        onWithdraw={handleWithdraw}
                        claimBusy={claimBusy === s.id}
                      />
                    ))
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

      {/* ── My Requests ── */}
      {sortedMyRequests.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: "text.secondary", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>
            My Shift Requests
          </Typography>
          <Stack spacing={0.75}>
            {sortedMyRequests.map(r => {
              const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.Withdrawn;
              return (
                <Card
                  key={r.id}
                  variant="outlined"
                  sx={{
                    borderColor: sc.border,
                    borderLeft: `3px solid ${sc.text}`,
                    background: sc.bg,
                  }}
                >
                  <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                          {(r as any).role ?? "Shift"}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                          {(r as any).startUtc
                            ? `${dayjs((r as any).startUtc).format("MMM D, YYYY · h:mm a")} – ${dayjs((r as any).endUtc).format("h:mm a")}`
                            : `Requested ${dayjs(r.requestedUtc).format("MMM D, YYYY")}`}
                        </Typography>
                      </Box>
                      <Chip
                        label={r.status}
                        size="small"
                        sx={{
                          bgcolor: sc.bg,
                          color: sc.text,
                          border: `1px solid ${sc.border}`,
                          fontWeight: 600,
                          fontSize: 11,
                          height: 22,
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Empty state (no shifts at all this week) */}
      {!loading && shifts.length === 0 && (
        <Box sx={{ mt: 4, textAlign: "center", py: 3 }}>
          <WorkHistoryIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary" variant="body2">
            No open shifts available for your role this week.
          </Typography>
          <Typography color="text.disabled" variant="caption">
            Check back next week or navigate to see other weeks.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
