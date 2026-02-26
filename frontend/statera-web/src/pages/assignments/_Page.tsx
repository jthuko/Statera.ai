// src/pages/assignments/_Page.tsx
import * as React from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, MenuItem, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import SearchIcon from "@mui/icons-material/Search";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

import { useFacility } from "../../context/facility";
import { useAuth } from "../../auth/useAuth";
import { useNotifications } from "../../context/NotificationContext";
import { listStaff, StaffDto } from "../../api/staff";
import { listUnits } from "../../api/units";
import type { UnitDto } from "../../api/units";

import WeekGrid from "../../components/scheduler/WeekGrid";
import AssignmentFormDialog, { FormValues } from "../../components/scheduler/AssignmentFormDialog";
import {
  listAssignments, createAssignment, updateAssignment, deleteAssignment,
  AssignmentDto,
} from "../../api/assignments";

interface RoleOption { id: string; name: string; }
const CREDENTIALS = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT", "Other"];
const ROLE_OPTIONS: RoleOption[] = CREDENTIALS.map(c => ({ id: c, name: c }));

function startOfWeekMonday(d: Dayjs) {
  return d.isoWeekday(1).startOf("day");
}

export default function AssignmentsPage() {
  const { facilities, selected, setSelectedId } = useFacility();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const isOwner   = user?.systemRole === "Owner";
  const facilityId = selected?.id;

  const [weekStart, setWeekStart] = React.useState<Dayjs>(startOfWeekMonday(dayjs()));
  const [viewMode, setViewMode]   = React.useState<"week" | "range">("week");
  const [rangeStart, setRangeStart] = React.useState<string>(dayjs().format("YYYY-MM-DD"));
  const [rangeEnd, setRangeEnd]     = React.useState<string>(dayjs().format("YYYY-MM-DD"));
  const [units, setUnits]         = React.useState<UnitDto[]>([]);
  const [staff, setStaff]         = React.useState<StaffDto[]>([]);
  const [unitId, setUnitId]       = React.useState<string>("");
  const [roleId, setRoleId]       = React.useState<string>("");
  const [nameSearch, setNameSearch] = React.useState<string>("");

  const [loading, setLoading]         = React.useState(false);
  const [assignments, setAssignments] = React.useState<AssignmentDto[]>([]);
  const [error, setError]             = React.useState<string | null>(null);
  const [toast, setToast]             = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen]       = React.useState(false);
  const [dialogTitle, setDialogTitle]     = React.useState("Create Assignment");
  const [dialogInitial, setDialogInitial] = React.useState<FormValues>({
    unitId: "", staffId: "", roleId: "",
    start: dayjs().toISOString(),
    end:   dayjs().add(8, "hour").toISOString(),
    notes: "",
  });
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);

  const loadLookups = React.useCallback(async () => {
    if (!facilityId) return;
    try {
      setLoading(true);
      const [u, st] = await Promise.all([listUnits(facilityId), listStaff(facilityId)]);
      setUnits(u);
      setStaff(st.filter(s => s.active));
      setUnitId(prev => prev || "");
    } catch { setError("Failed to load lookups"); }
    finally { setLoading(false); }
  }, [facilityId]);

  const loadAssignments = React.useCallback(async () => {
    if (!facilityId) return;
    try {
      setLoading(true);
      let start: string;
      let end: string;

      if (viewMode === "week") {
        start = weekStart.startOf("day").toISOString();
        end   = weekStart.add(7, "day").startOf("day").toISOString();
      } else {
        const rs = dayjs(rangeStart);
        const re = dayjs(rangeEnd);
        if (!rs.isValid() || !re.isValid()) { setAssignments([]); return; }
        start = rs.startOf("day").toISOString();
        end   = re.add(1, "day").startOf("day").toISOString();
      }

      const data  = await listAssignments(facilityId, { start, end, unitId: unitId || undefined, roleId: roleId || undefined });
      setAssignments(data);
    } catch { setError("Failed to load assignments"); }
    finally { setLoading(false); }
  }, [facilityId, weekStart, unitId, roleId, viewMode, rangeStart, rangeEnd]);

  React.useEffect(() => {
    setUnitId(""); setStaff([]); setUnits([]); setAssignments([]);
    loadLookups();
  }, [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const staffRows = React.useMemo(() => {
    let f = staff;
    if (unitId)     f = f.filter(s => s.unitId === unitId);
    if (roleId)     f = f.filter(s => (s.role ?? "").toLowerCase() === roleId.toLowerCase());
    if (nameSearch) {
      const q = nameSearch.toLowerCase();
      f = f.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.displayName ?? "").toLowerCase().includes(q));
    }
    return f.map(s => ({ id: s.id, label: s.displayName ?? `${s.firstName} ${s.lastName}`, role: s.role ?? undefined }));
  }, [staff, unitId, roleId, nameSearch]);

  const assignmentCells = React.useMemo(() => assignments.map(a => {
    const start    = dayjs(a.start);
    const dayISO   = start.startOf("day").toISOString();
    const roleName = ROLE_OPTIONS.find(r => r.id.toLowerCase() === (a.roleId ?? "").toLowerCase())?.name ?? a.roleId;
    const unitName = units.find(u => u.id === a.unitId)?.name;
    return { id: a.id, staffId: a.staffId, dayISO, startISO: a.start, endISO: a.end, roleName, unitName, notes: a.notes ?? null };
  }), [assignments, units]);

  const staffNameMap = React.useMemo(() => new Map(staff.map(s => [s.id, s.displayName ?? `${s.firstName} ${s.lastName}`])), [staff]);

  const sortedAssignments = React.useMemo(() =>
    [...assignments].sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf()),
  [assignments]);

  const openCreate = (staffId: string, dayISO: string) => {
    const start = dayjs(dayISO).hour(7).minute(0).second(0).millisecond(0);
    const sm    = staff.find(s => s.id === staffId);
    setDialogTitle("Create Assignment");
    setEditingId(undefined);
    setDialogInitial({ unitId: unitId || sm?.unitId || (units[0]?.id ?? ""), staffId, roleId: sm?.role || roleId || ROLE_OPTIONS[0].id, start: start.toISOString(), end: start.add(8, "hour").toISOString(), notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (assignmentId: string) => {
    const a = assignments.find(x => x.id === assignmentId);
    if (!a) return;
    setDialogTitle("Edit Assignment");
    setEditingId(a.id);
    setDialogInitial({ id: a.id, unitId: a.unitId, staffId: a.staffId, roleId: a.roleId, start: a.start, end: a.end, notes: a.notes ?? "" });
    setDialogOpen(true);
  };

  const submitAssignment = async (values: FormValues) => {
    if (!facilityId) return;
    try {
      setLoading(true);
      const s = staff.find(x => x.id === values.staffId);
      const label = s ? `${s.firstName} ${s.lastName}` : values.staffId;
      if (!editingId) {
        await createAssignment(facilityId, { unitId: values.unitId || undefined, staffId: values.staffId, roleId: values.roleId, start: values.start, end: values.end, notes: values.notes });
        setToast("Assignment created");
        addNotification(`Assignment created for ${label} (${values.roleId}) on ${dayjs(values.start).format("MMM D")}`, "success");
      } else {
        await updateAssignment(facilityId, editingId, { id: editingId, unitId: values.unitId || undefined, staffId: values.staffId, roleId: values.roleId, start: values.start, end: values.end, notes: values.notes });
        setToast("Assignment updated");
        addNotification(`Assignment updated for ${label} on ${dayjs(values.start).format("MMM D")}`, "info");
      }
      setDialogOpen(false);
      await loadAssignments();
    } catch (e: any) { setError(e?.response?.data?.error ?? "Failed to save assignment"); }
    finally { setLoading(false); }
  };

  const deleteCurrent = async () => {
    if (!facilityId || !editingId) return;
    try {
      setLoading(true);
      await deleteAssignment(facilityId, editingId);
      setDialogOpen(false);
      setToast("Assignment deleted");
      addNotification("An assignment was removed from the schedule.", "warning");
      await loadAssignments();
    } catch (e: any) { setError(e?.response?.data?.error ?? "Failed to delete assignment"); }
    finally { setLoading(false); }
  };

  const moveWeek  = (delta: number) => setWeekStart(p => startOfWeekMonday(p.add(delta, "week")));
  const weekLabel = `${weekStart.format("MMM D")} – ${weekStart.add(6, "day").format("MMM D, YYYY")}`;
  const rangeLabel = `${dayjs(rangeStart).format("MMM D, YYYY")} – ${dayjs(rangeEnd).format("MMM D, YYYY")}`;

  const rangeWeekStarts = React.useMemo(() => {
    if (viewMode !== "range") return [] as Dayjs[];
    const rs = dayjs(rangeStart);
    const re = dayjs(rangeEnd);
    if (!rs.isValid() || !re.isValid()) return [] as Dayjs[];

    let cursor = startOfWeekMonday(rs);
    const end = re.startOf("day");
    const weeks: Dayjs[] = [];
    while (cursor.isBefore(end) || cursor.isSame(end))
    {
      weeks.push(cursor);
      cursor = cursor.add(1, "week");
    }
    return weeks;
  }, [viewMode, rangeStart, rangeEnd]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>

      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2.5,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} flexWrap="wrap">

            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
              }}>
                <CalendarMonthIcon sx={{ color: "#4db6ac", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Assignments</Typography>
                <Typography variant="caption" color="text.secondary">Weekly schedule view</Typography>
              </Box>
            </Stack>

            {isOwner && (
              <TextField select label="Facility" value={facilityId ?? ""}
                onChange={e => setSelectedId(e.target.value)} size="small" sx={{ minWidth: 240 }}>
                {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </TextField>
            )}

            <Stack direction="row" spacing={0.5} alignItems="center">
              <Button variant={viewMode === "week" ? "contained" : "outlined"} size="small"
                onClick={() => setViewMode("week")}
                sx={{ minWidth: 70, fontSize: 12 }}>
                Week
              </Button>
              <Button variant={viewMode === "range" ? "contained" : "outlined"} size="small"
                onClick={() => setViewMode("range")}
                sx={{ minWidth: 70, fontSize: 12 }}>
                Range
              </Button>

              {viewMode === "week" ? (
                <>
                  <Button variant="outlined" size="small" onClick={() => moveWeek(-1)}
                    sx={{ minWidth: 34, px: 0.5, borderColor: "rgba(255,255,255,0.15)" }}>
                    <ChevronLeftIcon fontSize="small" />
                  </Button>
                  <Button variant="outlined" size="small"
                    onClick={() => setWeekStart(startOfWeekMonday(dayjs()))}
                    startIcon={<TodayIcon sx={{ fontSize: "16px !important" }} />}
                    sx={{ borderColor: "rgba(255,255,255,0.15)", fontSize: 12 }}>
                    Today
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => moveWeek(1)}
                    sx={{ minWidth: 34, px: 0.5, borderColor: "rgba(255,255,255,0.15)" }}>
                    <ChevronRightIcon fontSize="small" />
                  </Button>
                  <Chip label={weekLabel} size="small" sx={{
                    ml: 0.5,
                    bgcolor: "rgba(0,77,77,0.4)", color: "#4db6ac",
                    border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 12,
                  }} />
                </>
              ) : (
                <>
                  <Button variant="outlined" size="small"
                    onClick={() => { const t = dayjs().format("YYYY-MM-DD"); setRangeStart(t); setRangeEnd(t); }}
                    startIcon={<TodayIcon sx={{ fontSize: "16px !important" }} />}
                    sx={{ borderColor: "rgba(255,255,255,0.15)", fontSize: 12 }}>
                    Today
                  </Button>
                  <Chip label={rangeLabel} size="small" sx={{
                    ml: 0.5,
                    bgcolor: "rgba(0,77,77,0.4)", color: "#4db6ac",
                    border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 12,
                  }} />
                </>
              )}
            </Stack>

            {loading && <CircularProgress size={20} sx={{ color: "#4db6ac" }} />}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Filters ── */}
      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" alignItems="center">
            <TextField select label="Unit" value={unitId}
              onChange={e => setUnitId(e.target.value)} size="small" sx={{ minWidth: 200 }}>
              <MenuItem value="">All Units</MenuItem>
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>

            <TextField select label="Role" value={roleId}
              onChange={e => setRoleId(e.target.value)} size="small" sx={{ minWidth: 150 }}>
              <MenuItem value="">All Roles</MenuItem>
              {ROLE_OPTIONS.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </TextField>

            <TextField label="Search staff" value={nameSearch}
              onChange={e => setNameSearch(e.target.value)} size="small" sx={{ minWidth: 180 }}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} /> }}
            />

            {(unitId || roleId || nameSearch) && (
              <Button size="small" variant="text"
                onClick={() => { setUnitId(""); setRoleId(""); setNameSearch(""); }}
                sx={{ color: "text.secondary", fontSize: 12 }}>
                Clear
              </Button>
            )}

            {viewMode === "range" && (
              <>
                <TextField
                  label="Start"
                  type="date"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 150 }}
                />
                <TextField
                  label="End"
                  type="date"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 150 }}
                />
              </>
            )}

            <Box sx={{ flex: 1 }} />

            {assignments.length > 0 && (
              <Chip label={`${assignments.length} assignment${assignments.length !== 1 ? "s" : ""}`}
                size="small" sx={{
                  bgcolor: "rgba(0,77,77,0.3)", color: "#4db6ac",
                  border: "1px solid rgba(0,137,123,0.25)", fontSize: 11,
                }} />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Grid ── */}
      {!facilityId ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>Select a facility to view and manage assignments.</Alert>
      ) : viewMode === "week" ? (
        <WeekGrid
          weekStart={weekStart}
          staff={staffRows}
          assignments={assignmentCells}
          onCreate={openCreate}
          onEdit={openEdit}
        />
      ) : (
        rangeWeekStarts.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>Select a valid date range to view assignments.</Alert>
        ) : (
          <Stack spacing={2}>
            {rangeWeekStarts.map(ws => (
              <WeekGrid
                key={ws.toISOString()}
                weekStart={ws}
                staff={staffRows}
                assignments={assignmentCells}
                onCreate={openCreate}
                onEdit={openEdit}
              />
            ))}
          </Stack>
        )
      )}

      <AssignmentFormDialog
        open={dialogOpen} title={dialogTitle} initial={dialogInitial}
        units={units.map(u => ({ id: u.id, name: u.name }))}
        roles={ROLE_OPTIONS}
        staff={staffRows.map(s => ({ id: s.id, label: s.label }))}
        onCancel={() => setDialogOpen(false)}
        onSubmit={submitAssignment}
        onDelete={editingId ? deleteCurrent : undefined}
      />

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
    </Container>
  );
}
