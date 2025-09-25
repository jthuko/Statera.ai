import { Card, CardContent, CardHeader, Typography } from "@mui/material";
import { ReactNode } from "react";

export default function RuleCard({
  title,
  subheader,
  children,
}: {
  title: string;
  subheader?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader
        title={<Typography variant="h6">{title}</Typography>}
        subheader={subheader}
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
