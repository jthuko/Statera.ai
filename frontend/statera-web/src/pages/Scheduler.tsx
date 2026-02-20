import { useState, useEffect } from "react";
import {
  Container,
  TextField,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  Select,
  FormControl,
  InputLabel,
  Box
} from "@mui/material";
import { suggestAssignments, listStaff, Suggestion } from "../api/endpoints";
import { listUnits } from "../api/units";
import { useFacility } from "../context/facility";

type Row = {
  staffId: string;
  name: string;
  role?: string | null;
  score: number;
  reasoning?: string;
};

export default function Scheduler(){
  const [startUtc,setStart]=useState<string>(new Date().toISOString());
  const [endUtc,setEnd]=useState<string>(new Date(Date.now()+8*3600*1000).toISOString());
  const [unitId,setUnitId]=useState<string>("");
  const [cred,setCred]=useState<"RN"|"LPN"|"CNA">("RN");
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string | null>(null);
  const [units,setUnits]=useState<{id:string;name:string}[]>([]);
  const { facilities, selected: facility, setSelectedId } = useFacility();

  // load units when facility changes
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!facility) return setUnits([]);
      try {
        const u = await listUnits(facility.id);
        if (mounted) setUnits(u.map(x => ({ id: x.id, name: x.name })));
      } catch (e) {
        if (mounted) setUnits([]);
      }
    }
    load();
    return () => { mounted = false; };
  }, [facility]);
  const [orderBy,setOrderBy]=useState<"score"|"name">("score");
  const [orderDesc,setOrderDesc]=useState<boolean>(true);

  async function run(){
    setLoading(true);
    setError(null);
    setRows([]);
    try{
      const res: Suggestion[] = await suggestAssignments({ startUtc, endUtc, unitId, requiredCredential: cred });

      // batch-fetch staff (optionally scoped to facility)
      const facilityId = facility?.id ?? undefined;
      const staffList = await listStaff(facilityId);
      const map = new Map(staffList.map(s => [s.id, s]));

      const details = res.map(s => {
        const d = map.get(s.staffId);
        const name = d?.name ?? s.staffId;
        const role = d?.role ?? null;
        return { staffId: s.staffId, name, role, score: s.score, reasoning: s.reasoning } as Row;
      });

      setRows(details);
    }catch(e:any){
      setError(e?.response?.data?.error ?? e?.message ?? "Request failed");
    }finally{
      setLoading(false);
    }
  }

  const sorted = [...rows].sort((a,b)=>{
    const dir = orderDesc ? -1 : 1;
    if(orderBy === "score") return dir * (b.score - a.score);
    return dir * a.name.localeCompare(b.name);
  });

  return (<Container sx={{ mt:3 }}>
    <Typography variant="h5" gutterBottom>AI Suggestions</Typography>
    <TextField fullWidth label="Start (UTC ISO)" margin="dense" value={startUtc} onChange={e=>setStart(e.target.value)} />
    <TextField fullWidth label="End (UTC ISO)" margin="dense" value={endUtc} onChange={e=>setEnd(e.target.value)} />
      <Box sx={{ display: 'flex', gap:2, alignItems: 'center', mt:1 }}>
      <FormControl size="small" sx={{ minWidth:260 }}>
        <InputLabel>Facility</InputLabel>
        <Select label="Facility" value={facility?.id ?? ""} onChange={(e)=>setSelectedId(String(e.target.value))}>
          {facilities.map(f => (<MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth:220 }}>
        <InputLabel>Unit</InputLabel>
        <Select label="Unit" value={unitId} onChange={(e)=>setUnitId(String(e.target.value))}>
          <MenuItem value="">(Any Unit)</MenuItem>
          {units.map(u => (<MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>))}
        </Select>
      </FormControl>
      <TextField select size="small" label="Credential" value={cred} onChange={(e)=>setCred(e.target.value as any)} sx={{ minWidth:120 }}>
        <MenuItem value="RN">RN</MenuItem><MenuItem value="LPN">LPN</MenuItem><MenuItem value="CNA">CNA</MenuItem>
      </TextField>
      <Button variant="contained" onClick={run} disabled={loading}>Suggest</Button>
    </Box>

    {loading ? (
      <CircularProgress sx={{ mt:2 }} />
    ) : error ? (
      <Alert severity="error" sx={{ mt:2 }}>{error}</Alert>
    ) : rows.length === 0 ? (
      <Typography sx={{ mt:2, color: 'text.secondary' }}>No suggestions returned</Typography>
    ) : (
      <TableContainer component={Paper} sx={{ mt:2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={orderBy==='name'} direction={orderDesc? 'desc':'asc'} onClick={()=>{ if(orderBy==='name') setOrderDesc(!orderDesc); else { setOrderBy('name'); setOrderDesc(false); } }}>
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">
                <TableSortLabel active={orderBy==='score'} direction={orderDesc? 'desc':'asc'} onClick={()=>{ if(orderBy==='score') setOrderDesc(!orderDesc); else { setOrderBy('score'); setOrderDesc(true); } }}>
                  Score
                </TableSortLabel>
              </TableCell>
              <TableCell>Reasoning</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map(r=> (
              <TableRow key={r.staffId}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.role ?? '—'}</TableCell>
                <TableCell align="right">{r.score.toFixed(0)}</TableCell>
                <TableCell>{r.reasoning}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )}
  </Container>);
}
