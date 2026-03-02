import React from "react";
import { Box, Button, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
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
