import { useState, useEffect } from "react";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip,
  CircularProgress, Divider, Grid, InputAdornment, LinearProgress,
  MenuItem, Paper, Slider, Stack, Step, StepLabel, Stepper,
  TextField, Tooltip, Typography,
} from "@mui/material";
import {
  Science as ScienceIcon,
  AutoAwesome as AutoAwesomeIcon,
  History as HistoryIcon,
  Lightbulb as LightbulbIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  PersonOff as PersonOffIcon,
  AccessTime as AccessTimeIcon,
  TrendingDown as TrendingDownIcon,
} from "@mui/icons-material";
import { useFacility } from "../../context/facility";
import { runSimulation, SimulationResult, SimulationOption, SimulationType } from "../../api/simulation";
import api from "../../api/axios";

// ── Scenario type definitions ─────────────────────────────────────────────────

interface ScenarioType {
  id: SimulationType;
  label: string;
  subtitle: string;
  description: string;
  icon: JSX.Element;
  color: string;
  examples: string[];
}

const SCENARIO_TYPES: ScenarioType[] = [
  {
    id: "ShortStaffed",
    label: "Short-Staffed Unit",
    subtitle: "Find the best way to fill a coverage gap",
    description:
      "Simulate a unit running short. Statera pulls your live staff data and recommends the best internal options before resorting to agency.",
    icon: <PersonOffIcon sx={{ fontSize: 36 }} />,
    color: "#ef5350",
    examples: ["Med Surg is short 2 CNAs tonight", "ICU needs an extra RN for day shift"],
  },
  {
    id: "CallOff",
    label: "Call-Off Event",
    subtitle: "Model last-minute staff absences",
    description:
      "Simulate one or more call-offs. See which units are most exposed, who your best backups are, and whether patient safety thresholds are at risk.",
    icon: <AccessTimeIcon sx={{ fontSize: 36 }} />,
    color: "#f57c00",
    examples: ["2 nurses call off on Friday night", "Weekend CNA shortage due to weather"],
  },
  {
    id: "OvertimeReduction",
    label: "Overtime Reduction",
    subtitle: "Measure the impact of capping overtime",
    description:
      "Set an overtime cap and see exactly who exceeds it, how much you save, which units lose coverage, and the safest way to phase it in.",
    icon: <TrendingDownIcon sx={{ fontSize: 36 }} />,
    color: "#4db6ac",
    examples: ["Cap all staff at 8h OT this week", "What if we ban double shifts for 14 days?"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function tagColor(tag: string): "success" | "warning" | "error" | "info" | "default" {
  switch (tag) {
    case "Best":               return "success";
    case "Cheapest":           return "info";
    case "Cheapest (short term)": return "info";
    case "Safest":             return "success";
    case "Alternative":        return "warning";
    case "Last Resort":        return "error";
    default:                   return "default";
  }
}

function coverageColor(score: number) {
  if (score >= 80) return "#4caf50";
  if (score >= 60) return "#f57c00";
  return "#ef5350";
}

function fillColor(pct: number) {
  if (pct >= 0.75) return "#4caf50";
  if (pct >= 0.55) return "#f57c00";
  return "#ef5350";
}

function costLabel(cost: number) {
  if (cost < 0) return `Saves $${Math.abs(cost).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (cost === 0) return "No additional cost";
  return `~$${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Box
      sx={{
        flex: 1, minWidth: 120, p: 1.5, borderRadius: 2,
        border: "1px solid", borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex", flexDirection: "column", gap: 0.25,
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: color ?? "text.primary", lineHeight: 1.3 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

function OptionCard({ opt, index }: { opt: SimulationOption; index: number }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, borderRadius: 2, border: "1px solid",
        borderColor: opt.tag === "Best" || opt.tag === "Safest" ? "rgba(77,182,172,0.35)" : "divider",
        bgcolor: opt.tag === "Best" || opt.tag === "Safest" ? "rgba(77,182,172,0.04)" : "background.paper",
        position: "relative",
      }}
    >
      {/* Option number badge */}
      <Box sx={{ position: "absolute", top: 12, right: 12 }}>
        <Chip
          label={opt.tag}
          color={tagColor(opt.tag)}
          size="small"
          sx={{ fontWeight: 700, fontSize: 11 }}
        />
      </Box>

      <Typography variant="body1" sx={{ fontWeight: 700, pr: 8, mb: 0.5 }}>
        {opt.label}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6, mb: 2 }}>
        {opt.description}
      </Typography>

      {/* Metrics row */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {/* Coverage score */}
        <Tooltip title="Coverage adequacy if this option is executed">
          <Box
            sx={{
              px: 1.5, py: 0.5, borderRadius: 1.5, border: "1px solid",
              borderColor: coverageColor(opt.coverageScore) + "55",
              bgcolor: coverageColor(opt.coverageScore) + "15",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1 }}>
              Coverage
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: coverageColor(opt.coverageScore) }}>
              {opt.coverageScore}/100
            </Typography>
          </Box>
        </Tooltip>

        {/* Fill likelihood */}
        <Tooltip title="Probability this option successfully fills the gap">
          <Box
            sx={{
              px: 1.5, py: 0.5, borderRadius: 1.5, border: "1px solid",
              borderColor: fillColor(opt.fillLikelihood) + "55",
              bgcolor: fillColor(opt.fillLikelihood) + "15",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1 }}>
              Fill Rate
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: fillColor(opt.fillLikelihood) }}>
              {(opt.fillLikelihood * 100).toFixed(0)}%
            </Typography>
          </Box>
        </Tooltip>

        {/* Cost */}
        <Tooltip title="Estimated direct cost (negative = savings)">
          <Box
            sx={{
              px: 1.5, py: 0.5, borderRadius: 1.5, border: "1px solid",
              borderColor: opt.estimatedCost <= 0 ? "rgba(76,175,80,0.4)" : "divider",
              bgcolor: opt.estimatedCost <= 0 ? "rgba(76,175,80,0.08)" : "transparent",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1 }}>
              Cost
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: opt.estimatedCost <= 0 ? "#4caf50" : "text.primary" }}
            >
              {costLabel(opt.estimatedCost)}
            </Typography>
          </Box>
        </Tooltip>

        {/* OT Risk */}
        {opt.overtimeRisk !== "None" && opt.overtimeRisk !== "Eliminated" && (
          <Box
            sx={{
              px: 1.5, py: 0.5, borderRadius: 1.5,
              border: "1px solid", borderColor: "divider",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1 }}>
              OT Risk
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {opt.overtimeRisk}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ScenarioSimulatorPage() {
  const { selected: facility } = useFacility();

  const [step, setStep]                 = useState(0); // 0=choose, 1=configure, 2=results
  const [scenarioType, setScenarioType] = useState<SimulationType | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<SimulationResult | null>(null);

  // Form values — shared
  const [units, setUnits]               = useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId]             = useState("");
  const [role, setRole]                 = useState("");

  // ShortStaffed / CallOff
  const [simDate, setSimDate]           = useState(() => new Date().toISOString().slice(0, 10));
  const [missingCount, setMissingCount] = useState(1);

  // OvertimeReduction
  const [maxOtHours, setMaxOtHours]     = useState(8);
  const [windowDays, setWindowDays]     = useState(7);

  useEffect(() => {
    if (!facility?.id) return;
    api.get<{ id: string; name: string; isActive: boolean }[]>(`/facilities/${facility.id}/units`)
      .then(r => setUnits(r.data.filter(u => u.isActive)))
      .catch(() => {});
  }, [facility?.id]);

  function handleSelectType(type: SimulationType) {
    setScenarioType(type);
    setStep(1);
    setResult(null);
    setError(null);
  }

  async function handleRunSimulation() {
    if (!facility?.id || !scenarioType) return;

    setLoading(true);
    setError(null);

    try {
      const req = {
        type: scenarioType,
        unitId:       unitId || undefined,
        role:         role   || undefined,
        simDate:      scenarioType !== "OvertimeReduction" ? simDate : undefined,
        missingCount: scenarioType !== "OvertimeReduction" ? missingCount : undefined,
        maxOtHours:   scenarioType === "OvertimeReduction" ? maxOtHours : undefined,
        windowDays:   scenarioType === "OvertimeReduction" ? windowDays : undefined,
      };
      const resp = await runSimulation(facility.id, req);
      setResult(resp.data);
      setStep(2);
    } catch {
      setError("Simulation failed. Please check your inputs and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (step === 1) {
      setStep(0);
      setScenarioType(null);
    } else if (step === 2) {
      setStep(1);
      setResult(null);
    }
  }

  const selectedScenario = SCENARIO_TYPES.find(s => s.id === scenarioType);

  return (
    <Box>
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <ScienceIcon sx={{ fontSize: 28, color: "#4db6ac" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            AI Scenario Simulator
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Model staffing decisions before making them — powered by your facility's real data
          </Typography>
        </Box>
      </Box>

      {!facility && (
        <Alert severity="info" sx={{ mb: 2 }}>Select a facility to use the simulator.</Alert>
      )}

      {/* ── Stepper ────────────────────────────────────────────────────────── */}
      <Stepper activeStep={step} sx={{ mb: 4, maxWidth: 600 }}>
        <Step><StepLabel>Choose Scenario</StepLabel></Step>
        <Step><StepLabel>Configure</StepLabel></Step>
        <Step><StepLabel>Results</StepLabel></Step>
      </Stepper>

      {/* ── Step 0: Choose scenario type ───────────────────────────────────── */}
      {step === 0 && (
        <Grid container spacing={2} sx={{ maxWidth: 900 }}>
          {SCENARIO_TYPES.map(s => (
            <Grid item xs={12} md={4} key={s.id}>
              <Card
                elevation={0}
                sx={{
                  height: "100%", border: "1.5px solid",
                  borderColor: "divider", borderRadius: 3,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  "&:hover": {
                    borderColor: s.color,
                    boxShadow: `0 0 0 1px ${s.color}33`,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => facility && handleSelectType(s.id)}
                  disabled={!facility}
                  sx={{ height: "100%", p: 0.5 }}
                >
                  <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 1.5 }}>
                    {/* Icon */}
                    <Box
                      sx={{
                        width: 56, height: 56, borderRadius: 2,
                        bgcolor: s.color + "18",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: s.color,
                      }}
                    >
                      {s.icon}
                    </Box>

                    {/* Title */}
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {s.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {s.subtitle}
                      </Typography>
                    </Box>

                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6, flexGrow: 1 }}>
                      {s.description}
                    </Typography>

                    {/* Example chips */}
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      {s.examples.map(ex => (
                        <Chip
                          key={ex}
                          label={ex}
                          size="small"
                          sx={{ fontSize: 10, bgcolor: s.color + "12", color: s.color, border: "none" }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Step 1: Configure ──────────────────────────────────────────────── */}
      {step === 1 && selectedScenario && (
        <Box sx={{ maxWidth: 560 }}>
          {/* Scenario recap */}
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 2, mb: 3,
              p: 2, borderRadius: 2, bgcolor: selectedScenario.color + "10",
              border: "1px solid", borderColor: selectedScenario.color + "33",
            }}
          >
            <Box sx={{ color: selectedScenario.color }}>{selectedScenario.icon}</Box>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {selectedScenario.label}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {selectedScenario.subtitle}
              </Typography>
            </Box>
          </Box>

          <Stack spacing={2.5}>
            {/* Shared: Unit */}
            <TextField
              select
              label="Unit (optional)"
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              fullWidth
              size="small"
              helperText="Leave blank to simulate across all units"
            >
              <MenuItem value="">All units</MenuItem>
              {units.map(u => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>

            {/* ShortStaffed / CallOff — Role, Date, Count */}
            {scenarioType !== "OvertimeReduction" && (
              <>
                <TextField
                  label="Role / Position"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g. RN, CNA, LPN, Charge Nurse"
                  helperText="Enter the role that is short-staffed"
                />

                <TextField
                  label="Simulation Date"
                  type="date"
                  value={simDate}
                  onChange={e => setSimDate(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "text.secondary" }}>
                    {scenarioType === "ShortStaffed" ? "Number of Staff Short" : "Number of Call-Offs"}
                    : <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                        {missingCount}
                      </Typography>
                  </Typography>
                  <Slider
                    value={missingCount}
                    onChange={(_, v) => setMissingCount(v as number)}
                    min={1} max={8} step={1} marks
                    sx={{ color: selectedScenario.color }}
                  />
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>1</Typography>
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>8</Typography>
                  </Box>
                </Box>
              </>
            )}

            {/* OvertimeReduction — Max OT, Window */}
            {scenarioType === "OvertimeReduction" && (
              <>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "text.secondary" }}>
                    Max Overtime Hours Per Week:{" "}
                    <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                      {maxOtHours}h
                    </Typography>
                  </Typography>
                  <Slider
                    value={maxOtHours}
                    onChange={(_, v) => setMaxOtHours(v as number)}
                    min={0} max={20} step={1} marks={[0,4,8,12,16,20].map(v=>({value:v,label:`${v}h`}))}
                    sx={{ color: "#4db6ac" }}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "text.secondary" }}>
                    Simulation Window:{" "}
                    <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                      {windowDays} days
                    </Typography>
                  </Typography>
                  <Slider
                    value={windowDays}
                    onChange={(_, v) => setWindowDays(v as number)}
                    min={7} max={28} step={7} marks={[7,14,21,28].map(v=>({value:v,label:`${v}d`}))}
                    sx={{ color: "#4db6ac" }}
                  />
                </Box>
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {/* Actions */}
            <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                variant="outlined"
                color="inherit"
              >
                Back
              </Button>
              <Button
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                onClick={handleRunSimulation}
                variant="contained"
                disabled={loading || !facility}
                sx={{
                  bgcolor: selectedScenario.color,
                  "&:hover": { bgcolor: selectedScenario.color + "dd" },
                  px: 3,
                }}
              >
                {loading ? "Simulating…" : "Run Simulation"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* ── Step 2: Results ────────────────────────────────────────────────── */}
      {step === 2 && result && (
        <Box sx={{ maxWidth: 800 }}>
          {/* Back button */}
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="text"
            color="inherit"
            sx={{ mb: 2 }}
          >
            Adjust Parameters
          </Button>

          {/* Title banner */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5, mb: 3, borderRadius: 2,
              border: "1px solid",
              borderColor: selectedScenario ? selectedScenario.color + "44" : "divider",
              bgcolor: selectedScenario ? selectedScenario.color + "08" : "background.paper",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
              <Box sx={{ color: selectedScenario?.color ?? "#4db6ac" }}>
                {selectedScenario?.icon}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {result.title}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {result.summary}
            </Typography>
          </Paper>

          {/* Safety Alert */}
          {result.metrics.safetyAlert && (
            <Alert
              severity="error"
              icon={<WarningIcon />}
              sx={{ mb: 3, fontWeight: 600, borderRadius: 2 }}
            >
              {result.metrics.safetyAlert}
            </Alert>
          )}

          {/* AI Narrative */}
          {result.aiNarrative && (
            <Box
              sx={{
                p: 2, mb: 3, borderRadius: 2,
                bgcolor: "rgba(77,182,172,0.07)",
                border: "1px solid rgba(77,182,172,0.25)",
                display: "flex", gap: 1.5,
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 18, color: "#4db6ac", mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#4db6ac", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  AI Recommendation
                </Typography>
                <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.7, mt: 0.5 }}>
                  {result.aiNarrative}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Metrics summary bar */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6, display: "block", mb: 1.5 }}>
              Simulation Metrics
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <MetricTile
                label="Coverage Score"
                value={`${result.metrics.coverageScore}/100`}
                color={coverageColor(result.metrics.coverageScore)}
              />
              <MetricTile
                label="Est. Cost / Savings"
                value={costLabel(result.metrics.estimatedCost)}
                color={result.metrics.estimatedCost <= 0 ? "#4caf50" : undefined}
              />
              <MetricTile
                label="Fill Likelihood"
                value={`${(result.metrics.fillLikelihood * 100).toFixed(0)}%`}
                color={fillColor(result.metrics.fillLikelihood)}
              />
              <MetricTile label="OT Impact" value={result.metrics.overtimeImpact} />
              <MetricTile
                label="Fatigue Risk"
                value={result.metrics.fatigueRisk}
                color={result.metrics.fatigueRisk === "High" ? "#ef5350" : result.metrics.fatigueRisk === "Medium" ? "#f57c00" : "#4caf50"}
              />
            </Stack>
          </Paper>

          {/* Response options */}
          <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6, mb: 1.5 }}>
            Response Options — Ranked by Effectiveness
          </Typography>
          <Stack spacing={2} sx={{ mb: 3 }}>
            {result.options.map((opt, i) => (
              <OptionCard key={i} opt={opt} index={i} />
            ))}
          </Stack>

          {/* Historical context */}
          <Box
            sx={{
              p: 2, borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.03)",
              border: "1px solid", borderColor: "divider",
              display: "flex", gap: 1.5,
            }}
          >
            <HistoryIcon sx={{ fontSize: 16, color: "text.disabled", mt: 0.3, flexShrink: 0 }} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6 }}>
                Historical Context
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7, mt: 0.25 }}>
                {result.historicalContext}
              </Typography>
            </Box>
          </Box>

          {/* Run another */}
          <Box sx={{ mt: 3 }}>
            <Button
              startIcon={<ScienceIcon />}
              onClick={() => { setStep(0); setScenarioType(null); setResult(null); }}
              variant="outlined"
              sx={{ borderColor: "#4db6ac", color: "#4db6ac" }}
            >
              Run Another Simulation
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
