// src/pages/AdminTimeClock.tsx
// Admin panel: view, adjust, and approve staff time clock entries
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import dayjs from "dayjs";
import { useFacility } from "../context/facility";
import { listStaff, type StaffDto } from "../api/staff";
import {
  listTimeClockEntries, adjustTimeClockEntry, reviewTimeClockEntry,
  type TimeClockEntryDto, type AdjustTimeClockPayload,
} from "../api/timeclock";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  ClockedIn: "warning", OnLunch: "info", ClockedOut: "default",
  Approved: "success", Denied: "error", Adjusted: "success", PendingCorrection: "warning",
};

function netHours(e: TimeClockEntryDto): number {
  if (!e.clockOutUtc) return 0;
  const total = dayjs(e.clockOutUtc).diff(dayjs(e.clockInUtc), "minute");
  const lunch = (e.lunchOutUtc && e.lunchInUtc)
    ? dayjs(e.lunchInUtc).diff(dayjs(e.lunchOutUtc), "minute") : 0;
  return Math.max(0, total - lunch) / 60;
}

function lunchHours(e: TimeClockEntryDto): number {
  if (!e.lunchOutUtc || !e.lunchInUtc) return 0;
  return dayjs(e.lunchInUtc).diff(dayjs(e.lunchOutUtc), "minute") / 60;
}

function toLocal(iso: string | null | undefined) {
  return iso ? dayjs(iso).format("YYYY-MM-DDTHH:mm") : "";
}

function fmt(iso: string | null | undefined) {
  return iso ? dayjs(iso).format("h:mm a") : "—";
}

