import * as React from "react";
import {
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
  email: z.string().email().optional(),
  unitId: z.string().optional(),
  role: z.string().min(1, "Role required"),
  employmentType: z.enum(["FullTime", "PartTime", "PerDiem", "Contract"]),
  active: z.boolean(),
});

export type StaffFormValues = z.infer<typeof Schema>;

export default function StaffFormDialog(props: {
  open: boolean;
  onClose: () => void;
  onSave: (values: StaffFormValues) => Promise<void> | void;
  defaultFacilityId: string;
  defaultUnitId?: string | null;
}) {
  const { open, onClose, onSave, defaultFacilityId, defaultUnitId } = props;
  // All hooks must be at the top level
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<StaffFormValues & { roleOther?: string }>({
    resolver: zodResolver(Schema),
    defaultValues: { firstName: "", lastName: "", email: "", unitId: "", role: "CNA", roleOther: "", employmentType: "FullTime", active: true }
  });
  const { selected: facility } = useFacility();
  const [units, setUnits] = React.useState<UnitDto[]>([]);

  React.useEffect(() => {
    if (facility?.id) {
      listUnits(facility.id).then(setUnits).catch(() => setUnits([]));
    } else {
      setUnits([]);
    }
  }, [facility]);

  React.useEffect(() => {
    if (open) {
      reset({ firstName: "", lastName: "", email: "", unitId: defaultUnitId ?? "", role: "CNA", roleOther: "", employmentType: "FullTime", active: true });
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
            {watch('role') === 'Other' && (
              <TextField label="Other role" fullWidth {...register('roleOther')} />
            )}
            <TextField select label="Employment" fullWidth defaultValue={"FullTime"} {...register('employmentType') }>
              <MenuItem value="FullTime">FullTime</MenuItem>
              <MenuItem value="PartTime">PartTime</MenuItem>
              <MenuItem value="PerDiem">PerDiem</MenuItem>
              <MenuItem value="Contract">Contract</MenuItem>
            </TextField>
            <TextField select label="Unit (optional)" fullWidth {...register('unitId')}>
              <MenuItem value="">None</MenuItem>
              {units.map(u => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
            <FormControlLabel control={<Switch defaultChecked {...register('active') as any} />} label="Active" />
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
