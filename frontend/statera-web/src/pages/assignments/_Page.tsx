// src/pages/assignments/_Page.tsx
import * as React from "react";
import {
  Box, Button, Container, Divider, MenuItem, Stack, TextField, Typography,
  CircularProgress, Snackbar, Alert
} from "@mui/material";
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
  AssignmentDto
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
  const isOwner = user?.systemRole === "Owner";
  const facilityId = selected?.id;

  const [weekStart, setWeekStart] = React.useState<Dayjs>(startOfWeekMonday(dayjs()));
  const [units, setUnits] = React.useState<UnitDto[]>([]);
  const [staff, setStaff] = React.useState<StaffDto[]>([]);
  const [unitId, setUnitId] = React.useState<string>("");
  const [roleId, setRoleId] = React.useState<string>("");
  const [nameSearch, setNameSearch] = React.useState<string>("");

  const [loading, setLoading] = React.useState(false);
  const [assignments, setAssignments] = React.useState<AssignmentDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogTitle, setDialogTitle] = React.useState("Create Assignment");
  const [dialogInitial, setDialogInitial] = React.useState<FormValues>({
    unitId: "",
    staffId: "",
    roleId: "",
    start: dayjs().toISOString(),
    end: dayjs().add(8, "hour").toISOString(),
    notes: ""
  });
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);

  const loadLookups = React.useCallback(async () => {
    if (!facilityId) return;
    try {
      setLoading(true);
      const [u, st] = await Promise.all([
        listUnits(facilityId),
        listStaff(facilityId)
      ]);
      setUnits(u);
      setStaff(st.filter(s => s.active));
      setUnitId(prev => prev || "");
    } catch {
      setError("Failed to load lookups");
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const loadAssignments = React.useCallback(async () => {
    if (!facilityId) return;
    try {
      setLoading(true);
      const start = weekStart.startOf("day").toISOString();
      const end = weekStart.add(7, "day").startOf("day").toISOString();
      const data = await listAssignments(facilityId, {
        start, end, unitId: unitId || undefined, roleId: roleId || undefined
      });
      setAssignments(data);
    } catch {
      setError("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [facilityId, weekStart, unitId, roleId]);

  // Reload lookups when facility changes
  React.useEffect(() => {
    setUnitId("");
    setStaff([]);
    setUnits([]);
    setAssignments([]);
    loadLookups();
  }, [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const staffRows = React.useMemo(() => {
    let filtered = staff;
    if (unitId) filtered = filtered.filter(s => s.unitId === unitId);
    if (roleId) filtered = filtered.filter(s => (s.role ?? "").toLowerCase() === roleId.toLowerCase());
    if (nameSearch) {
      const q = nameSearch.toLowerCase();
      filtered = filtered.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.displayName ?? "").toLowerCase().includes(q)
      );
    }
    return filtered.map(s => ({ id: s.id, label: s.displayName ?? `${s.firstName} ${s.lastName}`, role: s.role ?? undefined }));
  }, [staff, unitId, roleId, nameSearch]);

  const assignmentCells = React.useMemo(() => {
    return assignments.map(a => {
      const start = dayjs(a.start);
      const dayISO = start.startOf("day").toISOString();
      const roleName = ROLE_OPTIONS.find(r => r.id.toLowerCase() === (a.roleId ?? "").toLowerCase())?.name ?? a.roleId;
      const unitName = units.find(u => u.id === a.unitId)?.name;
      return { id: a.id, staffId: a.staffId, dayISO, startISO: a.start, endISO: a.end, roleName, unitName, notes: a.notes ?? null };
    });
  }, [assignments, units]);

  const openCreate = (staffId: string, dayISO: string) => {
    const start = dayjs(dayISO).hour(7).minute(0).second(0).millisecond(0);
    const end = start.add(8, "hour");
    const staffMember = staff.find(s => s.id === staffId);
    const staffRole = staffMember?.role ?? "";
    setDialogTitle("Create Assignment");
    setEditingId(undefined);
    setDialogInitial({
      unitId: unitId || staffMember?.unitId || (units[0]?.id ?? ""),
      staffId,
      roleId: staffRole || roleId || ROLE_OPTIONS[0].id,
      start: start.toISOString(),
      end: end.toISOString(),
      notes: ""
    });
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
      if (!editingId) {
        await createAssignment(facilityId, { unitId: values.unitId || undefined, staffId: values.staffId, roleId: values.roleId, start: values.start, end: values.end, notes: values.notes });
        setToast("Assignment created");
        const staffName = staff.find(s => s.id === values.staffId);
        const label = staffName ? `${staffName.firstName} ${staffName.lastName}` : values.staffId;
        addNotification(`Assignment created for ${label} (${values.roleId}) on ${dayjs(values.start).format("MMM D")}`, "success");
      } else {
        await updateAssignment(facilityId, editingId, { id: editingId, unitId: values.unitId || undefined, staffId: values.staffId, roleId: values.roleId, start: values.start, end: values.end, notes: values.notes });
        setToast("Assignment updated");
        const staffName = staff.find(s => s.id === values.staffId);
        const label = staffName ? `${staffName.firstName} ${staffName.lastName}` : values.staffId;
        addNotification(`Assignment updated for ${label} on ${dayjs(values.start).format("MMM D")}`, "info");
      }
      setDialogOpen(false);
      await loadAssignments();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to save assignment");
    } finally {
      setLoading(false);
    }
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
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to delete assignment");
    } finally {
      setLoading(false);
    }
  };

  const moveWeek = (delta: number) => setWeekStart(prev => startOfWeekMonday(prev.add(delta, "week")));

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Assignments (Scheduler)
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        {/* Facility selector — only shown to Owners who manage multiple facilities */}
        {isOwner && (
          <TextField
            select
            label="Facility"
            value={facilityId ?? ""}
            onChange={e => setSelectedId(e.target.value)}
            sx={{ minWidth: 260 }}
            size="small"
          >
            {facilities.map(f => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </TextField>
        )}

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => moveWeek(-1)}>Prev</Button>
          <Button variant="outlined" onClick={() => setWeekStart(startOfWeekMonday(dayjs()))}>Today</Button>
          <Button variant="outlined" onClick={() => moveWeek(1)}>Next</Button>
        </Stack>

        <Box sx={{ display: "flex", alignItems: "center", px: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, height: 40, minWidth: 220 }}>
          <Typography variant="body2" noWrap>
            {weekStart.format("MMM D")} – {weekStart.add(6, "day").format("MMM D, YYYY")}
          </Typography>
        </Box>

        <TextField
          select
          label="Unit"
          value={unitId}
          onChange={e => setUnitId(e.target.value)}
          sx={{ minWidth: 220 }}
          size="small"
        >
          <MenuItem value="">All Units</MenuItem>
          {units.map(u => (
            <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Role"
          value={roleId}
          onChange={e => setRoleId(e.target.value)}
          sx={{ minWidth: 180 }}
          size="small"
        >
          <MenuItem value="">All Roles</MenuItem>
          {ROLE_OPTIONS.map(r => (
            <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
          ))}
        </TextField>

        <TextField
          label="Search staff"
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          sx={{ minWidth: 180 }}
          size="small"
        />

        {loading && <CircularProgress size={24} />}
      </Stack>

      {!facilityId ? (
        <Alert severity="info">Select a facility to view assignments.</Alert>
      ) : (
        <>
          <Divider sx={{ mb: 2 }} />
          <WeekGrid
            weekStart={weekStart}
            staff={staffRows}
            assignments={assignmentCells}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        </>
      )}

      <AssignmentFormDialog
        open={dialogOpen}
        title={dialogTitle}
        initial={dialogInitial}
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
