// src/pages/ResetPassword.tsx
import { useState } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { Visibility, VisibilityOff, CheckCircleOutline as CheckIcon } from "@mui/icons-material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import axios from "axios";
import StateraLogo from "../assets/statera-logo.png";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = !email || !token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.post("/api/v1/auth/reset-password", {
        email,
        token,
        newPassword,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Reset failed. The link may have expired.");
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

        {invalid ? (
          <Stack spacing={2}>
            <Alert severity="error">
              This reset link is invalid or incomplete. Please request a new one.
            </Alert>
            <Button component={RouterLink} to="/forgot-password" variant="outlined">
              Request new link
            </Button>
          </Stack>
        ) : done ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 2, textAlign: "center" }}>
            <CheckIcon sx={{ fontSize: 48, color: "#10b981" }} />
            <Typography variant="h6" fontWeight={700}>Password updated!</Typography>
            <Typography variant="body2" color="text.secondary">
              Your password has been reset. You can now sign in with your new password.
            </Typography>
            <Button component={RouterLink} to="/login" variant="contained" sx={{ mt: 1 }}>
              Sign in
            </Button>
          </Stack>
        ) : (
          <>
            <Typography variant="h5" fontWeight={700}>Set new password</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
              Enter a new password for <strong>{email}</strong>.
            </Typography>
            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField
                  label="New password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword(v => !v)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Confirm password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  error={!!confirmPassword && confirmPassword !== newPassword}
                  helperText={confirmPassword && confirmPassword !== newPassword ? "Passwords don't match" : ""}
                />
                <Button type="submit" variant="contained" disabled={loading || !newPassword || !confirmPassword}>
                  {loading ? "Updating…" : "Reset password"}
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
