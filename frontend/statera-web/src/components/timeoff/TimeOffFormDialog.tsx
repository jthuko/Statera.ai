// frontend/src/components/timeoff/TimeOffFormDialog.tsx
import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { Dayjs } from "dayjs";

export interface TimeOffFormValues {
  staffId: string;
  type: string;
  startUtc: Dayjs | null; // We'll convert to ISO (UTC) on submit
  endUtc: Dayjs | null;   // ditto
  reason?: string;
}

interface Props {
  open: boolean;
  title?: string;
  initial?: Partial<TimeOffFormValues>;
  onClose: () => void;
  onSubmit: (values: TimeOffFormValues) => void;
}

const TYPES = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];
const DEFAULT_TYPE = "Vacation";

export default function TimeOffFormDialog({
  open,
  title = "Request Time Off",
  initial,
  onClose,
  onSubmit,
}: Props) {
  const [v, setV] = React.useState<TimeOffFormValues>({
    staffId: initial?.staffId ?? "",
    type: (initial?.type as string) ?? DEFAULT_TYPE,
    // ❌ no dayjs.utc() — keep it simple:
    startUtc: initial?.startUtc ?? dayjs().startOf("day"),
    endUtc: initial?.endUtc ?? dayjs().startOf("day"),
    reason: initial?.reason ?? "",
  });

  React.useEffect(() => {
    if (open) {
      setV({
        staffId: initial?.staffId ?? "",
        type: (initial?.type as string) ?? DEFAULT_TYPE,
        startUtc: initial?.startUtc ?? dayjs().startOf("day"),
        endUtc: initial?.endUtc ?? dayjs().startOf("day"),
        reason: initial?.reason ?? "",
      });
    }
  }, [open, initial]);

  const disabled =
    !v.staffId || !v.startUtc || !v.endUtc || v.endUtc.isBefore(v.startUtc);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Staff ID"
            value={v.staffId}
            onChange={(e) => setV({ ...v, staffId: e.target.value })}
            fullWidth
          />

          <DateTimePicker
            label="Start"
            value={v.startUtc}
            onChange={(d) => setV({ ...v, startUtc: d })}
          />

          <DateTimePicker
            label="End"
            value={v.endUtc}
            onChange={(d) => setV({ ...v, endUtc: d })}
          />

          <TextField
            select
            label="Type"
            value={v.type}
            onChange={(e) => setV({ ...v, type: e.target.value })}
          >
            {TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Reason"
            value={v.reason}
            onChange={(e) => setV({ ...v, reason: e.target.value })}
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSubmit(v)}
          disabled={disabled}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
