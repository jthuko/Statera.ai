// src/pages/ForgotPassword.tsx
import { useState } from "react";
import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { CheckCircleOutline as CheckIcon } from "@mui/icons-material";
import axios from "axios";
import StateraLogo from "../assets/statera-logo.png";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post("/api/v1/auth/forgot-password", { email: email.trim() });
      setSent(true);
      // Dev mode: backend returns the reset URL so the flow can be tested without email
      if (res.data?.resetUrl) setResetUrl(res.data.resetUrl);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Paper sx={{ p: 3, width: 420 }}>
        <Box
          component="img"
          src={StateraLogo}
          alt="Statera"
          sx={{
            width: 200, height: "auto", objectFit: "contain",
            display: "block", mb: 1.5,
            filter: "drop-shadow(0 0 10px rgba(0,137,123,0.25))",
          }}
        />

        {sent ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 2, textAlign: "center" }}>
            <CheckIcon sx={{ fontSize: 48, color: "#10b981" }} />
            <Typography variant="h6" fontWeight={700}>Check your email</Typography>
            <Typography variant="body2" color="text.secondary">
              If an account exists for <strong>{email}</strong>, we sent a password reset link.
            </Typography>

            {/* Until email is configured, the reset link is returned directly */}
            {resetUrl && (
              <Button
                component={RouterLink}
                to={resetUrl}
                variant="contained"
                sx={{ mt: 1 }}
              >
                Continue to reset password
              </Button>
            )}

            <Button component={RouterLink} to="/login" variant="outlined" size="small" sx={{ mt: 1 }}>
              Back to sign in
            </Button>
          </Stack>
        ) : (
          <>
            <Typography variant="h5" fontWeight={700}>Reset your password</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
              Enter your email and we'll send you a reset link.
            </Typography>
            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <Button type="submit" variant="contained" disabled={loading || !email.trim()}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <Typography variant="body2" textAlign="center">
                  <Link component={RouterLink} to="/login" underline="hover" sx={{ opacity: 0.7 }}>
                    Back to sign in
                  </Link>
                </Typography>
              </Stack>
            </form>
          </>
        )}
      </Paper>
    </Box>
  );
}
