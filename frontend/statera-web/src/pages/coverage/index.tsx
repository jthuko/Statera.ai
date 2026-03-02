// src/pages/coverage/index.tsx
import * as React from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, FormControl, InputLabel, LinearProgress, MenuItem,
  Select, Stack, Tab, Tabs, TextField, Tooltip, Typography,
  Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import InsightsIcon from "@mui/icons-material/Insights";
import RefreshIcon from "@mui/icons-material/Refresh";
import TodayIcon from "@mui/icons-material/Today";
import dayjs from "dayjs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";

import { useFacility } from "../../context/facility";
import { useAuth } from "../../auth/useAuth";
import { listUnits } from "../../api/units";
import { listAssignments, type AssignmentDto } from "../../api/assignments";
import { listConstraints } from "../../api/constraints";
import { forecastApi, type DemandPoint, type BurnoutPoint, type AiInsight, type ForecastSummary } from "../../api/forecast";

type Guid = string;

interface ConstraintDto {
  id: Guid; facilityId: Guid; scope: "Facility" | "Unit";
  unitId?: Guid | null; roleId?: Guid | null;
  type: string; value: number; isActive: boolean;
  notes?: string | null; createdOn: string; updatedOn?: string | null;
}

interface UnitOpt { id: Guid; name: string; }

interface CoverageRow {
  unitId: Guid; unitName: string; date: string;
  roleId: string; required: number; assigned: number; variance: number;
}

type SortCol = "date" | "unit" | "role" | "required" | "assigned" | "variance";

// ── Variance chip ─────────────────────────────────────────────────────────────
function VarianceChip({ variance }: { variance: number }) {
  const label = variance > 0 ? `+${variance}` : `${variance}`;
  const title = variance < 0 ? "Under-staffed" : variance > 0 ? "Over-staffed" : "On target";
  const color = variance < 0 ? "error" : variance > 0 ? "success" : "warning";
  return (
    <Tooltip title={title}>
      <Chip label={label} size="small" color={color}
        sx={{ fontWeight: 700, minWidth: 44, fontSize: 12 }} />
    </Tooltip>
  );
}

