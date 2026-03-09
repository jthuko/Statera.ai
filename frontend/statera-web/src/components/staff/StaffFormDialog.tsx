import * as React from "react";
import {
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CreateStaffPayload } from "../../api/staff";
import { useFacility } from "../../context/facility";
import { listUnits, UnitDto } from "../../api/units";

const Schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email().optional().or(z.literal("")),
  unitId: z.string().optional(),
  role: z.string().min(1, "Role required"),
  employmentType: z.enum(["FullTime", "PartTime", "PerDiem", "Contract"]),
  active: z.boolean(),
  adminAccess: z.boolean(),
  licenseNumber: z.string().optional(),
  licenseExpiresOn: z.string().optional(),
  cprExpiresOn: z.string().optional(),
});

export type StaffFormValues = z.infer<typeof Schema>;

export default function StaffFormDialog(props: {
  open: boolean;
  onClose: () => void;
  onSave: (values: StaffFormValues) => Promise<void> | void;
  defaultFacilityId: string;
  defaultUnitId?: string | null;
  duplicateError?: boolean;
}) {
  const { open, onClose, onSave, defaultFacilityId, defaultUnitId, duplicateError } = props;
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<StaffFormValues & { roleOther?: string }>({
    resolver: zodResolver(Schema),
    defaultValues: { firstName: "", lastName: "", email: "", unitId: "", role: "CNA", roleOther: "", employmentType: "FullTime", active: true, adminAccess: false, licenseNumber: "", licenseExpiresOn: "", cprExpiresOn: "" }
  });
  const { selected: facility } = useFacility();
  const [units, setUnits] = React.useState<UnitDto[]>([]);

  const emailValue = watch("email");
  const hasEmail = !!emailValue && emailValue.trim().length > 0;

  React.useEffect(() => {
    if (facility?.id) {
      listUnits(facility.id).then(setUnits).catch(() => setUnits([]));
    } else {
      setUnits([]);
    }
  }, [facility]);

  React.useEffect(() => {
    if (open) {
      reset({ firstName: "", lastName: "", email: "", unitId: defaultUnitId ?? "", role: "CNA", roleOther: "", employmentType: "FullTime", active: true, adminAccess: false, licenseNumber: "", licenseExpiresOn: "", cprExpiresOn: "" });
    }
  }, [open, reset, defaultUnitId]);

  const submit = async (vals: StaffFormValues) => {
    const role = (vals as any).role === "Other" ? ((vals as any).roleOther ?? "Other") : (vals as any).role;
    await onSave({ ...(vals as any), role } as StaffFormValues);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New Staff</DialogTitle>
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent>
          {duplicateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Cannot add staff: a staff member with that email already exists.
            </Alert>
          )}
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First name" fullWidth {...register('firstName')} error={!!errors.firstName} helperText={errors.firstName?.message} />
              <TextField label="Last name" fullWidth {...register('lastName')} error={!!errors.lastName} helperText={errors.lastName?.message} />
            </Stack>
            <TextField label="Email" fullWidth {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
            <TextField select label="Role" fullWidth defaultValue={"CNA"} {...register('role')} error={!!errors.role} helperText={errors.role?.message}>
              <MenuItem value="RN">RN</MenuItem>
              <MenuItem value="LPN">LPN</MenuItem>
              <MenuItem value="CNA">CNA</MenuItem>
              <MenuItem value="Manager">Manager</MenuItem>
              <MenuItem value="Cook">Cook</MenuItem>
              <MenuItem value="Receptionist">Receptionist</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
            <TextField select label="Employment Type" fullWidth defaultValue={"FullTime"} {...register('employmentType')} error={!!errors.employmentType} helperText={errors.employmentType?.message}>
              <MenuItem value="FullTime">Full Time</MenuItem>
              <MenuItem value="PartTime">Part Time</MenuItem>
              <MenuItem value="PerDiem">Per Diem</MenuItem>
              <MenuItem value="Contract">Contract</MenuItem>
            </TextField>
            <TextField select label="Unit (optional)" fullWidth {...register('unitId')}>
              <MenuItem value="">None</MenuItem>
              {units.map(u => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="License Number" fullWidth {...register('licenseNumber')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="License Expiry"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                {...register('licenseExpiresOn')}
              />
              <TextField
                label="CPR Expiry (optional)"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                {...register('cprExpiresOn')}
              />
            </Stack>
            <FormControlLabel control={<Switch defaultChecked {...register('active') as any} />} label="Active" />
            <Tooltip title={!hasEmail ? "An email address is required to enable portal or admin access" : "Email grants staff portal access. Enable this to also grant full admin access."} placement="top-start">
              <span>
                <FormControlLabel
                  control={<Switch {...register('adminAccess') as any} disabled={!hasEmail} />}
                  label="Grant Admin Access (email = portal access)"
                  sx={{ opacity: hasEmail ? 1 : 0.5 }}
                />
              </span>
            </Tooltip>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>Create</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
