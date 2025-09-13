import { useState } from "react";
import { Container, TextField, MenuItem, Button, Typography, List, ListItem, ListItemText } from "@mui/material";
import { suggestAssignments } from "../api/endpoints";
export default function Scheduler(){
  const [startUtc,setStart]=useState<string>(new Date().toISOString());
  const [endUtc,setEnd]=useState<string>(new Date(Date.now()+8*3600*1000).toISOString());
  const [unitId]=useState<number>(1);
  const [cred,setCred]=useState<"RN"|"LPN"|"CNA">("RN");
  const [results,setResults]=useState<{staffId:number,score:number,reasoning:string}[]>([]);
  async function run(){ const res = await suggestAssignments({ startUtc, endUtc, unitId, requiredCredential: cred }); setResults(res); }
  return (<Container sx={{ mt:3 }}>
    <Typography variant="h5" gutterBottom>AI Suggestions</Typography>
    <TextField fullWidth label="Start (UTC ISO)" margin="dense" value={startUtc} onChange={e=>setStart(e.target.value)} />
    <TextField fullWidth label="End (UTC ISO)" margin="dense" value={endUtc} onChange={e=>setEnd(e.target.value)} />
    <TextField select label="Credential" value={cred} onChange={(e)=>setCred(e.target.value as any)} sx={{ mr:2, mt:1 }}>
      <MenuItem value="RN">RN</MenuItem><MenuItem value="LPN">LPN</MenuItem><MenuItem value="CNA">CNA</MenuItem>
    </TextField>
    <Button variant="contained" onClick={run} sx={{ mt:1 }}>Suggest</Button>
    <List dense>{results.map(r=> (<ListItem key={r.staffId}><ListItemText primary={`Staff ${r.staffId} — Score ${r.score.toFixed(2)}`} secondary={r.reasoning}/></ListItem>))}</List>
  </Container>);
}
