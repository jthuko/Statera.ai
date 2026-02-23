// src/pages/portal/PortalTimesheet.tsx
// Staff portal: worked hours in calendar format + CSV download (includes lunch/payroll)
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Stack, Typography,
} from "@mui/material";
import { Download as DownloadIcon, ChevronLeft, ChevronRight } from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import { listTimeClockEntries, type TimeClockEntryDto } from "../../api/timeclock";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  ClockedIn: "warning", OnLunch: "info", ClockedOut: "default",
  Approved: "success", Denied: "error", Adjusted: "success", PendingCorrection: "warning",
};

function netHours(e: TimeClockEntryDto): number {
  if (!e.clockOutUtc) return 0;
  const total = dayjs(e.clockOutUtc).diff(dayjs(e.clockInUtc), "minute");
  const lunch = (e.lunchOutUtc && e.lunchInUtc)
    ? dayjs(e.lunchInUtc).diff(dayjs(e.lunchOutUtc), "minute") : 0;
  return Math.max(0, total - lunch) / 60;
}

function lunchHours(e: TimeClockEntryDto): number {
  if (!e.lunchOutUtc || !e.lunchInUtc) return 0;
  return dayjs(e.lunchInUtc).diff(dayjs(e.lunchOutUtc), "minute") / 60;
}

function fmt(iso: string | null | undefined) {
  return iso ? dayjs(iso).format("h:mm a") : "";
}

