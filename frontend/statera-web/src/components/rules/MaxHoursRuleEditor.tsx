import { Stack, Switch, TextField, Typography } from "@mui/material";
import RuleCard from "./RuleCard";
import { MaxHoursRule } from "../../api/rules/types";

export default function MaxHoursRuleEditor({
  value,
  onChange,
}: {
  value: MaxHoursRule;
  onChange: (next: MaxHoursRule) => void;
}) {
  return (
    <RuleCard title="Max Hours" subheader="Daily/weekly/biweekly limits and overrides.">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Daily Max (hrs)"
          type="number"
          value={value.dailyMaxHours}
          onChange={(e) => onChange({ ...value, dailyMaxHours: Number(e.target.value) })}
          inputProps={{ min: 0, max: 24, step: 1 }}
        />
        <TextField
          label="Weekly Max (hrs)"
          type="number"
          value={value.weeklyMaxHours}
          onChange={(e) => onChange({ ...value, weeklyMaxHours: Number(e.target.value) })}
          inputProps={{ min: 0, max: 168, step: 1 }}
        />
        <TextField
          label="Biweekly Max (hrs)"
          type="number"
          value={value.biweeklyMaxHours}
          onChange={(e) => onChange({ ...value, biweeklyMaxHours: Number(e.target.value) })}
          inputProps={{ min: 0, max: 336, step: 1 }}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        <Switch
          checked={value.allowSelfOverride}
          onChange={(e) => onChange({ ...value, allowSelfOverride: e.target.checked })}
        />
        <Typography>Allow staff to self-override (requires manager approval)</Typography>
      </Stack>
    </RuleCard>
  );
}