// ── Forecast tab component ────────────────────────────────────────────────────
function ForecastTab({ facilityId, unitOptions }: { facilityId: Guid; unitOptions: UnitOpt[] }) {
  const [unitId, setUnitId] = React.useState<Guid | "">(unitOptions[0]?.id ?? "");
  const [from, setFrom] = React.useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = React.useState(dayjs().add(4, "week").format("YYYY-MM-DD"));

  const [demandPoints, setDemandPoints] = React.useState<DemandPoint[]>([]);
  const [burnoutPoints, setBurnoutPoints] = React.useState<BurnoutPoint[]>([]);
  const [insights, setInsights] = React.useState<AiInsight[]>([]);
  const [summary, setSummary] = React.useState<ForecastSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Update unitId when unitOptions load
  React.useEffect(() => {
    if (!unitId && unitOptions.length > 0) setUnitId(unitOptions[0].id);
  }, [unitOptions]);

  const load = React.useCallback(async () => {
    if (!facilityId || !unitId) return;
    setLoading(true);
    setError(null);
    try {
      const [demandRes, insightsRes, burnoutRes] = await Promise.all([
        forecastApi.getDemand(facilityId, unitId, from, to),
        forecastApi.getInsights(facilityId, unitId, from, to),
        forecastApi.getBurnout(facilityId, from, to),
      ]);
      setDemandPoints(demandRes.data.points ?? []);
      setInsights(insightsRes.data.insights ?? []);
      setSummary(insightsRes.data.summary ?? null);
      setBurnoutPoints(burnoutRes.data.points ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to load forecast data");
    } finally {
      setLoading(false);
    }
  }, [facilityId, unitId, from, to]);

  React.useEffect(() => { load(); }, [load]);

  // Build recharts data
  const chartData = demandPoints.map(p => ({
    date: dayjs(p.date).format("MMM D"),
    Required: p.requiredHeads,
    "Hist. Avg": p.historicalAvgHeads,
    confidence: Math.round(p.confidence * 100),
  }));

  const insightSeverityMap: Record<string, "info" | "warning" | "error"> = {
    info: "info",
    warning: "warning",
    critical: "error",
  };

  return (
    <Box>
      {/* Filters */}
      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" alignItems="center">
            <TextField select label="Unit" size="small" value={unitId}
              onChange={e => setUnitId(e.target.value)} sx={{ minWidth: 200 }}>
              {unitOptions.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
            <TextField type="date" label="From" size="small" value={from}
              onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="To" size="small" value={to}
              onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button size="small" variant="contained" startIcon={<RefreshIcon fontSize="small" />}
              onClick={load} disabled={loading || !unitId}>
              Run Forecast
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {loading && <CircularProgress sx={{ display: "block", mx: "auto", my: 6, color: "#4db6ac" }} />}

      {error && !loading && (
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={load}>Retry</Button>
        } sx={{ mb: 2 }}>{error}</Alert>
      )}

      {!loading && !error && (
        <>
          {/* Summary chips */}
          {summary && (
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
              <Chip label={`Coverage: ${(summary.avgCoverageRate * 100).toFixed(0)}%`}
                size="small" color={summary.avgCoverageRate >= 0.9 ? "success" : "warning"} variant="outlined" />
              {summary.understaffedDays > 0 && (
                <Chip label={`${summary.understaffedDays} understaffed days`}
                  size="small" color="error" variant="outlined" />
              )}
              {summary.overtimeDays > 0 && (
                <Chip label={`${summary.overtimeDays} overtime days`}
                  size="small" color="warning" variant="outlined" />
              )}
              <Chip label={`Peak: ${summary.peakDayOfWeek}`}
                size="small" variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.15)" }} />
            </Stack>
          )}

          {/* Demand Chart */}
          {chartData.length > 0 ? (
            <Card variant="outlined" sx={{ mb: 3, borderColor: "rgba(255,255,255,0.06)", p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>
                Demand Forecast — Required vs. Historical Average
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ background: "#1e2a2a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "#ccc" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
                  <Line type="monotone" dataKey="Required" stroke="#4db6ac" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Hist. Avg" stroke="#81c784" strokeWidth={2}
                    dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ) : !loading && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No demand data for the selected unit and date range.
              Make sure Shift Templates are configured for this unit.
            </Alert>
          )}

          {/* Burnout Risk */}
          {burnoutPoints.length > 0 && (
            <Card variant="outlined" sx={{ mb: 3, borderColor: "rgba(255,255,255,0.06)" }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                  Burnout Risk (Last 4 Weeks)
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 } }}>
                      <TableCell>Staff Member</TableCell>
                      <TableCell>Risk Score</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell align="right">Shifts</TableCell>
                      <TableCell align="right">Consec. Days</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {burnoutPoints.slice(0, 10).map(p => (
                      <TableRow key={p.staffId} sx={{ "& td": { borderBottom: "1px solid rgba(255,255,255,0.04)", py: 1 } }}>
                        <TableCell>{p.staffName}</TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <LinearProgress variant="determinate"
                              value={Math.round(p.riskScore * 100)}
                              color={p.riskScore > 0.75 ? "error" : p.riskScore > 0.5 ? "warning" : "success"}
                              sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                            <Typography variant="caption" sx={{ minWidth: 36, textAlign: "right" }}>
                              {(p.riskScore * 100).toFixed(0)}%
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{p.hoursLast4Wk.toFixed(1)}h</TableCell>
                        <TableCell align="right">{p.shiftsLast4Wk}</TableCell>
                        <TableCell align="right">{p.consecutiveDays}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* AI Insights */}
          {insights.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                AI Insights
              </Typography>
              {insights.map((insight, i) => (
                <Alert key={i}
                  severity={insightSeverityMap[insight.severity] ?? "info"}
                  sx={{ borderRadius: 2, "& .MuiAlert-message": { width: "100%" } }}>
                  <Typography variant="body2" fontWeight={700} mb={0.5}>{insight.title}</Typography>
                  <Typography variant="body2">{insight.body}</Typography>
                </Alert>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}

// ── Main CoveragePage ─────────────────────────────────────────────────────────
export default function CoveragePage() {
  const { facilities, selected, setSelectedId } = useFacility();
  const { user } = useAuth();
  const isOwner = user?.systemRole === "Owner";
  const facilityId = selected?.id;

  const [tab, setTab] = React.useState(0);
  const [start, setStart] = React.useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [end, setEnd] = React.useState(dayjs().endOf("week").format("YYYY-MM-DD"));
  const [unitId, setUnitId] = React.useState<Guid | "ALL">("ALL");
  const [roleId, setRoleId] = React.useState<string | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [unitOptions, setUnitOptions] = React.useState<UnitOpt[]>([]);
  const [roleOptions, setRoleOptions] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<CoverageRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sortCol, setSortCol] = React.useState<SortCol>("date");
  const [sortAsc, setSortAsc] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [units, constraints, assignments] = await Promise.all([
        listUnits(facilityId),
        listConstraints(facilityId),
        listAssignments(facilityId, { start, end }),
      ]);
      const unitMap: Record<string, string> = {};
      const opts = (units as any[]).map(u => ({ id: u.id as Guid, name: String(u.name) }));
      opts.forEach(u => (unitMap[u.id] = u.name));
      setUnitOptions(opts);

      const demand = buildDemand(constraints as unknown as ConstraintDto[], start, end, opts);
      const assigned = buildAssigned(assignments, start, end);

      const rolesSeen = new Set<string>();
      Object.keys(demand).forEach(k => rolesSeen.add(k.split("|")[2]));
      Object.keys(assigned).forEach(k => rolesSeen.add(k.split("|")[2]));
      setRoleOptions([...rolesSeen].sort());

      const allDates = eachDay(start, end);
      const selUnits = unitId === "ALL" ? opts.map(o => o.id) : [unitId];
      const selRoles = roleId === "ALL" ? [...rolesSeen] : [roleId];

      const out: CoverageRow[] = [];
      for (const d of allDates) {
        for (const u of selUnits) {
          for (const r of selRoles) {
            const req = demand[`${d}|${u}|${r}`] ?? 0;
            const got = assigned[`${d}|${u}|${r}`] ?? 0;
            if (req === 0 && got === 0) continue;
            out.push({ unitId: u, unitName: unitMap[u] ?? "(Unknown)", date: d, roleId: r, required: req, assigned: got, variance: got - req });
          }
        }
      }
      setRows(out);
    } catch (e) {
      console.error("Failed to load coverage", e);
    } finally { setLoading(false); }
  }, [facilityId, start, end, unitId, roleId]);

  React.useEffect(() => { load(); }, [load]);

  const resetToThisWeek = () => {
    setStart(dayjs().startOf("week").format("YYYY-MM-DD"));
    setEnd(dayjs().endOf("week").format("YYYY-MM-DD"));
  };

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  }

  const filtered = rows.filter(r =>
    search === "" ||
    r.unitName.toLowerCase().includes(search.toLowerCase()) ||
    r.roleId.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "date") cmp = a.date.localeCompare(b.date);
    if (sortCol === "unit") cmp = a.unitName.localeCompare(b.unitName);
    if (sortCol === "role") cmp = a.roleId.localeCompare(b.roleId);
    if (sortCol === "required") cmp = a.required - b.required;
    if (sortCol === "assigned") cmp = a.assigned - b.assigned;
    if (sortCol === "variance") cmp = a.variance - b.variance;
    return sortAsc ? cmp : -cmp;
  });

  const underCount = sorted.filter(r => r.variance < 0).length;
  const onTarget = sorted.filter(r => r.variance === 0).length;
  const overCount = sorted.filter(r => r.variance > 0).length;

  function SortHeader({ col, label }: { col: SortCol; label: string }) {
    return (
      <TableSortLabel
        active={sortCol === col}
        direction={sortCol === col ? (sortAsc ? "asc" : "desc") : "asc"}
        onClick={() => toggleSort(col)}
      >
        {label}
      </TableSortLabel>
    );
  }

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
                <BarChartIcon sx={{ color: "#4db6ac", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Demand & Coverage</Typography>
                <Typography variant="caption" color="text.secondary">
                  {tab === 0
                    ? `${dayjs(start).format("MMM D")} – ${dayjs(end).format("MMM D, YYYY")}`
                    : "AI-powered staffing forecast"}
                </Typography>
              </Box>
            </Stack>
            {tab === 0 && (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" startIcon={<TodayIcon fontSize="small" />}
                  onClick={resetToThisWeek}
                  sx={{ borderColor: "rgba(255,255,255,0.15)", fontSize: 12 }}>
                  This week
                </Button>
                <Button size="small" variant="contained" startIcon={<RefreshIcon fontSize="small" />}
                  onClick={load} disabled={loading}>
                  Refresh
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2,
        "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 40 },
        "& .MuiTabs-indicator": { bgcolor: "#4db6ac" },
      }}>
        <Tab label="Coverage" />
        <Tab label="Forecast & Insights" icon={<InsightsIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {/* ── Facility selector (owner only, both tabs) ── */}
      {isOwner && (
        <Box sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Facility</InputLabel>
            <Select label="Facility" value={facilityId ?? ""}
              onChange={e => setSelectedId(String(e.target.value))}>
              {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      )}

      {!facilityId && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>Select a facility to view coverage.</Alert>
      )}

      {/* ── Tab 0: Coverage table ── */}
      {tab === 0 && facilityId && (
        <>
          {/* Summary chips */}
          {!loading && sorted.length > 0 && (
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
              <Chip label={`${sorted.length} slots`} size="small" variant="outlined"
                sx={{ borderColor: "rgba(255,255,255,0.15)" }} />
              {underCount > 0 && (
                <Chip label={`${underCount} under-staffed`} size="small" color="error" variant="outlined" />
              )}
              {onTarget > 0 && (
                <Chip label={`${onTarget} on target`} size="small" color="warning" variant="outlined" />
              )}
              {overCount > 0 && (
                <Chip label={`${overCount} over-staffed`} size="small" color="success" variant="outlined" />
              )}
            </Stack>
          )}

          {/* Filters */}
          <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" alignItems="center">
                <TextField type="date" label="Start" size="small" value={start}
                  onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField type="date" label="End" size="small" value={end}
                  onChange={e => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField select label="Unit" size="small" value={unitId}
                  onChange={e => setUnitId(e.target.value as any)} sx={{ minWidth: 180 }}>
                  <MenuItem value="ALL">All Units</MenuItem>
                  {unitOptions.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                </TextField>
                <TextField select label="Role" size="small" value={roleId}
                  onChange={e => setRoleId(e.target.value as any)} sx={{ minWidth: 140 }}>
                  <MenuItem value="ALL">All Roles</MenuItem>
                  {roleOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Search" value={search}
                  onChange={e => setSearch(e.target.value)} sx={{ minWidth: 180 }} />
              </Stack>
            </CardContent>
          </Card>

          {/* Table */}
          <Box sx={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 1.5, overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow sx={{
                    "& th": {
                      bgcolor: "rgba(0,55,55,0.55)",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      py: 1.25,
                      whiteSpace: "nowrap",
                    },
                  }}>
                    <TableCell sx={{ pl: 2 }}><SortHeader col="date" label="Date" /></TableCell>
                    <TableCell><SortHeader col="unit" label="Unit" /></TableCell>
                    <TableCell><SortHeader col="role" label="Role" /></TableCell>
                    <TableCell align="right"><SortHeader col="required" label="Required" /></TableCell>
                    <TableCell align="right"><SortHeader col="assigned" label="Assigned" /></TableCell>
                    <TableCell align="center"><SortHeader col="variance" label="Variance" /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, border: 0 }}>
                        <CircularProgress size={26} sx={{ color: "#4db6ac" }} />
                      </TableCell>
                    </TableRow>
                  ) : sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8, border: 0 }}>
                        <BarChartIcon sx={{ fontSize: 40, color: "text.disabled", opacity: 0.25, mb: 1, display: "block", mx: "auto" }} />
                        <Typography color="text.secondary" variant="body2">No data for the selected filters.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : sorted.map((row, i) => (
                    <TableRow key={i} hover sx={{
                      borderLeft: row.variance < 0 ? "3px solid #c62828" : row.variance > 0 ? "3px solid #2e7d32" : "3px solid #e65100",
                      "& td": { borderBottom: "1px solid rgba(255,255,255,0.05)", py: 1.25 },
                      "&:last-child td": { borderBottom: 0 },
                      "&:hover": { bgcolor: "rgba(255,255,255,0.025) !important" },
                    }}>
                      <TableCell sx={{ pl: 2, fontWeight: 500 }}>{dayjs(row.date).format("ddd, MMM D")}</TableCell>
                      <TableCell>{row.unitName}</TableCell>
                      <TableCell>
                        <Chip label={row.roleId} size="small" variant="outlined"
                          sx={{ fontSize: 11, height: 20, borderColor: "rgba(255,255,255,0.15)" }} />
                      </TableCell>
                      <TableCell align="right">{row.required}</TableCell>
                      <TableCell align="right">{row.assigned}</TableCell>
                      <TableCell align="center"><VarianceChip variance={row.variance} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </>
      )}

      {/* ── Tab 1: Forecast ── */}
      {tab === 1 && facilityId && (
        <ForecastTab facilityId={facilityId} unitOptions={unitOptions} />
      )}
    </Container>
  );
}

function eachDay(startISO: string, endISO: string): string[] {
  const s = dayjs(startISO); const e = dayjs(endISO);
  const out: string[] = [];
  let d = s;
  while (d.isBefore(e) || d.isSame(e, "day")) { out.push(d.format("YYYY-MM-DD")); d = d.add(1, "day"); }
  return out;
}

function buildDemand(constraints: ConstraintDto[], start: string, end: string, units: UnitOpt[]) {
  const dates = eachDay(start, end);
  const map: Record<string, number> = {};
  const isDemandType = (t: string) => {
    const x = t.toLowerCase();
    return x === "minstaffperday" || x === "minstaffpershift" || x === "requiredheadcount";
  };
  for (const c of constraints) {
    if (!c.isActive || !isDemandType(c.type)) continue;
    const targetUnits: Guid[] = c.scope === "Facility" ? units.map(u => u.id) : c.unitId ? [c.unitId] : [];
    const targetRoles = c.roleId ? [c.roleId] : ["*"];
    for (const d of dates) for (const u of targetUnits) for (const r of targetRoles) {
      const key = `${d}|${u}|${r}`;
      map[key] = (map[key] ?? 0) + Number(c.value ?? 0);
    }
  }
  return map;
}

function buildAssigned(assignments: AssignmentDto[], start: string, end: string) {
  const map: Record<string, number> = {};
  for (const a of assignments) {
    if (!a.unitId || !a.roleId || !a.start) continue;
    const date = a.start.slice(0, 10);
    if (date < start || date > end) continue;
    const key = `${date}|${a.unitId}|${a.roleId}`;
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}
