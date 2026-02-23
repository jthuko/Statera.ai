// src/pages/portal/PortalTimeClock.tsx
// Staff portal: clock in / clock out
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from "@mui/material";
import { AccessAlarm, Login, Logout } from "@mui/icons-material";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useAuth } from "../../auth/useAuth";
import {
  clockIn, clockOut, getActiveEntry, listTimeClockEntries,
  type TimeClockEntryDto,
} from "../../api/timeclock";

dayjs.extend(duration);

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  ClockedIn: "warning", ClockedOut: "default", Approved: "success", Denied: "error", Adjusted: "success",
};

function elapsed(since: string): string {
  const diff = dayjs().diff(dayjs(since));
  const d = dayjs.duration(diff);
  return `${d.hours()}h ${d.minutes()}m`;
}

export default function PortalTimeClock() {
  const { user } = useAuth();
  const [active, setActive] = useState<TimeClockEntryDto | null>(null);
  const [history, setHistory] = useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Tick timer for live elapsed display
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    try {
      const [act, hist] = await Promise.all([
        getActiveEntry(user.staffId),
        listTimeClockEntries({ staffId: user.staffId, page: 1, pageSize: 20 }),
      ]);
      setActive(act);
      setHistory(hist.items);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [user?.staffId]);

  useEffect(() => { load(); }, [load]);

  async function handleClockIn() {
    if (!user?.facilityIds?.[0]) { setError("No facility assigned."); return; }
    setBusy(true); setError(null);
    try {
      await clockIn(user.facilityIds[0], user.staffId ?? undefined);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Clock-in failed.");
    } finally { setBusy(false); }
  }

  async function handleClockOut() {
    setBusy(true); setError(null);
    try {
      await clockOut(user?.staffId ?? undefined);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Clock-out failed.");
    } finally { setBusy(false); }
  }

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;

  const isClockedIn = !!active;

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Time Clock</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Status card */}
      <Card sx={{ mb: 3, background: isClockedIn ? "rgba(0,200,100,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${isClockedIn ? "rgba(0,200,100,0.25)" : "rgba(255,255,255,0.1)"}` }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <AccessAlarm sx={{ fontSize: 48, color: isClockedIn ? "success.main" : "text.secondary" }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight={700}>
                {isClockedIn ? "Clocked In" : "Clocked Out"}
              </Typography>
              {active && (
                <Typography variant="body2" color="text.secondary">
                  Since {dayjs(active.clockInUtc).format("h:mm a")} · {elapsed(active.clockInUtc)} elapsed
                </Typography>
              )}
            </Box>
            {isClockedIn ? (
              <Button
                variant="contained"
                color="error"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Logout />}
                onClick={handleClockOut}
                disabled={busy}
                size="large"
              >
                Clock Out
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Login />}
                onClick={handleClockIn}
                disabled={busy}
                size="large"
              >
                Clock In
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Recent entries */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Recent Entries</Typography>
      {history.length === 0 ? (
        <Typography color="text.secondary" variant="body2">No time clock entries yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {history.map(e => {
            const hours = e.clockOutUtc
              ? (dayjs(e.clockOutUtc).diff(dayjs(e.clockInUtc), "minute") / 60).toFixed(2)
              : null;
            return (
              <Card key={e.id} variant="outlined">
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box>
                      <Typography variant="body2">
                        {dayjs(e.clockInUtc).format("ddd, MMM D · h:mm a")}
                        {e.clockOutUtc && ` – ${dayjs(e.clockOutUtc).format("h:mm a")}`}
                      </Typography>
                      {hours && (
                        <Typography variant="caption" color="text.secondary">{hours} hrs</Typography>
                      )}
                      {e.adminNotes && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Admin note: {e.adminNotes}
                        </Typography>
                      )}
                    </Box>
                    <Chip label={e.status} size="small" color={STATUS_COLOR[e.status] ?? "default"} />
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
