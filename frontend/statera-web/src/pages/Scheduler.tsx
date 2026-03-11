import { useState, useEffect } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import {
  Container, Typography, Box, Button, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TableSortLabel, Chip, Tooltip, Snackbar, TextField,
  ToggleButton, ToggleButtonGroup,
  Accordion, AccordionSummary, AccordionDetails,
  Divider, Switch, FormControlLabel, LinearProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TodayIcon from "@mui/icons-material/Today";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import { suggestAssignments, Suggestion } from "../api/endpoints";
import { listUnits } from "../api/units";
import { listStaff as listFacilityStaff, StaffDto } from "../api/staff";
import { createAssignment } from "../api/assignments";
import { useFacility } from "../context/facility";
import AssignmentFormDialog, { FormValues } from "../components/scheduler/AssignmentFormDialog";
import { useNotifications } from "../context/NotificationContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = {
  staffId: string;
  name: string;
  role?: string | null;
  score: number;
  reasoning: string;
  accepted?: boolean;
};

type DateGroup = {
  date: string;
  startUtc: string;
  endUtc: string;
  rows: Row[];
  error?: string | null;
};

interface RoleSlot {
  credential: string;
  enabled: boolean;
  ratio: number;   // patients per 1 staff (e.g. 8 means 1 RN per 8 patients)
}

interface AutoResult {
  date: string;
  startUtc: string;
  endUtc: string;
  slots: {
    credential: string;
    needed: number;
    assigned: string[];  // staff names
    failed: number;
  }[];
}

