import { useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  Container, Typography, Box, Button, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TableSortLabel, Chip, Tooltip, Snackbar, TextField,
  ToggleButton, ToggleButtonGroup,
  Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TodayIcon from "@mui/icons-material/Today";
import { suggestAssignments, Suggestion } from "../api/endpoints";
import { listUnits } from "../api/units";
import { listStaff as listFacilityStaff, StaffDto } from "../api/staff";
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

type DateGroup = {
  date: string;       // YYYY-MM-DD
  startUtc: string;
  endUtc: string;
  rows: Row[];
  error?: string | null;
};

const CREDENTIALS = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT", "Other"];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Scheduler() {
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const { addNotification } = useNotifications();
  const [units, setUnits]   = useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId] = useState<string>("");
  const [cred, setCred]     = useState<string>("RN");

  // Mode
  const [mode, setMode] = useState<"single" | "range">("single");

  // Single shift
  const [startDt, setStartDt] = useState<string>(
    dayjs().startOf("day").add(7, "hour").format("YYYY-MM-DDTHH:mm")
  );
  const [endDt, setEndDt] = useState<string>(
    dayjs().startOf("day").add(15, "hour").format("YYYY-MM-DDTHH:mm")
  );

  // Range mode
  const [fromDate, setFromDate]       = useState(dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate]           = useState(dayjs().add(6, "day").format("YYYY-MM-DD"));
  const [shiftStartTime, setShiftStartTime] = useState("07:00");
  const [shiftEndTime, setShiftEndTime]     = useState("15:00");
  const [selectedDays, setSelectedDays]     = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri

  // Results
  const [rows, setRows]           = useState<Row[]>([]);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [orderBy, setOrderBy]     = useState<"score" | "name">("score");
  const [orderDesc, setOrderDesc] = useState(true);
  const [toast, setToast]         = useState<string | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [dialogInitial, setDialogInitial] = useState<FormValues | null>(null);
  const [pendingRow, setPendingRow]       = useState<Row | null>(null);
  const [pendingDate, setPendingDate]     = useState<string | null>(null);
  const [facilityStaff, setFacilityStaff] = useState<StaffDto[]>([]);

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
    setError(null);
    if (mode === "single") await runSingle();
    else await runRange();
  }

  async function runSingle() {
    setLoading(true); setRows([]); setDateGroups([]);
    try {
      const startUtc = dayjs(startDt).toISOString();
      const endUtc   = dayjs(endDt).toISOString();
      const [suggestions, staffList] = await Promise.all([
        suggestAssignments({ startUtc, endUtc, unitId: unitId || "", requiredCredential: cred, facilityId: facility!.id }),
        listFacilityStaff(facility!.id),
      ]);
      setFacilityStaff(staffList);
      const staffMap = new Map(staffList.map(s => [s.id, s]));
      setRows(suggestions.map((s: Suggestion) => {
        const d    = staffMap.get(s.staffId);
        const name = d ? (`${d.firstName} ${d.lastName}`.trim() || d.displayName || s.staffId) : s.staffId;
        return { staffId: s.staffId, name, role: d?.role ?? null, score: s.score, reasoning: s.reasoning ?? "", accepted: false };
      }));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function runRange() {
    setLoading(true); setRows([]); setDateGroups([]);
    try {
      // Build date list
      const dates: string[] = [];
      let cursor = dayjs(fromDate);
      const end  = dayjs(toDate);
      while (!cursor.isAfter(end)) {
        if (selectedDays.includes(cursor.day())) dates.push(cursor.format("YYYY-MM-DD"));
        cursor = cursor.add(1, "day");
      }

      if (dates.length === 0) {
        setError("No dates match the selected days of the week."); setLoading(false); return;
      }
      if (dates.length > 42) {
        setError("Please limit the range to 6 weeks or fewer."); setLoading(false); return;
      }

      const staffList = await listFacilityStaff(facility!.id);
      setFacilityStaff(staffList);
      const staffMap = new Map(staffList.map(s => [s.id, s]));

      // Build ISO datetimes per date (handle overnight)
      const buildShift = (date: string) => {
        const startUtc = dayjs(`${date}T${shiftStartTime}`).toISOString();
        const endDate  = shiftEndTime <= shiftStartTime
          ? dayjs(date).add(1, "day").format("YYYY-MM-DD")
          : date;
        const endUtc   = dayjs(`${endDate}T${shiftEndTime}`).toISOString();
        return { startUtc, endUtc };
      };

      // Parallel requests
      const results = await Promise.allSettled(
        dates.map(date => {
          const { startUtc, endUtc } = buildShift(date);
          return suggestAssignments({ startUtc, endUtc, unitId: unitId || "", requiredCredential: cred, facilityId: facility!.id })
            .then(suggestions => ({ date, startUtc, endUtc, suggestions }));
        })
      );

      setDateGroups(results.map((r, i) => {
        const date = dates[i];
        if (r.status === "rejected") {
          const { startUtc, endUtc } = buildShift(date);
          return { date, startUtc, endUtc, rows: [], error: r.reason?.message ?? "Failed" };
        }
        const { startUtc, endUtc, suggestions } = r.value;
        const rows: Row[] = suggestions.map((s: Suggestion) => {
          const d    = staffMap.get(s.staffId);
          const name = d ? (`${d.firstName} ${d.lastName}`.trim() || d.displayName || s.staffId) : s.staffId;
          return { staffId: s.staffId, name, role: d?.role ?? null, score: s.score, reasoning: s.reasoning ?? "", accepted: false };
        });
        return { date, startUtc, endUtc, rows };
      }));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function openAcceptDialog(row: Row, startUtc: string, endUtc: string, date?: string) {
    setDialogInitial({
      unitId: unitId || "",
      staffId: row.staffId,
      roleId: row.role ?? cred,
      start: startUtc,
      end: endUtc,
      notes: `Auto-assigned via scheduler (score ${row.score.toFixed(0)})`,
    });
    setPendingRow(row);
    setPendingDate(date ?? null);
    setDialogOpen(true);
  }

  async function handleDialogSubmit(values: FormValues) {
    if (!facility || !pendingRow) return;
    try {
      await createAssignment(facility.id, {
        staffId: values.staffId, roleId: values.roleId,
        unitId: values.unitId || undefined, start: values.start, end: values.end,
        notes: values.notes ?? undefined,
      });
      if (pendingDate) {
        setDateGroups(prev => prev.map(g =>
          g.date === pendingDate
            ? { ...g, rows: g.rows.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r) }
            : g
        ));
      } else {
        setRows(prev => prev.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r));
      }
      setToast(`Assignment created for ${pendingRow.name}`);
      addNotification(`Assignment created for ${pendingRow.name} (${values.roleId})`, "success");
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to create assignment");
    } finally {
      setDialogOpen(false); setPendingRow(null); setPendingDate(null); setDialogInitial(null);
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

  // Bulk-accept: create assignments for the top-scored staff on every date group
  const [bulkBusy, setBulkBusy] = useState(false);

  async function handleAcceptAll() {
    if (!facility || bulkBusy) return;
    setBulkBusy(true);
    const toAccept = dateGroups.filter(g => !g.error && g.rows.length > 0 && !g.rows[0].accepted);
    let created = 0; let failed = 0;
    for (const group of toAccept) {
      const best = group.rows[0];
      try {
        await createAssignment(facility.id, {
          staffId: best.staffId, roleId: best.role ?? cred,
          unitId: unitId || undefined, start: group.startUtc, end: group.endUtc,
          notes: `Auto-assigned via scheduler (score ${best.score.toFixed(0)})`,
        });
        setDateGroups(prev => prev.map(g =>
          g.date === group.date
            ? { ...g, rows: g.rows.map((r, i) => i === 0 ? { ...r, accepted: true } : r) }
            : g
        ));
        created++;
      } catch { failed++; }
    }
    if (created > 0) {
      setToast(`${created} assignment${created !== 1 ? "s" : ""} created${failed > 0 ? `, ${failed} failed` : ""}`);
      addNotification(`Scheduler created ${created} assignments`, "success");
    } else {
      setError(`Failed to create assignments (${failed} errors).`);
    }
    setBulkBusy(false);
  }

  const unitOptions = units.map(u => ({ id: u.id, name: u.name }));
  const roleOptions = CREDENTIALS.map(c => ({ id: c, name: c }));
  const allRows     = mode === "single" ? rows : dateGroups.flatMap(g => g.rows);
  const staffOptions = Array.from(
    new Map([
      ...allRows.map(r => [r.staffId, { id: r.staffId, label: r.name }] as [string, { id: string; label: string }]),
      ...facilityStaff.map(s => [s.id, { id: s.id, label: `${s.firstName} ${s.lastName}`.trim() }] as [string, { id: string; label: string }]),
    ]).values()
  );

  return (
    <Container sx={{ mt: 3, pb: 4 }}>
      <Typography variant="h5" gutterBottom>Scheduler — Staff Suggestions</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select a shift window and credential, then click <strong>Suggest</strong>. Staff are scored
        using weekly hours, constraints, rest rules, and role checks.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        {/* ── Mode toggle ── */}
        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => { if (v) { setMode(v); setRows([]); setDateGroups([]); } }}
            size="small"
          >
            <ToggleButton value="single">
              <TodayIcon sx={{ mr: 0.5, fontSize: 16 }} /> Single Shift
            </ToggleButton>
            <ToggleButton value="range">
              <CalendarMonthIcon sx={{ mr: 0.5, fontSize: 16 }} /> Date Range
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
          {/* Common */}
          {facilities.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Facility</InputLabel>
              <Select label="Facility" value={facility?.id ?? ""} onChange={e => setSelectedId(String(e.target.value))}>
                {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

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

          {/* Single shift fields */}
          {mode === "single" && (
            <>
              <TextField size="small" label="Shift start" type="datetime-local" value={startDt}
                onChange={e => {
                  const newStart = e.target.value;
                  if (newStart && startDt && endDt) {
                    const durationMs = dayjs(endDt).valueOf() - dayjs(startDt).valueOf();
                    setEndDt(dayjs(newStart).add(durationMs, "millisecond").format("YYYY-MM-DDTHH:mm"));
                  }
                  setStartDt(newStart);
                }}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
              <TextField size="small" label="Shift end" type="datetime-local" value={endDt}
                onChange={e => setEndDt(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
            </>
          )}

          {/* Range fields */}
          {mode === "range" && (
            <>
              <TextField size="small" label="From date" type="date" value={fromDate}
                onChange={e => {
                  const newFrom = e.target.value;
                  if (newFrom && fromDate && toDate) {
                    const diff = dayjs(toDate).diff(dayjs(fromDate), "day");
                    setToDate(dayjs(newFrom).add(diff, "day").format("YYYY-MM-DD"));
                  }
                  setFromDate(newFrom);
                }}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
              <TextField size="small" label="To date" type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                inputProps={{ min: fromDate }}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
              <TextField size="small" label="Shift start time" type="time" value={shiftStartTime}
                onChange={e => setShiftStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
              <TextField size="small" label="Shift end time" type="time" value={shiftEndTime}
                onChange={e => setShiftEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
            </>
          )}

          <Button variant="contained" onClick={run} disabled={loading || !facility} sx={{ height: 40 }}>
            {loading ? <CircularProgress size={20} color="inherit" /> : "Suggest"}
          </Button>
        </Box>

        {/* Day-of-week filter for range mode */}
        {mode === "range" && (
          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Days:</Typography>
            {DAYS_OF_WEEK.map((day, i) => (
              <Chip
                key={day}
                label={day}
                size="small"
                onClick={() => setSelectedDays(prev =>
                  prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort()
                )}
                color={selectedDays.includes(i) ? "primary" : "default"}
                variant={selectedDays.includes(i) ? "filled" : "outlined"}
                sx={{ cursor: "pointer", height: 24 }}
              />
            ))}
          </Box>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Single mode results ── */}
      {mode === "single" && (
        <>
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
                          <Button size="small" variant="contained" color="primary"
                            onClick={() => openAcceptDialog(r, dayjs(startDt).toISOString(), dayjs(endDt).toISOString())}>
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
        </>
      )}

      {/* ── Range mode results ── */}
      {mode === "range" && (
        <>
          {!loading && dateGroups.length === 0 && !error && (
            <Typography color="text.secondary">
              No suggestions yet — configure the date range above and click Suggest.
            </Typography>
          )}

          {dateGroups.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {dateGroups.length} day{dateGroups.length !== 1 ? "s" : ""} ·{" "}
                {dateGroups.filter(g => g.rows.some(r => r.accepted)).length} assigned
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={handleAcceptAll}
                disabled={bulkBusy || dateGroups.every(g => g.rows.length === 0 || g.rows[0].accepted)}
                startIcon={bulkBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
                sx={{ bgcolor: "#00897b", "&:hover": { bgcolor: "#00695c" } }}
              >
                Accept Best for All Days
              </Button>
            </Box>
          )}

          {dateGroups.map(group => {
            const hasAccepted = group.rows.some(r => r.accepted);
            const topRows     = group.rows.slice(0, 5);
            return (
              <Accordion key={group.date} defaultExpanded sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, flexWrap: "wrap" }}>
                    <Typography fontWeight={600}>
                      {dayjs(group.date).format("ddd, MMM D, YYYY")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(`${group.date}T${shiftStartTime}`).format("h:mm a")}
                      {" – "}
                      {shiftEndTime <= shiftStartTime
                        ? `${dayjs(`${group.date}T${shiftEndTime}`).add(1,"day").format("h:mm a")} (+1)`
                        : dayjs(`${group.date}T${shiftEndTime}`).format("h:mm a")}
                    </Typography>
                    {hasAccepted && <Chip label="Assigned" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />}
                    {group.error && <Chip label="Error" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
                    {!group.error && group.rows.length === 0 && (
                      <Chip label="No suggestions" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
                    )}
                    {!group.error && group.rows.length > 0 && (
                      <Chip label={`${group.rows.length} candidates`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {group.error ? (
                    <Alert severity="error" sx={{ m: 1 }}>{group.error}</Alert>
                  ) : group.rows.length === 0 ? (
                    <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                      No available staff found for this day.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ "& th": { fontWeight: 600, fontSize: 12, color: "text.secondary" } }}>
                          <TableCell>Name</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell align="center">Score</TableCell>
                          <TableCell>Reasoning</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topRows.map(r => (
                          <TableRow key={r.staffId} sx={{ opacity: r.accepted ? 0.55 : 1 }}>
                            <TableCell>{r.name}</TableCell>
                            <TableCell><Chip label={r.role ?? "—"} size="small" variant="outlined" /></TableCell>
                            <TableCell align="center"><Chip label={r.score.toFixed(0)} size="small" color={scoreColor(r.score)} /></TableCell>
                            <TableCell><Typography variant="caption" color="text.secondary">{r.reasoning}</Typography></TableCell>
                            <TableCell align="center">
                              {r.accepted ? (
                                <Tooltip title="Assignment created"><CheckCircleOutlineIcon color="success" fontSize="small" /></Tooltip>
                              ) : (
                                <Button size="small" variant="contained" color="primary"
                                  onClick={() => openAcceptDialog(r, group.startUtc, group.endUtc, group.date)}>
                                  Accept
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </>
      )}

      {dialogInitial && (
        <AssignmentFormDialog
          open={dialogOpen}
          title="Confirm Assignment"
          initial={dialogInitial}
          units={unitOptions}
          roles={roleOptions}
          staff={staffOptions}
          onCancel={() => { setDialogOpen(false); setPendingRow(null); setPendingDate(null); setDialogInitial(null); }}
          onSubmit={handleDialogSubmit}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} message={toast} />
    </Container>
  );
}
