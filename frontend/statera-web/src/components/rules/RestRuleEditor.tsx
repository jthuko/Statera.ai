import { Stack, Switch, TextField, Typography } from "@mui/material";
import RuleCard from "./RuleCard";
import { RestRule } from "../../api/rules/types";

export default function RestRuleEditor({
  value,
  onChange,
}: {
  value: RestRule;
  onChange: (next: RestRule) => void;
}) {
  return (
    <RuleCard title="Rest & Fatigue" subheader="Minimum rest windows and consecutive day limits.">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Min Rest Between Shifts (hrs)"
          type="number"
          value={value.minRestHoursBetweenShifts}
          onChange={(e) =>
            onChange({ ...value, minRestHoursBetweenShifts: Number(e.target.value) })
          }
          inputProps={{ min: 0, max: 24, step: 1 }}
        />
        <TextField
          label="Min Rest After Overtime (hrs)"
          type="number"
          value={value.minRestHoursAfterOvertime}
          onChange={(e) =>
            onChange({ ...value, minRestHoursAfterOvertime: Number(e.target.value) })
          }
          inputProps={{ min: 0, max: 48, step: 1 }}
        />
        <TextField
          label="Consecutive Days Max"
          type="number"
          value={value.consecutiveDaysMax}
          onChange={(e) =>
            onChange({ ...value, consecutiveDaysMax: Number(e.target.value) })
          }
          inputProps={{ min: 1, max: 14, step: 1 }}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        <Switch
          checked={value.weeklyRestDayRequired}
          onChange={(e) => onChange({ ...value, weeklyRestDayRequired: e.target.checked })}
        />
        <Typography>Require at least one rest day per week</Typography>
      </Stack>
    </RuleCard>
  );
}
