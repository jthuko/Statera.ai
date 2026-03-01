import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useAuth } from "../auth/useAuth";

const PLAN_FEATURES = [
  "Unlimited staff scheduling",
  "AI-powered shift suggestions",
  "Time clock & timesheets",
  "Staff portal & self-service",
  "Demand templates",
  "Open shift marketplace",
  "Payroll integrations (Gusto, QuickBooks)",
  "Chat & messaging",
  "Analytics & reports",
];

export default function TrialExpiredPage() {
  const { logout } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          width: "100%",
          maxWidth: 520,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        {/* Lock icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 36, color: "#fff" }} />
        </Box>

        <Typography variant="h5" fontWeight={800} gutterBottom>
          Your free trial has ended
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Upgrade to keep your schedules, staff data, and settings — nothing is deleted.
        </Typography>

        {/* Pricing card */}
        <Box
          sx={{
            border: "2px solid",
            borderColor: "primary.main",
            borderRadius: 2,
            p: 3,
            mb: 3,
            background: "rgba(59,130,246,0.05)",
          }}
        >
          <Chip label="Growth Plan" color="primary" size="small" sx={{ mb: 1.5 }} />
          <Typography variant="h4" fontWeight={800}>
            $199
            <Typography component="span" variant="body1" color="text.secondary" fontWeight={400}>
              /month
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Up to 3 facilities · up to 150 staff · Cancel any time
          </Typography>

          <Stack spacing={1} alignItems="flex-start" sx={{ textAlign: "left" }}>
            {PLAN_FEATURES.map((f) => (
              <Stack key={f} direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "primary.main" }} />
                <Typography variant="body2">{f}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Button
          variant="contained"
          size="large"
          fullWidth
          href="mailto:hello@statera.ai?subject=Upgrade%20to%20Paid%20Plan"
          sx={{
            py: 1.5,
            fontWeight: 700,
            mb: 1.5,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            "&:hover": { background: "linear-gradient(135deg, #2563eb, #7c3aed)" },
          }}
        >
          Upgrade now — Contact us
        </Button>

        <Button
          variant="text"
          size="small"
          onClick={logout}
          sx={{ color: "text.secondary" }}
        >
          Sign out
        </Button>
      </Paper>
    </Box>
  );
}
