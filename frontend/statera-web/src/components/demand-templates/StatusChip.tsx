// src/components/demand-templates/StatusChip.tsx
import * as React from "react";
import { Chip } from "@mui/material";
import type { DemandTemplateStatus } from "../../api/demandTemplates";

export default function StatusChip({ status }: { status: DemandTemplateStatus }) {
  const color: "default" | "info" | "warning" | "success" = 
    status === "Draft" ? "default" :
    status === "Review" ? "info" :
    status === "Approved" ? "success" :
    "warning"; // Published -> use warning to pop, or success if you prefer

  return <Chip size="small" label={status} color={color} variant="outlined" />;
}
