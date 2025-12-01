// src/components/demand-templates/DemandTemplateForm.tsx
import * as React from "react";
import {
  Box, Button, Card, CardContent, Divider, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import type {
  DemandTemplate, DemandDay, CreateDemandTemplateRequest, UpdateDemandTemplateRequest, Guid
} from "../../api/demandTemplates";

const WEEKDAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
] as const;

export interface DemandTemplateFormProps {
  mode: "create" | "edit";
  value?: DemandTemplate;
  facilityId: Guid;
  onSubmit: (payload: CreateDemandTemplateRequest | UpdateDemandTemplateRequest) => Promise<void> | void;
  onValidate?: () => Promise<void> | void;
  onApprove?: () => Promise<void> | void;
  onPublish?: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

export default function DemandTemplateForm(props: DemandTemplateFormProps) {
  const { mode, value, facilityId, onSubmit, onValidate, onApprove, onPublish, onDelete } = props;

  const [name, setName] = React.useState<string>(value?.name ?? "");
  const [role, setRole] = React.useState<string>(value?.role ?? "");
  const [unitId, setUnitId] = React.useState<string>(value?.unitId ?? "");
  const [notes, setNotes] = React.useState<string>(value?.notes ?? "");
  const [days, setDays] = React.useState<DemandDay[]>(
    value?.days ?? WEEKDAYS.map(d => ({ day: d.value, required: 0 }))
  );

  const updateRequired = (dayValue: number, required: number) => {
    setDays(prev =>
      prev.map(d => (d.day === dayValue ? { ...d, required: Math.max(0, Math.floor(required)) } : d))
    );
  };

  const canSubmit = !!name.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (mode === "create") {
      const payload: CreateDemandTemplateRequest = {
        facilityId,
        name: name.trim(),
        role: role || null,
        unitId: unitId || null,
        notes: notes || null,
        days
      };
      await onSubmit(payload);
    } else {
      const payload: UpdateDemandTemplateRequest = {
        name: name.trim(),
        role: role || null,
        unitId: unitId || null,
        notes: notes || null,
        days
      };
      await onSubmit(payload);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>Demand Template</Typography>

        <Stack spacing={2}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            helperText="A friendly name, e.g. 'Med-Surg Weekday RN Coverage'"
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Role (optional)"
              placeholder="e.g., RN"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              fullWidth
            />
            <TextField
              label="UnitId (optional GUID)"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              fullWidth
            />
          </Stack>

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />

          <Divider />

          <Typography variant="subtitle1" fontWeight={600}>Weekly Headcount</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1,
              maxWidth: 720
            }}
          >
            {WEEKDAYS.map(d => (
              <TextField
                key={d.value}
                label={d.label}
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={days.find(x => x.day === d.value)?.required ?? 0}
                onChange={(e) => updateRequired(d.value, Number(e.target.value))}
              />
            ))}
          </Box>

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>

            <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit}>
              {mode === "create" ? "Create" : "Save Changes"}
            </Button>

            {onValidate && (
              <Button variant="outlined" onClick={() => onValidate?.()}>
                Validate
              </Button>
            )}

            {onApprove && (
              <Button variant="outlined" onClick={() => onApprove?.()}>
                Approve
              </Button>
            )}

            {onPublish && (
              <Button variant="outlined" color="success" onClick={() => onPublish?.()}>
                Publish
              </Button>
            )}

            {onDelete && (
              <Button variant="text" color="error" onClick={() => onDelete?.()}>
                Delete
              </Button>
            )}

          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
