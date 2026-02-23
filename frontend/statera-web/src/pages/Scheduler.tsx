import { useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  Container, Typography, Box, Button, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TableSortLabel, Chip, Tooltip, Snackbar, TextField,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { suggestAssignments, Suggestion } from "../api/endpoints";
import { listUnits } from "../api/units";
import { listStaff as listFacilityStaff } from "../api/staff";
import { createAssignment } from "../api/assignments";
import { useFacility } from "../context/facility";
import AssignmentFormDialog, { FormValues } from "../components/scheduler/AssignmentFormDialog";
import { useNotifications } from "../context/NotificationContext";

type Row = {
  staffId: string;
  name: string;
  role?: string | null;
  score: number;
  reasoning: string;
  accepted?: boolean;
};

const CREDENTIALS = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT", "Other"];

export default function Scheduler() {
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const { addNotification } = useNotifications();
  const [units, setUnits]   = useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId] = useState<string>("");
  const [cred, setCred]     = useState<string>("RN");

  const [startDt, setStartDt] = useState<string>(
    dayjs().startOf("day").add(7, "hour").format("YYYY-MM-DDTHH:mm")
  );
  const [endDt, setEndDt] = useState<string>(
    dayjs().startOf("day").add(15, "hour").format("YYYY-MM-DDTHH:mm")
  );

  const [rows, setRows]           = useState<Row[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [orderBy, setOrderBy]     = useState<"score" | "name">("score");
  const [orderDesc, setOrderDesc] = useState(true);
  const [toast, setToast]         = useState<string | null>(null);

  // Pre-fill dialog state
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [dialogInitial, setDialogInitial] = useState<FormValues | null>(null);
  const [pendingRow, setPendingRow]     = useState<Row | null>(null);

  useEffect(() => {
    let active = true;
    setUnits([]); setUnitId("");
    if (!facility) return;
    listUnits(facility.id)
      .then(u => { if (active) setUnits(u.map(x => ({ id: x.id, name: x.name }))); })
      .catch(() => { if (active) setUnits([]); });
    return () => { active = false; };
  }, [facility]);

  async function run() {
    if (!facility) { setError("Please select a facility first."); return; }
    setLoading(true); setError(null); setRows([]);
    try {
      const startUtc = dayjs(startDt).toISOString();
      const endUtc   = dayjs(endDt).toISOString();
      const [suggestions, staffList] = await Promise.all([
        suggestAssignments({ startUtc, endUtc, unitId: unitId || "", requiredCredential: cred, facilityId: facility.id }),
        listFacilityStaff(facility.id),
      ]);
      const staffMap = new Map(staffList.map(s => [s.id, s]));
      const details: Row[] = suggestions.map((s: Suggestion) => {
        const d    = staffMap.get(s.staffId);
        const name = d ? (`${d.firstName} ${d.lastName}`.trim() || d.displayName || s.staffId) : s.staffId;
        return { staffId: s.staffId, name, role: d?.role ?? null, score: s.score, reasoning: s.reasoning ?? "", accepted: false };
      });
      setRows(details);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  // Open the pre-filled dialog instead of directly creating
  function openAcceptDialog(row: Row) {
    const roleOptions = CREDENTIALS.map(c => ({ id: c, name: c }));
    setDialogInitial({
      unitId: unitId || "",
      staffId: row.staffId,
      roleId: row.role ?? cred,
      start: dayjs(startDt).toISOString(),
      end: dayjs(endDt).toISOString(),
      notes: `Auto-assigned via scheduler (score ${row.score.toFixed(0)})`,
    });
    setPendingRow(row);
    setDialogOpen(true);
  }

  async function handleDialogSubmit(values: FormValues) {
    if (!facility || !pendingRow) return;
    try {
      await createAssignment(facility.id, {
        staffId: values.staffId,
        roleId:  values.roleId,
        unitId:  values.unitId || undefined,
        start:   values.start,
        end:     values.end,
        notes:   values.notes ?? undefined,
      });
      setRows(prev =>
        prev.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r)
      );
      setToast(`Assignment created for ${pendingRow.name}`);
      addNotification(`Assignment created for ${pendingRow.name} (${values.roleId})`, "success");
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to create assignment");
    } finally {
      setDialogOpen(false);
      setPendingRow(null);
      setDialogInitial(null);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = orderDesc ? -1 : 1;
    if (orderBy === "score") return dir * (b.score - a.score);
    return dir * a.name.localeCompare(b.name);
  });

  function toggleSort(col: "score" | "name") {
    if (orderBy === col) setOrderDesc(d => !d);
    else { setOrderBy(col); setOrderDesc(col === "score"); }
  }

  function scoreColor(score: number): "success" | "warning" | "error" {
    if (score >= 70) return "success";
    if (score >= 40) return "warning";
    return "error";
  }

  const unitOptions = units.map(u => ({ id: u.id, name: u.name }));
  const roleOptions = CREDENTIALS.map(c => ({ id: c, name: c }));
  const staffOptions = rows.map(r => ({ id: r.staffId, label: r.name }));

  return (
    <Container sx={{ mt: 3, pb: 4 }}>
      <Typography variant="h5" gutterBottom>Scheduler — Staff Suggestions</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select a shift window and credential, then click <strong>Suggest</strong>. Staff are
        scored using weekly hours, facility constraints, rest rules, and role/license checks.
        Click <strong>Accept</strong> to review and confirm the assignment.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Facility</InputLabel>
            <Select label="Facility" value={facility?.id ?? ""} onChange={e => setSelectedId(String(e.target.value))}>
              {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Unit</InputLabel>
            <Select label="Unit" value={unitId} onChange={e => setUnitId(String(e.target.value))} disabled={units.length === 0}>
              <MenuItem value="">(Any unit)</MenuItem>
              {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Credential</InputLabel>
            <Select label="Credential" value={cred} onChange={e => setCred(e.target.value)}>
              {CREDENTIALS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField size="small" label="Shift start" type="datetime-local" value={startDt}
            onChange={e => setStartDt(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />

          <TextField size="small" label="Shift end" type="datetime-local" value={endDt}
            onChange={e => setEndDt(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />

          <Button variant="contained" onClick={run} disabled={loading || !facility} sx={{ height: 40 }}>
            {loading ? <CircularProgress size={20} color="inherit" /> : "Suggest"}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {!loading && rows.length === 0 && !error && (
        <Typography color="text.secondary">
          No suggestions yet — configure the shift above and click Suggest.
        </Typography>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel active={orderBy === "name"} direction={orderDesc ? "desc" : "asc"} onClick={() => toggleSort("name")}>
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="center">
                  <TableSortLabel active={orderBy === "score"} direction={orderDesc ? "desc" : "asc"} onClick={() => toggleSort("score")}>
                    Score
                  </TableSortLabel>
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
                  <TableCell align="center">
                    <Chip label={r.score.toFixed(0)} size="small" color={scoreColor(r.score)} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{r.reasoning}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    {r.accepted ? (
                      <Tooltip title="Assignment created">
                        <CheckCircleOutlineIcon color="success" fontSize="small" />
                      </Tooltip>
                    ) : (
                      <Button size="small" variant="contained" color="primary" onClick={() => openAcceptDialog(r)}>
                        Accept
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pre-filled assignment confirmation dialog */}
      {dialogInitial && (
        <AssignmentFormDialog
          open={dialogOpen}
          title="Confirm Assignment"
          initial={dialogInitial}
          units={unitOptions}
          roles={roleOptions}
          staff={staffOptions}
          onCancel={() => { setDialogOpen(false); setPendingRow(null); setDialogInitial(null); }}
          onSubmit={handleDialogSubmit}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} message={toast} />
    </Container>
  );
}
