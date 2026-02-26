// src/pages/portal/PortalProfile.tsx
// Staff portal: profile + password
import { useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent,
  CircularProgress, Stack, TextField, Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";
import { getMyProfile, updateMyProfile, changePassword, type FullStaffDto } from "../../api/staff";

export default function PortalProfile() {
  const [data, setData] = useState<FullStaffDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getMyProfile();
        if (!active) return;
        setData(res);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Failed to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const updateField = (key: keyof FullStaffDto, value: string) => {
    setData(prev => prev ? ({ ...prev, [key]: value }) : prev);
  };

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      updateField("photoUrl", url);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      await updateMyProfile({
        phone: data.phone ?? null,
        address1: data.address1 ?? null,
        address2: data.address2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        zip: data.zip ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        photoUrl: data.photoUrl ?? null,
      });
      setSuccess("Profile updated.");
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdError(null); setPwdSuccess(null);
    if (!pwdCurrent || !pwdNew) { setPwdError("Enter current and new password."); return; }
    if (pwdNew !== pwdConfirm) { setPwdError("New passwords do not match."); return; }
    setPwdBusy(true);
    try {
      await changePassword(pwdCurrent, pwdNew);
      setPwdSuccess("Password updated.");
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } catch (e: any) {
      setPwdError(e?.response?.data?.error ?? e?.message ?? "Failed to change password.");
    } finally {
      setPwdBusy(false);
    }
  };

  if (loading) return (
    <Box sx={{ pt: 2 }}><CircularProgress size={22} /></Box>
  );

  if (!data) return <Alert severity="error">Profile not available.</Alert>;

  return (
    <Box sx={{ pt: 1 }}>
      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(0,137,123,0.25)" }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Avatar src={data.photoUrl ?? undefined} sx={{ width: 72, height: 72 }} />
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700}>My Profile</Typography>
              <Typography variant="body2" color="text.secondary">{data.firstName} {data.lastName}</Typography>
            </Stack>
            <Button component="label" variant="outlined" size="small" startIcon={<PhotoCameraIcon />}>
              Upload Photo
              <input type="file" hidden accept="image/*" onChange={e => {
                const f = e.target.files?.[0]; if (f) handlePhotoUpload(f);
              }} />
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Demographics</Typography>
          <Stack spacing={1.5}>
            <TextField label="Phone" value={data.phone ?? ""} onChange={e => updateField("phone", e.target.value)} />
            <TextField label="Address 1" value={data.address1 ?? ""} onChange={e => updateField("address1", e.target.value)} />
            <TextField label="Address 2" value={data.address2 ?? ""} onChange={e => updateField("address2", e.target.value)} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField label="City" value={data.city ?? ""} onChange={e => updateField("city", e.target.value)} fullWidth />
              <TextField label="State" value={data.state ?? ""} onChange={e => updateField("state", e.target.value)} sx={{ minWidth: 120 }} />
              <TextField label="Zip" value={data.zip ?? ""} onChange={e => updateField("zip", e.target.value)} sx={{ minWidth: 140 }} />
            </Stack>
            <TextField
              label="Date of Birth"
              type="date"
              value={data.dateOfBirth ? dayjs(data.dateOfBirth).format("YYYY-MM-DD") : ""}
              onChange={e => updateField("dateOfBirth", e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField label="Emergency Contact Name" value={data.emergencyContactName ?? ""} onChange={e => updateField("emergencyContactName", e.target.value)} />
            <TextField label="Emergency Contact Phone" value={data.emergencyContactPhone ?? ""} onChange={e => updateField("emergencyContactPhone", e.target.value)} />
          </Stack>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />} onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Change Password</Typography>
          {pwdError && <Alert severity="error" sx={{ mb: 1 }}>{pwdError}</Alert>}
          {pwdSuccess && <Alert severity="success" sx={{ mb: 1 }}>{pwdSuccess}</Alert>}
          <Stack spacing={1.5}>
            <TextField label="Current Password" type="password" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} />
            <TextField label="New Password" type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} />
            <TextField label="Confirm New Password" type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} />
          </Stack>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" onClick={handleChangePassword} disabled={pwdBusy}>
              {pwdBusy ? <CircularProgress size={16} /> : "Update Password"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