const CREDENTIALS = ["RN", "LPN", "CNA", "MD", "PA", "NP", "CRNA", "RRT", "EMT", "Other"];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_ROLES: RoleSlot[] = [
  { credential: "RN",  enabled: true,  ratio: 8  },
  { credential: "LPN", enabled: true,  ratio: 10 },
  { credential: "CNA", enabled: true,  ratio: 10 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Scheduler() {
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const { addNotification } = useNotifications();

  // ── Top-level schedule mode ──────────────────────────────────────────────
  const [scheduleMode, setScheduleMode] = useState<"auto" | "manual">("manual");

  // ── Shared state ─────────────────────────────────────────────────────────
  const [units, setUnits]   = useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId] = useState<string>("");

  useEffect(() => {
    let active = true;
    setUnits([]); setUnitId("");
    if (!facility) return;
    listUnits(facility.id)
      .then(u => { if (active) setUnits(u.map(x => ({ id: x.id, name: x.name }))); })
      .catch(() => { if (active) setUnits([]); });
    return () => { active = false; };
  }, [facility]);

  // ── AUTO SCHEDULE state ───────────────────────────────────────────────────
  const [census, setCensus]           = useState<number>(30);
  const [roleSlots, setRoleSlots]     = useState<RoleSlot[]>(DEFAULT_ROLES);
  const [autoFromDate, setAutoFromDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [autoToDate, setAutoToDate]   = useState(dayjs().add(6, "day").format("YYYY-MM-DD"));
  const [autoStartTime, setAutoStartTime] = useState("07:00");
  const [autoEndTime, setAutoEndTime]     = useState("15:00");
  const [autoSelectedDays, setAutoSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [autoResults, setAutoResults] = useState<AutoResult[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);
  const [autoError, setAutoError]     = useState<string | null>(null);
  const [autoSummary, setAutoSummary] = useState<string | null>(null);

  // ── MANUAL SCHEDULE state ─────────────────────────────────────────────────
  const [cred, setCred]       = useState<string>("RN");
  const [mode, setMode]       = useState<"single" | "range">("single");
  const [startDt, setStartDt] = useState(dayjs().startOf("day").add(7, "hour").format("YYYY-MM-DDTHH:mm"));
  const [endDt, setEndDt]     = useState(dayjs().startOf("day").add(15, "hour").format("YYYY-MM-DDTHH:mm"));
  const [fromDate, setFromDate]             = useState(dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate]                 = useState(dayjs().add(6, "day").format("YYYY-MM-DD"));
  const [shiftStartTime, setShiftStartTime] = useState("07:00");
  const [shiftEndTime, setShiftEndTime]     = useState("15:00");
  const [selectedDays, setSelectedDays]     = useState<number[]>([1, 2, 3, 4, 5]);
  const [rows, setRows]                     = useState<Row[]>([]);
  const [dateGroups, setDateGroups]         = useState<DateGroup[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [orderBy, setOrderBy]               = useState<"score" | "name">("score");
  const [orderDesc, setOrderDesc]           = useState(true);
  const [toast, setToast]                   = useState<string | null>(null);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [dialogInitial, setDialogInitial]   = useState<FormValues | null>(null);
  const [pendingRow, setPendingRow]         = useState<Row | null>(null);
  const [pendingDate, setPendingDate]       = useState<string | null>(null);
  const [facilityStaff, setFacilityStaff]   = useState<StaffDto[]>([]);
  const [bulkBusy, setBulkBusy]             = useState(false);

  // ── AUTO SCHEDULE logic ───────────────────────────────────────────────────

  function updateSlot(cred: string, patch: Partial<RoleSlot>) {
    setRoleSlots(prev => prev.map(s => s.credential === cred ? { ...s, ...patch } : s));
  }

  async function runAutoSchedule() {
    if (!facility) { setAutoError("Please select a facility first."); return; }
    const activeSlots = roleSlots.filter(s => s.enabled && s.ratio > 0);
    if (activeSlots.length === 0) { setAutoError("Enable at least one role."); return; }

    // Build date list
    const dates: string[] = [];
    let cursor = dayjs(autoFromDate);
    const end  = dayjs(autoToDate);
    while (!cursor.isAfter(end)) {
      if (autoSelectedDays.includes(cursor.day())) dates.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "day");
    }
    if (dates.length === 0) { setAutoError("No dates match the selected days."); return; }
    if (dates.length > 42)  { setAutoError("Limit the range to 6 weeks or fewer."); return; }

    setAutoLoading(true);
    setAutoError(null);
    setAutoResults([]);
    setAutoSummary(null);
    setAutoProgress(0);

    const staffList = await listFacilityStaff(facility.id);
    const staffMap  = new Map(staffList.map(s => [s.id, s]));
    const buildShift = (date: string) => {
      // Use dayjs.utc so the typed time is sent as-is in UTC (no browser tz offset added).
      // This matches how availability windows are stored (local-time-as-UTC on the server).
      const startUtc = dayjs.utc(`${date}T${autoStartTime}`).toISOString();
      const endDate  = autoEndTime <= autoStartTime
        ? dayjs(date).add(1, "day").format("YYYY-MM-DD")
        : date;
      const endUtc = dayjs.utc(`${endDate}T${autoEndTime}`).toISOString();
      return { startUtc, endUtc };
    };

    const results: AutoResult[] = [];
    let totalCreated = 0;
    let totalFailed  = 0;
    const totalSteps = dates.length * activeSlots.length;
    let step = 0;

    for (const date of dates) {
      const { startUtc, endUtc } = buildShift(date);
      const assignedThisSlot = new Set<string>(); // avoid double-booking on same date
      const dateResult: AutoResult = { date, startUtc, endUtc, slots: [] };

      for (const slot of activeSlots) {
        const needed = Math.ceil(census / slot.ratio);
        const slotResult = { credential: slot.credential, needed, assigned: [] as string[], failed: 0 };

        try {
          const suggestions: Suggestion[] = await suggestAssignments({
            startUtc, endUtc,
            unitId: unitId || "",
            requiredCredential: slot.credential,
            facilityId: facility.id,
          });

          // Pick top `needed` candidates not already assigned this date
          const candidates = suggestions.filter(s => !assignedThisSlot.has(s.staffId));
          const picks = candidates.slice(0, needed);

          for (const pick of picks) {
            const staffMember = staffMap.get(pick.staffId);
            const name = staffMember
              ? `${staffMember.firstName} ${staffMember.lastName}`.trim()
              : pick.staffId;
            try {
              await createAssignment(facility.id, {
                staffId: pick.staffId,
                roleId: slot.credential,
                unitId: unitId || undefined,
                start: startUtc,
                end: endUtc,
                notes: `Auto-scheduled (score ${pick.score.toFixed(0)})`,
              });
              slotResult.assigned.push(name);
              assignedThisSlot.add(pick.staffId);
              totalCreated++;
            } catch {
              slotResult.failed++;
              totalFailed++;
            }
          }
          // If we couldn't fill all slots
          if (picks.length < needed) {
            slotResult.failed += needed - picks.length;
            totalFailed += needed - picks.length;
          }
        } catch {
          slotResult.failed = needed;
          totalFailed += needed;
        }

        dateResult.slots.push(slotResult);
        step++;
        setAutoProgress(Math.round((step / totalSteps) * 100));
      }
      results.push(dateResult);
      setAutoResults([...results]);
    }

    setAutoLoading(false);
    setAutoProgress(100);
    const summary = `Auto-schedule complete: ${totalCreated} assignment${totalCreated !== 1 ? "s" : ""} created${totalFailed > 0 ? `, ${totalFailed} could not be filled` : ""}.`;
    setAutoSummary(summary);
    addNotification(summary, totalFailed > 0 ? "warning" : "success");
  }

  // ── MANUAL SCHEDULE logic ─────────────────────────────────────────────────

  async function run() {
    if (!facility) { setError("Please select a facility first."); return; }
    setError(null);
    if (mode === "single") await runSingle();
    else await runRange();
  }

  async function runSingle() {
    setLoading(true); setRows([]); setDateGroups([]);
    try {
      const startUtc = dayjs.utc(startDt).toISOString();
      const endUtc   = dayjs.utc(endDt).toISOString();
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
    } finally { setLoading(false); }
  }

  async function runRange() {
    setLoading(true); setRows([]); setDateGroups([]);
    try {
      const dates: string[] = [];
      let cursor = dayjs(fromDate);
      const end  = dayjs(toDate);
      while (!cursor.isAfter(end)) {
        if (selectedDays.includes(cursor.day())) dates.push(cursor.format("YYYY-MM-DD"));
        cursor = cursor.add(1, "day");
      }
      if (dates.length === 0) { setError("No dates match the selected days of the week."); setLoading(false); return; }
      if (dates.length > 42)  { setError("Please limit the range to 6 weeks or fewer."); setLoading(false); return; }

      const staffList = await listFacilityStaff(facility!.id);
      setFacilityStaff(staffList);
      const staffMap  = new Map(staffList.map(s => [s.id, s]));
      const buildShift = (date: string) => {
        const startUtc = dayjs.utc(`${date}T${shiftStartTime}`).toISOString();
        const endDate  = shiftEndTime <= shiftStartTime ? dayjs(date).add(1, "day").format("YYYY-MM-DD") : date;
        const endUtc   = dayjs.utc(`${endDate}T${shiftEndTime}`).toISOString();
        return { startUtc, endUtc };
      };

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
    } finally { setLoading(false); }
  }

  function openAcceptDialog(row: Row, startUtc: string, endUtc: string, date?: string) {
    setDialogInitial({ unitId: unitId || "", staffId: row.staffId, roleId: row.role ?? cred, start: startUtc, end: endUtc, notes: `Auto-assigned via scheduler (score ${row.score.toFixed(0)})` });
    setPendingRow(row); setPendingDate(date ?? null); setDialogOpen(true);
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
          g.date === pendingDate ? { ...g, rows: g.rows.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r) } : g
        ));
      } else {
        setRows(prev => prev.map(r => r.staffId === pendingRow.staffId ? { ...r, accepted: true } : r));
      }
      setToast(`Assignment created for ${pendingRow.name}`);
      addNotification(`Assignment created for ${pendingRow.name} (${values.roleId})`, "success");
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to create assignment");
    } finally { setDialogOpen(false); setPendingRow(null); setPendingDate(null); setDialogInitial(null); }
  }

  async function handleAcceptAll() {
    if (!facility || bulkBusy) return;
    setBulkBusy(true);
    const toAccept = dateGroups.filter(g => !g.error && g.rows.length > 0 && !g.rows[0].accepted);
    let created = 0; let failed = 0;
    for (const group of toAccept) {
      const best = group.rows[0];
      try {
        await createAssignment(facility.id, { staffId: best.staffId, roleId: best.role ?? cred, unitId: unitId || undefined, start: group.startUtc, end: group.endUtc, notes: `Auto-assigned via scheduler (score ${best.score.toFixed(0)})` });
        setDateGroups(prev => prev.map(g => g.date === group.date ? { ...g, rows: g.rows.map((r, i) => i === 0 ? { ...r, accepted: true } : r) } : g));
        created++;
      } catch { failed++; }
    }
    if (created > 0) {
      setToast(`${created} assignment${created !== 1 ? "s" : ""} created${failed > 0 ? `, ${failed} failed` : ""}`);
      addNotification(`Scheduler created ${created} assignments`, "success");
    } else { setError(`Failed to create assignments (${failed} errors).`); }
    setBulkBusy(false);
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
    if (score >= 70) return "success"; if (score >= 40) return "warning"; return "error";
  }

  const unitOptions  = units.map(u => ({ id: u.id, name: u.name }));
  const roleOptions  = CREDENTIALS.map(c => ({ id: c, name: c }));
  const allRows      = mode === "single" ? rows : dateGroups.flatMap(g => g.rows);
  const staffOptions = Array.from(
    new Map([
      ...allRows.map(r => [r.staffId, { id: r.staffId, label: r.name }] as [string, { id: string; label: string }]),
      ...facilityStaff.map(s => [s.id, { id: s.id, label: `${s.firstName} ${s.lastName}`.trim() }] as [string, { id: string; label: string }]),
    ]).values()
  );

  // ── Shared census preview ────────────────────────────────────────────────
  const activeSlots = roleSlots.filter(s => s.enabled && s.ratio > 0);
  const neededPerRole = activeSlots.map(s => ({ cred: s.credential, count: Math.ceil(census / s.ratio) }));

  return (
    <Container sx={{ mt: 3, pb: 4 }}>
      <Typography variant="h5" gutterBottom>Scheduler</Typography>

      {/* ── Top-level mode toggle ── */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={scheduleMode}
          exclusive
          onChange={(_, v) => { if (v) setScheduleMode(v); }}
          size="small"
        >
          <ToggleButton value="auto" sx={{ gap: 0.5 }}>
            <AutoAwesomeIcon sx={{ fontSize: 16 }} /> Auto Schedule
          </ToggleButton>
          <ToggleButton value="manual" sx={{ gap: 0.5 }}>
            <EditCalendarIcon sx={{ fontSize: 16 }} /> Manual Schedule
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ═══════════════════════════════════════════════════════════
          AUTO SCHEDULE
      ═══════════════════════════════════════════════════════════ */}
      {scheduleMode === "auto" && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your facility census and staff ratios. Statera will calculate the required staffing
            and automatically generate and assign the full schedule.
          </Typography>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            {/* Facility selector */}
            {facilities.length > 1 && (
              <Box sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <InputLabel>Facility</InputLabel>
                  <Select label="Facility" value={facility?.id ?? ""} onChange={e => setSelectedId(String(e.target.value))}>
                    {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Census & Ratios */}
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Census & Ratios</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
              <TextField
                size="small"
                label="Patient Census"
                type="number"
                value={census}
                onChange={e => setCensus(Math.max(1, Number(e.target.value)))}
                inputProps={{ min: 1 }}
                sx={{ width: 150 }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Unit</InputLabel>
                <Select label="Unit" value={unitId} onChange={e => setUnitId(String(e.target.value))} disabled={units.length === 0}>
                  <MenuItem value="">(Any unit)</MenuItem>
                  {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2.5 }}>
              {roleSlots.map(slot => (
                <Box key={slot.credential} sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={slot.enabled}
                        onChange={e => updateSlot(slot.credential, { enabled: e.target.checked })}
                        size="small"
                        color="primary"
                      />
                    }
                    label={<Typography variant="body2" sx={{ minWidth: 36, fontWeight: 600 }}>{slot.credential}</Typography>}
                    sx={{ m: 0, minWidth: 90 }}
                  />
                  {slot.enabled && (
                    <>
                      <Typography variant="body2" color="text.secondary">1 staff per</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={slot.ratio}
                        onChange={e => updateSlot(slot.credential, { ratio: Math.max(1, Number(e.target.value)) })}
                        inputProps={{ min: 1 }}
                        sx={{ width: 80 }}
                      />
                      <Typography variant="body2" color="text.secondary">patients</Typography>
                      <Chip
                        label={`= ${Math.ceil(census / slot.ratio)} needed`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </>
                  )}
                </Box>
              ))}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Date & Shift */}
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Date Range & Shift</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end", mb: 2 }}>
              <TextField size="small" label="From date" type="date" value={autoFromDate}
                onChange={e => {
                  const v = e.target.value;
                  if (v && autoFromDate && autoToDate) {
                    const diff = dayjs(autoToDate).diff(dayjs(autoFromDate), "day");
                    setAutoToDate(dayjs(v).add(diff, "day").format("YYYY-MM-DD"));
                  }
                  setAutoFromDate(v);
                }}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
              <TextField size="small" label="To date" type="date" value={autoToDate}
                onChange={e => setAutoToDate(e.target.value)}
                inputProps={{ min: autoFromDate }}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
              <TextField size="small" label="Shift start" type="time" value={autoStartTime}
                onChange={e => setAutoStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 140 }} />
              <TextField size="small" label="Shift end" type="time" value={autoEndTime}
                onChange={e => setAutoEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 140 }} />
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mb: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Days:</Typography>
              {DAYS_OF_WEEK.map((day, i) => (
                <Chip key={day} label={day} size="small"
                  onClick={() => setAutoSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort())}
                  color={autoSelectedDays.includes(i) ? "primary" : "default"}
                  variant={autoSelectedDays.includes(i) ? "filled" : "outlined"}
                  sx={{ cursor: "pointer", height: 24 }}
                />
              ))}
            </Box>

            {/* Schedule preview */}
            {neededPerRole.length > 0 && census > 0 && (
              <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Per-shift staffing plan (census: {census} patients):
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {neededPerRole.map(n => (
                    <Chip key={n.cred} label={`${n.count} ${n.cred}`} size="small" color="primary" />
                  ))}
                </Box>
              </Box>
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={autoLoading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={runAutoSchedule}
              disabled={autoLoading || !facility}
              sx={{ bgcolor: "#00897b", "&:hover": { bgcolor: "#00695c" } }}
            >
              {autoLoading ? "Generating Schedule…" : "Auto Schedule"}
            </Button>
          </Paper>

          {/* Progress */}
          {autoLoading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress variant="determinate" value={autoProgress} color="primary" />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {autoProgress}% complete…
              </Typography>
            </Box>
          )}

          {autoError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAutoError(null)}>{autoError}</Alert>}
          {autoSummary && <Alert severity={autoSummary.includes("could not") ? "warning" : "success"} sx={{ mb: 2 }}>{autoSummary}</Alert>}

          {/* Results */}
          {autoResults.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Schedule Results
              </Typography>
              {autoResults.map(result => {
                const totalAssigned = result.slots.reduce((s, sl) => s + sl.assigned.length, 0);
                const totalFailed   = result.slots.reduce((s, sl) => s + sl.failed, 0);
                return (
                  <Accordion key={result.date} defaultExpanded sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, flexWrap: "wrap" }}>
                        <Typography fontWeight={600}>{dayjs(result.date).format("ddd, MMM D, YYYY")}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(result.startUtc).format("h:mm a")} – {dayjs(result.endUtc).format("h:mm a")}
                        </Typography>
                        <Chip label={`${totalAssigned} assigned`} size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                        {totalFailed > 0 && <Chip label={`${totalFailed} unfilled`} size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ "& th": { fontWeight: 600, fontSize: 12, color: "text.secondary" } }}>
                            <TableCell>Role</TableCell>
                            <TableCell align="center">Needed</TableCell>
                            <TableCell align="center">Assigned</TableCell>
                            <TableCell>Staff</TableCell>
                            <TableCell align="center">Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.slots.map(slot => (
                            <TableRow key={slot.credential}>
                              <TableCell><Chip label={slot.credential} size="small" variant="outlined" /></TableCell>
                              <TableCell align="center">{slot.needed}</TableCell>
                              <TableCell align="center">{slot.assigned.length}</TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {slot.assigned.join(", ") || "—"}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {slot.failed === 0 ? (
                                  <Chip label="Full" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                                ) : slot.assigned.length === 0 ? (
                                  <Chip label="Unfilled" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
                                ) : (
                                  <Chip label={`${slot.failed} short`} size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MANUAL SCHEDULE (existing functionality, unchanged)
      ═══════════════════════════════════════════════════════════ */}
      {scheduleMode === "manual" && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a shift window and credential, then click <strong>Suggest</strong>. Staff are scored
            using weekly hours, constraints, rest rules, and role checks. Review each candidate and accept individually.
          </Typography>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ mb: 2 }}>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, v) => { if (v) { setMode(v); setRows([]); setDateGroups([]); } }}
                size="small"
              >
                <ToggleButton value="single"><TodayIcon sx={{ mr: 0.5, fontSize: 16 }} /> Single Shift</ToggleButton>
                <ToggleButton value="range"><CalendarMonthIcon sx={{ mr: 0.5, fontSize: 16 }} /> Date Range</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
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

            {mode === "range" && (
              <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Days:</Typography>
                {DAYS_OF_WEEK.map((day, i) => (
                  <Chip key={day} label={day} size="small"
                    onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort())}
                    color={selectedDays.includes(i) ? "primary" : "default"}
                    variant={selectedDays.includes(i) ? "filled" : "outlined"}
                    sx={{ cursor: "pointer", height: 24 }}
                  />
                ))}
              </Box>
            )}
          </Paper>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

          {mode === "single" && (
            <>
              {!loading && rows.length === 0 && !error && (
                <Typography color="text.secondary">No suggestions yet — configure the shift above and click Suggest.</Typography>
              )}
              {rows.length > 0 && (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><TableSortLabel active={orderBy === "name"} direction={orderDesc ? "desc" : "asc"} onClick={() => toggleSort("name")}>Name</TableSortLabel></TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell align="center"><TableSortLabel active={orderBy === "score"} direction={orderDesc ? "desc" : "asc"} onClick={() => toggleSort("score")}>Score</TableSortLabel></TableCell>
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
                                onClick={() => openAcceptDialog(r, dayjs.utc(startDt).toISOString(), dayjs.utc(endDt).toISOString())}>
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

          {mode === "range" && (
            <>
              {!loading && dateGroups.length === 0 && !error && (
                <Typography color="text.secondary">No suggestions yet — configure the date range above and click Suggest.</Typography>
              )}
              {dateGroups.length > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {dateGroups.length} day{dateGroups.length !== 1 ? "s" : ""} · {dateGroups.filter(g => g.rows.some(r => r.accepted)).length} assigned
                  </Typography>
                  <Button variant="contained" size="small" onClick={handleAcceptAll}
                    disabled={bulkBusy || dateGroups.every(g => g.rows.length === 0 || g.rows[0].accepted)}
                    startIcon={bulkBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{ bgcolor: "#00897b", "&:hover": { bgcolor: "#00695c" } }}>
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
                        <Typography fontWeight={600}>{dayjs(group.date).format("ddd, MMM D, YYYY")}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(`${group.date}T${shiftStartTime}`).format("h:mm a")}
                          {" – "}
                          {shiftEndTime <= shiftStartTime
                            ? `${dayjs(`${group.date}T${shiftEndTime}`).add(1, "day").format("h:mm a")} (+1)`
                            : dayjs(`${group.date}T${shiftEndTime}`).format("h:mm a")}
                        </Typography>
                        {hasAccepted && <Chip label="Assigned" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />}
                        {group.error && <Chip label="Error" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
                        {!group.error && group.rows.length === 0 && <Chip label="No suggestions" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
                        {!group.error && group.rows.length > 0 && <Chip label={`${group.rows.length} candidates`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      {group.error ? (
                        <Alert severity="error" sx={{ m: 1 }}>{group.error}</Alert>
                      ) : group.rows.length === 0 ? (
                        <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>No available staff found for this day.</Typography>
                      ) : (
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 600, fontSize: 12, color: "text.secondary" } }}>
                              <TableCell>Name</TableCell><TableCell>Role</TableCell>
                              <TableCell align="center">Score</TableCell><TableCell>Reasoning</TableCell>
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
