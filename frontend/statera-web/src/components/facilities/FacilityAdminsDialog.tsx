import { useState, useEffect } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import {
  useFacilityAdmins,
  useAvailableUsers,
  useAssignFacilityAdmin,
  useRemoveFacilityAdmin,
  type AvailableUser,
} from "../../api/facilityAdmins";
import { listStaff, grantAdminAccess, type StaffDto } from "../../api/staff";
import { useAuth } from "../../auth/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface FacilityAdminsDialogProps {
  open: boolean;
  facilityId: string;
  facilityName: string;
  onClose: () => void;
}

export default function FacilityAdminsDialog({
  open,
  facilityId,
  facilityName,
  onClose,
}: FacilityAdminsDialogProps) {
  const { user } = useAuth();
  const isOwner = user?.systemRole === "Owner";
  const qc = useQueryClient();

  // Assign existing user state
  const [selectedUser, setSelectedUser] = useState<AvailableUser | null>(null);

  // Remove admin confirmation state
  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<{ userId: string; email: string } | null>(null);

  // Grant admin from staff state
  const [staffList, setStaffList] = useState<StaffDto[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantResult, setGrantResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  const { data: admins = [], isLoading: loadingAdmins } =
    useFacilityAdmins(open ? facilityId : undefined);
  const { data: availableUsers = [] } = useAvailableUsers(
    open ? facilityId : undefined
  );
  const assignMut = useAssignFacilityAdmin(facilityId);
  const removeMut = useRemoveFacilityAdmin(facilityId);

  // Load facility staff whenever the dialog opens
  useEffect(() => {
    if (!open || !facilityId) return;
    setGrantResult(null);
    setGrantError(null);
    setSelectedStaff(null);
    listStaff(facilityId).then(setStaffList).catch(() => setStaffList([]));
  }, [open, facilityId]);

  // Staff eligible for admin grant: have an email and are not already in the admins list
  const adminEmails = new Set(admins.map((a) => a.email.toLowerCase()));
  const eligibleStaff = staffList.filter(
    (s) => (s as any).email && !adminEmails.has(((s as any).email as string).toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedUser) return;
    try {
      await assignMut.mutateAsync(selectedUser.id);
      setSelectedUser(null);
    } catch {
      // error handled by mutation
    }
  };

  const handleGrantAdmin = async () => {
    if (!selectedStaff) return;
    setConfirmOpen(false);
    setGrantLoading(true);
    setGrantError(null);
    try {
      const result = await grantAdminAccess(selectedStaff.id);
      setGrantResult(result);
      setSelectedStaff(null);
      // Refresh admins and available users lists
      qc.invalidateQueries({ queryKey: ["facilityAdmins", facilityId] });
      qc.invalidateQueries({ queryKey: ["availableUsers", facilityId] });
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Failed to grant admin access.";
      setGrantError(msg);
    } finally {
      setGrantLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Admins — {facilityName}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>
            Current Admins
          </Typography>

          {loadingAdmins ? (
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          ) : (
            <List dense disablePadding>
              {admins.length === 0 && (
                <ListItem disablePadding>
                  <ListItemText secondary="No admins assigned to this facility yet." />
                </ListItem>
              )}
              {admins.map((a) => (
                <ListItem
                  key={a.userId}
                  disablePadding
                  secondaryAction={
                    isOwner ? (
                      <IconButton
                        edge="end"
                        aria-label="remove admin"
                        onClick={() => setRemoveConfirmTarget({ userId: a.userId, email: a.email })}
                        color="error"
                        disabled={removeMut.isPending}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : null
                  }
                >
                  <ListItemText
                    primary={a.email}
                    secondary={a.facilityRole}
                    sx={{ py: 0.5 }}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Section 1: Assign existing system user */}
          <Typography variant="subtitle2" gutterBottom>
            Assign Existing User
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={availableUsers}
              getOptionLabel={(u) => u.email ?? u.userName ?? u.id}
              renderOption={(props, u) => (
                <li {...props} key={u.id}>
                  <Box>
                    <Typography variant="body2">{u.email ?? u.userName}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.systemRole}</Typography>
                  </Box>
                </li>
              )}
              value={selectedUser}
              onChange={(_, val) => setSelectedUser(val)}
              renderInput={(params) => (
                <TextField {...params} label="Select user" size="small" />
              )}
            />
            <Button
              startIcon={<PersonAddIcon />}
              variant="contained"
              onClick={handleAssign}
              disabled={!selectedUser || assignMut.isPending}
              sx={{ whiteSpace: "nowrap" }}
            >
              Assign
            </Button>
          </Box>
          {assignMut.isError && (
            <Typography variant="caption" color="error" sx={{ mt: 1 }}>
              Failed to assign admin. They may already be assigned.
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Section 2: Grant admin access to a staff member */}
          <Typography variant="subtitle2" gutterBottom>
            Create Admin from Staff Directory
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Creates a login account for a staff member and assigns them as Facility Admin.
          </Typography>

          {grantResult ? (
            <Alert severity="success">
              <Typography variant="body2" fontWeight={600}>Login account created!</Typography>
              <Typography variant="body2"><strong>Email:</strong> {grantResult.email}</Typography>
              <Typography variant="body2"><strong>Temp Password:</strong> {grantResult.tempPassword}</Typography>
            </Alert>
          ) : (
            <>
              {grantError && (
                <Alert severity="error" sx={{ mb: 1 }}>{grantError}</Alert>
              )}
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={eligibleStaff}
                  getOptionLabel={(s) => `${s.firstName} ${s.lastName}` + ((s as any).email ? ` — ${(s as any).email}` : "")}
                  noOptionsText={staffList.length === 0 ? "No staff found" : "All staff already have admin access"}
                  renderOption={(props, s) => (
                    <li {...props} key={s.id}>
                      <Box>
                        <Typography variant="body2">{s.firstName} {s.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{(s as any).email ?? "No email"}</Typography>
                      </Box>
                    </li>
                  )}
                  value={selectedStaff}
                  onChange={(_, val) => setSelectedStaff(val)}
                  renderInput={(params) => (
                    <TextField {...params} label="Select staff member" size="small" />
                  )}
                />
                <Button
                  startIcon={<AdminPanelSettingsIcon />}
                  variant="contained"
                  color="secondary"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!selectedStaff || grantLoading}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {grantLoading ? "Granting…" : "Grant & Assign"}
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Remove admin confirmation */}
      <Dialog open={!!removeConfirmTarget} onClose={() => setRemoveConfirmTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Admin Access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will remove <strong>{removeConfirmTarget?.email}</strong> as a Facility Admin for{" "}
            <strong>{facilityName}</strong>. They will no longer be able to manage this facility.
            <br /><br />
            Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveConfirmTarget(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (removeConfirmTarget) removeMut.mutate(removeConfirmTarget.userId);
              setRemoveConfirmTarget(null);
            }}
            variant="contained"
            color="error"
          >
            Yes, Remove Access
          </Button>
        </DialogActions>
      </Dialog>

      {/* Grant admin confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Admin Access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a login account for{" "}
            <strong>{selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName}` : ""}</strong>{" "}
            with <strong>Facility Admin</strong> access and assign them to <strong>{facilityName}</strong>.
            <br /><br />
            Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleGrantAdmin} variant="contained" color="warning">
            Yes, Grant Admin Access
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
