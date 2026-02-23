import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Page from "./_Page";
import { listStaff, createStaff, CreateStaffPayload, StaffDto } from "../api/staff";
import { useNavigate } from "react-router-dom";
import { useFacility } from "../context/facility";
import StaffFormDialog, { StaffFormValues } from "../components/staff/StaffFormDialog";

const cols: GridColDef[] = [
  { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
  { field: "role", headerName: "Role", width: 180 },
  { field: "employmentType", headerName: "Type", width: 140 },
  { field: "unit", headerName: "Unit", width: 160 },
];

export default function Staff() {
  const [rows, setRows] = useState<StaffDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [duplicatePopup, setDuplicatePopup] = useState(false);
  const [newLoginInfo, setNewLoginInfo] = useState<{ email: string; password: string } | null>(null);
  // Holds form values pending admin confirmation
  const [pendingAdminCreate, setPendingAdminCreate] = useState<StaffFormValues | null>(null);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { facilities, selected: facility, setSelectedId } = useFacility();

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
    return () => { alive = false; };
  }, [facility]);

  const doCreate = async (vals: StaffFormValues) => {
    if (!facility) return;
    try {
      const payload: CreateStaffPayload = {
        firstName: vals.firstName,
        lastName: vals.lastName,
        email: vals.email || null,
        facilityId: facility.id,
        unitId: vals.unitId || null,
        role: vals.role,
        employmentType: vals.employmentType,
        active: vals.active,
        adminAccess: vals.adminAccess,
      };
      const result = await createStaff(payload);
      const data = await listStaff(facility.id);
      setRows(data);
      setOpen(false);
      if (result.loginCreated && result.tempPassword && result.email) {
        setNewLoginInfo({ email: result.email, password: result.tempPassword });
      }
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setDuplicatePopup(true);
      } else {
        setErr(e?.message || "Failed to create staff.");
      }
    }
  };

  const handleCreate = async (vals: StaffFormValues) => {
    // If admin access is requested, show confirmation first
    if (vals.adminAccess && vals.email) {
      setPendingAdminCreate(vals);
      return;
    }
    await doCreate(vals);
  };

  const handleConfirmAdmin = async () => {
    if (!pendingAdminCreate) return;
    const vals = pendingAdminCreate;
    setPendingAdminCreate(null);
    await doCreate(vals);
  };

  return (
    <Page title="Staff">
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {duplicatePopup && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDuplicatePopup(false)}>
          Cannot add staff: a staff member with that email already exists.
        </Alert>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField select size="small" label="Facility" value={facility?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 280 }}>
            {facilities.map(f => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Search name or role"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </Stack>
        <Button variant="contained" onClick={() => setOpen(true)} disabled={!facility}>New Staff</Button>
      </Stack>
      <Box sx={{ height: 560 }}>
        <DataGrid
          columns={cols}
          rows={rows
            .filter(r => {
              if (!search) return true;
              const q = search.toLowerCase();
              const name = (r.displayName ?? `${r.firstName} ${r.lastName}`).toLowerCase();
              const role = (r.role ?? r.roles?.[0]?.name ?? "").toLowerCase();
              return name.includes(q) || role.includes(q);
            })
            .map(r => ({
              id: r.id,
              name: r.displayName ?? `${r.firstName} ${r.lastName}`,
              role: r.role ?? r.roles?.[0]?.name ?? "",
              employmentType: (r as any).employmentType ?? "",
              unit: "",
            }))}
          onRowClick={(p) => nav(`/staff/${p.id}`)}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>

      <StaffFormDialog
        open={open}
        onClose={() => { setOpen(false); setDuplicatePopup(false); }}
        onSave={handleCreate}
        defaultFacilityId={facility?.id ?? ""}
        defaultUnitId={undefined}
        duplicateError={duplicatePopup}
      />

      {/* Confirmation dialog — shown when adminAccess is toggled on */}
      <Dialog open={!!pendingAdminCreate} onClose={() => setPendingAdminCreate(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Admin Access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a login account for <strong>{pendingAdminCreate?.email}</strong> with{" "}
            <strong>Facility Admin</strong> access. They will receive a temporary password.
            <br /><br />
            Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAdminCreate(null)}>Cancel</Button>
          <Button onClick={handleConfirmAdmin} variant="contained" color="warning">
            Yes, Create Admin Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Login account created — show credentials to admin */}
      <Dialog open={!!newLoginInfo} onClose={() => setNewLoginInfo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Login Account Created</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            A login account was created for this staff member. Share these temporary credentials with them:
          </Typography>
          <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 2 }}>
            <Typography variant="body2"><strong>Email:</strong> {newLoginInfo?.email}</Typography>
            <Typography variant="body2"><strong>Temp Password:</strong> {newLoginInfo?.password}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            They can now be assigned as a Facility Admin from the Facilities page.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewLoginInfo(null)} variant="contained">Got it</Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
