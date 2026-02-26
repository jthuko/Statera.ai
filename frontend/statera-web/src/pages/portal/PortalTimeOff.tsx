// src/pages/portal/PortalTimeOff.tsx
// Staff portal: view and submit time off requests
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { Add as AddIcon, BeachAccess, EventBusy } from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import { listTimeOff, createTimeOff, type TimeOffRequestDto } from "../../api/timeoff";

const OFF_TYPES = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

const STATUS_META: Record<string, { color: "default" | "warning" | "success" | "error"; border: string }> = {
  Pending:   { color: "warning", border: "#f57c00" },
  Approved:  { color: "success", border: "#2e7d32" },
  Denied:    { color: "error",   border: "#c62828" },
  Cancelled: { color: "default", border: "rgba(255,255,255,0.1)" },
};

const TYPE_COLOR: Record<string, string> = {
  Vacation: "#00897b", Sick: "#c62828", Personal: "#1565c0",
  Unpaid: "#6a1b9a", Other: "#455a64",
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

  const pendingCount  = items.filter(r => r.status === "Pending").length;
  const approvedCount = items.filter(r => r.status === "Approved").length;

  if (loading) return (
    <Box sx={{ pt: 4, textAlign: "center" }}>
      <CircularProgress sx={{ color: "#4db6ac" }} />
    </Box>
  );

  return (
    <Box sx={{ pt: 1 }}>
      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
              }}>
                <BeachAccess sx={{ color: "#4db6ac", fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>My Time Off</Typography>
                {items.length > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.25 }}>
                    {pendingCount > 0 && (
                      <Chip label={`${pendingCount} pending`} size="small" color="warning"
                        sx={{ height: 18, fontSize: 10 }} />
                    )}
                    {approvedCount > 0 && (
                      <Chip label={`${approvedCount} approved`} size="small" color="success"
                        sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Stack>
                )}
              </Box>
            </Stack>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setFormOpen(true)}
              sx={{ bgcolor: "#00897b", "&:hover": { bgcolor: "#00796b" } }}
            >
              New Request
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {items.length === 0 ? (
        <Box sx={{
          textAlign: "center", py: 8,
          border: "2px dashed", borderColor: "rgba(255,255,255,0.08)",
          borderRadius: 2,
        }}>
          <EventBusy sx={{ fontSize: 48, color: "text.disabled", opacity: 0.3, mb: 1 }} />
          <Typography color="text.secondary" fontWeight={500}>No time off requests yet</Typography>
          <Typography variant="caption" color="text.disabled">
            Submit your first request using the button above
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map(r => {
            const meta = STATUS_META[r.status] ?? STATUS_META.Cancelled;
            const days = Math.ceil(dayjs(r.endUtc).diff(dayjs(r.startUtc), "day", true));
            const typeColor = TYPE_COLOR[r.type] ?? "#455a64";
            return (
              <Card key={r.id} variant="outlined" sx={{
                borderColor: "rgba(255,255,255,0.07)",
                borderLeft: `3px solid ${meta.border}`,
                transition: "background 0.15s",
                "&:hover": { bgcolor: "rgba(255,255,255,0.02)" },
              }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Chip
                          label={r.type}
                          size="small"
                          sx={{
                            height: 20, fontSize: 11,
                            bgcolor: `${typeColor}22`,
                            color: typeColor,
                            border: `1px solid ${typeColor}44`,
                          }}
                        />
                        <Chip label={r.status} size="small" color={meta.color}
                          sx={{ height: 20, fontSize: 11 }} />
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs(r.startUtc).format("MMM D")} – {dayjs(r.endUtc).format("MMM D, YYYY")}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {days} day{days !== 1 ? "s" : ""}
                        </Typography>
                      </Typography>
                      {r.reason && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
                          {r.reason}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
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

  const reset = () => {
    setType("Vacation");
    setStartDate(dayjs().format("YYYY-MM-DD"));
    setEndDate(dayjs().format("YYYY-MM-DD"));
    setReason(""); setError(null);
  };

  async function handleSubmit() {
    if (!staffId) return;
    setBusy(true); setError(null);
    try {
      await createTimeOff({
        staffId, type,
        startUtc: dayjs(startDate).startOf("day").toISOString(),
        endUtc:   dayjs(endDate).endOf("day").toISOString(),
        reason:   reason || null,
      });
      reset();
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to submit request.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>New Time Off Request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Type" value={type} onChange={e => setType(e.target.value)} size="small">
            {OFF_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Start date" value={startDate}
            onChange={e => {
              const newStart = e.target.value;
              if (newStart && startDate && endDate) {
                const diffDays = dayjs(endDate).diff(dayjs(startDate), "day");
                setEndDate(dayjs(newStart).add(diffDays, "day").format("YYYY-MM-DD"));
              }
              setStartDate(newStart);
            }} InputLabelProps={{ shrink: true }} size="small" />
          <TextField type="date" label="End date" value={endDate}
            onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small"
            inputProps={{ min: startDate }} />
          <TextField label="Reason (optional)" value={reason}
            onChange={e => setReason(e.target.value)} multiline rows={2} size="small" />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}
          disabled={busy || !startDate || !endDate}
          sx={{ bgcolor: "#00897b", "&:hover": { bgcolor: "#00796b" } }}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
