import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, FormControlLabel, Switch, Stack
} from "@mui/material";
import { z } from "zod";
import type { Unit, UnitType } from "../../api/units";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(["ICU","MedSurg","ER","OR","LTC","Other"]),
  floor: z.string().optional(),
  capacity: z.union([z.number().int().min(0), z.nan()]).optional(),
  notes: z.string().optional(),
  isActive: z.boolean()
});

export type UnitFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<Unit>;
  onCancel: () => void;
  onSave: (values: UnitFormValues) => Promise<void>;
};

const UNIT_TYPES: UnitType[] = ["ICU","MedSurg","ER","OR","LTC","Other"];

export default function UnitFormDialog({ open, mode, initial, onCancel, onSave }: Props) {
  const [values, setValues] = React.useState<UnitFormValues>({
    name: initial?.name ?? "",
    type: (initial?.type as UnitType) ?? "Other",
    floor: initial?.floor ?? "",
    capacity: initial?.capacity ?? undefined,
    notes: initial?.notes ?? "",
    isActive: initial?.isActive ?? true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues({
        name: initial?.name ?? "",
        type: (initial?.type as UnitType) ?? "Other",
        floor: initial?.floor ?? "",
        capacity: initial?.capacity ?? undefined,
        notes: initial?.notes ?? "",
        isActive: initial?.isActive ?? true,
      });
      setErrors({});
    }
  }, [open, initial]);

  const handleChange =
    (field: keyof UnitFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val =
        field === "capacity" ? (e.target.value === "" ? undefined : Number(e.target.value)) :
        field === "isActive" ? e.target.checked :
        e.target.value;
      setValues((v) => ({ ...v, [field]: val }));
    };

  const submit = async () => {
    try {
      const parsed = schema.parse(values);
      setSaving(true);
      await onSave(parsed);
    } catch (e: any) {
      if (e?.issues) {
        const map: Record<string,string> = {};
        e.issues.forEach((i: any) => {
          map[i.path.join(".")] = i.message;
        });
        setErrors(map);
      }
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "create" ? "Create Unit" : "Edit Unit"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Name"
            value={values.name}
            onChange={handleChange("name")}
            error={!!errors.name}
            helperText={errors.name}
            autoFocus
            fullWidth
          />
          <TextField
            select
            label="Type"
            value={values.type}
            onChange={handleChange("type")}
            fullWidth
          >
            {UNIT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Floor"
              value={values.floor ?? ""}
              onChange={handleChange("floor")}
              fullWidth
            />
            <TextField
              label="Capacity"
              type="number"
              value={values.capacity ?? ""}
              onChange={handleChange("capacity")}
              inputProps={{ min: 0, step: 1 }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Notes"
            value={values.notes ?? ""}
            onChange={handleChange("notes")}
            fullWidth
            multiline
            minRows={3}
          />
          <FormControlLabel
            control={<Switch checked={values.isActive} onChange={handleChange("isActive")} />}
            label="Active"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
