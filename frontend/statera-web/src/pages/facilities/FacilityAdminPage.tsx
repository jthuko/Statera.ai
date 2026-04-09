// src/pages/facilities/FacilityAdminPage.tsx
// Per-facility admin panel: Constraints, Coverage, Time Off, Scheduler, Time Clock
import * as React from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, List, ListItemButton, ListItemText,
  MenuItem, Select, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RuleIcon from "@mui/icons-material/Rule";
import BarChartIcon from "@mui/icons-material/BarChart";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SearchIcon from "@mui/icons-material/Search";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import LinkIcon from "@mui/icons-material/Link";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HiringPage from "../hiring";
import OnboardingPage from "../onboarding";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { useFacility } from "../../context/facility";
import { useNotifications } from "../../context/NotificationContext";
import { useUpdateBranding } from "../../api/facilities";

import {
  ConstraintDto, CreateConstraintRequest, UpdateConstraintRequest,
  listConstraints, createConstraint, updateConstraint, deleteConstraint,
} from "../../api/constraints";
import ConstraintFormDialog from "../../components/constraints/ConstraintFormDialog";
import ConstraintsTable from "../../components/constraints/ConstraintsTable";

import { listAssignments } from "../../api/assignments";
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
import {
  listFacilityIntegrations,
  connectFacilityIntegration,
  disconnectFacilityIntegration,
  type FacilityIntegrationStatus,
  type IntegrationProvider,
} from "../../api/integrations";
import { getClockedInCount } from "../../api/timeclock";

// ── Types ─────────────────────────────────────────────────────────────────────
type SortCol = "date" | "unit" | "role" | "required" | "assigned" | "variance";

interface CoverageRow {
  unitId: string; unitName: string; date: string;
  roleId: string; required: number; assigned: number; variance: number;
}

type DialogState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: ConstraintDto };

const CREDENTIALS = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT", "Other"];
const OFF_TYPES   = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