export default function PortalTimesheet() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const month = dayjs().startOf("month").add(monthOffset, "month");
  const monthStart = month.startOf("month");
  const monthEnd   = month.endOf("month");

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await listTimeClockEntries({
        staffId: user.staffId,
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
        page: 1,
        pageSize: 200,
      });
      setEntries(res.items);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load timesheet.");
    } finally { setLoading(false); }
  }, [user?.staffId, monthStart.toISOString()]);

  useEffect(() => { load(); }, [load]);

  const byDate: Record<string, TimeClockEntryDto[]> = {};
  for (const e of entries) {
    const d = dayjs(e.clockInUtc).format("YYYY-MM-DD");
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }

  const completedEntries = entries.filter(e => e.clockOutUtc);
  const totalNet   = completedEntries.reduce((s, e) => s + netHours(e), 0);
  const totalLunch = completedEntries.reduce((s, e) => s + lunchHours(e), 0);

  const daysInMonth = monthStart.daysInMonth();
  const calDays = Array.from({ length: daysInMonth }, (_, i) =>
    monthStart.add(i, "day").format("YYYY-MM-DD"));

  function downloadCsv() {
    const rows = [
      ["Date", "Day", "Clock In", "Clock Out", "Lunch Start", "Lunch End", "Lunch (hrs)", "Net Hours Worked", "Status", "Admin Notes"],
    ];
    for (const e of completedEntries) {
      const lh = lunchHours(e);
      rows.push([
        dayjs(e.clockInUtc).format("YYYY-MM-DD"),
        dayjs(e.clockInUtc).format("ddd"),
        fmt(e.clockInUtc),
        fmt(e.clockOutUtc),
        fmt(e.lunchOutUtc),
        fmt(e.lunchInUtc),
        lh > 0 ? lh.toFixed(2) : "",
        netHours(e).toFixed(2),
        e.status,
        e.adminNotes ?? "",
      ]);
    }
    rows.push(["", "", "", "", "", "TOTAL", totalLunch.toFixed(2), totalNet.toFixed(2), "", ""]);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${monthStart.format("YYYY-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button size="small" onClick={() => setMonthOffset(o => o - 1)}><ChevronLeft /></Button>
          <Box>
            <Typography variant="h6" fontWeight={700}>{monthStart.format("MMMM YYYY")}</Typography>
            <Typography variant="body2" color="text.secondary">
              Net: <strong>{totalNet.toFixed(2)}h</strong>
              {totalLunch > 0 && <span style={{ marginLeft: 8 }}>Lunch: <strong>{totalLunch.toFixed(2)}h</strong></span>}
            </Typography>
          </Box>
          <Button size="small" onClick={() => setMonthOffset(o => o + 1)}><ChevronRight /></Button>
        </Stack>
        <Button variant="outlined" startIcon={<DownloadIcon />} size="small" onClick={downloadCsv}
          disabled={completedEntries.length === 0}>
          Download CSV
        </Button>
      </Stack>

      {/* Calendar grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 3 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <Typography key={d} variant="caption" color="text.secondary" align="center" fontWeight={600} sx={{ py: 0.5 }}>
            {d}
          </Typography>
        ))}
        {Array.from({ length: dayjs(calDays[0]).day() }, (_, i) => <Box key={`b${i}`} />)}
        {calDays.map(d => {
          const dayEntries = byDate[d] ?? [];
          const totalHrs   = dayEntries.reduce((s, e) => s + netHours(e), 0);
          const lunchHrs   = dayEntries.reduce((s, e) => s + lunchHours(e), 0);
          const isToday    = d === dayjs().format("YYYY-MM-DD");
          const hasPending = dayEntries.some(e => e.status === "PendingCorrection");
          return (
            <Card key={d} variant="outlined" sx={{
              height: 60,
              borderColor: isToday ? "primary.main" : hasPending ? "warning.main" : undefined,
              background: dayEntries.length > 0 ? "rgba(0,180,120,0.07)" : undefined,
            }}>
              <CardContent sx={{ p: 0.5, "&:last-child": { pb: 0.5 } }}>
                <Typography variant="caption" fontWeight={isToday ? 700 : 400}
                  color={isToday ? "primary.main" : "text.secondary"}>
                  {dayjs(d).date()}
                </Typography>
                {totalHrs > 0 && (
                  <Typography variant="caption" color="success.main" display="block" fontWeight={600}>
                    {totalHrs.toFixed(1)}h
                  </Typography>
                )}
                {lunchHrs > 0 && (
                  <Typography variant="caption" color="info.main" display="block" sx={{ fontSize: 9 }}>
                    🍴{lunchHrs.toFixed(1)}h
                  </Typography>
                )}
                {hasPending && (
                  <Typography variant="caption" color="warning.main" display="block" sx={{ fontSize: 9 }}>⏳</Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Entry list */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>All Entries</Typography>
      {entries.length === 0 ? (
        <Typography color="text.secondary" variant="body2">No entries this month.</Typography>
      ) : (
        <Stack spacing={0.75}>
          {entries.map(e => (
            <Card key={e.id} variant="outlined">
              <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }}
                  justifyContent="space-between" flexWrap="wrap" gap={0.5}>
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 110 }}>
                    {dayjs(e.clockInUtc).format("ddd, MMM D")}
                  </Typography>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {fmt(e.clockInUtc)} – {fmt(e.clockOutUtc) || "In progress"}
                    </Typography>
                    {e.lunchOutUtc && (
                      <Typography variant="caption" color="info.main" display="block">
                        🍴 Lunch {fmt(e.lunchOutUtc)} – {fmt(e.lunchInUtc)}
                        {e.lunchMinutes != null ? ` (${e.lunchMinutes}m)` : ""}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" fontWeight={600}>
                    {e.clockOutUtc ? `${netHours(e).toFixed(2)}h` : "—"}
                  </Typography>
                  <Chip label={e.status} size="small" color={STATUS_COLOR[e.status] ?? "default"} />
                </Stack>
                {e.adminNotes && (
                  <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
                    Admin note: {e.adminNotes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
          <Stack direction="row" justifyContent="flex-end" sx={{ pt: 1 }}>
            <Typography variant="subtitle2">
              Total: {totalNet.toFixed(2)} hrs worked
              {totalLunch > 0 && ` | ${totalLunch.toFixed(2)} hrs lunch`}
            </Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
