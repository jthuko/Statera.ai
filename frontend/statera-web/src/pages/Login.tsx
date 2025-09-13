import { Box, Button, Container, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
export default function Login(){
  const [email,setEmail]=useState("admin@statera.local");
  const [password,setPassword]=useState("Password123!");
  const [err,setErr]=useState<string|null>(null);
  const nav=useNavigate(); const loc=useLocation();
  const { signIn } = useAuth();
  async function submit(e:React.FormEvent){ e.preventDefault();
    try{ await signIn(email,password); const dest=(loc.state as any)?.from?.pathname || "/"; nav(dest); }catch{ setErr("Login failed"); } }
  return (<Container maxWidth="sm" sx={{ mt:8 }}>
    <Typography variant="h4" gutterBottom>Sign in to Statera</Typography>
    <Box component="form" onSubmit={submit}>
      <TextField fullWidth margin="normal" label="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <TextField fullWidth type="password" margin="normal" label="Password" value={password} onChange={e=>setPassword(e.target.value)} />
      {err && <Typography color="error">{err}</Typography>}
      <Button type="submit" variant="contained" sx={{ mt:2 }}>Sign In</Button>
    </Box></Container>);
}
