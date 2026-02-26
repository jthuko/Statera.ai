// src/pages/portal/PortalTimeClock.tsx
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { AccessAlarm, Login, Logout, RestaurantMenu, KeyboardReturn, AccessTime } from "@mui/icons-material";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useAuth } from "../../auth/useAuth";
import {
  clockIn, clockOut, lunchOut, lunchReturn,
  getActiveEntry, listTimeClockEntries, submitCorrection,
  type TimeClockEntryDto,
} from "../../api/timeclock";

dayjs.extend(duration);

const STATUS_META: Record<string, { color: "default" | "warning" | "success" | "error" | "info"; border: string }> = {
  ClockedIn:         { color: "warning", border: "#f57c00" },
  OnLunch:           { color: "info",    border: "#0288d1" },
  ClockedOut:        { color: "default", border: "rgba(255,255,255,0.1)" },
  Approved:          { color: "success", border: "#2e7d32" },
  Denied:            { color: "error",   border: "#c62828" },
  Adjusted:          { color: "success", border: "#2e7d32" },
  PendingCorrection: { color: "warning", border: "#f57c00" },
};

function elapsed(since: string): string {
  const diff = dayjs().diff(dayjs(since));
  const d = dayjs.duration(diff);
  return `${d.hours()}h ${d.minutes()}m`;
}

function fmtTime(iso: string | null | undefined) {
  return iso ? dayjs(iso).format("h:mm a") : "—";
}

function netHours(e: TimeClockEntryDto): number | null {
  if (!e.clockOutUtc) return null;
  const total = dayjs(e.clockOutUtc).diff(dayjs(e.clockInUtc), "minute");
  const lunch = (e.lunchOutUtc && e.lunchInUtc)
    ? dayjs(e.lunchInUtc).diff(dayjs(e.lunchOutUtc), "minute") : 0;
  return Math.max(0, total - lunch) / 60;
}

