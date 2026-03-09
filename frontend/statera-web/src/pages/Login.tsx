import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useAuth } from "../auth/useAuth";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import StateraLogo from "../assets/statera-logo.png";

export default function LoginPage(){
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const { login } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try{
      const loggedUser = await login(email, password);
      nav(loggedUser.systemRole === "Staff" ? "/portal" : "/app");
    } catch(err: any) {
      const status = err?.response?.status;
      if (status === 401) setError("Invalid email or password.");
      else setError("Login failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Paper sx={{ p:3, width: 420 }}>
        <Box
          component="img"
          src={StateraLogo}
          alt="Statera"
          sx={{
            width: 200,
            height: "auto",
            objectFit: "contain",
            display: "block",
            mb: 1.5,
            filter: "drop-shadow(0 0 10px rgba(0,137,123,0.25))",
          }}
        />
        <Typography variant="h5" fontWeight={700}>Welcome back</Typography>
        <Typography variant="body2" sx={{ opacity:.7, mb:2 }}>
          Sign in to manage schedules &nbsp;·&nbsp;{" "}
          <RouterLink to="/" style={{ color: "inherit", opacity: 0.6, fontSize: 12 }}>Home</RouterLink>
        </Typography>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <TextField label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
            <Button type="submit" variant="contained" disabled={loading}>Sign In</Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