function eachDay(s: string, e: string) {
  const out: string[] = [];
  let d = dayjs(s);
  while (!d.isAfter(dayjs(e))) { out.push(d.format("YYYY-MM-DD")); d = d.add(1, "day"); }
  return out;
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ── Tab icon map ──────────────────────────────────────────────────────────────
const TAB_ICONS = [
  <RuleIcon fontSize="small" />,
  <BarChartIcon fontSize="small" />,
  <BeachAccessIcon fontSize="small" />,
  <AutoFixHighIcon fontSize="small" />,
  <AccessTimeIcon fontSize="small" />,
  <LinkIcon fontSize="small" />,
  <PaletteIcon fontSize="small" />,
  <PersonSearchIcon fontSize="small" />,
  <HowToRegIcon fontSize="small" />,
];
const TAB_LABELS = ["Constraints", "Coverage", "Time Off", "Scheduler", "Time Clock", "Integrations", "Branding", "Hiring", "Onboarding"];

// ═══════════════════════════════════════════════════════════════════════════════
export default function FacilityAdminPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { facilities, setSelectedId } = useFacility();
  const { addNotification } = useNotifications();

  const facility = facilities.find(f => f.id === facilityId) ?? null;

  React.useEffect(() => {
    if (facilityId) setSelectedId(facilityId);
  }, [facilityId, setSelectedId]);

  const [tab, setTab]   = React.useState(() => {
    const params = new URLSearchParams(location.search);
    const target = params.get("tab")?.toLowerCase();
    if (!target) return 0;
    const idx = TAB_LABELS.findIndex(t => t.toLowerCase() === target);
    return idx >= 0 ? idx : 0;
  });
  const [toast, setToast] = React.useState<{ msg: string; sev: "success" | "error" } | null>(null);
  // Mount scheduler once so its results survive tab switches
  const [schedulerMounted, setSchedulerMounted] = React.useState(false);
  React.useEffect(() => { if (tab === 3) setSchedulerMounted(true); }, [tab]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const target = params.get("tab")?.toLowerCase();
    if (!target) return;
    const idx = TAB_LABELS.findIndex(t => t.toLowerCase() === target);
    if (idx >= 0 && idx !== tab) setTab(idx);
  }, [location.search, tab]);

  const [clockedInCount, setClockedInCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!facilityId) return;
    getClockedInCount(facilityId).then(setClockedInCount).catch(() => setClockedInCount(null));
  }, [facilityId]);

  if (!facilityId) return <Alert severity="error">Facility not found.</Alert>;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>

      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2.5,
        background: "linear-gradient(90deg, rgba(0,77,77,0.45) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.3)",
      }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={() => navigate("/app/facilities")} size="small"
              sx={{ border: "1px solid rgba(255,255,255,0.12)", "&:hover": { bgcolor: "rgba(255,255,255,0.06)" } }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                {facility?.name ?? "Facility Admin"}
              </Typography>
              {facility && (
                <Typography variant="caption" color="text.secondary">
                  {facility.city}, {facility.state} &nbsp;·&nbsp; Admin Panel
                </Typography>
              )}
            </Box>
            {clockedInCount !== null && (
              <Chip
                label={`Clocked in: ${clockedInCount}`}
                icon={<AccessTimeIcon fontSize="small" />}
                size="small"
                sx={{ bgcolor: "rgba(0,137,123,0.15)", color: "#00897b", border: "1px solid #00897b", fontWeight: 600 }}
              />
            )}
            <Chip
              label={TAB_LABELS[tab]}
              icon={TAB_ICONS[tab]}
              size="small"
              sx={{
                bgcolor: "rgba(0,77,77,0.4)", color: "#4db6ac",
                border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600,
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          {TAB_LABELS.map((label, i) => (
            <Tab key={label} label={label} icon={TAB_ICONS[i]} iconPosition="start"
              sx={{ minHeight: 48, fontSize: 13 }} />
          ))}
        </Tabs>
      </Box>

      {tab === 0 && <ConstraintsTab facilityId={facilityId} setToast={setToast} />}
      {tab === 1 && <CoverageTab facilityId={facilityId} />}
      {tab === 2 && <TimeOffTab facilityId={facilityId} setToast={setToast} />}
      {/* Keep SchedulerTab mounted once visited so results survive tab switches */}
      {schedulerMounted && (
        <Box sx={{ display: tab === 3 ? "block" : "none" }}>
          <SchedulerTab facilityId={facilityId} addNotification={addNotification} setToast={setToast} />
        </Box>
      )}
      {tab === 4 && <TimeClockTab facilityId={facilityId} setToast={setToast} />}
      {tab === 5 && <IntegrationsTab facilityId={facilityId} setToast={setToast} />}
      {tab === 6 && <BrandingTab facilityId={facilityId} facility={facility} setToast={setToast} />}
      {tab === 7 && <HiringPage />}
      {tab === 8 && <OnboardingPage />}

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
      setToast({ msg: "Constraint created.", sev: "success" }); reload();
    } catch (e: any) { setToast({ msg: e?.response?.data?.detail ?? "Failed to create.", sev: "error" }); }
  }

  async function handleEdit(payload: CreateConstraintRequest | UpdateConstraintRequest) {
    if (dialog.mode !== "edit") return;
    try {
      await updateConstraint(facilityId, dialog.row.id, payload as UpdateConstraintRequest);
      setToast({ msg: "Constraint updated.", sev: "success" }); reload();
    } catch (e: any) { setToast({ msg: e?.response?.data?.detail ?? "Failed to update.", sev: "error" }); }
  }

  async function handleDelete(row: ConstraintDto) {
    if (!confirm(`Delete this ${row.type} constraint?`)) return;
    try {
      await deleteConstraint(facilityId, row.id);
      setToast({ msg: "Deleted.", sev: "success" }); reload();
    } catch { setToast({ msg: "Failed to delete.", sev: "error" }); }
  }

  const activeCount = rows.filter(r => r.isActive).length;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1}>
          {!loading && rows.length > 0 && (
            <>
              <Chip label={`${activeCount} active`} size="small" color="success" variant="outlined" />
              <Chip label={`${rows.length - activeCount} inactive`} size="small" variant="outlined"
                sx={{ borderColor: "rgba(255,255,255,0.15)" }} />
            </>
          )}
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ mode: "create" })}>
          New Rule
        </Button>
      </Stack>

      <ConstraintsTable
        loading={loading}
        rows={rows}
        units={units}
        onEdit={r => setDialog({ mode: "edit", row: r })}
        onDelete={handleDelete}
      />

      <ConstraintFormDialog
        open={dialog.mode === "create"} title="New Constraint" submitLabel="Create"
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
  const [start, setStart]       = React.useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [end, setEnd]           = React.useState(dayjs().endOf("week").format("YYYY-MM-DD"));
  const [unitFilter, setUnitFilter] = React.useState("ALL");
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [search, setSearch]     = React.useState("");
  const [unitOptions, setUnitOptions] = React.useState<{ id: string; name: string }[]>([]);
  const [roleOptions, setRoleOptions] = React.useState<string[]>([]);
  const [rows, setRows]         = React.useState<CoverageRow[]>([]);
  const [loading, setLoading]   = React.useState(false);
  const [sortCol, setSortCol]   = React.useState<SortCol>("date");
  const [sortAsc, setSortAsc]   = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [units, constraints, assignments] = await Promise.all([
        listUnits(facilityId), listConstraints(facilityId),
        listAssignments(facilityId, { start, end }),
      ]);
      const unitMap: Record<string, string> = {};
      const opts = units.map(u => ({ id: u.id, name: u.name }));
      opts.forEach(u => (unitMap[u.id] = u.name));
      setUnitOptions(opts);

      const demandMap: Record<string, number> = {};
      const isDemand = (t: string) => ["minstaffperday","minstaffpershift","requiredheadcount"].includes(t.toLowerCase());
      const dates = eachDay(start, end);
      for (const c of constraints) {
        if (!c.isActive || !isDemand(c.type)) continue;
        const tUnits = c.scope === "Facility" ? opts.map(o => o.id) : c.unitId ? [c.unitId] : [];
        const tRoles = [(c as any).roleId ?? "*"];
        for (const d of dates) for (const u of tUnits) for (const r of tRoles) {
          const k = `${d}|${u}|${r}`; demandMap[k] = (demandMap[k] ?? 0) + Number((c as any).value ?? 0);
        }
      }

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
    if (sortCol === col) setSortAsc(a => !a); else { setSortCol(col); setSortAsc(true); }
  }

  function SortHdr({ col, label }: { col: SortCol; label: string }) {
    return <TableSortLabel active={sortCol === col} direction={sortCol === col ? (sortAsc ? "asc" : "desc") : "asc"} onClick={() => toggleSort(col)}>{label}</TableSortLabel>;
  }

  const filtered = rows.filter(r => search === "" || r.unitName.toLowerCase().includes(search.toLowerCase()) || r.roleId.toLowerCase().includes(search.toLowerCase()));
  const sorted   = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "date")     cmp = a.date.localeCompare(b.date);
    if (sortCol === "unit")     cmp = a.unitName.localeCompare(b.unitName);
    if (sortCol === "role")     cmp = a.roleId.localeCompare(b.roleId);
    if (sortCol === "required") cmp = a.required - b.required;
    if (sortCol === "assigned") cmp = a.assigned - b.assigned;
    if (sortCol === "variance") cmp = a.variance - b.variance;
    return sortAsc ? cmp : -cmp;
  });

  const underCount = sorted.filter(r => r.variance < 0).length;
  const overCount  = sorted.filter(r => r.variance > 0).length;

  return (
    <>
      {/* Summary chips */}
      {!loading && sorted.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
          {underCount > 0 && <Chip label={`${underCount} under-staffed`} size="small" color="error" variant="outlined" />}
          {overCount > 0  && <Chip label={`${overCount} over-staffed`}  size="small" color="success" variant="outlined" />}
          <Chip label={`${sorted.length - underCount - overCount} on target`} size="small" color="warning" variant="outlined" />
        </Stack>
      )}

      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" alignItems="center">
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
            <TextField size="small" label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 160 }}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} /> }} />
            <Button variant="outlined" size="small" onClick={load} disabled={loading}>Refresh</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ "& th": { bgcolor: "rgba(0,77,77,0.2)", fontWeight: 700 } }}>
                <TableCell><SortHdr col="date"     label="Date" /></TableCell>
                <TableCell><SortHdr col="unit"     label="Unit" /></TableCell>
                <TableCell><SortHdr col="role"     label="Role" /></TableCell>
                <TableCell align="right"><SortHdr col="required" label="Req." /></TableCell>
                <TableCell align="right"><SortHdr col="assigned" label="Asgn." /></TableCell>
                <TableCell align="center"><SortHdr col="variance" label="Variance" /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={24} sx={{ color: "#4db6ac" }} />
                </TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">No coverage data for the selected filters.</Typography>
                </TableCell></TableRow>
              ) : sorted.map((row, i) => {
                const varColor = row.variance < 0 ? "error" : row.variance > 0 ? "success" : "warning";
                return (
                  <TableRow key={i} hover sx={{
                    borderLeft: row.variance < 0 ? "3px solid #c62828" : row.variance > 0 ? "3px solid #2e7d32" : "3px solid #e65100",
                  }}>
                    <TableCell sx={{ fontWeight: 500 }}>{dayjs(row.date).format("ddd, MMM D")}</TableCell>
                    <TableCell>{row.unitName}</TableCell>
                    <TableCell>
                      <Chip label={row.roleId} size="small" variant="outlined"
                        sx={{ fontSize: 11, height: 20, borderColor: "rgba(255,255,255,0.15)" }} />
                    </TableCell>
                    <TableCell align="right">{row.required}</TableCell>
                    <TableCell align="right">{row.assigned}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={row.variance < 0 ? "Under-staffed" : row.variance > 0 ? "Over-staffed" : "On target"}>
                        <Chip
                          label={row.variance > 0 ? `+${row.variance}` : `${row.variance}`}
                          size="small" color={varColor}
                          sx={{ fontWeight: 700, minWidth: 40 }}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Card>
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
      <Card variant="outlined" sx={{ width: { md: 270 }, flexShrink: 0, borderColor: "rgba(255,255,255,0.06)" }}>
        <Box sx={{ p: 1.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <TextField size="small" fullWidth placeholder="Search staff…"
            value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} /> }}
          />
        </Box>
        {staffLoading ? (
          <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} sx={{ color: "#4db6ac" }} /></Box>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map(s => (
              <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => setSelected(s)}
                sx={{
                  py: 1, px: 1.5,
                  "&.Mui-selected": { bgcolor: "rgba(0,137,123,0.15)", borderLeft: "3px solid #4db6ac" },
                  "&.Mui-selected:hover": { bgcolor: "rgba(0,137,123,0.2)" },
                }}>
                <Avatar sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 700, mr: 1.5, flexShrink: 0,
                  bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.3)" }}>
                  {getInitials(`${s.firstName} ${s.lastName}`)}
                </Avatar>
                <ListItemText primary={`${s.firstName} ${s.lastName}`} secondary={s.role ?? undefined}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: selected?.id === s.id ? 600 : 400 }}
                  secondaryTypographyProps={{ fontSize: 11 }} />
              </ListItemButton>
            ))}
            {filtered.length === 0 && (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">No staff found.</Typography>
              </Box>
            )}
          </List>
        )}
      </Card>

      {/* Right panel */}
      <Box sx={{ flex: 1 }}>
        {selected ? (
          <>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Avatar sx={{ width: 38, height: 38, fontSize: 14, fontWeight: 700,
                bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.3)" }}>
                {getInitials(`${selected.firstName} ${selected.lastName}`)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={600}>{selected.firstName} {selected.lastName}</Typography>
                {selected.role && <Chip label={selected.role} size="small" sx={{ height: 18, fontSize: 11, mt: 0.25 }} />}
              </Box>
              <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setAssignOpen(true)}>
                Assign Off Days
              </Button>
            </Stack>
            <TimeOffTable key={`${refreshKey}-${selected.id}`} facilityId={facilityId} staffId={selected.id} />
          </>
        ) : (
          <Box sx={{ textAlign: "center", py: 8, border: "2px dashed", borderColor: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <EventBusyIcon sx={{ fontSize: 40, color: "text.disabled", opacity: 0.3, mb: 1 }} />
            <Typography color="text.secondary" fontWeight={500}>No staff selected</Typography>
            <Typography variant="caption" color="text.disabled">Select a staff member from the list</Typography>
          </Box>
        )}
      </Box>

      <AssignOffDaysDialog open={assignOpen} staff={selected} onClose={() => setAssignOpen(false)} onSave={handleAssign} />
    </Stack>
  );
}

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
    catch (e: any) { setErr(e?.response?.data?.detail ?? "Failed."); }
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
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!start || !end || (end?.isBefore(start) ?? false) || busy}>
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
      const [suggestions, staffList] = await Promise.all([
        suggestAssignments({ startUtc: dayjs(startDt).toISOString(), endUtc: dayjs(endDt).toISOString(), unitId: unitId || "", requiredCredential: cred, facilityId }),
        listStaff(facilityId),
      ]);
      const staffMap = new Map(staffList.map(s => [s.id, s]));
      setRows(suggestions.map((s: Suggestion) => {
        const d = staffMap.get(s.staffId);
        return { staffId: s.staffId, name: d ? `${d.firstName} ${d.lastName}` : s.staffId, role: d?.role ?? null, score: s.score, reasoning: s.reasoning ?? "", accepted: false };
      }));
    } catch (e: any) { setError(e?.response?.data?.error ?? e?.message ?? "Request failed"); }
    finally { setLoading(false); }
  }

  function openAccept(row: SchedulerRow) {
    setDialogInitial({ unitId, staffId: row.staffId, roleId: row.role ?? cred, start: dayjs(startDt).toISOString(), end: dayjs(endDt).toISOString(), notes: `Auto-assigned via scheduler (score ${row.score.toFixed(0)})` });
    setPendingRow(row); setDialogOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    if (!pendingRow) return;
    try {
      await createAssignment(facilityId, { staffId: values.staffId, roleId: values.roleId, unitId: values.unitId || undefined, start: values.start, end: values.end, notes: values.notes ?? undefined });
      setRows(prev => prev.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r));
      setToast({ msg: `Assignment created for ${pendingRow.name}`, sev: "success" });
      addNotification(`Assignment created for ${pendingRow.name} (${values.roleId})`, "success");
    } catch (e: any) { setError(e?.response?.data?.error ?? e?.message ?? "Failed to create assignment"); }
    finally { setDialogOpen(false); setPendingRow(null); setDialogInitial(null); }
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
      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" alignItems="flex-end">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Unit</InputLabel>
              <Select label="Unit" value={unitId} onChange={e => setUnitId(String(e.target.value))} disabled={units.length === 0}>
                <MenuItem value="">(Any)</MenuItem>
                {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Credential</InputLabel>
              <Select label="Credential" value={cred} onChange={e => setCred(e.target.value)}>
                {CREDENTIALS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Shift start" type="datetime-local" value={startDt}
              onChange={e => setStartDt(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 190 }} />
            <TextField size="small" label="Shift end"   type="datetime-local" value={endDt}
              onChange={e => setEndDt(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 190 }} />
            <Button variant="contained" onClick={run} disabled={loading} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}>
              {loading ? "Thinking…" : "Suggest"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {rows.length === 0 && !loading && !error && (
        <Box sx={{ textAlign: "center", py: 6, border: "2px dashed", borderColor: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
          <AutoFixHighIcon sx={{ fontSize: 40, color: "text.disabled", opacity: 0.3, mb: 1, display: "block", mx: "auto" }} />
          <Typography color="text.secondary">Configure the shift above and click Suggest</Typography>
        </Box>
      )}

      {rows.length > 0 && (
        <Card variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { bgcolor: "rgba(0,77,77,0.2)", fontWeight: 700 } }}>
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
                <TableRow key={r.staffId} sx={{ opacity: r.accepted ? 0.5 : 1, "&:hover": { bgcolor: "rgba(0,137,123,0.04)" } }}>
                  <TableCell fontWeight={500}>{r.name}</TableCell>
                  <TableCell><Chip label={r.role ?? "—"} size="small" variant="outlined" sx={{ fontSize: 11 }} /></TableCell>
                  <TableCell align="center"><Chip label={r.score.toFixed(0)} size="small" color={scoreColor(r.score)} sx={{ fontWeight: 700 }} /></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{r.reasoning}</Typography></TableCell>
                  <TableCell align="center">
                    {r.accepted ? (
                      <Tooltip title="Assignment created"><CheckCircleOutlineIcon color="success" fontSize="small" /></Tooltip>
                    ) : (
                      <Button size="small" variant="contained" onClick={() => openAccept(r)}>Accept</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {dialogInitial && (
        <AssignmentFormDialog
          open={dialogOpen} title="Confirm Assignment" initial={dialogInitial}
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
  const [entries, setEntries]       = React.useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading]       = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [reviewing, setReviewing]   = React.useState<TimeClockEntryDto | null>(null);
  const [reviewNote, setReviewNote] = React.useState("");
  const [adjIn, setAdjIn]           = React.useState("");
  const [adjOut, setAdjOut]         = React.useState("");
  const [reviewMode, setReviewMode] = React.useState<"Approve" | "Deny" | "Adjust">("Approve");
  const [reviewBusy, setReviewBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTimeClockEntries({ facilityId, status: statusFilter === "All" ? undefined : statusFilter, page: 1, pageSize: 100 });
      setEntries(res.items);
    } catch { setToast({ msg: "Failed to load time clock entries.", sev: "error" }); }
    finally { setLoading(false); }
  }, [facilityId, statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  function openReview(entry: TimeClockEntryDto, mode: "Approve" | "Deny" | "Adjust") {
    setReviewing(entry); setReviewMode(mode); setReviewNote("");
    setAdjIn(entry.clockInUtc ? dayjs(entry.clockInUtc).format("YYYY-MM-DDTHH:mm") : "");
    setAdjOut(entry.clockOutUtc ? dayjs(entry.clockOutUtc).format("YYYY-MM-DDTHH:mm") : "");
  }

  async function handleReview() {
    if (!reviewing) return;
    setReviewBusy(true);
    try {
      if (reviewMode === "Adjust") {
        await adjustTimeClockEntry(reviewing.id, { clockInUtc: dayjs(adjIn).toISOString(), clockOutUtc: adjOut ? dayjs(adjOut).toISOString() : undefined, adminNotes: reviewNote || undefined });
        setToast({ msg: "Entry adjusted.", sev: "success" });
      } else {
        await reviewTimeClockEntry(reviewing.id, reviewMode as "Approved" | "Denied", reviewNote || undefined);
        setToast({ msg: reviewMode === "Approve" ? "Entry approved." : "Entry denied.", sev: "success" });
      }
      setReviewing(null); load();
    } catch (e: any) { setToast({ msg: e?.response?.data?.detail ?? "Failed.", sev: "error" }); }
    finally { setReviewBusy(false); }
  }

  const fmt = (iso: string | null | undefined) => iso ? dayjs(iso).format("h:mm a") : "—";
  const hrs = (e: TimeClockEntryDto) => e.clockOutUtc ? (dayjs(e.clockOutUtc).diff(dayjs(e.clockInUtc), "minute") / 60).toFixed(2) : "—";

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        <TextField select size="small" label="Status" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
          {["All", "ClockedIn", "ClockedOut", "Approved", "Denied", "Adjusted"].map(s => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" size="small" onClick={load} disabled={loading}>Refresh</Button>
        {!loading && entries.length > 0 && (
          <Chip label={`${entries.length} entries`} size="small"
            sx={{ bgcolor: "rgba(0,77,77,0.3)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.25)" }} />
        )}
      </Stack>

      <Card variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { bgcolor: "rgba(0,77,77,0.2)", fontWeight: 700 } }}>
                <TableCell>Staff</TableCell>
                <TableCell>Clock In</TableCell>
                <TableCell>Clock Out</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} sx={{ color: "#4db6ac" }} />
                </TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <AccessTimeIcon sx={{ fontSize: 36, color: "text.disabled", opacity: 0.3, mb: 1, display: "block", mx: "auto" }} />
                  <Typography variant="body2" color="text.secondary">No entries found.</Typography>
                </TableCell></TableRow>
              ) : entries.map(e => (
                <TableRow key={e.id} hover sx={{ "&:hover": { bgcolor: "rgba(0,137,123,0.04)" } }}>
                  <TableCell fontWeight={500}>{e.staffName ?? e.staffId.slice(0, 8)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dayjs(e.clockInUtc).format("MMM D, h:mm a")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{e.clockOutUtc ? dayjs(e.clockOutUtc).format("MMM D, h:mm a") : "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{hrs(e)}</TableCell>
                  <TableCell><Chip size="small" label={e.status} color={TC_STATUS_COLOR[e.status] ?? "default"} /></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{e.adminNotes ?? "—"}</Typography></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {e.status !== "Approved" && (
                        <Button size="small" variant="contained" color="success" sx={{ minWidth: 70, fontSize: 11 }}
                          onClick={() => openReview(e, "Approve")}>Approve</Button>
                      )}
                      {e.status !== "Denied" && (
                        <Button size="small" variant="outlined" color="error" sx={{ minWidth: 55, fontSize: 11 }}
                          onClick={() => openReview(e, "Deny")}>Deny</Button>
                      )}
                      <Button size="small" variant="outlined" sx={{ fontSize: 11 }}
                        onClick={() => openReview(e, "Adjust")}>Adjust</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewMode === "Approve" ? "Approve Entry" : reviewMode === "Deny" ? "Deny Entry" : "Adjust Entry"}
          {reviewing && ` — ${reviewing.staffName ?? ""}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {reviewMode === "Adjust" && (
              <>
                <TextField size="small" label="Clock In" type="datetime-local" value={adjIn}
                  onChange={e => setAdjIn(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField size="small" label="Clock Out" type="datetime-local" value={adjOut}
                  onChange={e => setAdjOut(e.target.value)} InputLabelProps={{ shrink: true }} />
              </>
            )}
            <TextField size="small" label="Note to staff (optional)" value={reviewNote}
              onChange={e => setReviewNote(e.target.value)} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)} disabled={reviewBusy}>Cancel</Button>
          <Button variant="contained" color={reviewMode === "Deny" ? "error" : "primary"}
            onClick={handleReview} disabled={reviewBusy}>
            {reviewBusy ? <CircularProgress size={18} color="inherit" /> : reviewMode}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 6: Integrations
// ═══════════════════════════════════════════════════════════════════════════════
function IntegrationsTab({ facilityId, setToast }: {
  facilityId: string;
  setToast: (t: { msg: string; sev: "success" | "error" } | null) => void;
}) {
  const [rows, setRows] = React.useState<FacilityIntegrationStatus[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyProvider, setBusyProvider] = React.useState<IntegrationProvider | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFacilityIntegrations(facilityId);
      setRows(res);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? "Failed to load integrations.", sev: "error" });
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  React.useEffect(() => { load(); }, [load]);

  const handleConnect = async (provider: IntegrationProvider) => {
    setBusyProvider(provider);
    try {
      const { authUrl } = await connectFacilityIntegration(facilityId, provider);
      window.location.href = authUrl;
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error ?? "Failed to start connection.", sev: "error" });
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    setBusyProvider(provider);
    try {
      await disconnectFacilityIntegration(facilityId, provider);
      setToast({ msg: `${provider} disconnected.`, sev: "success" });
      await load();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error ?? "Failed to disconnect.", sev: "error" });
    } finally {
      setBusyProvider(null);
    }
  };

  const gusto = rows.find(r => r.provider === "Gusto");
  const qb = rows.find(r => r.provider === "QuickBooks");

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Connect payroll accounts per facility. Once connected, exports will use that facility’s account.
      </Alert>

      <Card variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Gusto</Typography>
              <Typography variant="caption" color="text.secondary">
                {gusto?.connected ? `Connected${gusto.updatedUtc ? ` · ${dayjs(gusto.updatedUtc).fromNow()}` : ""}` : "Not connected"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {gusto?.connected ? (
                <Button variant="contained" color="error" onClick={() => handleDisconnect("Gusto")} disabled={busyProvider === "Gusto"}
                  sx={{ color: "#fff" }}>
                  Disconnect
                </Button>
              ) : (
                <Button variant="contained" onClick={() => handleConnect("Gusto")} disabled={busyProvider === "Gusto"}
                  sx={{ bgcolor: "#1976d2", color: "#fff", "&:hover": { bgcolor: "#115293" } }}>
                  Connect Gusto
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>QuickBooks</Typography>
              <Typography variant="caption" color="text.secondary">
                {qb?.connected ? `Connected${qb.updatedUtc ? ` · ${dayjs(qb.updatedUtc).fromNow()}` : ""}` : "Not connected"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {qb?.connected ? (
                <Button variant="contained" color="error" onClick={() => handleDisconnect("QuickBooks")} disabled={busyProvider === "QuickBooks"}
                  sx={{ color: "#fff" }}>
                  Disconnect
                </Button>
              ) : (
                <Button variant="contained" onClick={() => handleConnect("QuickBooks")} disabled={busyProvider === "QuickBooks"}
                  sx={{ bgcolor: "#f9a825", color: "#1b1b1b", "&:hover": { bgcolor: "#f57f17" } }}>
                  Connect QuickBooks
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {loading && <CircularProgress size={20} sx={{ color: "#4db6ac" }} />}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 7: Branding
// ═══════════════════════════════════════════════════════════════════════════════
function BrandingTab({ facilityId, facility, setToast }: {
  facilityId: string;
  facility: { name: string; logoUrl?: string | null; primaryColor?: string | null } | null;
  setToast: (t: { msg: string; sev: "success" | "error" } | null) => void;
}) {
  const [logoPreview, setLogoPreview] = React.useState<string>(facility?.logoUrl ?? "");
  const [color, setColor]             = React.useState<string>(facility?.primaryColor ?? "#00695c");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useUpdateBranding();

  // Sync if facility loads after mount
  React.useEffect(() => {
    setLogoPreview(facility?.logoUrl ?? "");
    setColor(facility?.primaryColor ?? "#00695c");
  }, [facility?.logoUrl, facility?.primaryColor]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setToast({ msg: "Logo must be under 512 KB", sev: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    try {
      await mutateAsync({
        id: facilityId,
        logoUrl: logoPreview || null,
        primaryColor: color || null,
      });
      setToast({ msg: "Branding saved", sev: "success" });
    } catch {
      setToast({ msg: "Failed to save branding", sev: "error" });
    }
  }

  return (
    <Stack spacing={3} maxWidth={520}>
      <Typography variant="h6" fontWeight={700}>Facility Branding</Typography>
      <Typography variant="body2" color="text.secondary">
        Upload a logo and choose a primary color to personalize your facility's app experience.
      </Typography>

      {/* Logo upload */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Logo</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 80, height: 80, border: "1px dashed", borderColor: "divider",
                borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", bgcolor: "action.hover",
              }}
            >
              {logoPreview
                ? <Box component="img" src={logoPreview} alt="logo preview" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <PaletteIcon sx={{ color: "text.disabled", fontSize: 32 }} />
              }
            </Box>
            <Stack spacing={1}>
              <Button variant="outlined" size="small" onClick={() => fileRef.current?.click()}>
                Upload Image
              </Button>
              {logoPreview && (
                <Button variant="text" size="small" color="error" onClick={() => setLogoPreview("")}>
                  Remove
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">PNG, JPG, SVG · max 512 KB</Typography>
            </Stack>
          </Stack>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </CardContent>
      </Card>

      {/* Primary color */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Primary Color</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 40, height: 40, borderRadius: 1, bgcolor: color,
                border: "1px solid", borderColor: "divider", flexShrink: 0,
              }}
            />
            <TextField
              label="Hex color"
              value={color}
              onChange={e => setColor(e.target.value)}
              size="small"
              sx={{ width: 160 }}
              placeholder="#00695c"
            />
            <Box
              component="input"
              type="color"
              value={color}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
              sx={{ width: 40, height: 40, border: "none", cursor: "pointer", borderRadius: 1, p: 0 }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={isPending}
        sx={{ alignSelf: "flex-start" }}
      >
        {isPending ? "Saving…" : "Save Branding"}
      </Button>
    </Stack>
  );
}
