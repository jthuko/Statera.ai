// src/pages/OpenShifts.tsx
// Admin: manage open shifts / shift marketplace
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, LinearProgress, MenuItem,
  Select, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography, useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import WorkHistoryIcon from "@mui/icons-material/WorkHistory";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import PeopleIcon from "@mui/icons-material/People";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useFacility } from "../context/facility";
import {
  listOpenShifts, createOpenShift, updateOpenShift, deleteOpenShift,
  listRequests, reviewRequest,
  OpenShiftDto, OpenShiftRequestDto,
} from "../api/openShifts";
import { listUnits, UnitDto } from "../api/units";
import api from "../api/axios";

// ─── Fill Probability ──────────────────────────────────────────────────────────

interface FillProbabilityResult {
  probability: number;
  label: "High" | "Medium" | "Low" | "Very Low";
  factors: string[];
  suggestions: string[];
}

function fillLabelColor(label: string): string {
  switch (label) {
    case "High":     return "#4caf50";
    case "Medium":   return "#f57c00";
    case "Low":      return "#ef5350";
    default:         return "#d32f2f";
  }
}

function FillProbabilityPanel({ result }: { result: FillProbabilityResult }) {
  const pct   = Math.round(result.probability * 100);
  const color = fillLabelColor(result.label);
  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, border: "1px solid rgba(77,182,172,0.2)", bgcolor: "rgba(0,0,0,0.2)" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ShowChartIcon sx={{ fontSize: 15, color: "#4db6ac" }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Shift Fill Probability
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color, ml: "auto !important" }}>
          {pct}% — {result.label}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6, borderRadius: 3, mb: 1,
          bgcolor: "rgba(255,255,255,0.08)",
          "& .MuiLinearProgress-bar": { borderRadius: 3, bgcolor: color },
        }}
      />
      {result.factors.length > 0 && (
        <Box sx={{ mb: result.suggestions.length > 0 ? 1 : 0 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600 }}>Why:</Typography>
          {result.factors.map((f, i) => (
            <Typography key={i} variant="caption" sx={{ display: "block", color: "text.secondary", pl: 1 }}>• {f}</Typography>
          ))}
        </Box>
      )}
      {result.suggestions.length > 0 && (
        <Box sx={{ p: 1, borderRadius: 1, bgcolor: "rgba(0,137,123,0.08)", border: "1px solid rgba(77,182,172,0.15)" }}>
          <Stack direction="row" spacing={0.5} alignItems="flex-start">
            <LightbulbIcon sx={{ fontSize: 13, color: "#4db6ac", mt: 0.2, flexShrink: 0 }} />
            <Box>
              {result.suggestions.map((s, i) => (
                <Typography key={i} variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{s}</Typography>
              ))}
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

// ─── Staff Recommendations ─────────────────────────────────────────────────────

interface StaffRecommendation {
  staffId: string;
  staffName: string;
  role: string;
  probability: number;
  signals: string[];
}

interface StaffRecommendationsResult {
  recommendations: StaffRecommendation[];
  totalEligible: number;
}

function probColor(p: number): string {
  if (p >= 75) return "#4caf50";
  if (p >= 50) return "#f57c00";
  if (p >= 30) return "#ef5350";
  return "#d32f2f";
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function StaffRecommendationsPanel({ result }: { result: StaffRecommendationsResult }) {
  if (result.recommendations.length === 0) return null;
  return (
    <Box sx={{ mt: 0, p: 1.5, borderRadius: 1.5, border: "1px solid rgba(77,182,172,0.2)", bgcolor: "rgba(0,0,0,0.2)" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Best Match
        </Typography>
        <Typography variant="caption" sx={{ color: "text.disabled", ml: "auto !important" }}>
          {result.totalEligible} eligible staff
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {result.recommendations.map((r, i) => {
          const color = probColor(r.probability);
          return (
            <Box key={r.staffId} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* Rank + avatar */}
              <Box sx={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: i === 0 ? "rgba(77,182,172,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${i === 0 ? "rgba(77,182,172,0.4)" : "rgba(255,255,255,0.1)"}`,
              }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, color: i === 0 ? "#4db6ac" : "text.secondary" }}>
                  {initials(r.staffName)}
                </Typography>
              </Box>
              {/* Name + signals */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{r.staffName}</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }} noWrap>
                  {r.signals.slice(0, 2).join(" · ")}
                </Typography>
              </Box>
              {/* Probability */}
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color, display: "block" }}>{r.probability}%</Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>acceptance</Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
      <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1.5, fontStyle: "italic" }}>
        Based on historical acceptance patterns, workload &amp; availability
      </Typography>
    </Box>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLES = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT"];

const STATUS_COLORS: Record<string, string> = {
  Open:      "#2e7d32",
  Filled:    "#1565c0",
  Cancelled: "#616161",
};

function statusChip(status: string) {
  const color = STATUS_COLORS[status] ?? "#616161";
  return (
    <Chip
      label={status}
      size="small"
      sx={{
        bgcolor: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        fontWeight: 600,
        fontSize: 11,
        height: 22,
      }}
    />
  );
}

const REQ_STATUS_COLORS: Record<string, string> = {
  Pending:   "#f57c00",
  Approved:  "#2e7d32",
  Denied:    "#616161",
  Withdrawn: "#9e9e9e",
};

function reqStatusChip(status: string) {
  const color = REQ_STATUS_COLORS[status] ?? "#616161";
  return (
    <Chip
      label={status}
      size="small"
      sx={{
        bgcolor: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        fontWeight: 600,
        fontSize: 11,
        height: 22,
      }}
    />
  );
}

// ─── Post Shift Dialog ─────────────────────────────────────────────────────────

interface PostShiftDialogProps {
  open: boolean;
  facilityId: string;
  units: UnitDto[];
  onClose: () => void;
  onCreated: () => void;
}

function PostShiftDialog({ open, facilityId, units, onClose, onCreated }: PostShiftDialogProps) {
  const [role, setRole]       = useState(ROLES[0]);
  const [unitId, setUnitId]   = useState<string>("");
  const [start, setStart]     = useState<Dayjs | null>(dayjs().add(1, "day").hour(7).minute(0).second(0));
  const [end, setEnd]         = useState<Dayjs | null>(dayjs().add(1, "day").hour(15).minute(0).second(0));
  const [notes, setNotes]     = useState("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [fillPrediction, setFillPrediction]   = useState<FillProbabilityResult | null>(null);
  const [staffRecs, setStaffRecs]             = useState<StaffRecommendationsResult | null>(null);
  const [predLoading, setPredLoading]         = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setRole(ROLES[0]); setUnitId(""); setNotes(""); setErr(null); setHourlyRate("");
      setFillPrediction(null); setStaffRecs(null);
      setStart(dayjs().add(1, "day").hour(7).minute(0).second(0));
      setEnd(dayjs().add(1, "day").hour(15).minute(0).second(0));
    }
  }, [open]);

  // Debounce: fetch fill probability + staff recommendations together
  useEffect(() => {
    if (!start || !end || !end.isAfter(start)) { setFillPrediction(null); setStaffRecs(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPredLoading(true);
      try {
        const rate = hourlyRate ? parseFloat(hourlyRate) : undefined;
        const [fillRes, recsRes] = await Promise.allSettled([
          api.post<FillProbabilityResult>("/open-shifts/fill-probability", {
            facilityId, role,
            startUtc: start.toISOString(),
            endUtc: end.toISOString(),
            hourlyRate: rate && !isNaN(rate) ? rate : null,
          }),
          api.post<StaffRecommendationsResult>("/open-shifts/staff-recommendations", {
            facilityId, role,
            startUtc: start.toISOString(),
            endUtc: end.toISOString(),
          }),
        ]);
        setFillPrediction(fillRes.status === "fulfilled" ? fillRes.value.data : null);
        setStaffRecs(recsRes.status === "fulfilled" ? recsRes.value.data : null);
      } finally {
        setPredLoading(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [facilityId, role, start, end, hourlyRate]);

  const canSave = !!role && !!start && !!end && end.isAfter(start);

  async function handleSave() {
    if (!canSave || !start || !end) return;
    setBusy(true); setErr(null);
    try {
      await createOpenShift({
        facilityId,
        unitId: unitId || null,
        role,
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        notes: notes || null,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Failed to post shift.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Post Open Shift</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Unit (optional)</InputLabel>
            <Select label="Unit (optional)" value={unitId} onChange={e => setUnitId(e.target.value)}>
              <MenuItem value="">— Any Unit —</MenuItem>
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>

          <DateTimePicker
            label="Start"
            value={start}
            onChange={v => {
              if (v && start && end) {
                const durationMs = end.valueOf() - start.valueOf();
                setEnd(v.add(durationMs, "millisecond"));
              }
              setStart(v);
            }}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
          <DateTimePicker
            label="End"
            value={end}
            onChange={v => setEnd(v)}
            minDateTime={start ?? undefined}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />

          <TextField
            label="Hourly Rate (optional)"
            value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)}
            size="small"
            type="number"
            inputProps={{ min: 0, step: 0.5 }}
            InputProps={{ startAdornment: <Typography variant="body2" sx={{ mr: 0.5, color: "text.secondary" }}>$</Typography> }}
            helperText="Used to estimate fill probability"
          />

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            multiline rows={2}
            size="small"
            inputProps={{ maxLength: 512 }}
          />

          {/* Predictions section */}
          {predLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={12} sx={{ color: "#4db6ac" }} />
              <Typography variant="caption" sx={{ color: "text.disabled" }}>Analyzing shift data…</Typography>
            </Box>
          )}
          {!predLoading && fillPrediction && <FillProbabilityPanel result={fillPrediction} />}
          {!predLoading && staffRecs && staffRecs.recommendations.length > 0 && (
            <StaffRecommendationsPanel result={staffRecs} />
          )}

          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!canSave || busy}
          startIcon={busy ? <CircularProgress size={14} /> : undefined}>
          Post Shift
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Edit Shift Dialog ─────────────────────────────────────────────────────────

interface EditShiftDialogProps {
  open: boolean;
  shift: OpenShiftDto | null;
  units: UnitDto[];
  onClose: () => void;
  onSaved: () => void;
}

function EditShiftDialog({ open, shift, units, onClose, onSaved }: EditShiftDialogProps) {
  const [role, setRole]     = useState(ROLES[0]);
  const [unitId, setUnitId] = useState<string>("");
  const [start, setStart]   = useState<Dayjs | null>(null);
  const [end, setEnd]       = useState<Dayjs | null>(null);
  const [notes, setNotes]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    if (open && shift) {
      setRole(shift.role);
      setUnitId(shift.unitId ?? "");
      setStart(dayjs(shift.startUtc));
      setEnd(dayjs(shift.endUtc));
      setNotes(shift.notes ?? "");
      setErr(null);
    }
  }, [open, shift]);

  const canSave = !!role && !!start && !!end && end.isAfter(start);

  async function handleSave() {
    if (!canSave || !start || !end || !shift) return;
    setBusy(true); setErr(null);
    try {
      await updateOpenShift(shift.id, {
        unitId: unitId || null,
        role,
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Failed to update shift.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Open Shift</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Unit (optional)</InputLabel>
            <Select label="Unit (optional)" value={unitId} onChange={e => setUnitId(e.target.value)}>
              <MenuItem value="">— Any Unit —</MenuItem>
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>

          <DateTimePicker
            label="Start"
            value={start}
            onChange={v => {
              if (v && start && end) {
                const durationMs = end.valueOf() - start.valueOf();
                setEnd(v.add(durationMs, "millisecond"));
              }
              setStart(v);
            }}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
          <DateTimePicker
            label="End"
            value={end}
            onChange={v => setEnd(v)}
            minDateTime={start ?? undefined}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            multiline rows={2}
            size="small"
            inputProps={{ maxLength: 512 }}
          />

          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!canSave || busy}
          startIcon={busy ? <CircularProgress size={14} /> : undefined}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Requests Dialog ───────────────────────────────────────────────────────────

interface RequestsDialogProps {
  open: boolean;
  shift: OpenShiftDto | null;
  onClose: () => void;
  onReviewed: () => void;
}

function RequestsDialog({ open, shift, onClose, onReviewed }: RequestsDialogProps) {
  const [requests, setRequests] = useState<OpenShiftRequestDto[]>([]);
  const [loading, setLoading]   = useState(false);
  const [busy, setBusy]         = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shift) return;
    setLoading(true); setErr(null);
    listRequests(shift.id)
      .then(r => setRequests(r))
      .catch(e => setErr(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Failed to load requests."))
      .finally(() => setLoading(false));
  }, [open, shift]);

  async function handleReview(reqId: string, action: "Approve" | "Deny") {
    if (!shift) return;
    setBusy(reqId); setErr(null);
    try {
      await reviewRequest(shift.id, reqId, action);
      onReviewed();
      // Refresh list
      const updated = await listRequests(shift.id);
      setRequests(updated);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.response?.data?.detail ?? `Failed to ${action.toLowerCase()} request.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Requests — {shift ? `${shift.role} · ${dayjs(shift.startUtc).format("MMM D h:mm a")} – ${dayjs(shift.endUtc).format("h:mm a")}` : ""}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!loading && requests.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            No requests yet.
          </Typography>
        )}
        {!loading && requests.length > 0 && (
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Staff</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.staffName}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {dayjs(r.requestedUtc).format("MMM D, h:mm a")}
                  </TableCell>
                  <TableCell>{reqStatusChip(r.status)}</TableCell>
                  <TableCell align="right">
                    {r.status === "Pending" && (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Approve">
                          <span>
                            <IconButton
                              size="small"
                              color="success"
                              disabled={busy === r.id}
                              onClick={() => handleReview(r.id, "Approve")}
                            >
                              {busy === r.id ? <CircularProgress size={14} /> : <CheckIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Deny">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={busy === r.id}
                              onClick={() => handleReview(r.id, "Deny")}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OpenShiftsPage() {
  const { selected: facility, facilities, setSelectedId } = useFacility();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [shifts, setShifts]     = useState<OpenShiftDto[]>([]);
  const [units, setUnits]       = useState<UnitDto[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Filters
  const [filterRole, setFilterRole]     = useState("");
  const [filterStatus, setFilterStatus] = useState("Open");
  const [filterUnit, setFilterUnit]     = useState("");

  // Dialogs
  const [postOpen, setPostOpen]       = useState(false);
  const [editShift, setEditShift]     = useState<OpenShiftDto | null>(null);
  const [reqsShift, setReqsShift]     = useState<OpenShiftDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OpenShiftDto | null>(null);
  const [deleteBusy, setDeleteBusy]   = useState(false);
  const [deleteErr, setDeleteErr]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facility) return;
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (filterRole)   params.role   = filterRole;
      if (filterStatus) params.status = filterStatus;
      if (filterUnit)   params.unitId = filterUnit;
      const data = await listOpenShifts(facility.id, params);
      setShifts(data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Failed to load open shifts.");
    } finally {
      setLoading(false);
    }
  }, [facility, filterRole, filterStatus, filterUnit]);

  useEffect(() => { load(); }, [load]);

  // Load units for facility
  useEffect(() => {
    if (!facility) { setUnits([]); return; }
    listUnits(facility.id).then(setUnits).catch(() => setUnits([]));
  }, [facility]);

  async function handleCancel(shift: OpenShiftDto) {
    try {
      await updateOpenShift(shift.id, { status: "Cancelled" });
      // Switch to "All" so the cancelled shift remains visible instead of disappearing
      if (filterStatus === "Open") setFilterStatus("");
      else load();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Failed to cancel shift.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteErr(null);
    try {
      await deleteOpenShift(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setDeleteErr(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Failed to delete shift.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const unitName = (id?: string | null) =>
    id ? (units.find(u => u.id === id)?.name ?? id) : "—";

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
                  Shift marketplace — post open shifts for staff to request
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              disabled={!facility}
              onClick={() => setPostOpen(true)}
              sx={{
                bgcolor: "#00897b",
                "&:hover": { bgcolor: "#00695c" },
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Post Shift
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Facility + Filters ── */}
      <Card variant="outlined" sx={{ mb: 2, borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
            {facilities.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Facility</InputLabel>
                <Select
                  label="Facility"
                  value={facility?.id ?? ""}
                  onChange={e => setSelectedId(e.target.value)}
                >
                  {facilities.map(f => (
                    <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="Filled">Filled</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Unit</InputLabel>
              <Select label="Unit" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                <MenuItem value="">All Units</MenuItem>
                {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* ── Table ── */}
      <Card variant="outlined" sx={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} sx={{ color: "#4db6ac" }} />
          </Box>
        ) : shifts.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <WorkHistoryIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No open shifts found.</Typography>
            {facility && (
              <Button
                variant="text"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setPostOpen(true)}
                sx={{ mt: 1, color: "#4db6ac" }}
              >
                Post the first shift
              </Button>
            )}
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 12, color: "text.secondary" } }}>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requests</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shifts.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>
                    {dayjs(s.startUtc).format("MMM D, YYYY")}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
                    {dayjs(s.startUtc).format("h:mm a")} – {dayjs(s.endUtc).format("h:mm a")}
                  </TableCell>
                  <TableCell>
                    <Chip label={s.role} size="small" sx={{ fontWeight: 600, fontSize: 11, height: 20 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {unitName(s.unitId)}
                  </TableCell>
                  <TableCell>{statusChip(s.status)}</TableCell>
                  <TableCell>
                    {s.requestCount > 0 ? (
                      <Chip
                        label={`${s.requestCount} pending`}
                        size="small"
                        sx={{ bgcolor: "rgba(245,124,0,0.12)", color: "#f57c00", border: "1px solid rgba(245,124,0,0.3)", fontSize: 11, height: 20 }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: 12, color: "text.disabled" }}>0</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary", maxWidth: 180 }}>
                    <Typography noWrap sx={{ fontSize: 12 }}>{s.notes ?? "—"}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="View Requests">
                        <IconButton
                          size="small"
                          onClick={() => setReqsShift(s)}
                          sx={{ color: "#4db6ac" }}
                        >
                          <PeopleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {s.status !== "Filled" && (
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => setEditShift(s)}
                            sx={{ color: "text.secondary" }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {s.status === "Open" && (
                        <Tooltip title="Cancel Shift">
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(s)}
                            sx={{ color: "warning.main" }}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {s.status !== "Filled" && (
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => { setDeleteTarget(s); setDeleteErr(null); }}
                            sx={{ color: "error.main" }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Post Shift Dialog ── */}
      {facility && (
        <PostShiftDialog
          open={postOpen}
          facilityId={facility.id}
          units={units}
          onClose={() => setPostOpen(false)}
          onCreated={load}
        />
      )}

      {/* ── Edit Shift Dialog ── */}
      <EditShiftDialog
        open={!!editShift}
        shift={editShift}
        units={units}
        onClose={() => setEditShift(null)}
        onSaved={load}
      />

      {/* ── Requests Dialog ── */}
      <RequestsDialog
        open={!!reqsShift}
        shift={reqsShift}
        onClose={() => setReqsShift(null)}
        onReviewed={load}
      />

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Open Shift?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete this {deleteTarget?.role} shift on{" "}
            {deleteTarget ? dayjs(deleteTarget.startUtc).format("MMM D, YYYY h:mm a") : ""}?
            This cannot be undone.
          </Typography>
          {deleteErr && <Alert severity="error" sx={{ mt: 1 }}>{deleteErr}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteBusy}
            startIcon={deleteBusy ? <CircularProgress size={14} /> : undefined}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
