import { useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Card, CardContent, Chip, CircularProgress,
  Container, Grid, MenuItem, Skeleton, Stack, TextField, Typography,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import RuleIcon from "@mui/icons-material/Rule";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import dayjs from "dayjs";
import { listStaff as listFacilityStaff } from "../api/staff";
import { listAssignments } from "../api/assignments";
import { listTimeOff } from "../api/timeoff";
import { listConstraints } from "../api/constraints";
import { listUnits } from "../api/units";
import { listOpenShifts } from "../api/openShifts";
import { useFacility } from "../context/facility";
import { useAuth } from "../auth/useAuth";

// ─── Stat card ───────────────────────────────────────────────────────────────

type StatCard = { label: string; value: number | string; icon: JSX.Element; color: string };

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

// ─── Upcoming shift types ─────────────────────────────────────────────────────

type UpcomingRow = {
  id: string;
  name: string;
  role: string;
  unit: string;
  startIso: string;
  endIso: string | null;
  dayKey: string; // YYYY-MM-DD for grouping
};

// ─── Role → accent color (teal-aware palette for dark mode) ──────────────────

const ROLE_COLORS: Record<string, string> = {
  RN:           "#1e88e5",
  LPN:          "#ab47bc",
  CNA:          "#26a69a",
  Manager:      "#ef6c00",
  Cook:         "#e53935",
  Receptionist: "#29b6f6",
  Other:        "#78909c",
};

function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? "#00897b";
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ─── Day label ────────────────────────────────────────────────────────────────

function getDayLabel(dayKey: string) {
  const today    = dayjs().format("YYYY-MM-DD");
  const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
  if (dayKey === today)    return { label: "Today",    sub: dayjs(dayKey).format("ddd, MMM D") };
  if (dayKey === tomorrow) return { label: "Tomorrow", sub: dayjs(dayKey).format("ddd, MMM D") };
  return { label: dayjs(dayKey).format("dddd"), sub: dayjs(dayKey).format("MMM D") };
}

// ─── Single shift card ────────────────────────────────────────────────────────

function ShiftCard({ row }: { row: UpcomingRow }) {
  const color = getRoleColor(row.role);
  const timeStr = dayjs(row.startIso).format("h:mm A");
  const endStr  = row.endIso ? dayjs(row.endIso).format("h:mm A") : null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${color}`,
        bgcolor: "rgba(255,255,255,0.02)",
        transition: "background 0.15s",
        "&:hover": { bgcolor: "rgba(0,137,123,0.07)" },
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 40, height: 40, fontSize: 14, fontWeight: 700,
          bgcolor: `${color}22`,
          color,
          border: `1px solid ${color}44`,
          flexShrink: 0,
        }}
      >
        {getInitials(row.name)}
      </Avatar>

      {/* Name + time */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} noWrap sx={{ fontSize: 14 }}>
          {row.name}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
          <AccessTimeIcon sx={{ fontSize: 12, color: "text.disabled" }} />
          <Typography variant="caption" color="text.secondary">
            {endStr ? `${timeStr} – ${endStr}` : timeStr}
          </Typography>
        </Stack>
      </Box>

      {/* Role chip */}
      {row.role && row.role !== "—" && (
        <Chip
          label={row.role}
          size="small"
          sx={{
            bgcolor: `${color}22`,
            color,
            border: `1px solid ${color}44`,
            fontWeight: 600,
            fontSize: 11,
            height: 22,
            flexShrink: 0,
          }}
        />
      )}

      {/* Unit */}
      {row.unit && row.unit !== "—" && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, display: { xs: "none", sm: "flex" } }}>
          <MeetingRoomIcon sx={{ fontSize: 13, color: "text.disabled" }} />
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
            {row.unit}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

// ─── Upcoming section ─────────────────────────────────────────────────────────

function UpcomingShifts({ rows, loading }: { rows: UpcomingRow[]; loading: boolean }) {
  // Group by dayKey
  const groups: { dayKey: string; rows: UpcomingRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === row.dayKey) {
      last.rows.push(row);
    } else {
      groups.push({ dayKey: row.dayKey, rows: [row] });
    }
  }

  return (
    <Card variant="outlined">
      {/* Header */}
      <Box
        sx={{
          px: 2.5, py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(90deg, rgba(0,77,77,0.35) 0%, transparent 100%)",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <CalendarTodayIcon sx={{ color: "primary.main", fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Upcoming Shifts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Next 3 days
          </Typography>
        </Box>
        {!loading && rows.length > 0 && (
          <Chip
            label={`${rows.length} shift${rows.length !== 1 ? "s" : ""}`}
            size="small"
            sx={{
              bgcolor: "rgba(0,77,77,0.4)",
              color: "#4db6ac",
              border: "1px solid rgba(0,137,123,0.3)",
              fontWeight: 600,
              fontSize: 11,
            }}
          />
        )}
      </Box>

      <CardContent sx={{ p: 2 }}>
        {loading ? (
          <Stack spacing={1.5}>
            {[...Array(4)].map((_, i) => (
              <Box key={i} sx={{ display: "flex", gap: 2, alignItems: "center", px: 1 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="50%" height={18} />
                  <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
                </Box>
                <Skeleton width={50} height={22} sx={{ borderRadius: 4 }} />
              </Box>
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <CalendarTodayIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1, opacity: 0.4 }} />
            <Typography color="text.secondary" fontWeight={500}>No upcoming shifts</Typography>
            <Typography variant="caption" color="text.disabled">
              No assignments scheduled in the next 3 days
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {groups.map(({ dayKey, rows: dayRows }) => {
              const { label, sub } = getDayLabel(dayKey);
              const isToday = label === "Today";
              return (
                <Box key={dayKey}>
                  {/* Day header */}
                  <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        color: isToday ? "#4db6ac" : "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        fontSize: 11,
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {sub}
                    </Typography>
                    {isToday && (
                      <Box
                        sx={{
                          width: 6, height: 6, borderRadius: "50%",
                          bgcolor: "#4db6ac", ml: 0.5,
                          boxShadow: "0 0 6px #4db6ac",
                        }}
                      />
                    )}
                  </Stack>

                  <Stack spacing={1}>
                    {dayRows.map(row => <ShiftCard key={row.id} row={row} />)}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const facilityId = facility?.id ?? "";
  const isOwner = user?.systemRole === "Owner";

  const [staffCount, setStaffCount]          = useState<number | null>(null);
  const [assignmentsThisWeek, setAssignments] = useState<number | null>(null);
  const [pendingTimeOff, setPendingTimeOff]  = useState<number | null>(null);
  const [constraintCount, setConstraints]    = useState<number | null>(null);
  const [openShiftCount, setOpenShiftCount]  = useState<number | null>(null);
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
      listOpenShifts(facilityId, { status: "Open" }).catch(() => []),
      listAssignments(facilityId, { start: now, end: threeDays }).catch(() => []),
      listUnits(facilityId).catch(() => []),
    ]).then(([staff, assignments, timeOff, constraints, openShifts, upcoming, units]) => {
      if (!active) return;
      setStaffCount(staff.length);
      setAssignments(assignments.length);
      setPendingTimeOff(timeOff.total);
      setConstraints(constraints.length);
      setOpenShiftCount(openShifts.length);

      const staffMap = new Map<string, string>(
        staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`])
      );
      const unitMap = new Map<string, string>(
        units.map((u) => [u.id, u.name])
      );

      const rows: UpcomingRow[] = upcoming.slice(0, 10).map((a) => ({
        id:       a.id,
        name:     staffMap.get(a.staffId) ?? a.staffId,
        role:     a.roleId ?? "—",
        unit:     unitMap.get(a.unitId) ?? (a.unitId ? a.unitId : "—"),
        startIso: a.start,
        endIso:   (a as any).end ?? null,
        dayKey:   dayjs(a.start).format("YYYY-MM-DD"),
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
      {/* Page header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
          {facility && !isOwner && (
            <Typography variant="body2" color="text.secondary">{facility.name}</Typography>
          )}
        </Box>
        {isOwner && facilities.length > 0 && (
          <TextField
            select label="Facility" value={facilityId}
            onChange={(e) => setSelectedId(e.target.value)}
            size="small" sx={{ minWidth: 220 }}
          >
            {facilities.map((f) => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {!facilityId && <Alert severity="info">Select a facility to see stats.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      {facilityId && (
        <>
          {/* Stat cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Stat label="Active Staff"            value={staffCount ?? "—"}          icon={<GroupIcon />}      color="#1565c0" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat label="Assignments this week"   value={assignmentsThisWeek ?? "—"} icon={<AssignmentIcon />} color="#2e7d32" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat label="Pending Time-Off"        value={pendingTimeOff ?? "—"}      icon={<BeachAccessIcon />} color={pendingTimeOff ? "#e65100" : "#757575"} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat label="Open Shifts"             value={openShiftCount ?? "—"}      icon={<CalendarTodayIcon />} color="#00897b" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stat label="Active Constraints"      value={constraintCount ?? "—"}     icon={<RuleIcon />}       color="#6a1b9a" />
            </Grid>
          </Grid>

          {/* Upcoming shifts */}
          <UpcomingShifts rows={upcomingRows} loading={loading} />
        </>
      )}
    </Container>
  );
}
