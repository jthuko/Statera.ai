import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Facility } from "../../api/facilities";

const Schema = z.object({
  name: z.string().min(2, "Name is required"),
  address: z.string().min(2, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required").max(2, "State must be 2 letters"),
  zip: z.string().min(2, "Zip is required"),
});

export type FacilityFormValues = z.infer<typeof Schema>;

export default function FacilityFormDialog({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: FacilityFormValues) => void | Promise<void>;
  initial?: Partial<Facility> | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FacilityFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", address: "", city: "", state: "", zip: "" },
  });

  useEffect(() => {
    if (initial) {
      reset({
        name: initial.name ?? "",
        address: (initial as any).address ?? "",
        city: initial.city ?? "",
        state: initial.state ?? "",
        zip: (initial as any).zip ?? "",
      });
    } else {
      reset({ name: "", address: "", city: "", state: "", zip: "" });
    }
  }, [initial, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial?.id ? "Edit facility" : "New facility"}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name"
              autoFocus
              {...register("name")}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
            <TextField
              label="Address"
              {...register("address")}
              error={!!errors.address}
              helperText={errors.address?.message}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="City" fullWidth {...register("city")} error={!!errors.city} helperText={errors.city?.message} />
              <TextField
                label="State"
                fullWidth
                inputProps={{ maxLength: 2 }}
                {...register("state")}
                error={!!errors.state}
                helperText={errors.state?.message}
              />
              <TextField label="Zip" fullWidth {...register("zip")} error={!!errors.zip} helperText={errors.zip?.message} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {initial?.id ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
