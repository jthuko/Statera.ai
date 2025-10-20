// src/pages/coverage/index.tsx
import * as React from "react";
import {
  Box, Button, Container, Divider, MenuItem, Stack, TextField, Typography, Chip,
  Table, TableBody, TableCell, TableHead, TableRow, Tooltip
} from "@mui/material";
import dayjs from "dayjs";

import { useFacility } from "../../context/facility";
import { listUnits } from "../../api/units";
import { listAssignments, type AssignmentDto } from "../../api/assignments";
import { listConstraints } from "../../api/constraints"; // must exist

type Guid = string;

// Constraints now assumed to reference roleId (GUID/string) instead of role name
interface ConstraintDto {
  id: Guid;
  facilityId: Guid;
  scope: "Facility" | "Unit";
  unitId?: Guid | null;
  roleId?: Guid | null;  // <-- important change
  type: string;          // e.g., MinStaffPerDay | MinStaffPerShift | RequiredHeadcount
  value: number;         // required headcount
  isActive: boolean;
  notes?: string | null;
  createdOn: string;
  updatedOn?: string | null;
}

interface UnitOpt { id: Guid; name: string; }

interface CoverageRow {
  unitId: Guid | "ALL";
  unitName: string;
  date: string;       // YYYY-MM-DD
  roleId: string;     // role GUID/id
  required: number;
  assigned: number;
  variance: number;   // assigned - required
}

