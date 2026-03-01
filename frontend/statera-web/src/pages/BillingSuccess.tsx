import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Paper, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

export default function BillingSuccessPage() {
  const navigate = useNavigate();

  // Reload user data so planStatus refreshes from the server
  useEffect(() => {
    const timer = setTimeout(() => navigate("/app"), 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

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
          maxWidth: 480,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #22c55e, #16a34a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 40, color: "#fff" }} />
        </Box>

        <Typography variant="h5" fontWeight={800} gutterBottom>
          You're all set!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Your subscription is active. Welcome to Statera — let's get back to scheduling.
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/app")}
          sx={{
            py: 1.5,
            fontWeight: 700,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            "&:hover": { background: "linear-gradient(135deg, #2563eb, #7c3aed)" },
          }}
        >
          Go to dashboard
        </Button>
      </Paper>
    </Box>
  );
}
