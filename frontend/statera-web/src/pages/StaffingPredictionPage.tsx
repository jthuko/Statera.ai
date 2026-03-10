import { useEffect, useState } from "react";
import {
  Alert, Box, Chip, CircularProgress, Divider,
  LinearProgress, Stack, Tooltip, Typography,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  AutoAwesome as AutoAwesomeIcon,
  CalendarMonth as CalendarIcon,
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import api from "../api/axios";
import { useFacility } from "../context/facility";

interface Prediction {
  id: string;
  role: string;
  startDate: string;
  endDate: string;
  shiftPattern: string;
  probability: number;
  severity: "Low" | "Medium" | "High" | "Critical";
  recommendation: string;
  reason: string;
  aiInsight: string | null;
}

interface PredictionResponse {
  predictions: Prediction[];
  windowStart: string;
  windowEnd: string;
}

function severityColor(s: string): string {
  switch (s) {
    case "Critical": return "#d32f2f";
    case "High":     return "#ef5350";
    case "Medium":   return "#f57c00";
    default:         return "#4caf50";
  }
}

function severityChipColor(s: string): "error" | "warning" | "success" | "default" {
  switch (s) {
    case "Critical": return "error";
    case "High":     return "error";
    case "Medium":   return "warning";
    default:         return "success";
  }
}

function PredictionCard({ p }: { p: Prediction }) {
  const pct = Math.round(p.probability * 100);
  const barColor = severityColor(p.severity);
  const same = p.startDate === p.endDate;
  const dateLabel = same
    ? dayjs(p.startDate).format("MMM D, YYYY")
    : `${dayjs(p.startDate).format("MMM D")} – ${dayjs(p.endDate).format("MMM D, YYYY")}`;

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: p.severity === "Critical" || p.severity === "High"
          ? "rgba(239,83,80,0.3)"
          : p.severity === "Medium" ? "rgba(245,124,0,0.2)" : "rgba(76,175,80,0.2)",
        bgcolor: p.severity === "Critical" ? "rgba(211,47,47,0.06)"
               : p.severity === "High"     ? "rgba(239,83,80,0.04)"
               : p.severity === "Medium"   ? "rgba(245,124,0,0.04)"
               : "rgba(76,175,80,0.03)",
      }}
    >
      {/* Header row */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            {p.severity === "Critical" && <ErrorOutlineIcon sx={{ fontSize: 16, color: "#d32f2f" }} />}
            {p.severity === "High" && <WarningIcon sx={{ fontSize: 16, color: "#ef5350" }} />}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Predicted {p.role} Shortage
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarIcon sx={{ fontSize: 13, color: "text.secondary" }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{dateLabel}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>·</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{p.shiftPattern}</Typography>
          </Stack>
        </Box>
        <Chip
          label={p.severity}
          color={severityChipColor(p.severity)}
          size="small"
          sx={{ fontWeight: 700, minWidth: 76, flexShrink: 0 }}
        />
      </Stack>

      {/* Probability bar */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
            SHORTAGE PROBABILITY
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: barColor }}>
            {pct}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: "rgba(255,255,255,0.08)",
            "& .MuiLinearProgress-bar": {
              borderRadius: 4,
              bgcolor: barColor,
            },
          }}
        />
      </Box>

      {/* Recommendation */}
      <Box
        sx={{
          p: 1.5, mb: 1.5, borderRadius: 1.5,
          bgcolor: "rgba(0,137,123,0.08)",
          border: "1px solid rgba(77,182,172,0.2)",
          display: "flex", gap: 1, alignItems: "flex-start",
        }}
      >
        <LightbulbIcon sx={{ fontSize: 15, color: "#4db6ac", mt: 0.15, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
          {p.recommendation}
        </Typography>
      </Box>

      {/* AI Insight */}
      {p.aiInsight && (
        <Box
          sx={{
            p: 1.5, mb: 1.5, borderRadius: 1.5,
            bgcolor: "rgba(77,182,172,0.06)",
            border: "1px solid rgba(77,182,172,0.15)",
            display: "flex", gap: 1, alignItems: "flex-start",
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 14, color: "#4db6ac", mt: 0.15, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
            {p.aiInsight}
          </Typography>
        </Box>
      )}

      {/* Reason */}
      <Typography variant="caption" sx={{ color: "text.disabled" }}>
        Why: {p.reason}
      </Typography>
    </Box>
  );
}

export default function StaffingPredictionPage() {
  const { selected: facility } = useFacility();
  const [data, setData]       = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!facility?.id) return;
    setLoading(true);
    setError(null);
    api.get<PredictionResponse>(`/facilities/${facility.id}/staffing-predictions`)
      .then(r => setData(r.data))
      .catch(() => setError("Failed to load staffing predictions."))
      .finally(() => setLoading(false));
  }, [facility?.id]);

  const criticalCount = data?.predictions.filter(p => p.severity === "Critical").length ?? 0;
  const highCount     = data?.predictions.filter(p => p.severity === "High").length ?? 0;
  const totalCount    = data?.predictions.length ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <TrendingUpIcon sx={{ fontSize: 28, color: "#4db6ac" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Staffing Predictions
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            AI-powered shortage forecasts for the next 4 weeks
          </Typography>
        </Box>
      </Box>

      {/* Window label */}
      {data && (
        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mb: 2 }}>
          Forecast window: {dayjs(data.windowStart).format("MMM D")} – {dayjs(data.windowEnd).format("MMM D, YYYY")}
          {" · "}Based on 12 weeks of historical patterns
        </Typography>
      )}

      {/* Summary chips */}
      {data && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap", gap: 1 }}>
          {criticalCount > 0 && (
            <Chip icon={<ErrorOutlineIcon />} label={`${criticalCount} Critical`} color="error" variant="outlined" sx={{ fontWeight: 700 }} />
          )}
          {highCount > 0 && (
            <Chip icon={<WarningIcon />} label={`${highCount} High Risk`} color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
          )}
          {totalCount > 0 && criticalCount === 0 && highCount === 0 && (
            <Chip icon={<CheckCircleIcon />} label={`${totalCount} Low-risk prediction${totalCount !== 1 ? "s" : ""}`} color="success" variant="outlined" />
          )}
          {totalCount === 0 && data && (
            <Chip icon={<CheckCircleIcon />} label="No shortages predicted" color="success" variant="outlined" />
          )}
        </Stack>
      )}

      {!facility && (
        <Alert severity="info">Select a facility to view staffing predictions.</Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress sx={{ color: "#4db6ac" }} />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {data && !loading && (
        <>
          {data.predictions.length === 0 && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              No staffing shortages predicted for the next 4 weeks based on current schedules and historical patterns.
            </Alert>
          )}

          {/* Group by severity */}
          {(["Critical", "High", "Medium", "Low"] as const).map(sev => {
            const group = data.predictions.filter(p => p.severity === sev);
            if (group.length === 0) return null;
            return (
              <Box key={sev} sx={{ mb: 3 }}>
                <Divider sx={{ mb: 2 }}>
                  <Chip
                    label={sev}
                    size="small"
                    color={severityChipColor(sev) as "error" | "warning" | "success" | "default"}
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                </Divider>
                <Stack spacing={1.5}>
                  {group.map(p => <PredictionCard key={p.id} p={p} />)}
                </Stack>
              </Box>
            );
          })}

          {/* How it works note */}
          <Box sx={{ mt: 4, p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <AutoAwesomeIcon sx={{ fontSize: 14, color: "#4db6ac" }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6 }}>
                How predictions work
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: "text.disabled", lineHeight: 1.6 }}>
              Statera analyzes 12 weeks of historical assignment data per role and day-of-week, your current scheduled coverage,
              historical sick call-off rates, and seasonal demand factors (flu season, holidays) to calculate shortage probability.
              High/Critical predictions include an AI-generated plain-English insight.
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}