// ── Correction Dialog ──────────────────────────────────────────────────────────
function CorrectionDialog({
  entry, open, onClose, onSubmitted,
}: { entry: TimeClockEntryDto; open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [ci, setCi] = useState(dayjs(entry.clockInUtc).format("YYYY-MM-DDTHH:mm"));
  const [co, setCo] = useState(entry.clockOutUtc ? dayjs(entry.clockOutUtc).format("YYYY-MM-DDTHH:mm") : "");
  const [lo, setLo] = useState(entry.lunchOutUtc ? dayjs(entry.lunchOutUtc).format("YYYY-MM-DDTHH:mm") : "");
  const [li, setLi] = useState(entry.lunchInUtc ? dayjs(entry.lunchInUtc).format("YYYY-MM-DDTHH:mm") : "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true); setErr(null);
    try {
      await submitCorrection(entry.id, {
        notes,
        clockInUtc:  dayjs(ci).toISOString(),
        clockOutUtc: co ? dayjs(co).toISOString() : null,
        lunchOutUtc: lo ? dayjs(lo).toISOString() : null,
        lunchInUtc:  li ? dayjs(li).toISOString() : null,
      });
      onSubmitted();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Failed to submit correction.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Request Time Correction</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Correct the times below and provide a reason. An admin will review and approve.
          </Typography>
          <TextField label="Clock In" type="datetime-local" size="small" value={ci}
            onChange={e => setCi(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Clock Out" type="datetime-local" size="small" value={co}
            onChange={e => setCo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Lunch Start (optional)" type="datetime-local" size="small" value={lo}
            onChange={e => setLo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Lunch End (optional)" type="datetime-local" size="small" value={li}
            onChange={e => setLi(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Reason for correction *" multiline minRows={2} size="small"
            value={notes} onChange={e => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={busy || !notes.trim()}>
          {busy ? <CircularProgress size={16} color="inherit" /> : "Submit Correction"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PortalTimeClock() {
  const { user } = useAuth();
  const [active, setActive] = useState<TimeClockEntryDto | null>(null);
  const [history, setHistory] = useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correctionEntry, setCorrectionEntry] = useState<TimeClockEntryDto | null>(null);

  const calMonth = dayjs().startOf("month");

  useEffect(() => {
    const id = setInterval(() => {/* force re-render for elapsed time */}, 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    try {
      const [act, hist] = await Promise.all([
        getActiveEntry(user.staffId),
        listTimeClockEntries({ staffId: user.staffId, page: 1, pageSize: 60 }),
      ]);
      setActive(act);
      setHistory(hist.items);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load.");
    } finally { setLoading(false); }
  }, [user?.staffId]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); }
    catch (e: any) { setError(e?.response?.data?.error ?? "Action failed."); }
    finally { setBusy(false); }
  };

  // Calendar data
  const byDate: Record<string, TimeClockEntryDto[]> = {};
  for (const e of history) {
    const d = dayjs(e.clockInUtc).format("YYYY-MM-DD");
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }
  const daysInMonth = calMonth.daysInMonth();
  const calDays = Array.from({ length: daysInMonth }, (_, i) =>
    calMonth.add(i, "day").format("YYYY-MM-DD"));
  const firstDow = dayjs(calDays[0]).day();

  if (loading) return (
    <Box sx={{ pt: 4, textAlign: "center" }}>
      <CircularProgress sx={{ color: "#4db6ac" }} />
    </Box>
  );

  const isOnLunch  = active?.status === "OnLunch";
  const isClockedIn = !!active;

  const statusColor  = isOnLunch ? "#0288d1" : isClockedIn ? "#2e7d32" : "rgba(255,255,255,0.1)";
  const statusBg     = isOnLunch ? "rgba(2,136,209,0.1)" : isClockedIn ? "rgba(46,125,50,0.1)" : "rgba(255,255,255,0.03)";
  const statusLabel  = isOnLunch ? "On Lunch Break" : isClockedIn ? "Clocked In" : "Clocked Out";

  return (
    <Box sx={{ pt: 1 }}>
      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
            }}>
              <AccessAlarm sx={{ color: "#4db6ac", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Time Clock</Typography>
              <Typography variant="caption" color="text.secondary">
                {calMonth.format("MMMM YYYY")}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Status card ── */}
      <Card sx={{
        mb: 2.5,
        background: statusBg,
        border: `1px solid ${statusColor}`,
        borderLeft: `4px solid ${statusColor}`,
      }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}>
            <AccessAlarm sx={{
              fontSize: 44,
              color: isOnLunch ? "info.main" : isClockedIn ? "success.main" : "text.secondary",
            }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight={700}>{statusLabel}</Typography>
              {active && !isOnLunch && (
                <Typography variant="body2" color="text.secondary">
                  Since {fmtTime(active.clockInUtc)} · {elapsed(active.clockInUtc)} elapsed
                </Typography>
              )}
              {isOnLunch && active?.lunchOutUtc && (
                <Typography variant="body2" color="text.secondary">
                  Lunch started {fmtTime(active.lunchOutUtc)} · {elapsed(active.lunchOutUtc)} elapsed
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {!isClockedIn && (
                <Button variant="contained" color="success" size="large" disabled={busy}
                  startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Login />}
                  onClick={() => doAction(() => clockIn(user?.facilityIds?.[0] ?? "", user?.staffId ?? undefined))}>
                  Clock In
                </Button>
              )}
              {isClockedIn && !isOnLunch && (
                <Button variant="outlined" color="info" disabled={busy}
                  startIcon={<RestaurantMenu />}
                  onClick={() => doAction(() => lunchOut(user?.staffId ?? undefined))}>
                  Start Lunch
                </Button>
              )}
              {isOnLunch && (
                <Button variant="outlined" color="success" disabled={busy}
                  startIcon={<KeyboardReturn />}
                  onClick={() => doAction(() => lunchReturn(user?.staffId ?? undefined))}>
                  End Lunch
                </Button>
              )}
              {isClockedIn && (
                <Button variant="contained" color="error" size="large" disabled={busy}
                  startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Logout />}
                  onClick={() => doAction(() => clockOut(user?.staffId ?? undefined))}>
                  Clock Out
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Monthly calendar ── */}
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: "rgba(255,255,255,0.7)" }}>
        {calMonth.format("MMMM YYYY")} Overview
      </Typography>
      <Card variant="outlined" sx={{ mb: 2.5, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <Typography key={d} variant="caption" color="text.secondary" align="center"
                fontWeight={600} sx={{ py: 0.5, fontSize: 10 }}>
                {d}
              </Typography>
            ))}
            {Array.from({ length: firstDow }, (_, i) => <Box key={`b${i}`} />)}
            {calDays.map(d => {
              const dayEntries = byDate[d] ?? [];
              const totalHrs = dayEntries.reduce((s, e) => s + (netHours(e) ?? 0), 0);
              const isToday = d === dayjs().format("YYYY-MM-DD");
              const hasPending = dayEntries.some(e => e.status === "PendingCorrection");
              const tooltipLines = dayEntries.map(e =>
                `${fmtTime(e.clockInUtc)}–${fmtTime(e.clockOutUtc)}`
              ).join("\n");
              return (
                <Tooltip key={d} title={tooltipLines} arrow placement="top">
                  <Box sx={{
                    height: 48, borderRadius: 1, p: 0.5,
                    border: "1px solid",
                    borderColor: isToday ? "#4db6ac" : hasPending ? "#f57c00" : "rgba(255,255,255,0.06)",
                    background: isToday ? "rgba(0,137,123,0.12)" : dayEntries.length > 0 ? "rgba(46,125,50,0.08)" : "transparent",
                    cursor: dayEntries.length > 0 ? "pointer" : "default",
                  }}>
                    <Typography variant="caption" fontWeight={isToday ? 700 : 400}
                      color={isToday ? "#4db6ac" : "text.secondary"} sx={{ fontSize: 10 }}>
                      {dayjs(d).date()}
                    </Typography>
                    {totalHrs > 0 && (
                      <Typography variant="caption" color="success.main" display="block"
                        fontWeight={600} sx={{ fontSize: 9 }}>
                        {totalHrs.toFixed(1)}h
                      </Typography>
                    )}
                    {hasPending && (
                      <Typography variant="caption" color="warning.main" display="block" sx={{ fontSize: 9 }}>
                        ⏳
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* ── Recent entries ── */}
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: "rgba(255,255,255,0.7)" }}>
        Recent Entries
      </Typography>
      {history.length === 0 ? (
        <Box sx={{
          textAlign: "center", py: 6,
          border: "2px dashed", borderColor: "rgba(255,255,255,0.08)",
          borderRadius: 2,
        }}>
          <AccessTime sx={{ fontSize: 40, color: "text.disabled", opacity: 0.3, mb: 1 }} />
          <Typography color="text.secondary" variant="body2">No time clock entries yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {history.slice(0, 14).map(e => {
            const hrs = netHours(e);
            const meta = STATUS_META[e.status] ?? STATUS_META.ClockedOut;
            return (
              <Card key={e.id} variant="outlined" sx={{
                borderColor: "rgba(255,255,255,0.07)",
                borderLeft: `3px solid ${meta.border}`,
              }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs(e.clockInUtc).format("ddd, MMM D")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                        In: {fmtTime(e.clockInUtc)} · Out: {fmtTime(e.clockOutUtc)}
                      </Typography>
                      {e.lunchOutUtc && (
                        <Typography variant="caption" color="info.main" display="block">
                          Lunch: {fmtTime(e.lunchOutUtc)} – {fmtTime(e.lunchInUtc)}
                          {e.lunchMinutes != null ? ` (${e.lunchMinutes}m)` : ""}
                        </Typography>
                      )}
                      {hrs != null && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Net: <strong>{hrs.toFixed(2)}h</strong>
                        </Typography>
                      )}
                      {e.adminNotes && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Admin note: {e.adminNotes}
                        </Typography>
                      )}
                      {e.status === "PendingCorrection" && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Correction pending admin review
                        </Typography>
                      )}
                    </Box>
                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Chip label={e.status} size="small" color={meta.color}
                        sx={{ height: 20, fontSize: 11 }} />
                      {e.clockOutUtc && e.status !== "PendingCorrection" && (
                        <Button size="small" sx={{ fontSize: 11, textTransform: "none", color: "rgba(255,255,255,0.5)", p: 0 }}
                          onClick={() => setCorrectionEntry(e)}>
                          Request Correction
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {correctionEntry && (
        <CorrectionDialog
          entry={correctionEntry}
          open
          onClose={() => setCorrectionEntry(null)}
          onSubmitted={load}
        />
      )}
    </Box>
  );
}
