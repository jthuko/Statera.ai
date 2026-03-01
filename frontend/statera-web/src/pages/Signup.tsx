import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../auth/useAuth";
import { useNavigate, Link as RouterLink } from "react-router-dom";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function SignupPage() {
  const { signup } = useAuth();
  const nav = useNavigate();

  const [facilityName, setFacilityName] = useState("");
  const [facilityAddress, setFacilityAddress] = useState("");
  const [facilityCity, setFacilityCity] = useState("");
  const [facilityState, setFacilityState] = useState("");
  const [facilityZip, setFacilityZip] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup({
        facilityName,
        facilityAddress,
        facilityCity,
        facilityState,
        facilityZip,
        firstName,
        lastName,
        email,
        password,
      });
      nav("/app");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Signup failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
          p: { xs: 3, sm: 4 },
          width: "100%",
          maxWidth: 580,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 3, textAlign: "center" }}>
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: 0.5,
            }}
          >
            Statera.ai
          </Typography>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Start your free 7-day trial
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No credit card required. Full access to all features.
          </Typography>
          <Chip
            label="7 days free · then $99/mo"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </Box>

        <Divider sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary">
            Facility details
          </Typography>
        </Divider>

        <form onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="Facility name *"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              required
              fullWidth
              placeholder="e.g. Sunrise Memory Care"
            />

            <TextField
              label="Street address"
              value={facilityAddress}
              onChange={(e) => setFacilityAddress(e.target.value)}
              fullWidth
              placeholder="123 Main St"
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="City"
                  value={facilityCity}
                  onChange={(e) => setFacilityCity(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  select
                  label="State *"
                  value={facilityState}
                  onChange={(e) => setFacilityState(e.target.value)}
                  required
                  fullWidth
                >
                  {US_STATES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="ZIP"
                  value={facilityZip}
                  onChange={(e) => setFacilityZip(e.target.value)}
                  fullWidth
                  inputProps={{ maxLength: 10 }}
                />
              </Grid>
            </Grid>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                Your account
              </Typography>
            </Divider>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First name *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last name *"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>
            </Grid>

            <TextField
              label="Work email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />

            <TextField
              label="Password *"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
              helperText="Minimum 8 characters"
            />

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              fullWidth
              sx={{
                py: 1.5,
                fontWeight: 700,
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                "&:hover": { background: "linear-gradient(135deg, #2563eb, #7c3aed)" },
              }}
            >
              {loading ? "Creating your account…" : "Start free trial →"}
            </Button>

            <Typography variant="body2" align="center" color="text.secondary">
              Already have an account?{" "}
              <RouterLink to="/login" style={{ color: "#3b82f6" }}>
                Sign in
              </RouterLink>
            </Typography>

            <Typography variant="caption" align="center" color="text.secondary">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
