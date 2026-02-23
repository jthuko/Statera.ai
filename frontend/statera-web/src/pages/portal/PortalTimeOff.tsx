// src/pages/portal/PortalTimeOff.tsx
// Staff portal: view and submit time off requests
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import { listTimeOff, createTimeOff, type TimeOffRequestDto } from "../../api/timeoff";

const OFF_TYPES = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  Pending: "warning", Approved: "success", Denied: "error", Cancelled: "default",
};

export default function PortalTimeOff() {
  const { user } = useAuth();
  const [items, setItems] = useState<TimeOffRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    try {
      const res = await listTimeOff({ staffId: user.staffId, page: 1, pageSize: 50 });
      setItems(res.items);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load time off.");
    } finally {
      setLoading(false);
    }
  }, [user?.staffId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>My Time Off</Typography>
        <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setFormOpen(true)}>
          New Request
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {items.length === 0 ? (
        <Typography color="text.secondary">No time off requests yet.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {items.map(r => (
            <Card key={r.id} variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={r.type} size="small" />
                      <Chip label={r.status} size="small" color={STATUS_COLOR[r.status] ?? "default"} />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {dayjs(r.startUtc).format("MMM D")} – {dayjs(r.endUtc).format("MMM D, YYYY")}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({Math.ceil(dayjs(r.endUtc).diff(dayjs(r.startUtc), "day", true))}d)
                      </Typography>
                    </Typography>
                    {r.reason && <Typography variant="caption" color="text.secondary">{r.reason}</Typography>}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <NewRequestDialog
        open={formOpen}
        staffId={user?.staffId ?? ""}
        onClose={() => setFormOpen(false)}
        onCreated={() => { setFormOpen(false); load(); }}
      />
    </Box>
  );
}

function NewRequestDialog({ open, staffId, onClose, onCreated }: {
  open: boolean; staffId: string; onClose: () => void; onCreated: () => void;
}) {
  const [type, setType] = useState("Vacation");
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setType("Vacation"); setStartDate(dayjs().format("YYYY-MM-DD")); setEndDate(dayjs().format("YYYY-MM-DD")); setReason(""); setError(null); };

  async function handleSubmit() {
    if (!staffId) return;
    setBusy(true); setError(null);
    try {
      await createTimeOff({
        staffId,
        type,
        startUtc: dayjs(startDate).startOf("day").toISOString(),
        endUtc: dayjs(endDate).endOf("day").toISOString(),
        reason: reason || null,
      });
      reset();
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to submit request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>New Time Off Request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Type" value={type} onChange={e => setType(e.target.value)} size="small">
            {OFF_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Start date" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <TextField type="date" label="End date" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small"
            inputProps={{ min: startDate }} />
          <TextField label="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} multiline rows={2} size="small" />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={busy || !startDate || !endDate}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
