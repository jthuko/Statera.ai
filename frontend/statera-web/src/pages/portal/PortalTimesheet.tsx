// src/pages/portal/PortalTimesheet.tsx
// Staff portal: view worked hours in calendar format + CSV download
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Stack, Typography,
} from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import { listTimeClockEntries, type TimeClockEntryDto } from "../../api/timeclock";

function hoursStr(entry: TimeClockEntryDto): number {
  if (!entry.clockOutUtc) return 0;
  return dayjs(entry.clockOutUtc).diff(dayjs(entry.clockInUtc), "minute") / 60;
}

export default function PortalTimesheet() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current month
  const monthStart = dayjs().startOf("month");
  const monthEnd = dayjs().endOf("month");

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    try {
      const res = await listTimeClockEntries({
        staffId: user.staffId,
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
        page: 1,
        pageSize: 200,
      });
      setEntries(res.items.filter(e => e.clockOutUtc)); // only completed entries
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load timesheet.");
    } finally {
      setLoading(false);
    }
  }, [user?.staffId]);

  useEffect(() => { load(); }, [load]);

  // Aggregate by date
  const byDate: Record<string, { hours: number; entries: TimeClockEntryDto[] }> = {};
  for (const e of entries) {
    const d = dayjs(e.clockInUtc).format("YYYY-MM-DD");
    if (!byDate[d]) byDate[d] = { hours: 0, entries: [] };
    byDate[d].hours += hoursStr(e);
    byDate[d].entries.push(e);
  }

  const totalHours = Object.values(byDate).reduce((s, d) => s + d.hours, 0);
  const daysInMonth = monthEnd.date();
  const calDays = Array.from({ length: daysInMonth }, (_, i) => monthStart.add(i, "day").format("YYYY-MM-DD"));

  function downloadCsv() {
    const rows = [["Date", "Clock In", "Clock Out", "Hours", "Status", "Admin Notes"]];
    for (const e of entries) {
      rows.push([
        dayjs(e.clockInUtc).format("YYYY-MM-DD"),
        dayjs(e.clockInUtc).format("h:mm a"),
        e.clockOutUtc ? dayjs(e.clockOutUtc).format("h:mm a") : "",
        hoursStr(e).toFixed(2),
        e.status,
        e.adminNotes ?? "",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${monthStart.format("YYYY-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{monthStart.format("MMMM YYYY")}</Typography>
          <Typography variant="body2" color="text.secondary">
            Total approved hours: <strong>{totalHours.toFixed(2)}</strong>
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} size="small" onClick={downloadCsv}>
          Download CSV
        </Button>
      </Stack>

      {/* Calendar grid — 7-column CSS grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <Typography key={d} variant="caption" color="text.secondary" align="center" sx={{ fontWeight: 600, py: 0.5 }}>
            {d}
          </Typography>
        ))}

        {/* Blank cells for month start offset */}
        {Array.from({ length: dayjs(calDays[0]).day() }, (_, i) => (
          <Box key={`blank-${i}`} sx={{ height: 60 }} />
        ))}

        {calDays.map(d => {
          const dayData = byDate[d];
          const isToday = d === dayjs().format("YYYY-MM-DD");
          return (
            <Card
              key={d}
              variant="outlined"
              sx={{
                height: 60,
                borderColor: isToday ? "primary.main" : undefined,
                background: dayData ? "rgba(0,180,120,0.07)" : undefined,
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: 0.5, "&:last-child": { pb: 0.5 } }}>
                <Typography variant="caption" fontWeight={isToday ? 700 : 400} color={isToday ? "primary.main" : "text.secondary"}>
                  {dayjs(d).date()}
                </Typography>
                {dayData && (
                  <Typography variant="caption" color="success.main" display="block" fontWeight={600}>
                    {dayData.hours.toFixed(1)}h
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Entry list */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>All Entries</Typography>
      {entries.length === 0 ? (
        <Typography color="text.secondary" variant="body2">No approved entries this month.</Typography>
      ) : (
        <Stack spacing={0.75}>
          {entries.map(e => (
            <Stack key={e.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <Typography variant="body2">
                {dayjs(e.clockInUtc).format("ddd, MMM D")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dayjs(e.clockInUtc).format("h:mm a")} – {dayjs(e.clockOutUtc!).format("h:mm a")}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {hoursStr(e).toFixed(2)} hrs
              </Typography>
            </Stack>
          ))}
          <Stack direction="row" justifyContent="flex-end" sx={{ pt: 1 }}>
            <Typography variant="subtitle2">Total: {totalHours.toFixed(2)} hrs</Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
