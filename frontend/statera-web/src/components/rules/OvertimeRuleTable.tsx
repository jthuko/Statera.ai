import {
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import RuleCard from "./RuleCard";
import { OvertimeRules, OvertimeTier } from "../../api/rules/types";

export default function OvertimeRuleTable({
  overtime,
  setOvertime,
}: {
  overtime: OvertimeRules;
  setOvertime: (next: OvertimeRules) => void;
}) {
  const addTier = () =>
    setOvertime({ ...overtime, tiers: [...overtime.tiers, { thresholdHours: 40, multiplier: 1.5 }] });
  const removeTier = (idx: number) =>
    setOvertime({ ...overtime, tiers: overtime.tiers.filter((_, i) => i !== idx) });
  const updateTier = (idx: number, patch: Partial<OvertimeTier>) => {
    const next = [...overtime.tiers];
    next[idx] = { ...next[idx], ...patch } as OvertimeTier;
    setOvertime({ ...overtime, tiers: next });
  };

  return (
    <RuleCard title="Overtime Rules" subheader="Define thresholds and multipliers.">
      <Stack spacing={2}>
        <TextField
          select
          label="Overtime Basis"
          value={overtime.basis}
          onChange={(e) => setOvertime({ ...overtime, basis: e.target.value as OvertimeRules["basis"] })}
          sx={{ maxWidth: 240 }}
        >
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="biweekly">Biweekly</MenuItem>
        </TextField>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Threshold (hrs)</TableCell>
              <TableCell>Multiplier (×)</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {overtime.tiers.map((t, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <TextField
                    type="number"
                    value={t.thresholdHours}
                    onChange={(e) => updateTier(idx, { thresholdHours: Number(e.target.value) })}
                    inputProps={{ min: 0, max: 168, step: 1 }}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={t.multiplier}
                    onChange={(e) => updateTier(idx, { multiplier: Number(e.target.value) })}
                    inputProps={{ min: 1, max: 5, step: 0.1 }}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Remove tier">
                    <IconButton color="error" onClick={() => removeTier(idx)}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3}>
                <Tooltip title="Add tier">
                  <IconButton color="primary" onClick={addTier}>
                    <Add />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Stack>
    </RuleCard>
  );
}
