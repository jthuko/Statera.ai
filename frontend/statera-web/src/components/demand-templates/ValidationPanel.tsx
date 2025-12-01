// src/components/demand-templates/ValidationPanel.tsx
import * as React from "react";
import { Alert, Box, List, ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import type { ValidationIssue } from "../../api/demandTemplates";

export default function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (!issues?.length) return null;

  const iconFor = (sev: ValidationIssue["severity"]) =>
    sev === "info" ? <InfoIcon /> : sev === "warning" ? <WarningAmberIcon /> : <ErrorOutlineIcon />;

  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>
        <Typography fontWeight={600}>Validation Results</Typography>
      </Alert>
      <List dense>
        {issues.map((x, i) => (
          <ListItem key={i}>
            <ListItemIcon>{iconFor(x.severity)}</ListItemIcon>
            <ListItemText
              primary={x.message}
              secondary={x.field ? `Field: ${x.field}` : undefined}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
