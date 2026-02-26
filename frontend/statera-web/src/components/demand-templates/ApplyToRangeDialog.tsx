// src/components/demand-templates/ApplyToRangeDialog.tsx
import * as React from "react";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, FormControlLabel, Switch
} from "@mui/material";
import type { ApplyToRangeRequest, Guid } from "../../api/demandTemplates";

export interface ApplyToRangeDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (payload: ApplyToRangeRequest) => Promise<void> | void;
  defaultRole?: string | null;
  defaultUnitId?: Guid | null;
}

export default function ApplyToRangeDialog({
  open, onClose, onApply, defaultRole, defaultUnitId
}: ApplyToRangeDialogProps) {
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [overwrite, setOverwrite] = React.useState<boolean>(false);
  const [targetRole, setTargetRole] = React.useState<string>(defaultRole ?? "");
  const [targetUnitId, setTargetUnitId] = React.useState<string>(defaultUnitId ?? "");

  const canApply = startDate && endDate;

  const handleApply = async () => {
    if (!canApply) return;
    const payload: ApplyToRangeRequest = {
      startDate,
      endDate,
      overwrite,
      targetRole: targetRole || null,
      targetUnitId: targetUnitId || null
    };
    await onApply(payload);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Apply Template to Date Range</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              value={startDate}
              onChange={(e) => {
                const newStart = e.target.value;
                if (newStart && startDate && endDate) {
                  const diffDays = dayjs(endDate).diff(dayjs(startDate), "day");
                  setEndDate(dayjs(newStart).add(diffDays, "day").format("YYYY-MM-DD"));
                }
                setStartDate(newStart);
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <TextField
            label="Target Role (optional)"
            placeholder="e.g., RN"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />

          <TextField
            label="Target UnitId (optional GUID)"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={targetUnitId}
            onChange={(e) => setTargetUnitId(e.target.value)}
          />

          <FormControlLabel
            control={<Switch checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />}
            label="Overwrite existing demand"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleApply} disabled={!canApply} variant="contained">Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
