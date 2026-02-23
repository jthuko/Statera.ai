// src/pages/facilities/FacilityAdminPage.tsx
// Per-facility admin panel: Constraints, Coverage, Time Off, Scheduler
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, Container, Tab, Tabs, Typography,
  Stack, Alert, Snackbar, Chip,
  // Constraints
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  IconButton, Tooltip,
  // Coverage
  TextField, MenuItem, Divider, TableSortLabel, FormControl, InputLabel, Select,
  // Time Off
  List, ListItemButton, ListItemText, Dialog, DialogTitle, DialogContent,
  DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { useFacility } from "../../context/facility";
import { useNotifications } from "../../context/NotificationContext";

import {
  ConstraintDto, CreateConstraintRequest, UpdateConstraintRequest,
  listConstraints, createConstraint, updateConstraint, deleteConstraint,
} from "../../api/constraints";
import ConstraintFormDialog from "../../components/constraints/ConstraintFormDialog";

import { listAssignments } from "../../api/assignments";
import { listConstraints as _lc } from "../../api/constraints";
import { listUnits } from "../../api/units";

import {
  listTimeOff, createTimeOff, changeTimeOffStatus, TimeOffRequestDto,
} from "../../api/timeoff";
import { listStaff, StaffDto } from "../../api/staff";
import TimeOffTable from "../../components/timeoff/TimeOffTable";

import { suggestAssignments, Suggestion } from "../../api/endpoints";
import { createAssignment } from "../../api/assignments";
import AssignmentFormDialog, { FormValues } from "../../components/scheduler/AssignmentFormDialog";

import {
  listTimeClockEntries, reviewTimeClockEntry, adjustTimeClockEntry,
  type TimeClockEntryDto,
} from "../../api/timeclock";

// ── Types ─────────────────────────────────────────────────────────────────────
type SortCol = "date" | "unit" | "role" | "required" | "assigned" | "variance";

interface CoverageRow {
  unitId: string; unitName: string; date: string;
  roleId: string; required: number; assigned: number; variance: number;
}

type DialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: ConstraintDto };

