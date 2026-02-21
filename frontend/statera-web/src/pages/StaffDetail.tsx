import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Page from "./_Page";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { getStaffById, updateStaff, deleteStaff, type FullStaffDto } from "../api/staff";
import StaffEditDialog, { StaffEditFormValues } from "../components/staff/StaffEditDialog";

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullStaffDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const reload = async () => {
    if (!id) return;
    const res = await getStaffById(id);
    setData(res);
  };

  useEffect(() => {
    let alive = true;
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await getStaffById(id);
        if (!alive) return;
        setData(res);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load staff.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const handleSave = async (vals: StaffEditFormValues) => {
    if (!id) return;
    try {
      setDuplicateError(false);
      const updated = await updateStaff(id, {
        firstName: vals.firstName,
        lastName: vals.lastName,
        email: vals.email || null,
        unitId: vals.unitId || null,
        role: vals.role,
        employmentType: vals.employmentType,
        active: vals.active,
      });
      // Reload to get fresh hasAdminAccount
      await reload();
      setEditOpen(false);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setDuplicateError(true);
      } else {
        setErr(e?.message || "Failed to update staff.");
        setEditOpen(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await deleteStaff(id);
      nav("/staff");
    } catch (e: any) {
      setErr(e?.message || "Failed to delete staff.");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const name = data
    ? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || `(Unnamed #${id})`
    : "";

  return (
    <Page title={loading ? "Staff" : name}>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Card>
        <CardContent>
          {loading ? (
            <Stack spacing={1}>
              <Skeleton width={220} height={32} />
              <Skeleton width={160} />
              <Skeleton width={160} />
              <Skeleton width={240} />
            </Stack>
          ) : data ? (
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="h5" fontWeight={700}>
                  {name}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    startIcon={<EditIcon />}
                    variant="contained"
                    size="small"
                    onClick={() => { setDuplicateError(false); setEditOpen(true); }}
                  >
                    Edit
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Delete
                  </Button>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {data.role && <Chip label={data.role} />}
                {data.employmentType && <Chip label={data.employmentType} variant="outlined" />}
                <Chip
                  label={data.active ? "Active" : "Inactive"}
                  color={data.active ? "success" : "default"}
                />
                {data.hasAdminAccount && (
                  <Chip
                    icon={<AdminPanelSettingsIcon />}
                    label="Facility Admin"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Stack>

              <Divider sx={{ my: 2 }} />

              {data.email && (
                <Typography>
                  <strong>Email:</strong> {data.email}
                </Typography>
              )}
              {data.unitId && (
                <Typography>
                  <strong>Unit ID:</strong> {data.unitId}
                </Typography>
              )}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      {data && (
        <StaffEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
          onAdminAccessChanged={reload}
          staff={data}
          duplicateError={duplicateError}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Staff Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove <strong>{name}</strong> from the staff directory.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error" disabled={deleteLoading}>
            {deleteLoading ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
