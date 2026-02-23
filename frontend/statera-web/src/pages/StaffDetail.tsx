import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Page from "./_Page";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import {
  getStaffById, updateStaff, deleteStaff,
  getStaffAvailability, updateStaffAvailability,
  createPortalAccount, resetPortalPassword,
  type FullStaffDto, type AvailabilityDto, type PortalAccountResult,
} from "../api/staff";
import StaffEditDialog, { StaffEditFormValues } from "../components/staff/StaffEditDialog";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const [tab, setTab] = useState(0);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalResult, setPortalResult] = useState<PortalAccountResult | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwBusy, setResetPwBusy] = useState(false);
  const [resetPwResult, setResetPwResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [resetPwError, setResetPwError] = useState<string | null>(null);

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

  const handleCreatePortalAccount = async () => {
    if (!id) return;
    setPortalBusy(true); setPortalError(null);
    try {
      const result = await createPortalAccount(id);
      setPortalResult(result);
      await reload();
    } catch (e: any) {
      setPortalError(e?.response?.data?.error ?? "Failed to create portal account.");
    } finally {
      setPortalBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!id) return;
    setResetPwBusy(true); setResetPwError(null);
    try {
      const result = await resetPortalPassword(id);
      setResetPwResult(result);
    } catch (e: any) {
      setResetPwError(e?.response?.data?.error ?? "Failed to reset password.");
    } finally {
      setResetPwBusy(false);
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
                  {data.email && !data.hasPortalAccount && !data.hasAdminAccount && (
                    <Button
                      startIcon={<PersonAddIcon />}
                      variant="outlined"
                      size="small"
                      onClick={() => { setPortalResult(null); setPortalError(null); setPortalDialogOpen(true); }}
                    >
                      Portal Account
                    </Button>
                  )}
                  {data.hasPortalAccount && (
                    <Button
                      startIcon={<AccountCircleIcon />}
                      variant="outlined"
                      size="small"
                      onClick={() => { setResetPwResult(null); setResetPwError(null); setResetPwOpen(true); }}
                    >
                      Reset Password
                    </Button>
                  )}
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
                {data.hasPortalAccount && (
                  <Chip
                    icon={<AccountCircleIcon />}
                    label="Portal Account"
                    color="success"
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

      {/* Tabs below the profile card */}
      {data && (
        <Box sx={{ mt: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
            <Tab label="Availability" />
          </Tabs>
          {tab === 0 && <AvailabilityPanel staffId={data.id} />}
        </Box>
      )}

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

      {/* Portal account creation */}
      <Dialog open={portalDialogOpen} onClose={() => setPortalDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Portal Account</DialogTitle>
        <DialogContent>
          {portalResult ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Alert severity="success">Portal account created successfully.</Alert>
              <Typography variant="body2"><strong>Email:</strong> {portalResult.email}</Typography>
              <Typography variant="body2"><strong>Temp Password:</strong> {portalResult.tempPassword}</Typography>
              <Typography variant="caption" color="text.secondary">
                Share these credentials with the staff member. They can use the Staff Portal at <em>/portal</em>.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <DialogContentText>
                Create a staff portal account for <strong>{name}</strong>. They will be able to view their
                schedule, manage time off, clock in/out, and chat at <em>/portal</em>.
              </DialogContentText>
              {portalError && <Alert severity="error">{portalError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPortalDialogOpen(false)}>
            {portalResult ? "Close" : "Cancel"}
          </Button>
          {!portalResult && (
            <Button variant="contained" onClick={handleCreatePortalAccount} disabled={portalBusy} startIcon={portalBusy ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}>
              Create Account
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reset portal password */}
      <Dialog open={resetPwOpen} onClose={() => setResetPwOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Portal Password</DialogTitle>
        <DialogContent>
          {resetPwResult ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Alert severity="success">Password reset successfully.</Alert>
              <Typography variant="body2"><strong>Email:</strong> {resetPwResult.email}</Typography>
              <Typography variant="body2"><strong>New Temp Password:</strong> {resetPwResult.tempPassword}</Typography>
              <Typography variant="caption" color="text.secondary">
                Share these credentials with the staff member so they can log in at <em>/portal</em>.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <DialogContentText>
                Reset the portal login password for <strong>{name}</strong>. A new temporary password will be generated.
              </DialogContentText>
              {resetPwError && <Alert severity="error">{resetPwError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPwOpen(false)}>
            {resetPwResult ? "Close" : "Cancel"}
          </Button>
          {!resetPwResult && (
            <Button variant="contained" onClick={handleResetPassword} disabled={resetPwBusy}
              startIcon={resetPwBusy ? <CircularProgress size={16} color="inherit" /> : <AccountCircleIcon />}
            >
              Reset Password
            </Button>
          )}
        </DialogActions>
      </Dialog>

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

// ─── Availability Panel ───────────────────────────────────────────────────────

interface AvailEntry { dayOfWeek: number; startLocal: string; endLocal: string }

function AvailabilityPanel({ staffId }: { staffId: string }) {
  const [entries, setEntries] = useState<AvailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getStaffAvailability(staffId);
      setEntries(data.map(d => ({ dayOfWeek: d.dayOfWeek, startLocal: d.startLocal, endLocal: d.endLocal })));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load availability.");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  function addEntry() {
    setEntries(prev => [...prev, { dayOfWeek: 1, startLocal: "07:00", endLocal: "15:00" }]);
  }

  function removeEntry(idx: number) {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  }

  function updateEntry(idx: number, field: keyof AvailEntry, value: string | number) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(false);
    try {
      await updateStaffAvailability(staffId, entries);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set the days and hours this staff member is available to work. These are used by the scheduler.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Availability saved.</Alert>}

      <Stack spacing={1.5}>
        {entries.map((e, idx) => (
          <Stack key={idx} direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Day</InputLabel>
              <Select
                label="Day"
                value={e.dayOfWeek}
                onChange={ev => updateEntry(idx, "dayOfWeek", Number(ev.target.value))}
              >
                {DAY_NAMES.map((d, i) => <MenuItem key={i} value={i}>{d}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              size="small" label="Start" type="time" value={e.startLocal}
              onChange={ev => updateEntry(idx, "startLocal", ev.target.value)}
              InputLabelProps={{ shrink: true }} sx={{ width: 120 }}
            />
            <TextField
              size="small" label="End" type="time" value={e.endLocal}
              onChange={ev => updateEntry(idx, "endLocal", ev.target.value)}
              InputLabelProps={{ shrink: true }} sx={{ width: 120 }}
            />
            <IconButton size="small" color="error" onClick={() => removeEntry(idx)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={addEntry}>Add Availability</Button>
        <Button
          size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={handleSave} disabled={saving}
        >
          Save
        </Button>
      </Stack>
    </Box>
  );
}
