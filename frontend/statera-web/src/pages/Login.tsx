import { useState } from "react";
import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useAuth } from "../auth/useAuth";
import { useNavigate } from "react-router-dom";

export default function LoginPage(){
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try{
      await login(email, password);
      // Read role from localStorage (setUser is async, but localStorage is sync)
      const raw = localStorage.getItem("statera:user");
      const role = raw ? (JSON.parse(raw) as { systemRole?: string }).systemRole : null;
      nav(role === "Staff" ? "/portal" : "/");
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Paper sx={{ p:3, width: 420 }}>
        <Typography variant="h5" fontWeight={700}>Welcome back</Typography>
        <Typography variant="body2" sx={{ opacity:.7, mb:2 }}>Sign in to manage schedules</Typography>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <TextField label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
            <Button type="submit" variant="contained" disabled={loading}>Sign In</Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
