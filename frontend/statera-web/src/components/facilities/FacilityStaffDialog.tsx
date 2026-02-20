import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Divider,
} from "@mui/material";
import { useFacility } from "../../context/facility";
import { listStaff, createStaff, CreateStaffPayload, StaffDto } from "../../api/staff";
import StaffFormDialog, { StaffFormValues } from "../staff/StaffFormDialog";

export default function FacilityStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { facilities, selected, setSelectedId } = useFacility();
  const [staff, setStaff] = React.useState<StaffDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [openCreate, setOpenCreate] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!selected) {
        setStaff([]);
        return;
      }
      try {
        setLoading(true);
        const s = await listStaff(selected.id);
        if (!alive) return;
        setStaff(s);
      } catch (e) {
        setStaff([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  // compact list view (Name, role, active)

  const handleCreate = async (vals: StaffFormValues) => {
    if (!selected) return;
    let unitId: string | null = null;
    if (vals.unitId && vals.unitId !== "") {
      unitId = vals.unitId;
      // Optionally validate Guid format here
    }
    const payload: CreateStaffPayload = {
      firstName: vals.firstName,
      lastName: vals.lastName,
      email: vals.email ?? null,
      facilityId: selected.id,
      unitId,
      role: vals.role,
      employmentType: vals.employmentType,
      active: vals.active,
    };
    await createStaff(payload);
    // refresh list
    const s = await listStaff(selected.id);
    setStaff(s);
    setOpenCreate(false);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Facility Staff</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField select label="Facility" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
              {facilities.map(f => (
                <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
              ))}
            </TextField>

            <Box>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={200}><CircularProgress /></Box>
              ) : (
                <List sx={{ maxHeight: 360, overflow: 'auto' }}>
                  {staff.map(s => (
                    <React.Fragment key={s.id}>
                      <ListItem>
                        <Avatar sx={{ mr: 2 }}>{(s.firstName?.[0] ?? "?") + (s.lastName?.[0] ?? "")}</Avatar>
                        <ListItemText primary={s.displayName ?? `${s.firstName} ${s.lastName}`} secondary={`${s.roles?.[0]?.name ?? ""} ${s.active ? "• Active" : "• Inactive"}`} />
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={() => setOpenCreate(true)} disabled={!selected}>New Staff</Button>
        </DialogActions>
      </Dialog>

      <StaffFormDialog open={openCreate} onClose={() => setOpenCreate(false)} onSave={handleCreate} defaultFacilityId={selected?.id ?? ""} defaultUnitId={undefined} />
    </>
  );
}