const CREDENTIALS = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT", "Other"];
const OFF_TYPES   = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function eachDay(s: string, e: string) {
  const out: string[] = [];
  let d = dayjs(s);
  while (!d.isAfter(dayjs(e))) { out.push(d.format("YYYY-MM-DD")); d = d.add(1, "day"); }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function FacilityAdminPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate = useNavigate();
  const { facilities, setSelectedId } = useFacility();
  const { addNotification } = useNotifications();

  const facility = facilities.find(f => f.id === facilityId) ?? null;

  // Sync facility context so the rest of the app also reflects this selection
  React.useEffect(() => {
    if (facilityId) setSelectedId(facilityId);
  }, [facilityId, setSelectedId]);

  const [tab, setTab] = React.useState(0);
  const [toast, setToast] = React.useState<{ msg: string; sev: "success" | "error" } | null>(null);

  if (!facilityId) return <Alert severity="error">Facility not found.</Alert>;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate("/facilities")} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {facility?.name ?? "Facility Admin"}
          </Typography>
          {facility && (
            <Typography variant="body2" color="text.secondary">
              {facility.city}, {facility.state}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* ── Tabs ── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Constraints" />
        <Tab label="Coverage" />
        <Tab label="Time Off" />
        <Tab label="Scheduler" />
        <Tab label="Time Clock" />
      </Tabs>

      {tab === 0 && <ConstraintsTab facilityId={facilityId} setToast={setToast} />}
      {tab === 1 && <CoverageTab facilityId={facilityId} />}
      {tab === 2 && <TimeOffTab facilityId={facilityId} setToast={setToast} />}
      {tab === 3 && <SchedulerTab facilityId={facilityId} addNotification={addNotification} setToast={setToast} />}
      {tab === 4 && <TimeClockTab facilityId={facilityId} setToast={setToast} />}

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)}>
        <Alert severity={toast?.sev ?? "success"} onClose={() => setToast(null)} sx={{ width: "100%" }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: Constraints
// ═══════════════════════════════════════════════════════════════════════════════
function ConstraintsTab({ facilityId, setToast }: {
  facilityId: string;
  setToast: (t: { msg: string; sev: "success" | "error" } | null) => void;
}) {
  const [rows, setRows]       = React.useState<ConstraintDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [units, setUnits]     = React.useState<{ id: string; name: string }[]>([]);
  const [dialog, setDialog]   = React.useState<DialogState>({ mode: "closed" });

  const reload = React.useCallback(async () => {
    setLoading(true);
    try { setRows(await listConstraints(facilityId)); }
    catch { setToast({ msg: "Failed to load constraints", sev: "error" }); }
    finally { setLoading(false); }
  }, [facilityId]);

  React.useEffect(() => {
    reload();
    listUnits(facilityId).then(u => setUnits(u.map(x => ({ id: x.id, name: x.name })))).catch(() => {});
  }, [facilityId, reload]);

  async function handleCreate(payload: CreateConstraintRequest | UpdateConstraintRequest) {
    try {
      await createConstraint(facilityId, payload as CreateConstraintRequest);
      setToast({ msg: "Constraint created.", sev: "success" });
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? "Failed to create.", sev: "error" });
    }
  }

  async function handleEdit(payload: CreateConstraintRequest | UpdateConstraintRequest) {
    if (dialog.mode !== "edit") return;
    try {
      await updateConstraint(facilityId, dialog.row.id, payload as UpdateConstraintRequest);
      setToast({ msg: "Constraint updated.", sev: "success" });
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? "Failed to update.", sev: "error" });
    }
  }

  async function handleDelete(row: ConstraintDto) {
    if (!confirm(`Delete this ${row.type} constraint?`)) return;
    try {
      await deleteConstraint(facilityId, row.id);
      setToast({ msg: "Deleted.", sev: "success" });
      reload();
    } catch {
      setToast({ msg: "Failed to delete.", sev: "error" });
    }
  }

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ mode: "create" })}>
          New Rule
        </Button>
      </Stack>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Scope</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3 }}><CircularProgress size={20} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">No constraints yet. Click <strong>New Rule</strong> to add one.</Typography>
                </TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.scope}</TableCell>
                  <TableCell>{r.unitId ?? "—"}</TableCell>
                  <TableCell>{r.role ?? "—"}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell><code style={{ fontSize: 12 }}>{r.value}</code></TableCell>
                  <TableCell>
                    <Chip size="small" label={r.isActive ? "Active" : "Inactive"}
                      color={r.isActive ? "success" : "default"} variant={r.isActive ? "filled" : "outlined"} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{r.updatedOn ?? r.createdOn}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton size="small" onClick={() => setDialog({ mode: "edit", row: r })}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(r)}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ConstraintFormDialog
        open={dialog.mode === "create"}
        title="New Constraint" submitLabel="Create"
        units={units} onClose={() => setDialog({ mode: "closed" })} onSubmit={handleCreate}
      />
      {dialog.mode === "edit" && (
        <ConstraintFormDialog
          open title="Edit Constraint" submitLabel="Save"
          units={units} initial={dialog.row}
          onClose={() => setDialog({ mode: "closed" })} onSubmit={handleEdit}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Coverage
// ═══════════════════════════════════════════════════════════════════════════════
function CoverageTab({ facilityId }: { facilityId: string }) {
  const [start, setStart] = React.useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [end, setEnd]     = React.useState(dayjs().endOf("week").format("YYYY-MM-DD"));
  const [unitFilter, setUnitFilter] = React.useState("ALL");
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [search, setSearch]         = React.useState("");
  const [unitOptions, setUnitOptions] = React.useState<{ id: string; name: string }[]>([]);
  const [roleOptions, setRoleOptions] = React.useState<string[]>([]);
  const [rows, setRows]   = React.useState<CoverageRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sortCol, setSortCol] = React.useState<SortCol>("date");
  const [sortAsc, setSortAsc] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [units, constraints, assignments] = await Promise.all([
        listUnits(facilityId),
        listConstraints(facilityId),
        listAssignments(facilityId, { start, end }),
      ]);
      const unitMap: Record<string, string> = {};
      const opts = units.map(u => ({ id: u.id, name: u.name }));
      opts.forEach(u => (unitMap[u.id] = u.name));
      setUnitOptions(opts);

      // Build demand from coverage-type constraints
      const demandMap: Record<string, number> = {};
      const isDemand = (t: string) => ["minstaffperday","minstaffpershift","requiredheadcount"].includes(t.toLowerCase());
      const dates = eachDay(start, end);
      for (const c of constraints) {
        if (!c.isActive || !isDemand(c.type)) continue;
        const tUnits = (c.scope === "Facility") ? opts.map(o => o.id) : (c.unitId ? [c.unitId] : []);
        const tRoles = [(c as any).roleId ?? "*"];
        for (const d of dates) for (const u of tUnits) for (const r of tRoles) {
          const k = `${d}|${u}|${r}`; demandMap[k] = (demandMap[k] ?? 0) + Number((c as any).value ?? 0);
        }
      }

      // Build assigned headcount
      const assignedMap: Record<string, number> = {};
      for (const a of assignments) {
        if (!a.unitId || !a.roleId || !a.start) continue;
        const date = a.start.slice(0, 10);
        if (date < start || date > end) continue;
        const k = `${date}|${a.unitId}|${a.roleId}`; assignedMap[k] = (assignedMap[k] ?? 0) + 1;
      }

      const rolesSeen = new Set<string>();
      Object.keys(demandMap).forEach(k => rolesSeen.add(k.split("|")[2]));
      Object.keys(assignedMap).forEach(k => rolesSeen.add(k.split("|")[2]));
      setRoleOptions([...rolesSeen].sort());

      const selUnits = unitFilter === "ALL" ? opts.map(o => o.id) : [unitFilter];
      const selRoles = roleFilter === "ALL" ? [...rolesSeen] : [roleFilter];
      const out: CoverageRow[] = [];
      for (const d of dates) for (const u of selUnits) for (const r of selRoles) {
        const req = demandMap[`${d}|${u}|${r}`] ?? 0;
        const got = assignedMap[`${d}|${u}|${r}`] ?? 0;
        if (req === 0 && got === 0) continue;
        out.push({ unitId: u, unitName: unitMap[u] ?? "?", date: d, roleId: r, required: req, assigned: got, variance: got - req });
      }
      setRows(out);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [facilityId, start, end, unitFilter, roleFilter]);

  React.useEffect(() => { load(); }, [load]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortHdr({ col, label }: { col: SortCol; label: string }) {
    return <TableSortLabel active={sortCol === col} direction={sortCol === col ? (sortAsc ? "asc" : "desc") : "asc"} onClick={() => toggleSort(col)}>{label}</TableSortLabel>;
  }

  const filtered = rows.filter(r =>
    search === "" || r.unitName.toLowerCase().includes(search.toLowerCase()) || r.roleId.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "date")     cmp = a.date.localeCompare(b.date);
    if (sortCol === "unit")     cmp = a.unitName.localeCompare(b.unitName);
    if (sortCol === "role")     cmp = a.roleId.localeCompare(b.roleId);
    if (sortCol === "required") cmp = a.required - b.required;
    if (sortCol === "assigned") cmp = a.assigned - b.assigned;
    if (sortCol === "variance") cmp = a.variance - b.variance;
    return sortAsc ? cmp : -cmp;
  });

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
          <TextField type="date" label="Start" size="small" value={start} onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="date" label="End"   size="small" value={end}   onChange={e => setEnd(e.target.value)}   InputLabelProps={{ shrink: true }} />
          <TextField select label="Unit" size="small" value={unitFilter} onChange={e => setUnitFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="ALL">All Units</MenuItem>
            {unitOptions.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </TextField>
          <TextField select label="Role" size="small" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="ALL">All Roles</MenuItem>
            {roleOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Search unit or role" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 180 }} />
          <Button variant="contained" onClick={load} disabled={loading}>Refresh</Button>
        </Stack>
      </Paper>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><SortHdr col="date"     label="Date" /></TableCell>
              <TableCell><SortHdr col="unit"     label="Unit" /></TableCell>
              <TableCell><SortHdr col="role"     label="Role" /></TableCell>
              <TableCell align="right"><SortHdr col="required" label="Required" /></TableCell>
              <TableCell align="right"><SortHdr col="assigned" label="Assigned" /></TableCell>
              <TableCell align="right"><SortHdr col="variance" label="Variance" /></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={20} /></TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No data for the selected filters.</Typography>
              </TableCell></TableRow>
            ) : sorted.map((row, i) => {
              const color = row.variance < 0 ? "error.main" : row.variance === 0 ? "warning.main" : "success.main";
              return (
                <TableRow key={i} hover>
                  <TableCell>{dayjs(row.date).format("ddd, MMM D")}</TableCell>
                  <TableCell>{row.unitName}</TableCell>
                  <TableCell>{row.roleId}</TableCell>
                  <TableCell align="right">{row.required}</TableCell>
                  <TableCell align="right">{row.assigned}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={row.variance < 0 ? "Under-staffed" : row.variance > 0 ? "Over-staffed" : "On target"}>
                      <Typography component="span" sx={{ color, fontWeight: 700 }}>
                        {row.variance > 0 ? `+${row.variance}` : `${row.variance}`}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3: Time Off
// ═══════════════════════════════════════════════════════════════════════════════
function TimeOffTab({ facilityId, setToast }: {
  facilityId: string;
  setToast: (t: { msg: string; sev: "success" | "error" } | null) => void;
}) {
  const [staff, setStaff]           = React.useState<StaffDto[]>([]);
  const [staffSearch, setStaffSearch] = React.useState("");
  const [staffLoading, setStaffLoading] = React.useState(false);
  const [selected, setSelected]     = React.useState<StaffDto | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setStaffLoading(true);
    listStaff(facilityId).then(setStaff).catch(() => setStaff([])).finally(() => setStaffLoading(false));
  }, [facilityId]);

  async function handleAssign(staffId: string, start: Dayjs, end: Dayjs, type: string) {
    const res = await createTimeOff({ staffId, type, startUtc: start.toISOString(), endUtc: end.toISOString(), reason: "Admin-assigned off days" });
    await changeTimeOffStatus(res.id, "Approved");
    setRefreshKey(k => k + 1);
    setToast({ msg: "Off days assigned and approved.", sev: "success" });
  }

  const filtered = staff.filter(s =>
    staffSearch === "" || `${s.firstName} ${s.lastName}`.toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      {/* Staff list */}
      <Paper variant="outlined" sx={{ width: { md: 260 }, flexShrink: 0 }}>
        <Box sx={{ p: 1.5 }}>
          <TextField size="small" fullWidth placeholder="Search staff…" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
        </Box>
        <Divider />
        {staffLoading ? (
          <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map(s => (
              <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => setSelected(s)}>
                <ListItemText primary={`${s.firstName} ${s.lastName}`} secondary={s.role ?? undefined} />
              </ListItemButton>
            ))}
            {filtered.length === 0 && (
              <Box sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">No staff found.</Typography></Box>
            )}
          </List>
        )}
      </Paper>

      {/* Right panel */}
      <Box sx={{ flex: 1 }}>
        {selected ? (
          <>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Typography variant="h6">{selected.firstName} {selected.lastName}</Typography>
              {selected.role && <Chip label={selected.role} size="small" />}
              <Box sx={{ flexGrow: 1 }} />
              <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setAssignOpen(true)}>
                Assign Off Days
              </Button>
            </Stack>
            <TimeOffTable key={`${refreshKey}-${selected.id}`} facilityId={facilityId} staffId={selected.id} />
          </>
        ) : (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">Select a staff member from the list to view or assign their off days.</Typography>
          </Box>
        )}
      </Box>

      <AssignOffDaysDialog open={assignOpen} staff={selected} onClose={() => setAssignOpen(false)} onSave={handleAssign} />
    </Stack>
  );
}

