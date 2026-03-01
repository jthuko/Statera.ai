// src/pages/AdminTimeClock.tsx
// Admin panel: view, adjust, and approve staff time clock entries
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Skeleton, Snackbar, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { Download as DownloadIcon, TableChart as ExcelIcon } from "@mui/icons-material";
import * as XLSX from "xlsx";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import dayjs from "dayjs";
import { useFacility } from "../context/facility";
import { listStaff, type StaffDto } from "../api/staff";
import {
  listTimeClockEntries, adjustTimeClockEntry, reviewTimeClockEntry,
  type TimeClockEntryDto, type AdjustTimeClockPayload,
} from "../api/timeclock";
import { exportTimesheetsToProvider, listFacilityIntegrations, type FacilityIntegrationStatus } from "../api/integrations";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { color: "default" | "warning" | "success" | "error" | "info"; border: string }> = {
  ClockedIn:         { color: "warning",  border: "#f57c00" },
  OnLunch:           { color: "info",     border: "#0288d1" },
  ClockedOut:        { color: "default",  border: "rgba(255,255,255,0.12)" },
  Approved:          { color: "success",  border: "#2e7d32" },
  Denied:            { color: "error",    border: "#c62828" },
  Adjusted:          { color: "success",  border: "#2e7d32" },
  PendingCorrection: { color: "warning",  border: "#f57c00" },
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

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function buildNotes(e: TimeClockEntryDto) {
  const parts = [
    e.notes ? `Staff: ${e.notes}` : null,
    e.adminNotes ? `Admin: ${e.adminNotes}` : null,
    e.correctionNotes ? `Correction: ${e.correctionNotes}` : null,
    e.isManual ? "Manual entry" : null,
  ].filter(Boolean) as string[];
  return parts.join(" | ");
}

// ── Adjust Dialog ─────────────────────────────────────────────────────────────

function AdjustDialog({ entry, open, onClose, onSaved }: {
  entry: TimeClockEntryDto; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [ci, setCi]     = useState(toLocal(entry.clockInUtc));
  const [co, setCo]     = useState(toLocal(entry.clockOutUtc));
  const [lo, setLo]     = useState(toLocal(entry.lunchOutUtc));
  const [li, setLi]     = useState(toLocal(entry.lunchInUtc));
  const [notes, setNotes] = useState(entry.adminNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  useEffect(() => {
    setCi(toLocal(entry.clockInUtc)); setCo(toLocal(entry.clockOutUtc));
    setLo(toLocal(entry.lunchOutUtc)); setLi(toLocal(entry.lunchInUtc));
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
      onSaved(); onClose();
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
          <TextField label="Clock In"           type="datetime-local" size="small" value={ci} onChange={e => setCi(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Clock Out"          type="datetime-local" size="small" value={co} onChange={e => setCo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Lunch Start (opt.)" type="datetime-local" size="small" value={lo} onChange={e => setLo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Lunch End (opt.)"   type="datetime-local" size="small" value={li} onChange={e => setLi(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Admin Notes" multiline minRows={2} size="small" value={notes} onChange={e => setNotes(e.target.value)} fullWidth />
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

  const [staff, setStaff]           = useState<StaffDto[]>([]);
  const [staffId, setStaffId]       = useState<string>("");
  const [from, setFrom]             = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo]                 = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [statusFilter, setStatusFilter] = useState("");

  const [entries, setEntries] = useState<TimeClockEntryDto[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);
  const [exporting, setExporting] = useState<"Gusto" | "QuickBooks" | null>(null);
  const [integrations, setIntegrations] = useState<FacilityIntegrationStatus[]>([]);

  const [adjustEntry, setAdjustEntry] = useState<TimeClockEntryDto | null>(null);

  useEffect(() => {
    if (!facilityId) { setStaff([]); setIntegrations([]); return; }
    listStaff(facilityId).then(setStaff).catch(() => setStaff([]));
    listFacilityIntegrations(facilityId).then(setIntegrations).catch(() => setIntegrations([]));
  }, [facilityId]);

  const loadEntries = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await listTimeClockEntries({
        facilityId, staffId: staffId || undefined,
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
    const rows = [["Staff", "Date", "Day", "Clock In", "Clock Out", "Lunch Start", "Lunch End", "Lunch (hrs)", "Net Hours", "Status", "Admin Notes"]];
    for (const e of entries.filter(x => x.clockOutUtc)) {
      const lh = lunchHours(e);
      rows.push([
        e.staffName ?? e.staffId, dayjs(e.clockInUtc).format("YYYY-MM-DD"), dayjs(e.clockInUtc).format("ddd"),
        fmt(e.clockInUtc), fmt(e.clockOutUtc), fmt(e.lunchOutUtc), fmt(e.lunchInUtc),
        lh > 0 ? lh.toFixed(2) : "", netHours(e).toFixed(2), e.status, e.adminNotes ?? "",
      ]);
    }
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `timeclock-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadExcel() {
    const rows = entries.filter(x => x.clockOutUtc).map(e => {
      const lh = lunchHours(e);
      return {
        "Staff":        e.staffName ?? e.staffId,
        "Date":         dayjs(e.clockInUtc).format("YYYY-MM-DD"),
        "Day":          dayjs(e.clockInUtc).format("ddd"),
        "Clock In":     fmt(e.clockInUtc),
        "Clock Out":    fmt(e.clockOutUtc),
        "Lunch Start":  fmt(e.lunchOutUtc),
        "Lunch End":    fmt(e.lunchInUtc),
        "Lunch (hrs)":  lh > 0 ? +lh.toFixed(2) : "",
        "Net Hours":    +netHours(e).toFixed(2),
        "Status":       e.status,
        "Admin Notes":  e.adminNotes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    const colWidths = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length, 12) }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Time Clock");
    XLSX.writeFile(wb, `timeclock-${from}-${to}.xlsx`);
  }

  async function exportToProvider(provider: "Gusto" | "QuickBooks") {
    if (!facilityId) return;
    setExporting(provider);
    try {
      const res = await exportTimesheetsToProvider(facilityId, provider, {
        fromUtc: dayjs(from).startOf("day").toISOString(),
        toUtc: dayjs(to).endOf("day").toISOString(),
        staffId: staffId || null,
        status: statusFilter || null,
      });
      const msg = `${provider}: exported ${res.exported}, skipped ${res.skipped}`;
      setToast(msg);
      if (res.errors?.length) {
        setError(`${provider} export completed with ${res.errors.length} error(s).`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? `Failed to export to ${provider}.`);
    } finally {
      setExporting(null);
    }
  }

  const totalNet     = entries.filter(e => e.clockOutUtc).reduce((s, e) => s + netHours(e), 0);
  const pendingCount = entries.filter(e => e.status === "PendingCorrection").length;
  const approvedCount = entries.filter(e => e.status === "Approved").length;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>

      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2.5,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{
                width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
              }}>
                <AccessTimeIcon sx={{ color: "#4db6ac", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Time Clock</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">Admin review</Typography>
                  {pendingCount > 0 && (
                    <Chip
                      icon={<WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
                      label={`${pendingCount} pending`}
                      size="small" color="warning"
                      sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="contained" startIcon={<DownloadIcon />} size="small" onClick={downloadCsv}
                disabled={entries.filter(e => e.clockOutUtc).length === 0}
                sx={{ bgcolor: "#00897b", color: "#fff", "&:hover": { bgcolor: "#00796b" } }}>
                Export CSV
              </Button>
              <Button variant="contained" startIcon={<ExcelIcon />} size="small" onClick={downloadExcel}
                disabled={entries.filter(e => e.clockOutUtc).length === 0}
                sx={{ bgcolor: "#2e7d32", color: "#fff", "&:hover": { bgcolor: "#1b5e20" } }}>
                Export Excel
              </Button>
              {(() => {
                const gustoConnected = integrations.find(i => i.provider === "Gusto")?.connected ?? false;
                const qbConnected    = integrations.find(i => i.provider === "QuickBooks")?.connected ?? false;
                const hasEntries     = entries.filter(e => e.clockOutUtc).length > 0;
                return (
                  <>
                    <Tooltip title={!gustoConnected ? "Connect Gusto in Facility Settings → Integrations first" : ""} arrow>
                      <span>
                        <Button variant="contained" startIcon={<DownloadIcon />} size="small"
                          onClick={() => exportToProvider("Gusto")}
                          disabled={!gustoConnected || !hasEntries || exporting === "Gusto"}
                          sx={{ bgcolor: "#1976d2", color: "#fff", "&:hover": { bgcolor: "#115293" }, "&.Mui-disabled": { opacity: 0.5 } }}>
                          {exporting === "Gusto" ? <CircularProgress size={14} color="inherit" sx={{ mr: 0.75 }} /> : null}
                          {exporting === "Gusto" ? "Exporting…" : gustoConnected ? "Export Gusto" : "Gusto (not connected)"}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={!qbConnected ? "Connect QuickBooks in Facility Settings → Integrations first" : ""} arrow>
                      <span>
                        <Button variant="contained" startIcon={<DownloadIcon />} size="small"
                          onClick={() => exportToProvider("QuickBooks")}
                          disabled={!qbConnected || !hasEntries || exporting === "QuickBooks"}
                          sx={{ bgcolor: "#f9a825", color: "#1b1b1b", "&:hover": { bgcolor: "#f57f17" }, "&.Mui-disabled": { opacity: 0.5 } }}>
                          {exporting === "QuickBooks" ? <CircularProgress size={14} color="inherit" sx={{ mr: 0.75 }} /> : null}
                          {exporting === "QuickBooks" ? "Exporting…" : qbConnected ? "Export QuickBooks" : "QuickBooks (not connected)"}
                        </Button>
                      </span>
                    </Tooltip>
                  </>
                );
              })()}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Summary chips ── */}
      {!loading && facilityId && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
          <Chip label={`${total} entries`} size="small" variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.15)" }} />
          <Chip
            icon={<AccessTimeIcon sx={{ fontSize: "14px !important" }} />}
            label={`${totalNet.toFixed(1)}h net`}
            size="small"
            sx={{ bgcolor: "rgba(0,77,77,0.3)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.25)" }}
          />
          {approvedCount > 0 && (
            <Chip icon={<CheckCircleIcon sx={{ fontSize: "14px !important" }} />}
              label={`${approvedCount} approved`} size="small" color="success" variant="outlined" />
          )}
          {pendingCount > 0 && (
            <Chip icon={<WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
              label={`${pendingCount} need review`} size="small" color="warning" variant="outlined" />
          )}
        </Stack>
      )}

      {/* ── Filters ── */}
      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" alignItems="center">
            <TextField select label="Facility" size="small" value={facilityId ?? ""}
              onChange={e => setSelectedId(e.target.value)} sx={{ minWidth: 200 }}>
              {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </TextField>
            <TextField select label="Staff" size="small" value={staffId}
              onChange={e => setStaffId(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">All Staff</MenuItem>
              {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</MenuItem>)}
            </TextField>
            <TextField type="date" label="From" size="small" value={from}
              onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="To" size="small" value={to}
              onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select label="Status" size="small" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value="">All Statuses</MenuItem>
              {["ClockedIn","OnLunch","ClockedOut","Approved","Denied","Adjusted","PendingCorrection"].map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            {loading && <CircularProgress size={20} sx={{ color: "#4db6ac" }} />}
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Entries ── */}
      {!facilityId ? (
        <Alert severity="info">Select a facility to view entries.</Alert>
      ) : loading ? (
        <Stack spacing={1.5}>
          {[...Array(4)].map((_, i) => (
            <Card key={i} variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="circular" width={40} height={40} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="40%" height={18} />
                    <Skeleton width="60%" height={14} sx={{ mt: 0.5 }} />
                  </Box>
                  <Skeleton width={70} height={24} sx={{ borderRadius: 4 }} />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : entries.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <AccessTimeIcon sx={{ fontSize: 48, color: "text.disabled", opacity: 0.3, mb: 1 }} />
          <Typography color="text.secondary" fontWeight={500}>No entries found</Typography>
          <Typography variant="caption" color="text.disabled">Try adjusting the filters above</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {entries.map(e => {
            const meta   = STATUS_META[e.status] ?? STATUS_META.ClockedOut;
            const name   = e.staffName ?? "Unknown";
            const hrs    = netHours(e);
            return (
              <Card key={e.id} variant="outlined" sx={{
                borderLeft: `3px solid ${meta.border}`,
                borderColor: e.status === "PendingCorrection" ? "warning.main" : "rgba(255,255,255,0.06)",
                transition: "box-shadow 0.15s",
                "&:hover": { boxShadow: 4 },
              }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }}
                    alignItems={{ sm: "flex-start" }} justifyContent="space-between" flexWrap="wrap" gap={1}>

                    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ flex: 1 }}>
                      <Avatar sx={{ width: 38, height: 38, fontSize: 13, fontWeight: 700, flexShrink: 0,
                        bgcolor: "rgba(0,137,123,0.15)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.25)" }}>
                        {getInitials(name)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                          {dayjs(e.clockInUtc).format("ddd, MMM D")}
                          &nbsp;·&nbsp;
                          <strong>In:</strong> {fmt(e.clockInUtc)}
                          &nbsp;·&nbsp;
                          <strong>Out:</strong> {fmt(e.clockOutUtc)}
                        </Typography>
                        {e.lunchOutUtc && (
                          <Typography variant="caption" color="info.main" display="block">
                            Lunch: {fmt(e.lunchOutUtc)} – {fmt(e.lunchInUtc)}
                            {e.lunchMinutes != null ? ` (${e.lunchMinutes}m)` : ""}
                          </Typography>
                        )}
                        {e.clockOutUtc && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Net: <strong>{hrs.toFixed(2)}h</strong>
                          </Typography>
                        )}
                        {e.adminNotes && (
                          <Typography variant="caption" color="warning.main" display="block">
                            Note: {e.adminNotes}
                          </Typography>
                        )}
                        {e.status === "PendingCorrection" && e.correctionNotes && (
                          <Alert severity="warning" sx={{ mt: 0.5, py: 0.25, fontSize: 12 }}>
                            <strong>Correction:</strong> {e.correctionNotes}
                            <br />
                            Suggested: in {fmt(e.correctedClockInUtc)} · out {fmt(e.correctedClockOutUtc)}
                          </Alert>
                        )}
                      </Box>
                    </Stack>

                    <Stack alignItems="flex-end" spacing={0.75} sx={{ flexShrink: 0 }}>
                      <Chip label={e.status} size="small" color={meta.color} />
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" variant="outlined" onClick={() => setAdjustEntry(e)}
                          sx={{ fontSize: 11 }}>
                          Adjust
                        </Button>
                        {(e.status === "PendingCorrection" || e.status === "ClockedOut" || e.status === "Adjusted") && (
                          <Button size="small" variant="contained" color="success"
                            onClick={() => handleReview(e.id, "Approved")} sx={{ fontSize: 11 }}>
                            Approve
                          </Button>
                        )}
                        {e.status === "PendingCorrection" && (
                          <Button size="small" variant="contained" color="error"
                            onClick={() => handleReview(e.id, "Denied")} sx={{ fontSize: 11 }}>
                            Deny
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {adjustEntry && (
        <AdjustDialog
          entry={adjustEntry} open
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