// ── Adjust Dialog ──────────────────────────────────────────────────────────────
function AdjustDialog({
  entry, open, onClose, onSaved,
}: { entry: TimeClockEntryDto; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [ci, setCi] = useState(toLocal(entry.clockInUtc));
  const [co, setCo] = useState(toLocal(entry.clockOutUtc));
  const [lo, setLo] = useState(toLocal(entry.lunchOutUtc));
  const [li, setLi] = useState(toLocal(entry.lunchInUtc));
  const [notes, setNotes] = useState(entry.adminNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setCi(toLocal(entry.clockInUtc));
    setCo(toLocal(entry.clockOutUtc));
    setLo(toLocal(entry.lunchOutUtc));
    setLi(toLocal(entry.lunchInUtc));
    setNotes(entry.adminNotes ?? "");
  }, [entry]);

  async function handleSave() {
    setBusy(true); setErr(null);
    try {
      const payload: AdjustTimeClockPayload = {
        clockInUtc:  dayjs(ci).toISOString(),
        clockOutUtc: co ? dayjs(co).toISOString() : null,
        lunchOutUtc: lo ? dayjs(lo).toISOString() : null,
        lunchInUtc:  li ? dayjs(li).toISOString() : null,
        adminNotes:  notes || undefined,
      };
      await adjustTimeClockEntry(entry.id, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Failed to adjust entry.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adjust Time Entry</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          {entry.correctionNotes && (
            <Alert severity="info">
              <strong>Staff correction request:</strong> {entry.correctionNotes}
              <br />
              Suggested in: {fmt(entry.correctedClockInUtc)} · out: {fmt(entry.correctedClockOutUtc)}
              {entry.correctedLunchOutUtc && ` · lunch ${fmt(entry.correctedLunchOutUtc)}–${fmt(entry.correctedLunchInUtc)}`}
            </Alert>
          )}
          <TextField label="Clock In" type="datetime-local" size="small" value={ci}
            onChange={e => setCi(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Clock Out" type="datetime-local" size="small" value={co}
            onChange={e => setCo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Lunch Start (optional)" type="datetime-local" size="small" value={lo}
            onChange={e => setLo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Lunch End (optional)" type="datetime-local" size="small" value={li}
            onChange={e => setLi(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Admin Notes" multiline minRows={2} size="small"
            value={notes} onChange={e => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={busy || !ci}>
          {busy ? <CircularProgress size={16} color="inherit" /> : "Save Adjustment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminTimeClock() {
  const { facilities, selected, setSelectedId } = useFacility();
  const facilityId = selected?.id;

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [staffId, setStaffId] = useState<string>("");
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to,   setTo]   = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [statusFilter, setStatusFilter] = useState("");

  const [entries, setEntries] = useState<TimeClockEntryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [adjustEntry, setAdjustEntry] = useState<TimeClockEntryDto | null>(null);

  // Load staff list
  useEffect(() => {
    if (!facilityId) { setStaff([]); return; }
    listStaff(facilityId).then(setStaff).catch(() => setStaff([]));
  }, [facilityId]);

  const loadEntries = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await listTimeClockEntries({
        facilityId,
        staffId: staffId || undefined,
        from: dayjs(from).startOf("day").toISOString(),
        to:   dayjs(to).endOf("day").toISOString(),
        status: statusFilter || undefined,
        page: 1, pageSize: 200,
      });
      setEntries(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load.");
    } finally { setLoading(false); }
  }, [facilityId, staffId, from, to, statusFilter]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleReview(id: string, status: "Approved" | "Denied") {
    try {
      await reviewTimeClockEntry(id, status);
      setToast(`Entry ${status.toLowerCase()}`);
      await loadEntries();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to review.");
    }
  }

  function downloadCsv() {
    const rows = [
      ["Staff", "Date", "Day", "Clock In", "Clock Out", "Lunch Start", "Lunch End", "Lunch (hrs)", "Net Hours", "Status", "Admin Notes"],
    ];
    for (const e of entries.filter(x => x.clockOutUtc)) {
      const lh = lunchHours(e);
      rows.push([
        e.staffName ?? e.staffId,
        dayjs(e.clockInUtc).format("YYYY-MM-DD"),
        dayjs(e.clockInUtc).format("ddd"),
        fmt(e.clockInUtc),
        fmt(e.clockOutUtc),
        fmt(e.lunchOutUtc),
        fmt(e.lunchInUtc),
        lh > 0 ? lh.toFixed(2) : "",
        netHours(e).toFixed(2),
        e.status,
        e.adminNotes ?? "",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `timeclock-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalNet   = entries.filter(e => e.clockOutUtc).reduce((s, e) => s + netHours(e), 0);
  const pendingCount = entries.filter(e => e.status === "PendingCorrection").length;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Time Clock — Admin</Typography>
          {pendingCount > 0 && (
            <Typography variant="body2" color="warning.main">
              {pendingCount} correction{pendingCount > 1 ? "s" : ""} pending review
            </Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} size="small" onClick={downloadCsv}
          disabled={entries.filter(e => e.clockOutUtc).length === 0}>
          Download CSV
        </Button>
      </Stack>

      {/* Filters */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
            <TextField select label="Facility" size="small" value={facilityId ?? ""}
              onChange={e => setSelectedId(e.target.value)} sx={{ minWidth: 200 }}>
              {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </TextField>
            <TextField select label="Staff" size="small" value={staffId}
              onChange={e => setStaffId(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">All Staff</MenuItem>
              {staff.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</MenuItem>
              ))}
            </TextField>
            <TextField type="date" label="From" size="small" value={from}
              onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="To" size="small" value={to}
              onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select label="Status" size="small" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value="">All Statuses</MenuItem>
              {["ClockedIn", "OnLunch", "ClockedOut", "Approved", "Denied", "Adjusted", "PendingCorrection"].map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            {loading && <CircularProgress size={24} sx={{ alignSelf: "center" }} />}
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {total} entries · Total net: <strong>{totalNet.toFixed(2)}h</strong>
      </Typography>

      {!facilityId ? (
        <Alert severity="info">Select a facility to view entries.</Alert>
      ) : entries.length === 0 && !loading ? (
        <Typography color="text.secondary">No entries found for the selected filters.</Typography>
      ) : (
        <Stack spacing={1}>
          {entries.map(e => (
            <Card key={e.id} variant="outlined"
              sx={{ borderColor: e.status === "PendingCorrection" ? "warning.main" : undefined }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "flex-start" }}
                  justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{e.staffName ?? "Unknown"}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dayjs(e.clockInUtc).format("ddd, MMM D")} · In: {fmt(e.clockInUtc)} · Out: {fmt(e.clockOutUtc)}
                    </Typography>
                    {e.lunchOutUtc && (
                      <Typography variant="caption" color="info.main" display="block">
                        Lunch: {fmt(e.lunchOutUtc)} – {fmt(e.lunchInUtc)}
                        {e.lunchMinutes != null ? ` (${e.lunchMinutes}m)` : ""}
                      </Typography>
                    )}
                    {e.clockOutUtc && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Net: {netHours(e).toFixed(2)}h
                      </Typography>
                    )}
                    {e.adminNotes && (
                      <Typography variant="caption" color="warning.main" display="block">
                        Note: {e.adminNotes}
                      </Typography>
                    )}
                    {e.status === "PendingCorrection" && e.correctionNotes && (
                      <Alert severity="warning" sx={{ mt: 0.5, py: 0.25 }}>
                        <strong>Correction request:</strong> {e.correctionNotes}
                        <br />
                        Suggested: in {fmt(e.correctedClockInUtc)} · out {fmt(e.correctedClockOutUtc)}
                        {e.correctedLunchOutUtc && ` · lunch ${fmt(e.correctedLunchOutUtc)}–${fmt(e.correctedLunchInUtc)}`}
                      </Alert>
                    )}
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip label={e.status} size="small" color={STATUS_COLOR[e.status] ?? "default"} />
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="outlined"
                        onClick={() => setAdjustEntry(e)}>
                        Adjust
                      </Button>
                      {e.status === "PendingCorrection" && (
                        <>
                          <Button size="small" variant="contained" color="success"
                            onClick={() => handleReview(e.id, "Approved")}>
                            Approve
                          </Button>
                          <Button size="small" variant="contained" color="error"
                            onClick={() => handleReview(e.id, "Denied")}>
                            Deny
                          </Button>
                        </>
                      )}
                      {(e.status === "ClockedOut" || e.status === "Adjusted") && (
                        <>
                          <Button size="small" variant="contained" color="success"
                            onClick={() => handleReview(e.id, "Approved")}>
                            Approve
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {adjustEntry && (
        <AdjustDialog
          entry={adjustEntry}
          open
          onClose={() => setAdjustEntry(null)}
          onSaved={() => { setToast("Entry adjusted"); loadEntries(); }}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Container>
  );
}
