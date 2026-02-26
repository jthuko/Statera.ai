import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Page from "./_Page";
import {
  Alert,
  Avatar,
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
  Paper,
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
import EmailIcon from "@mui/icons-material/Email";
import BusinessIcon from "@mui/icons-material/Business";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import {
  getStaffById, updateStaff, deleteStaff,
  getStaffAvailability, updateStaffAvailability,
  createPortalAccount, resetPortalPassword,
  type FullStaffDto, type AvailabilityDto, type PortalAccountResult,
} from "../api/staff";
import StaffEditDialog, { StaffEditFormValues } from "../components/staff/StaffEditDialog";
import { useAuth } from "../auth/useAuth";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ROLE_COLORS: Record<string, string> = {
  RN: "#1565c0",
  LPN: "#6a1b9a",
  CNA: "#2e7d32",
  Manager: "#e65100",
  Cook: "#b71c1c",
  Receptionist: "#01579b",
  Other: "#546e7a",
};

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? "#546e7a";
}

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
  const [impersonateBusy, setImpersonateBusy] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const { user, impersonate } = useAuth();

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
      await updateStaff(id, {
        firstName: vals.firstName,
        lastName: vals.lastName,
        email: vals.email || null,
        unitId: vals.unitId || null,
        role: vals.role,
        employmentType: vals.employmentType,
        active: vals.active,
      });
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

  const handleImpersonate = async () => {
    if (!id) return;
    setImpersonateBusy(true);
    setImpersonateError(null);
    try {
      await impersonate(id);
      nav("/portal");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error ?? e?.message;
      setImpersonateError(detail ? `Failed to impersonate staff. ${detail}` : (status ? `Failed to impersonate staff (HTTP ${status}).` : "Failed to impersonate staff."));
    } finally {
      setImpersonateBusy(false);
    }
  };

  const name = data
    ? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || `(Unnamed #${id})`
    : "";

  const roleColor = data?.role ? getRoleColor(data.role) : "#546e7a";

  return (
    <Page title={loading ? "Staff" : name}>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {impersonateError && <Alert severity="error" sx={{ mb: 2 }}>{impersonateError}</Alert>}

      {/* Profile Card */}
      <Card sx={{ mb: 3, overflow: "hidden" }}>
        {/* Gradient banner */}
        <Box
          sx={{
            height: 96,
            background: loading
              ? "linear-gradient(135deg, #78909c 0%, #b0bec5 100%)"
              : `linear-gradient(135deg, ${roleColor} 0%, ${roleColor}99 100%)`,
          }}
        />
        <CardContent sx={{ pt: 0 }}>
          {loading ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Skeleton variant="circular" width={72} height={72} sx={{ mt: -4, border: "3px solid white" }} />
              <Skeleton width={220} height={32} />
              <Skeleton width={160} />
              <Skeleton width={200} />
            </Stack>
          ) : data ? (
            <>
              {/* Avatar + Action buttons row */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: -4, mb: 2 }}>
                <Avatar
                  src={data.photoUrl ?? undefined}
                  sx={{
                    width: 72, height: 72, fontSize: 26, fontWeight: 700,
                    bgcolor: roleColor,
                    border: "3px solid white",
                    boxShadow: 3,
                  }}
                >
                  {getInitials(name)}
                </Avatar>
                <Stack direction="row" spacing={1} sx={{ pb: 0.5 }}>
                  {user?.systemRole !== "Staff" && (
                    <Button
                      startIcon={<SwitchAccountIcon />}
                      variant="outlined"
                      size="small"
                      disabled={impersonateBusy}
                      onClick={handleImpersonate}
                    >
                      Impersonate
                    </Button>
                  )}
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

              {/* Name */}
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                {name}
              </Typography>

              {/* Status chips */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                {data.role && (
                  <Chip
                    label={data.role}
                    size="small"
                    sx={{ bgcolor: roleColor, color: "#fff", fontWeight: 600 }}
                  />
                )}
                {data.employmentType && (
                  <Chip label={data.employmentType} size="small" variant="outlined" />
                )}
                <Chip
                  label={data.active ? "Active" : "Inactive"}
                  color={data.active ? "success" : "default"}
                  size="small"
                />
                {data.hasAdminAccount && (
                  <Chip
                    icon={<AdminPanelSettingsIcon />}
                    label="Facility Admin"
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
                {data.hasPortalAccount && (
                  <Chip
                    icon={<AccountCircleIcon />}
                    label="Portal Account"
                    color="success"
                    variant="outlined"
                    size="small"
                  />
                )}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {/* Info fields */}
              <Stack spacing={1}>
                {data.email && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <EmailIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    <Typography variant="body2">{data.email}</Typography>
                  </Stack>
                )}
                {data.phone && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" color="text.secondary">Phone:</Typography>
                    <Typography variant="body2">{data.phone}</Typography>
                  </Stack>
                )}
                {(data.address1 || data.city || data.state || data.zip) && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" color="text.secondary">Address:</Typography>
                    <Typography variant="body2">
                      {data.address1}{data.address2 ? `, ${data.address2}` : ""}
                      {data.city ? `, ${data.city}` : ""}
                      {data.state ? `, ${data.state}` : ""}
                      {data.zip ? ` ${data.zip}` : ""}
                    </Typography>
                  </Stack>
                )}
                {data.dateOfBirth && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" color="text.secondary">DOB:</Typography>
                    <Typography variant="body2">{data.dateOfBirth}</Typography>
                  </Stack>
                )}
                {(data.emergencyContactName || data.emergencyContactPhone) && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" color="text.secondary">Emergency:</Typography>
                    <Typography variant="body2">
                      {data.emergencyContactName ?? ""}{data.emergencyContactPhone ? ` (${data.emergencyContactPhone})` : ""}
                    </Typography>
                  </Stack>
                )}
                {data.unitId && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <BusinessIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    <Typography variant="body2" color="text.secondary">Unit: {data.unitId}</Typography>
                  </Stack>
                )}
              </Stack>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Tabs */}
      {data && (
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Availability" icon={<AccessTimeIcon fontSize="small" />} iconPosition="start" />
            </Tabs>
          </Box>
          <CardContent>
            {tab === 0 && <AvailabilityPanel staffId={data.id} />}
          </CardContent>
        </Card>
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

      {/* Portal account dialog */}
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
            <Button
              variant="contained"
              onClick={handleCreatePortalAccount}
              disabled={portalBusy}
              startIcon={portalBusy ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
            >
              Create Account
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reset password dialog */}
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
            <Button
              variant="contained"
              onClick={handleResetPassword}
              disabled={resetPwBusy}
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

const DAY_COLORS = [
  "#e53935", // Sun
  "#1e88e5", // Mon
  "#8e24aa", // Tue
  "#00897b", // Wed
  "#f4511e", // Thu
  "#3949ab", // Fri
  "#43a047", // Sat
];

function formatTime(t: string) {
  if (!t) return t;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

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

  if (loading) return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={1.5}>
        {[...Array(3)].map((_, i) => <Skeleton key={i} height={64} sx={{ borderRadius: 2 }} />)}
      </Stack>
    </Box>
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>Weekly Availability</Typography>
          <Typography variant="body2" color="text.secondary">
            Days and hours this staff member is available to work
          </Typography>
        </Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addEntry} variant="outlined">
          Add Day
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Availability saved successfully.</Alert>}

      {entries.length === 0 ? (
        <Box
          sx={{
            textAlign: "center", py: 5,
            border: "2px dashed", borderColor: "divider",
            borderRadius: 2, color: "text.secondary",
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
          <Typography variant="body1" fontWeight={500}>No availability set</Typography>
          <Typography variant="body2">Click "Add Day" to configure work availability.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {entries.map((e, idx) => {
            const dayColor = DAY_COLORS[e.dayOfWeek] ?? "#546e7a";
            return (
              <Paper
                key={idx}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderLeft: `4px solid ${dayColor}`,
                  overflow: "hidden",
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ px: 2, py: 1.5 }}
                  flexWrap="wrap"
                  gap={1}
                >
                  {/* Day selector */}
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Day</InputLabel>
                    <Select
                      label="Day"
                      value={e.dayOfWeek}
                      onChange={ev => updateEntry(idx, "dayOfWeek", Number(ev.target.value))}
                      sx={{ fontWeight: 600 }}
                    >
                      {DAY_NAMES.map((d, i) => (
                        <MenuItem key={i} value={i}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: DAY_COLORS[i] }} />
                            <span>{d}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Time range */}
                  <Stack direction="row" spacing={1} alignItems="center" flex={1}>
                    <TextField
                      size="small"
                      label="Start"
                      type="time"
                      value={e.startLocal}
                      onChange={ev => updateEntry(idx, "startLocal", ev.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 130 }}
                    />
                    <Typography color="text.secondary" sx={{ px: 0.5, fontWeight: 500 }}>→</Typography>
                    <TextField
                      size="small"
                      label="End"
                      type="time"
                      value={e.endLocal}
                      onChange={ev => updateEntry(idx, "endLocal", ev.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 130 }}
                    />
                  </Stack>

                  {/* Summary label */}
                  <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" }, minWidth: 140 }}>
                    {formatTime(e.startLocal)} – {formatTime(e.endLocal)}
                  </Typography>

                  <IconButton size="small" color="error" onClick={() => removeEntry(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ minWidth: 140 }}
        >
          {saving ? "Saving…" : "Save Availability"}
        </Button>
      </Stack>
    </Box>
  );
}
