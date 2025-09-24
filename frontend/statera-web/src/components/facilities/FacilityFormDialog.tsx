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
  city: z.string().optional(),
  state: z.string().optional(),
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
    defaultValues: { name: "", city: "", state: "" },
  });

  useEffect(() => {
    if (initial) {
      reset({
        name: initial.name ?? "",
        city: initial.city ?? "",
        state: initial.state ?? "",
      });
    } else {
      reset({ name: "", city: "", state: "" });
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
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="City" fullWidth {...register("city")} />
              <TextField
                label="State"
                fullWidth
                inputProps={{ maxLength: 2 }}
                {...register("state")}
              />
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
