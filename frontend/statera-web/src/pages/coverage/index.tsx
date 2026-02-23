// src/pages/coverage/index.tsx
import * as React from "react";
import {
  Box, Button, Container, Divider, FormControl, InputLabel, MenuItem,
  Select, Stack, TextField, Typography, Chip,
  Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Tooltip
} from "@mui/material";
import dayjs from "dayjs";

import { useFacility } from "../../context/facility";
import { useAuth } from "../../auth/useAuth";
import { listUnits } from "../../api/units";
import { listAssignments, type AssignmentDto } from "../../api/assignments";
import { listConstraints } from "../../api/constraints";

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

export default function CoveragePage() {
  const { facilities, selected, setSelectedId } = useFacility();
  const { user } = useAuth();
  const isOwner = user?.systemRole === "Owner";
  const facilityId = selected?.id;

  const [start, setStart] = React.useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [end, setEnd]     = React.useState(dayjs().endOf("week").format("YYYY-MM-DD"));
  const [unitId, setUnitId]   = React.useState<Guid | "ALL">("ALL");
  const [roleId, setRoleId]   = React.useState<string | "ALL">("ALL");
  const [search, setSearch]   = React.useState("");

  const [unitOptions, setUnitOptions] = React.useState<UnitOpt[]>([]);
  const [roleOptions, setRoleOptions] = React.useState<string[]>([]);
  const [rows, setRows]               = React.useState<CoverageRow[]>([]);
  const [loading, setLoading]         = React.useState(false);

  const [sortCol, setSortCol]   = React.useState<SortCol>("date");
  const [sortAsc, setSortAsc]   = React.useState(true);

  const load = React.useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [units, constraints, assignments] = await Promise.all([
        listUnits(facilityId),
        listConstraints(facilityId),
        listAssignments(facilityId, { start, end })
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
      const selectedUnits = unitId === "ALL" ? opts.map(o => o.id) : [unitId];
      const selectedRoles = roleId === "ALL" ? [...rolesSeen] : [roleId];

      const out: CoverageRow[] = [];
      for (const d of allDates) {
        for (const u of selectedUnits) {
          for (const r of selectedRoles) {
            const req = demand[`${d}|${u}|${r}`] ?? 0;
            const got = assigned[`${d}|${u}|${r}`] ?? 0;
            if (req === 0 && got === 0) continue; // skip empty rows
            out.push({
              unitId: u, unitName: unitMap[u] ?? "(Unknown)",
              date: d, roleId: r,
              required: req, assigned: got, variance: got - req
            });
          }
        }
      }
      setRows(out);
    } catch (e) {
      console.error("Failed to load coverage", e);
    } finally {
      setLoading(false);
    }
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
    if (sortCol === "date")     cmp = a.date.localeCompare(b.date);
    if (sortCol === "unit")     cmp = a.unitName.localeCompare(b.unitName);
    if (sortCol === "role")     cmp = a.roleId.localeCompare(b.roleId);
    if (sortCol === "required") cmp = a.required - b.required;
    if (sortCol === "assigned") cmp = a.assigned - b.assigned;
    if (sortCol === "variance") cmp = a.variance - b.variance;
    return sortAsc ? cmp : -cmp;
  });

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>Demand & Coverage</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={resetToThisWeek}>This week</Button>
          <Button variant="contained" onClick={load} disabled={loading}>Refresh</Button>
        </Stack>
      </Stack>

      <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
          {isOwner && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Facility</InputLabel>
              <Select
                label="Facility"
                value={facilityId ?? ""}
                onChange={e => setSelectedId(String(e.target.value))}
              >
                {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <TextField
            type="date" label="Start" size="small" value={start}
            onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date" label="End" size="small" value={end}
            onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }}
          />
          <TextField
            select label="Unit" size="small" value={unitId}
            onChange={(e) => setUnitId(e.target.value as any)} sx={{ minWidth: 180 }}
          >
            <MenuItem value="ALL">All Units</MenuItem>
            {unitOptions.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </TextField>
          <TextField
            select label="Role" size="small" value={roleId}
            onChange={(e) => setRoleId(e.target.value as any)} sx={{ minWidth: 140 }}
          >
            <MenuItem value="ALL">All Roles</MenuItem>
            {roleOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField
            size="small" label="Search unit or role"
            value={search} onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {!facilityId && (
        <Typography color="text.secondary">Select a facility to view coverage.</Typography>
      )}

      {facilityId && (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell><SortHeader col="date" label="Date" /></TableCell>
                <TableCell><SortHeader col="unit" label="Unit" /></TableCell>
                <TableCell><SortHeader col="role" label="Role" /></TableCell>
                <TableCell align="right"><SortHeader col="required" label="Required" /></TableCell>
                <TableCell align="right"><SortHeader col="assigned" label="Assigned" /></TableCell>
                <TableCell align="right"><SortHeader col="variance" label="Variance" /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>Loading…</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No data for the selected filters.</Typography>
                  </TableCell>
                </TableRow>
              ) : sorted.map((row, i) => {
                const color =
                  row.variance < 0 ? "error.main"
                  : row.variance === 0 ? "warning.main"
                  : "success.main";
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
