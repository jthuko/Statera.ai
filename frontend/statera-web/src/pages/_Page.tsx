// src/pages/_Page.tsx
import { Container, Stack, Typography } from "@mui/material";

export default function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <div>
          <Typography variant="h3" fontWeight={700} gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </div>
        {actions}
      </Stack>
      <Stack spacing={3}>{children}</Stack>
    </Container>
  );
}
