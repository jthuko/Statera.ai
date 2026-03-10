import { useEffect, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Chip, CircularProgress, Divider,
  Stack, Tooltip, Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  MonitorHeart as MonitorHeartIcon,
  AccessAlarm as AccessAlarmIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Lightbulb as LightbulbIcon,
  AutoAwesome as AutoAwesomeIcon,
} from "@mui/icons-material";
import api from "../api/axios";
import { useFacility } from "../context/facility";

interface BurnoutStaff {
  staffId: string;
  staffName: string;
  role: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  totalHours: number;
  overtimeHours: number;
  consecutiveDays: number;
  restViolations: number;
  sickCalloffs: number;
  aiInsight: string | null;
  suggestions: string[] | null;
}

interface BurnoutResponse {
  staff: BurnoutStaff[];
  windowStart: string;
  windowEnd: string;
}

function riskColor(level: string): "success" | "warning" | "error" | "default" {
  switch (level) {
    case "Critical": return "error";
    case "High":     return "error";
    case "Medium":   return "warning";
    default:         return "success";
  }
}

function riskBg(level: string, isDark: boolean) {
  switch (level) {
    case "Critical": return isDark ? "rgba(211,47,47,0.12)"  : "rgba(211,47,47,0.06)";
    case "High":     return isDark ? "rgba(239,83,80,0.10)"  : "rgba(239,83,80,0.05)";
    case "Medium":   return isDark ? "rgba(245,124,0,0.10)"  : "rgba(245,124,0,0.05)";
    default:         return isDark ? "rgba(56,142,60,0.08)"  : "rgba(56,142,60,0.04)";
  }
}

function RiskBadge({ score, level }: { score: number; level: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Chip
        label={level}
        color={riskColor(level) as "success" | "warning" | "error" | "default"}
        size="small"
        sx={{ fontWeight: 700, minWidth: 76 }}
      />
      <Typography variant="body2" sx={{ color: "text.secondary", minWidth: 48, textAlign: "right" }}>
        {score}%
      </Typography>
    </Box>
  );
}

function MetricPill({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <Box
      sx={{
        px: 1.5, py: 0.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: warn ? "warning.main" : "divider",
        bgcolor: warn ? "rgba(245,124,0,0.08)" : "transparent",
        display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80,
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.2 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: warn ? "warning.main" : "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function BurnoutPage() {
  const { selected: facility } = useFacility();
  const [data, setData]       = useState<BurnoutResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!facility?.id) return;
    setLoading(true);
    setError(null);
    api.get<BurnoutResponse>(`/facilities/${facility.id}/burnout`)
      .then(r => setData(r.data))
      .catch(() => setError("Failed to load burnout data."))
      .finally(() => setLoading(false));
  }, [facility?.id]);

  const criticalCount = data?.staff.filter(s => s.riskLevel === "Critical").length ?? 0;
  const highCount     = data?.staff.filter(s => s.riskLevel === "High").length ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <MonitorHeartIcon sx={{ fontSize: 28, color: "#4db6ac" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Burnout Prediction
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            AI-powered risk tracking for the last 4 weeks
          </Typography>
        </Box>
      </Box>

      {/* Summary chips */}
      {data && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap", gap: 1 }}>
          {criticalCount > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${criticalCount} Critical`}
              color="error"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          )}
          {highCount > 0 && (
            <Chip
              icon={<AccessAlarmIcon />}
              label={`${highCount} High Risk`}
              color="warning"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          )}
          {criticalCount === 0 && highCount === 0 && (
            <Chip
              icon={<CheckCircleIcon />}
              label="No high-risk staff detected"
              color="success"
              variant="outlined"
            />
          )}
          <Typography variant="caption" sx={{ color: "text.secondary", alignSelf: "center", ml: 1 }}>
            Window: last 28 days
          </Typography>
        </Stack>
      )}

      {!facility && (
        <Alert severity="info">Select a facility to view burnout data.</Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress sx={{ color: "#4db6ac" }} />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {data && !loading && (
        <Stack spacing={1}>
          {data.staff.length === 0 && (
            <Alert severity="info">No active staff with assignments in this window.</Alert>
          )}

          {data.staff.map(staff => (
            <Accordion
              key={staff.staffId}
              disableGutters
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: staff.riskLevel === "Critical" || staff.riskLevel === "High"
                  ? "rgba(239,83,80,0.3)"
                  : "divider",
                borderRadius: "10px !important",
                bgcolor: riskBg(staff.riskLevel, true),
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1, pr: 1, flexWrap: "wrap" }}>
                  {/* Name + role */}
                  <Box sx={{ flex: 1, minWidth: 140 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {staff.staffName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {staff.role}
                    </Typography>
                  </Box>

                  {/* Progress bar + badge */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ width: 100, display: { xs: "none", sm: "block" } }}>
                      <Box
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: "rgba(255,255,255,0.1)",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            height: "100%",
                            width: `${staff.riskScore}%`,
                            borderRadius: 3,
                            bgcolor:
                              staff.riskLevel === "Critical" ? "#d32f2f"
                              : staff.riskLevel === "High"   ? "#ef5350"
                              : staff.riskLevel === "Medium" ? "#f57c00"
                              : "#4caf50",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </Box>
                    </Box>
                    <RiskBadge score={staff.riskScore} level={staff.riskLevel} />
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ pt: 0 }}>
                <Divider sx={{ mb: 2 }} />

                {/* Metrics */}
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <MetricPill label="Total Hours" value={`${staff.totalHours}h`} warn={staff.totalHours > 160} />
                  <MetricPill label="Overtime" value={`${staff.overtimeHours}h`} warn={staff.overtimeHours > 0} />
                  <Tooltip title="Longest consecutive days worked">
                    <Box>
                      <MetricPill
                        label="Consec. Days"
                        value={staff.consecutiveDays}
                        warn={staff.consecutiveDays >= 5}
                      />
                    </Box>
                  </Tooltip>
                  <Tooltip title="Shifts with < 10h rest between them">
                    <Box>
                      <MetricPill
                        label="Short Rest"
                        value={staff.restViolations}
                        warn={staff.restViolations > 0}
                      />
                    </Box>
                  </Tooltip>
                  <MetricPill
                    label="Sick Days"
                    value={staff.sickCalloffs}
                    warn={staff.sickCalloffs > 0}
                  />
                </Stack>

                {/* AI Insight */}
                {staff.aiInsight && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: "rgba(77,182,172,0.08)",
                      border: "1px solid rgba(77,182,172,0.2)",
                      mb: 2,
                      display: "flex",
                      gap: 1,
                    }}
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 16, color: "#4db6ac", mt: 0.2, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                      {staff.aiInsight}
                    </Typography>
                  </Box>
                )}

                {/* Suggestions */}
                {staff.suggestions && staff.suggestions.length > 0 && (
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                      <LightbulbIcon sx={{ fontSize: 14, color: "#f57c00" }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6 }}>
                        Suggested Actions
                      </Typography>
                    </Box>
                    <Stack spacing={0.5}>
                      {staff.suggestions.map((s, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                          <Typography variant="body2" sx={{ color: "text.disabled", mt: 0.1 }}>•</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>{s}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
}
