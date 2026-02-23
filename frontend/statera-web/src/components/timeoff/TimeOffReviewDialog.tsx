// src/components/timeoff/TimeOffReviewDialog.tsx
import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Chip, Divider, Box, CircularProgress,
  Alert,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import { TimeOffRequestDto, TimeOffStatus, changeTimeOffStatus, deleteTimeOff } from "../../api/timeoff";
import { useAuth } from "../../auth/useAuth";

interface Props {
  open: boolean;
  request: TimeOffRequestDto | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TimeOffReviewDialog({ open, request, onClose, onRefresh }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<"view" | "confirm-deny" | "confirm-delete">("view");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) { setBusy(false); setStep("view"); setErr(null); }
  }, [open]);

  if (!request) return null;

  const isPending = request.status === "Pending";
  const reviewedBy = (user as any)?.email ?? (user as any)?.name ?? undefined;

  const statusColor = (s: TimeOffStatus): "default" | "success" | "error" | "warning" =>
    s === "Approved" ? "success" : s === "Denied" ? "error" : s === "Cancelled" ? "warning" : "default";

  const nights = Math.max(1, dayjs(request.endUtc).diff(dayjs(request.startUtc), "day"));

  async function approve() {
    setBusy(true); setErr(null);
    try {
      await changeTimeOffStatus(request!.id, "Approved", reviewedBy);
      onRefresh();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to approve request.");
    } finally { setBusy(false); }
  }

  async function deny() {
    setBusy(true); setErr(null);
    try {
      await changeTimeOffStatus(request!.id, "Denied", reviewedBy);
      onRefresh();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to deny request.");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setErr(null);
    try {
      await deleteTimeOff(request!.id);
      onRefresh();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to delete request.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={!busy ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h6">Time-Off Request</Typography>
          <Chip
            size="small"
            label={request.status}
            color={statusColor(request.status)}
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        {step === "view" && (
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="overline" color="text.secondary" display="block">
                Staff Member
              </Typography>
              <Typography variant="body1" fontWeight={600}>{request.staffName}</Typography>
            </Box>

            <Divider />

            <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
              <Box>
                <Typography variant="overline" color="text.secondary" display="block">Type</Typography>
                <Chip label={request.type} size="small" variant="outlined" />
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" display="block">From</Typography>
                <Typography variant="body2">
                  {dayjs(request.startUtc).format("ddd, MMM D YYYY")}
                </Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" display="block">To</Typography>
                <Typography variant="body2">
                  {dayjs(request.endUtc).format("ddd, MMM D YYYY")}
                </Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" display="block">Duration</Typography>
                <Typography variant="body2">
                  {nights} day{nights !== 1 ? "s" : ""}
                </Typography>
              </Box>
            </Stack>

            {request.reason && (
              <>
                <Divider />
                <Box>
                  <Typography variant="overline" color="text.secondary" display="block">
                    Reason / Notes
                  </Typography>
                  <Typography variant="body2">{request.reason}</Typography>
                </Box>
              </>
            )}

            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        )}

        {step === "confirm-deny" && (
          <Box sx={{ py: 1 }}>
            <Typography variant="body1">
              Are you sure you want to <strong>deny</strong> this request?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>{request.staffName}</strong> —{" "}
              {dayjs(request.startUtc).format("MMM D")} –{" "}
              {dayjs(request.endUtc).format("MMM D, YYYY")} ({request.type})
            </Typography>
            {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
          </Box>
        )}

        {step === "confirm-delete" && (
          <Box sx={{ py: 1 }}>
            <Typography variant="body1">
              Permanently <strong>delete</strong> this request?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>{request.staffName}</strong> —{" "}
              {dayjs(request.startUtc).format("MMM D")} –{" "}
              {dayjs(request.endUtc).format("MMM D, YYYY")} ({request.type})
            </Typography>
            {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {step === "view" && (
          <>
            {isPending && (
              <Button
                variant="text"
                color="error"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setStep("confirm-delete")}
                disabled={busy}
                sx={{ mr: "auto" }}
              >
                Delete
              </Button>
            )}
            <Button onClick={onClose} disabled={busy}>Close</Button>
            {isPending && (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setStep("confirm-deny")}
                  disabled={busy}
                >
                  Deny
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={
                    busy ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />
                  }
                  onClick={approve}
                  disabled={busy}
                >
                  Approve
                </Button>
              </>
            )}
          </>
        )}

        {step === "confirm-deny" && (
          <>
            <Button onClick={() => { setStep("view"); setErr(null); }} disabled={busy}>
              Back
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
              onClick={deny}
              disabled={busy}
            >
              Confirm Denial
            </Button>
          </>
        )}

        {step === "confirm-delete" && (
          <>
            <Button onClick={() => { setStep("view"); setErr(null); }} disabled={busy}>
              Back
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
              onClick={remove}
              disabled={busy}
            >
              Delete Request
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
