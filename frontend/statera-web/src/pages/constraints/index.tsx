import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Container,
  Divider,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { z } from "zod";
import {
  getConstraints,
  getRoles,
  testRulesAgainstSample,
  upsertConstraints,
} from "../../api/rules";
import {
  ConstraintsPayload,
  LicenseRequirement,
  MaxHoursRule,
  OvertimeRules,
  RestRule,
} from "../../api/rules/types";
import LicenseRequirementEditor from "../../components/rules/LicenseRequirementEditor";
import OvertimeRuleTable from "../../components/rules/OvertimeRuleTable";
import MaxHoursRuleEditor from "../../components/rules/MaxHoursRuleEditor";
import RestRuleEditor from "../../components/rules/RestRuleEditor";
import RuleCard from "../../components/rules/RuleCard";

function useActiveFacilityId() {
  return localStorage.getItem("statera:facilityId") ?? "";
}

export default function ConstraintsRulesPage() {
  const facilityId = useActiveFacilityId();

  const initial: ConstraintsPayload = useMemo(
    () => ({
      facilityId,
      maxHours: {
        dailyMaxHours: 12,
        weeklyMaxHours: 40,
        biweeklyMaxHours: 80,
        allowSelfOverride: false,
      },
      rest: {
        minRestHoursBetweenShifts: 8,
        minRestHoursAfterOvertime: 10,
        consecutiveDaysMax: 6,
        weeklyRestDayRequired: true,
      },
      overtime: {
        basis: "weekly",
        tiers: [{ thresholdHours: 40, multiplier: 1.5 }],
        capHours: 60,
        allowOvertimeOnDays: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
      licenseRequirements: [],
      aiWeights: { hardViolations: 10, softViolations: 5, overtimePenalty: 2 },
    }),
    [facilityId]
  );

  const [data, setData] = useState<ConstraintsPayload>(initial);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [r, c] = await Promise.all([
          getRoles(),
          getConstraints(facilityId),
        ]);
        if (!mounted) return;
        setRoles(r ?? []);
        if (c) setData(c);
      } catch (e: any) {
        if (!mounted) return;
        setError("Failed to load rules.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [facilityId]);

  const setMaxHours = (next: MaxHoursRule) =>
    setData((d) => ({ ...d, maxHours: next }));
  const setRest = (next: RestRule) => setData((d) => ({ ...d, rest: next }));
  const setOvertime = (next: OvertimeRules) =>
    setData((d) => ({ ...d, overtime: next }));
  const setLicReqs = (next: LicenseRequirement[]) =>
    setData((d) => ({ ...d, licenseRequirements: next }));

  async function save() {
  try {
    await upsertConstraints(data); // no need to parse
    setSnack({
      open: true,
      message: "Constraints saved.",
      severity: "success",
    });
  } catch (e: any) {
    setSnack({
      open: true,
      message: e?.message ?? "Failed to save",
      severity: "error",
    });
  }
}


  async function validate() {
    try {
      const res = await testRulesAgainstSample(facilityId);
      setSnack({
        open: true,
        message: res.ok
          ? res.message ?? "All constraints valid for sample week."
          : res.message ?? "Issues found.",
        severity: res.ok ? "success" : "error",
      });
    } catch (e: any) {
      setSnack({
        open: true,
        message: e?.message ?? "Test failed",
        severity: "error",
      });
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">Constraints & Rules</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={validate}>
            Validate
          </Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error">{error}</Alert>}

      <Stack spacing={2}>
        <MaxHoursRuleEditor value={data.maxHours} onChange={setMaxHours} />
        <RestRuleEditor value={data.rest} onChange={setRest} />
        <OvertimeRuleTable overtime={data.overtime} setOvertime={setOvertime} />
        <LicenseRequirementEditor
          items={data.licenseRequirements}
          setItems={setLicReqs}
          availableRoles={roles ?? []}
        />

        <RuleCard
          title="AI Weights"
          subheader="Influence the AI engine’s objective function."
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Hard Violations Weight"
              type="number"
              value={data.aiWeights.hardViolations}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  aiWeights: {
                    ...d.aiWeights,
                    hardViolations: Number(e.target.value),
                  },
                }))
              }
              inputProps={{ min: 0, max: 10, step: 1 }}
            />
            <TextField
              label="Soft Violations Weight"
              type="number"
              value={data.aiWeights.softViolations}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  aiWeights: {
                    ...d.aiWeights,
                    softViolations: Number(e.target.value),
                  },
                }))
              }
              inputProps={{ min: 0, max: 10, step: 1 }}
            />
            <TextField
              label="Overtime Penalty"
              type="number"
              value={data.aiWeights.overtimePenalty}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  aiWeights: {
                    ...d.aiWeights,
                    overtimePenalty: Number(e.target.value),
                  },
                }))
              }
              inputProps={{ min: 0, max: 10, step: 1 }}
            />
          </Stack>
        </RuleCard>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="outlined" onClick={validate}>
          Validate
        </Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </Stack>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