// ── Assign Off Days Dialog (reused from timeoff page) ────────────────────────
function AssignOffDaysDialog({ open, staff, onClose, onSave }: {
  open: boolean; staff: StaffDto | null; onClose: () => void;
  onSave: (staffId: string, start: Dayjs, end: Dayjs, type: string) => Promise<void>;
}) {
  const [start, setStart] = React.useState<Dayjs | null>(dayjs());
  const [end, setEnd]     = React.useState<Dayjs | null>(dayjs());
  const [type, setType]   = React.useState("Vacation");
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) { setStart(dayjs()); setEnd(dayjs()); setType("Vacation"); setErr(null); }
  }, [open]);

  async function handleSave() {
    if (!staff || !start || !end) return;
    setBusy(true); setErr(null);
    try { await onSave(staff.id, start.startOf("day"), end.endOf("day"), type); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.detail ?? "Failed to assign off days."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Off Days — {staff ? `${staff.firstName} ${staff.lastName}` : ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <DatePicker label="Start date" value={start} onChange={d => setStart(d)} />
          <DatePicker label="End date"   value={end}   onChange={d => setEnd(d)} minDate={start ?? undefined} />
          <TextField select label="Type" value={type} onChange={e => setType(e.target.value)}>
            {OFF_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          {err && <Typography color="error" variant="body2">{err}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!start || !end || end.isBefore(start) || busy}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Assign & Approve"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4: Scheduler
// ═══════════════════════════════════════════════════════════════════════════════
type SchedulerRow = { staffId: string; name: string; role?: string | null; score: number; reasoning: string; accepted?: boolean };

function SchedulerTab({ facilityId, addNotification, setToast }: {
  facilityId: string;
  addNotification: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
  setToast: (t: { msg: string; sev: "success" | "error" } | null) => void;
}) {
  const [units, setUnits]     = React.useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId]   = React.useState("");
  const [cred, setCred]       = React.useState("RN");
  const [startDt, setStartDt] = React.useState(dayjs().startOf("day").add(7, "hour").format("YYYY-MM-DDTHH:mm"));
  const [endDt, setEndDt]     = React.useState(dayjs().startOf("day").add(15, "hour").format("YYYY-MM-DDTHH:mm"));
  const [rows, setRows]       = React.useState<SchedulerRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError]     = React.useState<string | null>(null);
  const [orderBy, setOrderBy] = React.useState<"score" | "name">("score");
  const [orderDesc, setOrderDesc] = React.useState(true);

  const [dialogOpen, setDialogOpen]     = React.useState(false);
  const [dialogInitial, setDialogInitial] = React.useState<FormValues | null>(null);
  const [pendingRow, setPendingRow]     = React.useState<SchedulerRow | null>(null);

  React.useEffect(() => {
    listUnits(facilityId).then(u => setUnits(u.map(x => ({ id: x.id, name: x.name })))).catch(() => {});
  }, [facilityId]);

  async function run() {
    setLoading(true); setError(null); setRows([]);
    try {
      const startUtc = dayjs(startDt).toISOString();
      const endUtc   = dayjs(endDt).toISOString();
      const [suggestions, staffList] = await Promise.all([
        suggestAssignments({ startUtc, endUtc, unitId: unitId || "", requiredCredential: cred, facilityId }),
        listStaff(facilityId),
      ]);
      const staffMap = new Map(staffList.map(s => [s.id, s]));
      setRows(suggestions.map((s: Suggestion) => {
        const d = staffMap.get(s.staffId);
        return { staffId: s.staffId, name: d ? `${d.firstName} ${d.lastName}` : s.staffId, role: d?.role ?? null, score: s.score, reasoning: s.reasoning ?? "", accepted: false };
      }));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Request failed");
    } finally { setLoading(false); }
  }

  function openAccept(row: SchedulerRow) {
    setDialogInitial({ unitId, staffId: row.staffId, roleId: row.role ?? cred, start: dayjs(startDt).toISOString(), end: dayjs(endDt).toISOString(), notes: `Auto-assigned via scheduler (score ${row.score.toFixed(0)})` });
    setPendingRow(row);
    setDialogOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    if (!pendingRow) return;
    try {
      await createAssignment(facilityId, { staffId: values.staffId, roleId: values.roleId, unitId: values.unitId || undefined, start: values.start, end: values.end, notes: values.notes ?? undefined });
      setRows(prev => prev.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r));
      setToast({ msg: `Assignment created for ${pendingRow.name}`, sev: "success" });
      addNotification(`Assignment created for ${pendingRow.name} (${values.roleId})`, "success");
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to create assignment");
    } finally {
      setDialogOpen(false); setPendingRow(null); setDialogInitial(null);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = orderDesc ? -1 : 1;
    return orderBy === "score" ? dir * (b.score - a.score) : dir * a.name.localeCompare(b.name);
  });

  function toggleSort(col: "score" | "name") {
    if (orderBy === col) setOrderDesc(d => !d); else { setOrderBy(col); setOrderDesc(col === "score"); }
  }

  const scoreColor = (s: number): "success" | "warning" | "error" => s >= 70 ? "success" : s >= 40 ? "warning" : "error";

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Unit</InputLabel>
            <Select label="Unit" value={unitId} onChange={e => setUnitId(String(e.target.value))} disabled={units.length === 0}>
              <MenuItem value="">(Any)</MenuItem>
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Credential</InputLabel>
            <Select label="Credential" value={cred} onChange={e => setCred(e.target.value)}>
              {CREDENTIALS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Shift start" type="datetime-local" value={startDt} onChange={e => setStartDt(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 190 }} />
          <TextField size="small" label="Shift end"   type="datetime-local" value={endDt}   onChange={e => setEndDt(e.target.value)}   InputLabelProps={{ shrink: true }} sx={{ minWidth: 190 }} />
          <Button variant="contained" onClick={run} disabled={loading} sx={{ height: 40 }}>
            {loading ? <CircularProgress size={20} color="inherit" /> : "Suggest"}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {rows.length === 0 && !loading && !error && (
        <Typography color="text.secondary">No suggestions yet — configure the shift above and click Suggest.</Typography>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel active={orderBy === "name"} direction={orderDesc ? "desc" : "asc"} onClick={() => toggleSort("name")}>Name</TableSortLabel>
                </TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="center">
                  <TableSortLabel active={orderBy === "score"} direction={orderDesc ? "desc" : "asc"} onClick={() => toggleSort("score")}>Score</TableSortLabel>
                </TableCell>
                <TableCell>Reasoning</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(r => (
                <TableRow key={r.staffId} sx={{ opacity: r.accepted ? 0.55 : 1 }}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell><Chip label={r.role ?? "—"} size="small" variant="outlined" /></TableCell>
                  <TableCell align="center"><Chip label={r.score.toFixed(0)} size="small" color={scoreColor(r.score)} /></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{r.reasoning}</Typography></TableCell>
                  <TableCell align="center">
                    {r.accepted ? (
                      <Tooltip title="Assignment created"><CheckCircleOutlineIcon color="success" fontSize="small" /></Tooltip>
                    ) : (
                      <Button size="small" variant="contained" color="primary" onClick={() => openAccept(r)}>Accept</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {dialogInitial && (
        <AssignmentFormDialog
          open={dialogOpen} title="Confirm Assignment"
          initial={dialogInitial}
          units={units.map(u => ({ id: u.id, name: u.name }))}
          roles={CREDENTIALS.map(c => ({ id: c, name: c }))}
          staff={rows.map(r => ({ id: r.staffId, label: r.name, role: r.role ?? undefined }))}
          onCancel={() => { setDialogOpen(false); setPendingRow(null); setDialogInitial(null); }}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5: Time Clock (Admin review)
// ═══════════════════════════════════════════════════════════════════════════════
const TC_STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  ClockedIn: "warning", ClockedOut: "default", Approved: "success", Denied: "error", Adjusted: "success",
};

function TimeClockTab({ facilityId, setToast }: {
  facilityId: string;
  setToast: (t: { msg: string; sev: "success" | "error" } | null) => void;
}) {
  const [entries, setEntries] = React.useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [reviewing, setReviewing] = React.useState<TimeClockEntryDto | null>(null);
  const [reviewNote, setReviewNote] = React.useState("");
  const [adjIn, setAdjIn] = React.useState("");
  const [adjOut, setAdjOut] = React.useState("");
  const [reviewMode, setReviewMode] = React.useState<"Approve" | "Deny" | "Adjust">("Approve");
  const [reviewBusy, setReviewBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTimeClockEntries({
        facilityId,
        status: statusFilter === "All" ? undefined : statusFilter,
        page: 1,
        pageSize: 100,
      });
      setEntries(res.items);
    } catch {
      setToast({ msg: "Failed to load time clock entries.", sev: "error" });
    } finally {
      setLoading(false);
    }
  }, [facilityId, statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  function openReview(entry: TimeClockEntryDto, mode: "Approve" | "Deny" | "Adjust") {
    setReviewing(entry);
    setReviewMode(mode);
    setReviewNote("");
    setAdjIn(entry.clockInUtc ? dayjs(entry.clockInUtc).format("YYYY-MM-DDTHH:mm") : "");
    setAdjOut(entry.clockOutUtc ? dayjs(entry.clockOutUtc).format("YYYY-MM-DDTHH:mm") : "");
  }

  async function handleReview() {
    if (!reviewing) return;
    setReviewBusy(true);
    try {
      if (reviewMode === "Adjust") {
        await adjustTimeClockEntry(reviewing.id, {
          clockInUtc: dayjs(adjIn).toISOString(),
          clockOutUtc: adjOut ? dayjs(adjOut).toISOString() : undefined,
          adminNotes: reviewNote || undefined,
        });
        setToast({ msg: "Entry adjusted.", sev: "success" });
      } else {
        await reviewTimeClockEntry(
          reviewing.id,
          reviewMode as "Approved" | "Denied",
          reviewNote || undefined,
        );
        setToast({ msg: reviewMode === "Approve" ? "Entry approved." : "Entry denied.", sev: "success" });
      }
      setReviewing(null);
      load();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? "Failed.", sev: "error" });
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          select size="small" label="Status" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}
        >
          {["All", "ClockedIn", "ClockedOut", "Approved", "Denied", "Adjusted"].map(s => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" size="small" onClick={load} disabled={loading}>Refresh</Button>
      </Stack>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Staff</TableCell>
                <TableCell>Clock In</TableCell>
                <TableCell>Clock Out</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Admin Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}><CircularProgress size={20} /></TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">No entries found.</Typography>
                </TableCell></TableRow>
              ) : entries.map(e => {
                const hrs = e.clockOutUtc
                  ? (dayjs(e.clockOutUtc).diff(dayjs(e.clockInUtc), "minute") / 60).toFixed(2)
                  : "—";
                return (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.staffName ?? e.staffId.slice(0, 8)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{dayjs(e.clockInUtc).format("MMM D, h:mm a")}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{e.clockOutUtc ? dayjs(e.clockOutUtc).format("MMM D, h:mm a") : "—"}</TableCell>
                    <TableCell align="right">{hrs}</TableCell>
                    <TableCell>
                      <Chip size="small" label={e.status} color={TC_STATUS_COLOR[e.status] ?? "default"} />
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{e.adminNotes ?? "—"}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {e.status !== "Approved" && (
                          <Button size="small" variant="contained" color="success" sx={{ minWidth: 70 }}
                            onClick={() => openReview(e, "Approve")}>Approve</Button>
                        )}
                        {e.status !== "Denied" && (
                          <Button size="small" variant="outlined" color="error" sx={{ minWidth: 60 }}
                            onClick={() => openReview(e, "Deny")}>Deny</Button>
                        )}
                        <Button size="small" variant="outlined" onClick={() => openReview(e, "Adjust")}>Adjust</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Review / Adjust dialog */}
      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewMode === "Approve" ? "Approve Entry" : reviewMode === "Deny" ? "Deny Entry" : "Adjust Entry"}
          {reviewing && ` — ${reviewing.staffName ?? ""}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {reviewMode === "Adjust" && (
              <>
                <TextField
                  size="small" label="Clock In" type="datetime-local"
                  value={adjIn} onChange={e => setAdjIn(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  size="small" label="Clock Out" type="datetime-local"
                  value={adjOut} onChange={e => setAdjOut(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}
            <TextField
              size="small" label="Note to staff (optional)" value={reviewNote}
              onChange={e => setReviewNote(e.target.value)} multiline rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)} disabled={reviewBusy}>Cancel</Button>
          <Button
            variant="contained"
            color={reviewMode === "Deny" ? "error" : "primary"}
            onClick={handleReview}
            disabled={reviewBusy}
          >
            {reviewBusy ? <CircularProgress size={18} color="inherit" /> : reviewMode}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
