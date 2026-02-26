// src/pages/portal/PortalTimesheet.tsx
// Staff portal: worked hours in calendar format + CSV download (includes lunch/payroll)
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Stack, Typography,
} from "@mui/material";
import { Download as DownloadIcon, ChevronLeft, ChevronRight, Receipt } from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import { listTimeClockEntries, type TimeClockEntryDto } from "../../api/timeclock";

const STATUS_META: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
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

  const month      = dayjs().startOf("month").add(monthOffset, "month");
  const monthStart = month.startOf("month");
  const monthEnd   = month.endOf("month");

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await listTimeClockEntries({
        staffId: user.staffId,
        from: monthStart.toISOString(),
        to:   monthEnd.toISOString(),
        page: 1, pageSize: 200,
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
        fmt(e.clockInUtc), fmt(e.clockOutUtc),
        fmt(e.lunchOutUtc), fmt(e.lunchInUtc),
        lh > 0 ? lh.toFixed(2) : "",
        netHours(e).toFixed(2),
        e.status, e.adminNotes ?? "",
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

  if (loading) return (
    <Box sx={{ pt: 4, textAlign: "center" }}>
      <CircularProgress sx={{ color: "#4db6ac" }} />
    </Box>
  );
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ pt: 1 }}>
      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
              }}>
                <Receipt sx={{ color: "#4db6ac", fontSize: 20 }} />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button size="small" onClick={() => setMonthOffset(o => o - 1)}
                    sx={{ minWidth: 28, p: 0.5, color: "rgba(255,255,255,0.6)" }}>
                    <ChevronLeft fontSize="small" />
                  </Button>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                    {monthStart.format("MMMM YYYY")}
                  </Typography>
                  <Button size="small" onClick={() => setMonthOffset(o => o + 1)}
                    sx={{ minWidth: 28, p: 0.5, color: "rgba(255,255,255,0.6)" }}>
                    <ChevronRight fontSize="small" />
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1.5}>
                  <Typography variant="caption" color="text.secondary">
                    Net: <strong style={{ color: "#4db6ac" }}>{totalNet.toFixed(2)}h</strong>
                  </Typography>
                  {totalLunch > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Lunch: <strong>{totalLunch.toFixed(2)}h</strong>
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              size="small"
              onClick={downloadCsv}
              disabled={completedEntries.length === 0}
              sx={{ borderColor: "rgba(0,137,123,0.4)", color: "#4db6ac", "&:hover": { borderColor: "#4db6ac", bgcolor: "rgba(0,137,123,0.08)" } }}
            >
              Download CSV
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Calendar grid ── */}
      <Card variant="outlined" sx={{ mb: 2.5, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <Typography key={d} variant="caption" color="text.secondary" align="center"
                fontWeight={600} sx={{ py: 0.5, fontSize: 10 }}>
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
                <Box key={d} sx={{
                  height: 56, borderRadius: 1, p: 0.5,
                  border: "1px solid",
                  borderColor: isToday ? "#4db6ac" : hasPending ? "#f57c00" : "rgba(255,255,255,0.06)",
                  background: isToday ? "rgba(0,137,123,0.12)" : dayEntries.length > 0 ? "rgba(46,125,50,0.08)" : "transparent",
                }}>
                  <Typography variant="caption" fontWeight={isToday ? 700 : 400}
                    color={isToday ? "#4db6ac" : "text.secondary"} sx={{ fontSize: 10 }}>
                    {dayjs(d).date()}
                  </Typography>
                  {totalHrs > 0 && (
                    <Typography variant="caption" color="success.main" display="block"
                      fontWeight={600} sx={{ fontSize: 9 }}>
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
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.06)" }} />

      {/* ── Entry list ── */}
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: "rgba(255,255,255,0.7)" }}>
        All Entries
      </Typography>
      {entries.length === 0 ? (
        <Typography color="text.secondary" variant="body2">No entries this month.</Typography>
      ) : (
        <Stack spacing={0.5}>
          {entries.map(e => (
            <Card key={e.id} variant="outlined" sx={{
              borderColor: "rgba(255,255,255,0.07)",
              borderLeft: `3px solid ${e.status === "Approved" ? "#2e7d32" : e.status === "PendingCorrection" ? "#f57c00" : "rgba(255,255,255,0.1)"}`,
            }}>
              <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }}
                  justifyContent="space-between" flexWrap="wrap" gap={0.5}>
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 110 }}>
                    {dayjs(e.clockInUtc).format("ddd, MMM D")}
                  </Typography>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                      {fmt(e.clockInUtc)} – {fmt(e.clockOutUtc) || "In progress"}
                    </Typography>
                    {e.lunchOutUtc && (
                      <Typography variant="caption" color="info.main" display="block">
                        🍴 Lunch {fmt(e.lunchOutUtc)} – {fmt(e.lunchInUtc)}
                        {e.lunchMinutes != null ? ` (${e.lunchMinutes}m)` : ""}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "#4db6ac" }}>
                    {e.clockOutUtc ? `${netHours(e).toFixed(2)}h` : "—"}
                  </Typography>
                  <Chip label={e.status} size="small" color={STATUS_META[e.status] ?? "default"}
                    sx={{ height: 20, fontSize: 11 }} />
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
            <Typography variant="subtitle2" sx={{ color: "#4db6ac" }}>
              Total: {totalNet.toFixed(2)} hrs worked
              {totalLunch > 0 && (
                <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: 8 }}>
                  | {totalLunch.toFixed(2)} hrs lunch
                </span>
              )}
            </Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
