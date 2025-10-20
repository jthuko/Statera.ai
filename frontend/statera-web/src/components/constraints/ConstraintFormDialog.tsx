// src/components/constraints/ConstraintFormDialog.tsx
import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Stack, FormControlLabel, Switch
} from "@mui/material";
import { z } from "zod";
import {
  RuleScope, RULE_SCOPES,
  ConstraintType, CONSTRAINT_OPTIONS,
  CreateConstraintRequest, UpdateConstraintRequest, Guid
} from "../../api/constraints";

export type ConstraintFormValues = {
  scope: RuleScope;
  unitId?: Guid | null;
  role?: string | null;
  type: ConstraintType;
  value: string;
  isActive: boolean;
  notes?: string | null;
};

const schema = z.object({
  scope: z.enum(["Facility", "Unit", "Role"]),
  unitId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  role: z.string().max(64).optional().or(z.literal("").transform(() => undefined)),
  type: z.nativeEnum(ConstraintType),
  value: z.string().min(1, "Value is required"),
  isActive: z.boolean(),
  notes: z.string().max(1024).optional().or(z.literal("").transform(() => undefined)),
});

function normalize(values: ConstraintFormValues): CreateConstraintRequest {
  const parsed = schema.parse(values);
  return {
    scope: parsed.scope,
    unitId: parsed.scope === "Unit" ? parsed.unitId : undefined,
    role: parsed.scope === "Role" ? parsed.role : undefined,
    type: parsed.type,
    value: parsed.value.trim(),
    isActive: parsed.isActive,
    notes: parsed.notes,
  };
}

export default function ConstraintFormDialog(props: {
  open: boolean;
  initial?: Partial<ConstraintFormValues>;
  units?: { id: Guid; name: string }[];
  title: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (payload: CreateConstraintRequest | UpdateConstraintRequest) => Promise<void>;
}) {
  const { open, initial, units = [], title, submitLabel = "Save", onClose, onSubmit } = props;

  const [values, setValues] = React.useState<ConstraintFormValues>({
    scope: initial?.scope ?? "Facility",
    unitId: initial?.unitId ?? undefined,
    role: initial?.role ?? "",
    type: (initial?.type as ConstraintType) ?? ConstraintType.MaxHoursPerWeek,
    value: initial?.value ?? "",
    isActive: initial?.isActive ?? true,
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setValues({
      scope: initial?.scope ?? "Facility",
      unitId: initial?.unitId ?? undefined,
      role: initial?.role ?? "",
      type: (initial?.type as ConstraintType) ?? ConstraintType.MaxHoursPerWeek,
      value: initial?.value ?? "",
      isActive: initial?.isActive ?? true,
      notes: initial?.notes ?? "",
    });
    setError(null);
    setBusy(false);
  }, [open, initial]);

  const handleChange =
    (k: keyof ConstraintFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
    };

  const handleToggle =
    (k: keyof ConstraintFormValues) =>
    (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setValues((v) => ({ ...v, [k]: checked }));
    };

  async function handleSubmit() {
    try {
      setBusy(true);
      setError(null);
      const payload = normalize(values);
      await onSubmit(payload);
      onClose();
    } catch (ex: any) {
      setError(ex?.message ?? "Failed to save constraint");
    } finally {
      setBusy(false);
    }
  }

  const scope = values.scope;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select label="Scope" value={values.scope}
            onChange={handleChange("scope")}
            helperText="Where this rule applies"
          >
            {RULE_SCOPES.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>

          {scope === "Unit" && (
            <TextField
              select label="Unit" value={values.unitId ?? ""}
              onChange={handleChange("unitId")}
              helperText="Select the unit for this rule"
            >
              {units.map(u => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
          )}

          {scope === "Role" && (
            <TextField
              label="Role" value={values.role ?? ""}
              onChange={handleChange("role")}
              placeholder="RN, LPN, CNA, etc."
            />
          )}

          <TextField
            select label="Constraint Type" value={values.type}
            onChange={handleChange("type")}
          >
            {CONSTRAINT_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Value"
            value={values.value}
            onChange={handleChange("value")}
            placeholder={
              CONSTRAINT_OPTIONS.find(x => x.value === values.type)?.hint ?? "Enter value"
            }
            helperText="Numbers, codes, or small JSON blobs. Server will validate."
          />

          <TextField
            multiline minRows={2}
            label="Notes"
            value={values.notes ?? ""}
            onChange={handleChange("notes")}
          />

          <FormControlLabel
            control={
              <Switch checked={values.isActive} onChange={handleToggle("isActive")} />
            }
            label="Active"
          />

          {error && (
            <TextField
              value={error}
              error
              disabled
              multiline
              minRows={2}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={busy}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
