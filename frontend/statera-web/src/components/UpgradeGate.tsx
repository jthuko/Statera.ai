import React from "react";
import { Box, Button, Chip, Divider, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useNavigate } from "react-router-dom";
import { usePlanFeatures } from "../auth/usePlanFeatures";

const GROWTH_FEATURES = [
  "Coverage Analytics & demand forecasting",
  "Demand templates",
  "AI-powered chat assistant",
  "Gusto & QuickBooks payroll integration",
  "Bulk staff import (CSV / XLSX)",
];

const SCALE_FEATURES = [
  "AI Scenario Simulator — model staffing decisions before making them",
  "Short-staffed, call-off, and overtime reduction simulations",
  "AI-generated response recommendations with cost & risk scoring",
  "12-week historical context per scenario",
  "All Growth plan features included",
];

interface UpgradeGateProps {
  children: React.ReactNode;
  /** Minimum tier required. Defaults to "growth". */
  tier?: "growth" | "scale";
}

/** Wraps a route: renders children if the user meets the tier requirement, otherwise shows upgrade prompt. */
export function UpgradeGate({ children, tier = "growth" }: UpgradeGateProps) {
  const { isGrowthPlus, isScalePlus } = usePlanFeatures();
  const hasAccess = tier === "scale" ? isScalePlus : isGrowthPlus;
  if (hasAccess) return <>{children}</>;
  return <UpgradePrompt tier={tier} />;
}

function UpgradePrompt({ tier }: { tier: "growth" | "scale" }) {
  const navigate = useNavigate();
  const isScale  = tier === "scale";

  const title    = isScale ? "Scale Plan Required" : "Growth Plan Required";
  const subtitle = isScale
    ? "The AI Scenario Simulator is available on the Scale plan. Upgrade to unlock:"
    : "This feature is available on the Growth plan. Upgrade to unlock:";
  const features = isScale ? SCALE_FEATURES : GROWTH_FEATURES;
  const price    = isScale ? "$899" : "$499";
  const label    = isScale ? "Up to 10 facilities" : "Up to 3 facilities";
  const btnLabel = isScale ? "Upgrade to Scale" : "Upgrade to Growth";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        px: 3,
      }}
    >
      <LockOutlinedIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420, mb: 3 }}>
        {subtitle}
      </Typography>

      <List dense sx={{ mb: 3, textAlign: "left", width: "100%", maxWidth: 380 }}>
        {features.map((f) => (
          <ListItem key={f} disableGutters>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleOutlineIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText primary={f} />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ width: "100%", maxWidth: 380, mb: 3 }} />

      <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="h3" fontWeight={900} lineHeight={1}>{price}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>/month</Typography>
      </Stack>
      <Chip label={label} size="small" sx={{ mb: 3 }} />

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/trial-expired")}
        >
          {btnLabel}
        </Button>
        <Button variant="outlined" size="large" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Stack>
    </Box>
  );
}
