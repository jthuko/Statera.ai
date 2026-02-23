// src/pages/portal/PortalSchedule.tsx
// Staff portal: view own schedule for the week
import { useEffect, useState } from "react";
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import api from "../../api/axios";

interface AssignmentDto {
  id: string;
  startUtc: string;
  endUtc: string;
  roleId?: string | null;
  unitId?: string | null;
  notes?: string | null;
  facilityState?: string;
}

export default function PortalSchedule() {
  const { user } = useAuth();
  const [items, setItems] = useState<AssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekStart = dayjs().startOf("week");
  const weekEnd = dayjs().endOf("week").add(2, "week"); // show 3 weeks ahead

  useEffect(() => {
    if (!user?.staffId) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await api.get<AssignmentDto[]>("/assignments", {
          params: { staffId: user.staffId, start: weekStart.toISOString(), end: weekEnd.toISOString() },
        });
        setItems(data);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Failed to load schedule.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.staffId]);

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  // Group by date
  const byDate: Record<string, AssignmentDto[]> = {};
  for (const a of items) {
    const d = dayjs(a.startUtc).format("YYYY-MM-DD");
    (byDate[d] ??= []).push(a);
  }

  const days = Array.from({ length: 21 }, (_, i) => weekStart.add(i, "day").format("YYYY-MM-DD"));

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>My Schedule</Typography>
      <Stack spacing={1.5}>
        {days.map(d => {
          const shifts = byDate[d] ?? [];
          const isToday = d === dayjs().format("YYYY-MM-DD");
          return (
            <Card
              key={d}
              variant="outlined"
              sx={{
                borderColor: isToday ? "primary.main" : undefined,
                background: isToday ? "rgba(0,150,180,0.06)" : undefined,
              }}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ minWidth: 100 }}>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(d).format("ddd")}
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={isToday ? 700 : 400}>
                      {dayjs(d).format("MMM D")}
                      {isToday && <Chip label="Today" size="small" color="primary" sx={{ ml: 1, height: 18 }} />}
                    </Typography>
                  </Box>
                  {shifts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">— Off</Typography>
                  ) : (
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      {shifts.map(s => (
                        <Stack key={s.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" fontWeight={500}>
                            {dayjs(s.startUtc).format("h:mm a")} – {dayjs(s.endUtc).format("h:mm a")}
                          </Typography>
                          {s.roleId && <Chip label={s.roleId} size="small" variant="outlined" />}
                          {s.notes && <Typography variant="caption" color="text.secondary">{s.notes}</Typography>}
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
