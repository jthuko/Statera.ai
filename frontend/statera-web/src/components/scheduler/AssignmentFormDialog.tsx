// src/components/scheduler/AssignmentFormDialog.tsx
import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Stack, Alert
} from "@mui/material";
import dayjs, { Dayjs } from "dayjs";
import { getStaffAvailability, type AvailabilityDto } from "../../api/staff";

export interface FormValues {
  id?: string;
  unitId: string;
  staffId: string;
  roleId: string;
  start: string; // ISO
  end: string;   // ISO
  notes?: string | null;
}

interface Option {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  label: string;
  role?: string;
}

export interface AssignmentFormDialogProps {
  open: boolean;
  title: string;
  initial: FormValues;
  units: Option[];
  roles: Option[];
  staff: StaffOption[];
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
  /** Provided only in edit mode — shows a Delete button */
  onDelete?: () => void;
}

// Returns true if the shift conflicts with availability (i.e. staff is NOT available)
function shiftConflicts(avail: AvailabilityDto[], start: string, end: string): boolean {
  if (avail.length === 0) return false; // no restrictions
  const s = dayjs(start);
  const e = dayjs(end);
  if (!s.isValid() || !e.isValid()) return false;

  // Check each calendar day the shift touches
  let cursor = s.startOf("day");
  while (cursor.isBefore(e.startOf("day")) || cursor.isSame(s.startOf("day"))) {
    const dow = cursor.day(); // 0=Sun
    const segStartMin = cursor.isSame(s.startOf("day"))
      ? s.hour() * 60 + s.minute()
      : 0;
    const segEndMin = cursor.isSame(e.startOf("day"))
      ? e.hour() * 60 + e.minute()
      : 24 * 60;

    if (segEndMin === 0) { cursor = cursor.add(1, "day"); continue; }

    const covered = avail.some(a => {
      if (a.dayOfWeek !== dow) return false;
      const [sh, sm] = a.startLocal.split(":").map(Number);
      const [eh, em] = a.endLocal.split(":").map(Number);
      return (sh * 60 + sm) <= segStartMin && (eh * 60 + em) >= segEndMin;
    });

    if (!covered) return true; // conflict found
    cursor = cursor.add(1, "day");
  }
  return false;
}

export default function AssignmentFormDialog(props: AssignmentFormDialogProps) {
  const { open, title, initial, units, roles, staff, onCancel, onSubmit, onDelete } = props;

  const [values, setValues] = React.useState<FormValues>(initial);
  const [avail, setAvail] = React.useState<AvailabilityDto[] | null>(null);

  React.useEffect(() => setValues(initial), [initial]);

  // Load availability when staff changes or dialog opens
  React.useEffect(() => {
    if (!open || !values.staffId) { setAvail(null); return; }
    let active = true;
    getStaffAvailability(values.staffId)
      .then(data => { if (active) setAvail(data); })
      .catch(() => { if (active) setAvail(null); });
    return () => { active = false; };
  }, [open, values.staffId]);

  const hasConflict = avail !== null && shiftConflicts(avail, values.start, values.end);

  const handleChange = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues(v => ({ ...v, [key]: e.target.value }));
  };

  // When staff selection changes, auto-populate role from the selected staff member
  const handleStaffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStaffId = e.target.value;
    const found = staff.find(s => s.id === newStaffId);
    setAvail(null); // reset while loading new availability
    setValues(v => ({
      ...v,
      staffId: newStaffId,
      ...(found?.role ? { roleId: found.role } : {}),
    }));
  };

  const handleTimeChange = (key: "start" | "end") => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Accept "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
    const val = e.target.value;
    // Normalize to ISO
    const iso = dayjs(val).toISOString();
    setValues(v => ({ ...v, [key]: iso }));
  };

  const toLocalInput = (iso: string) => {
    const d = dayjs(iso);
    if (!d.isValid()) return "";
    return d.format("YYYY-MM-DDTHH:mm");
  };

  const submit = () => onSubmit(values);

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Unit"
            value={values.unitId}
            onChange={handleChange("unitId")}
            fullWidth
          >
            <MenuItem value="">None</MenuItem>
            {units.map(u => (
              <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Role"
            value={values.roleId}
            onChange={handleChange("roleId")}
            fullWidth
            required
          >
            {roles.map(r => (
              <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Staff"
            value={values.staffId}
            onChange={handleStaffChange}
            fullWidth
            required
          >
            {staff.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Start"
            type="datetime-local"
            value={toLocalInput(values.start)}
            onChange={handleTimeChange("start")}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="End"
            type="datetime-local"
            value={toLocalInput(values.end)}
            onChange={handleTimeChange("end")}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />

          {hasConflict && (
            <Alert severity="warning">
              This staff member is not available at the selected day/time based on their recorded availability.
              Saving will be blocked — adjust the shift time or update their availability settings.
            </Alert>
          )}

          <TextField
            label="Notes"
            value={values.notes ?? ""}
            onChange={handleChange("notes")}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {onDelete && (
          <Button onClick={onDelete} variant="contained" color="error" sx={{ mr: "auto" }}>
            Delete
          </Button>
        )}
        <Button onClick={onCancel} variant="text">Cancel</Button>
        <Button onClick={submit} variant="contained" disabled={hasConflict}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
