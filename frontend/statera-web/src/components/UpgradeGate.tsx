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

interface UpgradeGateProps {
  children: React.ReactNode;
}

/** Wraps a route: renders children if Growth+, otherwise shows upgrade prompt. */
export function UpgradeGate({ children }: UpgradeGateProps) {
  const { isGrowthPlus } = usePlanFeatures();
  if (isGrowthPlus) return <>{children}</>;
  return <UpgradePrompt />;
}

function UpgradePrompt() {
  const navigate = useNavigate();
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
        Growth Plan Required
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420, mb: 3 }}>
        This feature is available on the Growth plan. Upgrade to unlock:
      </Typography>

      <List dense sx={{ mb: 3, textAlign: "left", width: "100%", maxWidth: 380 }}>
        {GROWTH_FEATURES.map((f) => (
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
        <Typography variant="h3" fontWeight={900} lineHeight={1}>$499</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>/month</Typography>
      </Stack>
      <Chip label="Up to 3 facilities" size="small" sx={{ mb: 3 }} />

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/trial-expired")}
        >
          Upgrade to Growth
        </Button>
        <Button variant="outlined" size="large" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Stack>
    </Box>
  );
}
