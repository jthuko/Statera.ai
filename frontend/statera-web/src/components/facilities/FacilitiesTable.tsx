import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  Table,
  Typography,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PeopleIcon from "@mui/icons-material/People";
import type { Facility } from "../../api/facilities";
import {
  useFacilities,
  useCreateFacility,
  useUpdateFacility,
  useDeleteFacility,
} from "../../api/facilities";
import FacilityFormDialog, { FacilityFormValues } from "./FacilityFormDialog";
import FacilityAdminsDialog from "./FacilityAdminsDialog";
import { useAuth } from "../../auth/useAuth";

export default function FacilitiesTable() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [managingAdminsFor, setManagingAdminsFor] = useState<Facility | null>(null);

  const { user } = useAuth();
  const isOwner = user?.systemRole === "Owner";
  const navigate = useNavigate();

  const { data, isLoading, error } = useFacilities(query);
  const items: Facility[] = data ?? []; // hook normalizes to Facility[]

  const createMut = useCreateFacility();
  const updateMut = useUpdateFacility();
  const deleteMut = useDeleteFacility();

  const handleCreate = async (values: FacilityFormValues) => {
    try {
      await createMut.mutateAsync(values); // { name, city, state }
      setDialogOpen(false);
    } catch (e) {
      console.error("Create facility failed:", e);
      alert("Create failed. Check required fields and API route.");
    }
  };

  const handleUpdate = async (values: FacilityFormValues) => {
    if (!editing) return;
    try {
      await updateMut.mutateAsync({ ...editing, ...values });
      setEditing(null);
    } catch (e) {
      console.error("Update facility failed:", e);
      alert("Update failed.");
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          gap={2}
        >
          <Typography variant="h5">Facilities</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems="center">
            <TextField
              size="small"
              placeholder="Search facilities"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            {isOwner && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
              >
                New Facility
              </Button>
            )}
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {(error as any)?.message ?? "Failed to load facilities"}
          </Typography>
        )}

        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>City</TableCell>
                <TableCell>State</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4}>Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>No facilities found</TableCell>
                </TableRow>
              )}
              {items.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => navigate(`/facilities/${f.id}`)}
                      underline="hover"
                      sx={{ color: "primary.light", fontWeight: 500 }}
                    >
                      {f.name}
                    </Link>
                  </TableCell>
                  <TableCell>{f.city}</TableCell>
                  <TableCell>{f.state}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Manage Admins">
                      <IconButton
                        aria-label="manage admins"
                        onClick={() => setManagingAdminsFor(f)}
                      >
                        <PeopleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton aria-label="edit" onClick={() => setEditing(f)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    {isOwner && (
                      <Tooltip title="Delete">
                        <IconButton
                          aria-label="delete"
                          onClick={() => deleteMut.mutate(f.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>

      {/* Create */}
      <FacilityFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        initial={null}
      />

      {/* Edit */}
      <FacilityFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        initial={editing}
      />

      {/* Manage Admins */}
      {managingAdminsFor && (
        <FacilityAdminsDialog
          open={!!managingAdminsFor}
          facilityId={managingAdminsFor.id}
          facilityName={managingAdminsFor.name}
          onClose={() => setManagingAdminsFor(null)}
        />
      )}
    </Card>
  );
}
