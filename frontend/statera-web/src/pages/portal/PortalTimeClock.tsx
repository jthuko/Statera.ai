// src/pages/portal/PortalTimeClock.tsx
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { AccessAlarm, Login, Logout, RestaurantMenu, KeyboardReturn } from "@mui/icons-material";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useAuth } from "../../auth/useAuth";
import {
  clockIn, clockOut, lunchOut, lunchReturn,
  getActiveEntry, listTimeClockEntries, submitCorrection,
  type TimeClockEntryDto,
} from "../../api/timeclock";

dayjs.extend(duration);

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  ClockedIn: "warning",
  OnLunch: "info",
  ClockedOut: "default",
  Approved: "success",
  Denied: "error",
  Adjusted: "success",
  PendingCorrection: "warning",
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
        clockInUtc: dayjs(ci).toISOString(),
        clockOutUtc: co ? dayjs(co).toISOString() : null,
        lunchOutUtc: lo ? dayjs(lo).toISOString() : null,
        lunchInUtc: li ? dayjs(li).toISOString() : null,
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

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;

  const isOnLunch = active?.status === "OnLunch";
  const isClockedIn = !!active;

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Time Clock</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Status card */}
      <Card sx={{
        mb: 3,
        background: isOnLunch ? "rgba(0,150,255,0.07)" : isClockedIn ? "rgba(0,200,100,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isOnLunch ? "rgba(0,150,255,0.3)" : isClockedIn ? "rgba(0,200,100,0.3)" : "rgba(255,255,255,0.1)"}`,
      }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}>
            <AccessAlarm sx={{ fontSize: 40, color: isOnLunch ? "info.main" : isClockedIn ? "success.main" : "text.secondary" }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight={700}>
                {isOnLunch ? "On Lunch Break" : isClockedIn ? "Clocked In" : "Clocked Out"}
              </Typography>
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
                  onClick={() => doAction(() => clockIn(user!.facilityIds![0], user?.staffId ?? undefined))}>
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

      {/* Monthly calendar */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{calMonth.format("MMMM YYYY")}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 3 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <Typography key={d} variant="caption" color="text.secondary" align="center" fontWeight={600} sx={{ py: 0.5 }}>
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
            `${fmtTime(e.clockInUtc)}–${fmtTime(e.clockOutUtc)}${e.lunchOutUtc ? ` | lunch ${fmtTime(e.lunchOutUtc)}–${fmtTime(e.lunchInUtc)}` : ""}`
          ).join("\n");
          return (
            <Tooltip key={d} title={tooltipLines} arrow placement="top">
              <Card variant="outlined" sx={{
                height: 52, cursor: dayEntries.length > 0 ? "pointer" : "default",
                borderColor: isToday ? "primary.main" : hasPending ? "warning.main" : undefined,
                background: dayEntries.length > 0 ? "rgba(0,180,120,0.07)" : undefined,
              }}>
                <CardContent sx={{ p: 0.5, "&:last-child": { pb: 0.5 } }}>
                  <Typography variant="caption" fontWeight={isToday ? 700 : 400}
                    color={isToday ? "primary.main" : "text.secondary"}>
                    {dayjs(d).date()}
                  </Typography>
                  {totalHrs > 0 && (
                    <Typography variant="caption" color="success.main" display="block" fontWeight={600}>
                      {totalHrs.toFixed(1)}h
                    </Typography>
                  )}
                  {hasPending && (
                    <Typography variant="caption" color="warning.main" display="block" sx={{ fontSize: 9 }}>
                      ⏳pending
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Tooltip>
          );
        })}
      </Box>

      {/* Recent entries */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Recent Entries</Typography>
      {history.length === 0 ? (
        <Typography color="text.secondary" variant="body2">No time clock entries yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {history.slice(0, 14).map(e => {
            const hrs = netHours(e);
            return (
              <Card key={e.id} variant="outlined">
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs(e.clockInUtc).format("ddd, MMM D")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
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
                          Net hours worked: {hrs.toFixed(2)}h
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
                      <Chip label={e.status} size="small" color={STATUS_COLOR[e.status] ?? "default"} />
                      {e.clockOutUtc && e.status !== "PendingCorrection" && (
                        <Button size="small" sx={{ fontSize: 11, textTransform: "none" }}
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