export default function CoveragePage() {
  const { selected } = useFacility();
      const facilityId = selected?.id;
  

  const [start, setStart] = React.useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [end, setEnd] = React.useState(dayjs().endOf("week").format("YYYY-MM-DD"));

  const [unitId, setUnitId] = React.useState<Guid | "ALL">("ALL");
  const [roleId, setRoleId] = React.useState<string | "ALL">("ALL");

  const [unitOptions, setUnitOptions] = React.useState<UnitOpt[]>([]);
  const [roleOptions, setRoleOptions] = React.useState<string[]>([]); // list of roleIds seen in demand/assignments
  const [rows, setRows] = React.useState<CoverageRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      // Load supporting data
      const [units, constraints, assignments] = await Promise.all([
        listUnits(facilityId),
        listConstraints(facilityId),
        listAssignments(facilityId, { start, end })
      ]);

      // Units → options + map
      const unitMap: Record<string, string> = {};
      const opts = (units as any[]).map(u => ({ id: u.id as Guid, name: String(u.name) }));
      opts.forEach(u => (unitMap[u.id] = u.name));
      setUnitOptions(opts);

      // Build demand & assigned maps keyed by `${date}|${unitId}|${roleId}`
      const demand = buildDemand(constraints as unknown as ConstraintDto[], start, end, opts);
      const assigned = buildAssigned(assignments, start, end);

      // Build roleId options from both sides (present in the time window)
      const rolesSeen = new Set<string>();
      Object.keys(demand).forEach(k => rolesSeen.add(k.split("|")[2]));
      Object.keys(assigned).forEach(k => rolesSeen.add(k.split("|")[2]));
      setRoleOptions([...rolesSeen].sort());

      // Merge into rows applying filters
      const allDates = eachDay(start, end);
      const selectedUnits = unitId === "ALL" ? opts.map(o => o.id) : [unitId];
      const selectedRoles = roleId === "ALL" ? [...rolesSeen] : [roleId];

      const out: CoverageRow[] = [];
      for (const d of allDates) {
        for (const u of selectedUnits) {
          for (const r of selectedRoles) {
            const req = demand[`${d}|${u}|${r}`] ?? 0;
            const got = assigned[`${d}|${u}|${r}`] ?? 0;
            out.push({
              unitId: u,
              unitName: unitMap[u] ?? "(Unknown)",
              date: d,
              roleId: r,
              required: req,
              assigned: got,
              variance: got - req
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

  React.useEffect(() => {
    load();
  }, [load]);

  const resetToThisWeek = () => {
    setStart(dayjs().startOf("week").format("YYYY-MM-DD"));
    setEnd(dayjs().endOf("week").format("YYYY-MM-DD"));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Demand & Coverage</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={resetToThisWeek}>This week</Button>
          <Button variant="contained" onClick={load} disabled={loading}>Refresh</Button>
        </Stack>
      </Stack>

      <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            type="date" label="Start" value={start}
            onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date" label="End" value={end}
            onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }}
          />
          <TextField select label="Unit" value={unitId} onChange={(e) => setUnitId(e.target.value as any)} sx={{ minWidth: 220 }}>
            <MenuItem value="ALL">All Units</MenuItem>
            {unitOptions.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </TextField>
          <TextField select label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value as any)} sx={{ minWidth: 220 }}>
            <MenuItem value="ALL">All Roles</MenuItem>
            {roleOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      <CoverageTable rows={rows} />
    </Container>
  );
}

/** Helpers */

function eachDay(startISO: string, endISO: string): string[] {
  const s = dayjs(startISO);
  const e = dayjs(endISO);
  const out: string[] = [];
  let d = s;
  while (d.isBefore(e) || d.isSame(e, "day")) {
    out.push(d.format("YYYY-MM-DD"));
    d = d.add(1, "day");
  }
  return out;
}

/** Map constraints → daily demand per (date|unit|roleId) */
function buildDemand(constraints: ConstraintDto[], start: string, end: string, units: UnitOpt[]) {
  const dates = eachDay(start, end);
  const map: Record<string, number> = {};

  // Adjust to your real enum/string names if different
  const isDemandType = (t: string) => {
    const x = t.toLowerCase();
    return x === "minstaffperday" || x === "minstaffpershift" || x === "requiredheadcount";
  };

  for (const c of constraints) {
    if (!c.isActive || !isDemandType(c.type)) continue;

    // Facility-scoped: all units. Unit-scoped: that unit only.
    const targetUnits: Guid[] =
      c.scope === "Facility"
        ? units.map(u => u.id)
        : c.unitId
          ? [c.unitId]
          : [];

    // If constraint has a specific roleId, apply to it; if not, treat as “applies to all roles”.
    // Since we don’t have role metadata here, we’ll encode “no roleId” as applying to a synthetic key "*".
    // Later, when merging, you’ll see that only exact keys match. To make “no roleId” fan out to each role,
    // we expand it here by using a placeholder array with a single "*" and handle expansion below.
    const targetRoleIds: (string | "*")[] = c.roleId ? [c.roleId] : ["*"];

    for (const d of dates) {
      for (const u of targetUnits) {
        for (const r of targetRoleIds) {
          const key = `${d}|${u}|${r}`;
          map[key] = (map[key] ?? 0) + Number(c.value ?? 0);
        }
      }
    }
  }

  return map;
}

/** Map assignments → daily headcount per (date|unit|roleId) */
function buildAssigned(assignments: AssignmentDto[], start: string, end: string) {
  const map: Record<string, number> = {};
  for (const a of assignments) {
    if (!a.unitId || !a.roleId || !a.start) continue;

    // Extract YYYY-MM-DD from ISO start
    const date = a.start.slice(0, 10);
    if (date < start || date > end) continue;

    const key = `${date}|${a.unitId}|${a.roleId}`;
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

/** Coverage table */
function CoverageTable({ rows }: { rows: CoverageRow[] }) {
  // Group by date → unit
  const grouped: Record<string, CoverageRow[]> = {};
  for (const r of rows) {
    const k = `${r.date}|${r.unitId}`;
    (grouped[k] ??= []).push(r);
  }

  const keys = Object.keys(grouped).sort();

  return (
    <Box>
      {keys.length === 0 && (
        <Typography color="text.secondary">No data for the selected filters.</Typography>
      )}
      {keys.map(k => {
        const [date, unitId] = k.split("|");
        const first = grouped[k][0];
        const unitName = first?.unitName ?? unitId;
        // Sort by roleId for stable rendering
        const items = grouped[k].slice().sort((a,b) => a.roleId.localeCompare(b.roleId));

        return (
          <Box key={k} sx={{ mb: 3, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ px: 2, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography fontWeight={700}>{unitName}</Typography>
              <Chip label={dayjs(date).format("ddd, MMM D")} />
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell>Required</TableCell>
                  <TableCell>Assigned</TableCell>
                  <TableCell>Variance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(row => {
                  const variant = row.variance;
                  const color =
                    variant < 0 ? "error.main"
                    : variant === 0 ? "warning.main"
                    : "success.main";

                  return (
                    <TableRow key={`${row.roleId}`}>
                      <TableCell>{row.roleId}</TableCell>
                      <TableCell>{row.required}</TableCell>
                      <TableCell>{row.assigned}</TableCell>
                      <TableCell>
                        <Tooltip title={variant < 0 ? "Under-staffed" : variant > 0 ? "Over-staffed" : "On target"}>
                          <Typography sx={{ color, fontWeight: 700 }}>
                            {variant > 0 ? `+${variant}` : `${variant}`}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        );
      })}
    </Box>
  );
}
