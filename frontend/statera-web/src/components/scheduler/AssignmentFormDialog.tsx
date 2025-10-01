// src/components/scheduler/AssignmentFormDialog.tsx
import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Stack
} from "@mui/material";
import dayjs, { Dayjs } from "dayjs";

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
}

export default function AssignmentFormDialog(props: AssignmentFormDialogProps) {
  const { open, title, initial, units, roles, staff, onCancel, onSubmit } = props;

  const [values, setValues] = React.useState<FormValues>(initial);

  React.useEffect(() => setValues(initial), [initial]);

  const handleChange = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues(v => ({ ...v, [key]: e.target.value }));
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
            required
          >
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
            onChange={handleChange("staffId")}
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
        <Button onClick={onCancel} variant="text">Cancel</Button>
        <Button onClick={submit} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
