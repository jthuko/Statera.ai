import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BlockIcon from "@mui/icons-material/Block";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { listUnits, UnitDto } from "../../api/units";
import { grantAdminAccess, revokeAdminAccess, type FullStaffDto } from "../../api/staff";

const Schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email().optional().or(z.literal("")),
  unitId: z.string().optional(),
  role: z.string().min(1, "Role required"),
  employmentType: z.enum(["FullTime", "PartTime", "PerDiem", "Contract"]),
  active: z.boolean(),
});

export type StaffEditFormValues = z.infer<typeof Schema>;

interface StaffEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: StaffEditFormValues) => Promise<void>;
  onAdminAccessChanged?: () => void;
  staff: FullStaffDto;
  duplicateError?: boolean;
}

export default function StaffEditDialog({ open, onClose, onSave, onAdminAccessChanged, staff, duplicateError }: StaffEditDialogProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<StaffEditFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      firstName: staff.firstName ?? "",
      lastName: staff.lastName ?? "",
      email: staff.email ?? "",
      unitId: staff.unitId ?? "",
      role: staff.role ?? "CNA",
      employmentType: (staff.employmentType as any) ?? "FullTime",
      active: staff.active ?? true,
    },
  });
  const [units, setUnits] = React.useState<UnitDto[]>([]);

  // Admin access state
  const [adminConfirmAction, setAdminConfirmAction] = React.useState<"grant" | "revoke" | null>(null);
  const [adminLoading, setAdminLoading] = React.useState(false);
  const [grantResult, setGrantResult] = React.useState<{ email: string; tempPassword: string } | null>(null);
  const [adminError, setAdminError] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(staff.hasAdminAccount ?? false);

  React.useEffect(() => {
    if (staff.facilityId) {
      listUnits(staff.facilityId).then(setUnits).catch(() => setUnits([]));
    }
  }, [staff.facilityId]);

  React.useEffect(() => {
    if (open) {
      reset({
        firstName: staff.firstName ?? "",
        lastName: staff.lastName ?? "",
        email: staff.email ?? "",
        unitId: staff.unitId ?? "",
        role: staff.role ?? "CNA",
        employmentType: (staff.employmentType as any) ?? "FullTime",
        active: staff.active ?? true,
      });
      setIsAdmin(staff.hasAdminAccount ?? false);
      setAdminError(null);
      setGrantResult(null);
    }
  }, [open, staff, reset]);

  const handleAdminConfirm = async () => {
    setAdminConfirmAction(null);
    setAdminLoading(true);
    setAdminError(null);
    try {
      if (adminConfirmAction === "grant") {
        const result = await grantAdminAccess(staff.id);
        setGrantResult(result);
        setIsAdmin(true);
      } else {
        await revokeAdminAccess(staff.id);
        setIsAdmin(false);
        setGrantResult(null);
      }
      onAdminAccessChanged?.();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Action failed.";
      setAdminError(msg);
    } finally {
      setAdminLoading(false);
    }
  };

  const hasEmail = !!staff.email;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Edit Staff</DialogTitle>
        <form onSubmit={handleSubmit(onSave)}>
          <DialogContent>
            {duplicateError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                A staff member with that email already exists.
              </Alert>
            )}
            <Stack spacing={2} mt={1}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="First name" fullWidth {...register("firstName")} error={!!errors.firstName} helperText={errors.firstName?.message} />
                <TextField label="Last name" fullWidth {...register("lastName")} error={!!errors.lastName} helperText={errors.lastName?.message} />
              </Stack>
              <TextField label="Email" fullWidth {...register("email")} error={!!errors.email} helperText={errors.email?.message} />
              <TextField select label="Role" fullWidth {...register("role")} error={!!errors.role} helperText={errors.role?.message} defaultValue={staff.role ?? "CNA"}>
                <MenuItem value="RN">RN</MenuItem>
                <MenuItem value="LPN">LPN</MenuItem>
                <MenuItem value="CNA">CNA</MenuItem>
                <MenuItem value="Manager">Manager</MenuItem>
                <MenuItem value="Cook">Cook</MenuItem>
                <MenuItem value="Receptionist">Receptionist</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
              <TextField select label="Employment Type" fullWidth {...register("employmentType")} error={!!errors.employmentType} helperText={errors.employmentType?.message} defaultValue={staff.employmentType ?? "FullTime"}>
                <MenuItem value="FullTime">Full Time</MenuItem>
                <MenuItem value="PartTime">Part Time</MenuItem>
                <MenuItem value="PerDiem">Per Diem</MenuItem>
                <MenuItem value="Contract">Contract</MenuItem>
              </TextField>
              <TextField select label="Unit (optional)" fullWidth {...register("unitId")} defaultValue={staff.unitId ?? ""}>
                <MenuItem value="">None</MenuItem>
                {units.map(u => (
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Switch defaultChecked={staff.active ?? true} {...register("active") as any} />}
                label="Active"
              />

              <Divider />

              {/* Admin Access Section */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Facility Admin Access</Typography>

                {adminError && <Alert severity="error" sx={{ mb: 1 }}>{adminError}</Alert>}

                {grantResult && (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Login account created!</Typography>
                    <Typography variant="body2"><strong>Email:</strong> {grantResult.email}</Typography>
                    <Typography variant="body2"><strong>Temp Password:</strong> {grantResult.tempPassword}</Typography>
                  </Alert>
                )}

                {isAdmin ? (
                  <Button
                    startIcon={<BlockIcon />}
                    variant="contained"
                    color="error"
                    disabled={adminLoading}
                    onClick={() => setAdminConfirmAction("revoke")}
                  >
                    {adminLoading ? "Revoking…" : "Revoke Admin Access"}
                  </Button>
                ) : (
                  <Tooltip title={!hasEmail ? "Save an email address first before granting admin access" : ""} placement="top-start">
                    <span>
                      <Button
                        startIcon={<AdminPanelSettingsIcon />}
                        variant="contained"
                        color="secondary"
                        disabled={!hasEmail || adminLoading}
                        onClick={() => setAdminConfirmAction("grant")}
                        sx={{ opacity: hasEmail ? 1 : 0.5 }}
                      >
                        {adminLoading ? "Granting…" : "Grant Admin Access"}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {!hasEmail && !isAdmin && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    An email address is required to grant admin access.
                  </Typography>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Grant confirmation */}
      <Dialog open={adminConfirmAction === "grant"} onClose={() => setAdminConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Admin Access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a login account for <strong>{staff.email}</strong> with{" "}
            <strong>Facility Admin</strong> access and assign them to this facility.
            <br /><br />
            Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminConfirmAction(null)}>Cancel</Button>
          <Button onClick={handleAdminConfirm} variant="contained" color="warning">
            Yes, Grant Admin Access
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={adminConfirmAction === "revoke"} onClose={() => setAdminConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Revoke Admin Access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will remove Facility Admin access for <strong>{staff.email}</strong>.
            They will no longer be able to manage this facility. Their login account will remain.
            <br /><br />
            Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminConfirmAction(null)}>Cancel</Button>
          <Button onClick={handleAdminConfirm} variant="contained" color="error">
            Yes, Revoke Access
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
