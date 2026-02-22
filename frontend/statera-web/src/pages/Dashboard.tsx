import { useEffect, useState } from "react";
import {
  Box, Card, CardContent, CircularProgress, Container,
  Grid, Typography, Divider, Alert, MenuItem, TextField,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import RuleIcon from "@mui/icons-material/Rule";
import dayjs from "dayjs";
import { listStaff as listFacilityStaff } from "../api/staff";
import { listAssignments } from "../api/assignments";
import { listTimeOff } from "../api/timeoff";
import { listConstraints } from "../api/constraints";
import { listUnits } from "../api/units";
import { useFacility } from "../context/facility";
import { useAuth } from "../auth/useAuth";

type StatCard = {
  label: string;
  value: number | string;
  icon: JSX.Element;
  color: string;
};

function Stat({ label, value, icon, color }: StatCard) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: color, color: "white", flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

type UpcomingRow = {
  id: string;
  name: string;
  role: string;
  unit: string;
  date: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const facilityId = facility?.id ?? "";
  const isOwner = user?.systemRole === "Owner";

  const [staffCount, setStaffCount]          = useState<number | null>(null);
  const [assignmentsThisWeek, setAssignments] = useState<number | null>(null);
  const [pendingTimeOff, setPendingTimeOff]  = useState<number | null>(null);
  const [constraintCount, setConstraints]    = useState<number | null>(null);
  const [upcomingRows, setUpcomingRows]      = useState<UpcomingRow[]>([]);
  const [loading, setLoading]                = useState(false);
  const [error, setError]                    = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    let active = true;
    setLoading(true);
    setError(null);

    const weekStart = dayjs().startOf("isoWeek").toISOString();
    const weekEnd   = dayjs().endOf("isoWeek").toISOString();
    const now       = dayjs().toISOString();
    const threeDays = dayjs().add(3, "day").toISOString();

    Promise.all([
      listFacilityStaff(facilityId).catch(() => []),
      listAssignments(facilityId, { start: weekStart, end: weekEnd }).catch(() => []),
      listTimeOff({ facilityId, status: "Pending" }).catch(() => ({ total: 0, items: [] })),
      listConstraints(facilityId).catch(() => []),
      listAssignments(facilityId, { start: now, end: threeDays }).catch(() => []),
      listUnits(facilityId).catch(() => []),
    ]).then(([staff, assignments, timeOff, constraints, upcoming, units]) => {
      if (!active) return;
      setStaffCount(staff.length);
      setAssignments(assignments.length);
      setPendingTimeOff(timeOff.total);
      setConstraints(constraints.length);

      // Build lookup maps for display
      const staffMap = new Map<string, string>(
        staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`])
      );
      const unitMap = new Map<string, string>(
        units.map((u) => [u.id, u.name])
      );

      const rows: UpcomingRow[] = upcoming.slice(0, 10).map((a) => ({
        id: a.id,
        name: staffMap.get(a.staffId) ?? a.staffId,
        role: a.roleId ?? "—",
        unit: unitMap.get(a.unitId) ?? (a.unitId ? a.unitId : "—"),
        date: dayjs(a.start).format("ddd MMM D, h:mm a"),
      }));

      setUpcomingRows(rows);
    }).catch(() => {
      if (active) setError("Failed to load dashboard data.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [facilityId]);

  return (
    <Container maxWidth="lg" sx={{ mt: 3, pb: 4 }}>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
          {facility && !isOwner && (
            <Typography variant="body2" color="text.secondary">{facility.name}</Typography>
          )}
        </Box>

        {isOwner && facilities.length > 0 && (
          <TextField
            select
            label="Facility"
            value={facilityId}
            onChange={(e) => setSelectedId(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            {facilities.map((f) => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {!facilityId && (
        <Alert severity="info">Select a facility to see stats.</Alert>
      )}

      {loading && <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && facilityId && (
        <>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Stat
                label="Active Staff"
                value={staffCount ?? "—"}
                icon={<GroupIcon />}
                color="#1565c0"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat
                label="Assignments this week"
                value={assignmentsThisWeek ?? "—"}
                icon={<AssignmentIcon />}
                color="#2e7d32"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat
                label="Pending Time-Off"
                value={pendingTimeOff ?? "—"}
                icon={<BeachAccessIcon />}
                color={pendingTimeOff ? "#e65100" : "#757575"}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat
                label="Active Constraints"
                value={constraintCount ?? "—"}
                icon={<RuleIcon />}
                color="#6a1b9a"
              />
            </Grid>
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>Upcoming Assignments (next 3 days)</Typography>
              <Divider sx={{ mb: 1 }} />
              {upcomingRows.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingRows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.role}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography color="text.secondary" sx={{ py: 2 }}>
                  No upcoming assignments in the next 3 days.
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Container>
  );
}
