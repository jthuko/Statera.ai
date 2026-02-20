import { useEffect, useState } from "react";
import { Box, Alert, Button, Stack, TextField, MenuItem } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Page from "./_Page";
import { listStaff, StaffDto } from "../api/staff";
import { useNavigate } from "react-router-dom";
import { useFacility } from "../context/facility";
import StaffFormDialog, { StaffFormValues } from "../components/staff/StaffFormDialog";
import { createStaff } from "../api/staff";
import FacilityStaffDialog from "../components/facilities/FacilityStaffDialog";

const cols: GridColDef[] = [
  { field: "id", headerName: "ID", width: 250 }, // GUIDs are long; give them space
  { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
  { field: "role", headerName: "Role", width: 160 },
  { field: "unit", headerName: "Unit", width: 160 },
];

export default function Staff() {
  const [rows, setRows] = useState<StaffDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const [open, setOpen] = useState(false);
  const [openFacilityDialog, setOpenFacilityDialog] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!facility) {
        setRows([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr(null);
        const data = await listStaff(facility.id);
        if (!alive) return;
        setRows(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load staff.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [facility]);

  const handleCreate = async (vals: StaffFormValues) => {
    if (!facility) return;
    try {
      await createStaff({ ...vals, facilityId: facility.id, email: vals.email ?? null, unitId: vals.unitId ?? null });
      // refresh
      const data = await listStaff(facility.id);
      setRows(data);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to create staff.");
    }
  };

  return (
    <Page title="Staff">
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <TextField select size="small" label="Facility" value={facility?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 280 }}>
          {facilities.map(f => (
            <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={() => setOpen(true)} disabled={!facility}>New Staff</Button>
      </Stack>
      <Box sx={{ height: 560 }}>
        <DataGrid
          columns={cols}
          rows={rows.map(r => ({ id: r.id, name: r.displayName ?? `${r.firstName} ${r.lastName}`, role: r.roles?.[0]?.name ?? "", unit: "" }))}
          loading={loading}
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          onRowClick={(p) => nav(`/staff/${p.id}`)} // id is string
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>
      <StaffFormDialog open={open} onClose={() => setOpen(false)} onSave={handleCreate} defaultFacilityId={facility?.id ?? ""} defaultUnitId={undefined} />
      {/* facility dialog removed — use inline facility selector above */}
    </Page>
  );
}
