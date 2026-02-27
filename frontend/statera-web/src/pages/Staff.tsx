import { useEffect, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  InputAdornment, MenuItem, Skeleton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Page from "./_Page";
import { listStaff, createStaff, importStaff, StaffImportResult, CreateStaffPayload, StaffDto } from "../api/staff";
import { useNavigate } from "react-router-dom";
import { useFacility } from "../context/facility";
import StaffFormDialog, { StaffFormValues } from "../components/staff/StaffFormDialog";
import dayjs from "dayjs";

// ── Staff Import Dialog ───────────────────────────────────────────────────────
const TEMPLATE_CSV =
  "firstName,lastName,email,role,employmentType,unitId,active\n" +
  "John,Doe,john@example.com,RN,FullTime,,true\n" +
  "Jane,Smith,,LPN,PartTime,,true\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "staff_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StaffImportDialog({
  open, facilityId, onClose, onImported,
}: {
  open: boolean; facilityId: string;
  onClose: () => void; onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<StaffImportResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  function reset() {
    setFile(null); setResult(null); setError(null); setLoading(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const res = await importStaff(facilityId, file);
      setResult(res);
      if (res.successCount > 0) onImported();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Staff from CSV / Excel</DialogTitle>
      <DialogContent>
        {!result ? (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. Required columns:{" "}
              <code>firstName</code>, <code>lastName</code>, <code>role</code>,{" "}
              <code>employmentType</code> (FullTime / PartTime / PerDiem / Contract).
              Optional: <code>email</code>, <code>unitId</code>, <code>active</code>.
            </Typography>

            <Button
              size="small"
              variant="outlined"
              onClick={downloadTemplate}
              sx={{ alignSelf: "flex-start" }}
            >
              Download Template CSV
            </Button>

            {/* File pick area */}
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                border: "2px dashed",
                borderColor: file ? "success.main" : "divider",
                borderRadius: 2, p: 3, textAlign: "center", cursor: "pointer",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                transition: "border-color 0.2s",
              }}
            >
              <UploadFileIcon sx={{ fontSize: 36, color: file ? "success.main" : "text.disabled", mb: 1 }} />
              <Typography variant="body2" color={file ? "success.main" : "text.secondary"}>
                {file ? file.name : "Click to select a .csv or .xlsx file"}
              </Typography>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                style={{ display: "none" }}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Alert severity={result.errorCount === 0 ? "success" : result.successCount === 0 ? "error" : "warning"}>
              {result.successCount} staff member{result.successCount !== 1 ? "s" : ""} imported successfully.
              {result.errorCount > 0 && ` ${result.errorCount} row${result.errorCount !== 1 ? "s" : ""} had errors.`}
            </Alert>
            {result.errors.length > 0 && (
              <Box sx={{ maxHeight: 260, overflowY: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell>{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={!file || loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? "Importing…" : "Import"}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>Done</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

const ROLE_COLORS: Record<string, string> = {
  RN: "#1565c0",
  LPN: "#6a1b9a",
  CNA: "#2e7d32",
  Manager: "#e65100",
  Cook: "#b71c1c",
  Receptionist: "#01579b",
  Other: "#546e7a",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  FullTime: "Full Time",
  PartTime: "Part Time",
  PerDiem: "Per Diem",
  Contract: "Contract",
};

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? "#546e7a";
}

export default function Staff() {
  const [rows, setRows] = useState<StaffDto[]>([]);
  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState<"all" | "expiring" | "expired">("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [duplicatePopup, setDuplicatePopup] = useState(false);
  const [newLoginInfo, setNewLoginInfo] = useState<{ email: string; password: string } | null>(null);
  const [pendingAdminCreate, setPendingAdminCreate] = useState<StaffFormValues | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const nav = useNavigate();
  const { facilities, selected: facility, setSelectedId } = useFacility();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!facility) {
        setRows([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr(null);
        const data = await listStaff(facility.id);
        if (!alive) return;
        setRows(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load staff.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [facility]);

  const doCreate = async (vals: StaffFormValues) => {
    if (!facility) return;
    try {
      const payload: CreateStaffPayload = {
        firstName: vals.firstName,
        lastName: vals.lastName,
        email: vals.email || null,
        facilityId: facility.id,
        unitId: vals.unitId || null,
        role: vals.role,
        employmentType: vals.employmentType,
        active: vals.active,
        adminAccess: vals.adminAccess,
        licenseNumber: vals.licenseNumber || null,
        licenseExpiresOn: vals.licenseExpiresOn || null,
        cprExpiresOn: vals.cprExpiresOn || null,
      };
      const result = await createStaff(payload);
      const data = await listStaff(facility.id);
      setRows(data);
      setOpen(false);
      if (result.loginCreated && result.tempPassword && result.email) {
        setNewLoginInfo({ email: result.email, password: result.tempPassword });
      }
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setDuplicatePopup(true);
      } else {
        setErr(e?.message || "Failed to create staff.");
      }
    }
  };

  const handleCreate = async (vals: StaffFormValues) => {
    if (vals.adminAccess && vals.email) {
      setPendingAdminCreate(vals);
      return;
    }
    await doCreate(vals);
  };

  const handleConfirmAdmin = async () => {
    if (!pendingAdminCreate) return;
    const vals = pendingAdminCreate;
    setPendingAdminCreate(null);
    await doCreate(vals);
  };

  const filtered = rows
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name = (r.displayName ?? `${r.firstName} ${r.lastName}`).toLowerCase();
      const role = (r.role ?? r.roles?.[0]?.name ?? "").toLowerCase();
      return name.includes(q) || role.includes(q);
    })
    .filter(r => {
      if (licenseFilter === "all") return true;
      if (!r.licenseExpiresOn) return false;
      const today = dayjs().startOf("day");
      const exp = dayjs(r.licenseExpiresOn);
      if (licenseFilter === "expired") return exp.isBefore(today, "day");
      const soonCutoff = today.add(30, "day");
      return (exp.isAfter(today, "day") || exp.isSame(today, "day")) && (exp.isBefore(soonCutoff, "day") || exp.isSame(soonCutoff, "day"));
    })
    .map(r => ({
      id: r.id,
      name: r.displayName ?? `${r.firstName} ${r.lastName}`,
      role: r.role ?? r.roles?.[0]?.name ?? "",
      employmentType: (r as any).employmentType ?? "",
      active: (r as any).active !== false,
    }));

  const activeCount = rows.filter(r => (r as any).active !== false).length;

  return (
    <Page title="Staff Directory">
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {duplicatePopup && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDuplicatePopup(false)}>
          A staff member with that email already exists.
        </Alert>
      )}

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Staff Directory</Typography>
          {!loading && facility && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {activeCount} active &nbsp;·&nbsp; {rows.length} total
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setImportOpen(true)}
            disabled={!facility}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpen(true)}
            disabled={!facility}
          >
            New Staff
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <TextField
          select size="small" label="Facility"
          value={facility?.id ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {facilities.map(f => (
            <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          select size="small" label="License"
          value={licenseFilter}
          onChange={(e) => setLicenseFilter(e.target.value as "all" | "expiring" | "expired")}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="expiring">Expiring Soon (30 days)</MenuItem>
          <MenuItem value="expired">Expired</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="Search name or role"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {/* Card Grid */}
      {loading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 2 }}>
          {[...Array(8)].map((_, i) => (
            <Card key={i} sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="circular" width={52} height={52} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="70%" height={22} />
                  <Skeleton width="50%" height={18} sx={{ mt: 0.5 }} />
                </Box>
              </Stack>
            </Card>
          ))}
        </Box>
      ) : !facility ? (
        <Box sx={{ textAlign: "center", py: 10, color: "text.secondary" }}>
          <Typography variant="h6" gutterBottom>No facility selected</Typography>
          <Typography variant="body2">Select a facility above to view staff.</Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 10, color: "text.secondary" }}>
          <Typography variant="h6" gutterBottom>No staff found</Typography>
          <Typography variant="body2">Try adjusting the search or add new staff.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 2 }}>
          {filtered.map(s => {
            const color = getRoleColor(s.role);
            return (
              <Card
                key={s.id}
                onClick={() => nav(`/staff/${s.id}`)}
                sx={{
                  cursor: "pointer",
                  transition: "box-shadow 0.2s, transform 0.15s",
                  "&:hover": { boxShadow: 6, transform: "translateY(-2px)" },
                  position: "relative",
                  overflow: "visible",
                }}
              >
                {/* Colored top accent bar */}
                <Box sx={{ height: 4, bgcolor: color, borderRadius: "4px 4px 0 0" }} />
                <CardContent sx={{ pb: "16px !important" }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: color, width: 52, height: 52, fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                      {getInitials(s.name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} noWrap sx={{ mb: 0.5 }}>
                        {s.name}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {s.role && (
                          <Chip
                            label={s.role}
                            size="small"
                            sx={{ bgcolor: color, color: "#fff", fontSize: 11, height: 20, fontWeight: 600 }}
                          />
                        )}
                        {s.employmentType && (
                          <Chip
                            label={EMPLOYMENT_LABELS[s.employmentType] ?? s.employmentType}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 11, height: 20 }}
                          />
                        )}
                      </Stack>
                    </Box>
                    <Stack alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <Box sx={{
                        width: 9, height: 9, borderRadius: "50%",
                        bgcolor: s.active ? "success.main" : "grey.400",
                      }} />
                      <ChevronRightIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <StaffImportDialog
        open={importOpen}
        facilityId={facility?.id ?? ""}
        onClose={() => setImportOpen(false)}
        onImported={async () => { if (facility) setRows(await listStaff(facility.id)); }}
      />

      <StaffFormDialog
        open={open}
        onClose={() => { setOpen(false); setDuplicatePopup(false); }}
        onSave={handleCreate}
        defaultFacilityId={facility?.id ?? ""}
        defaultUnitId={undefined}
        duplicateError={duplicatePopup}
      />

      {/* Admin access confirmation */}
      <Dialog open={!!pendingAdminCreate} onClose={() => setPendingAdminCreate(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Admin Access</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a login account for <strong>{pendingAdminCreate?.email}</strong> with{" "}
            <strong>Facility Admin</strong> access. They will receive a temporary password.
            <br /><br />
            Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAdminCreate(null)}>Cancel</Button>
          <Button onClick={handleConfirmAdmin} variant="contained" color="warning">
            Yes, Create Admin Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Login created confirmation */}
      <Dialog open={!!newLoginInfo} onClose={() => setNewLoginInfo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Login Account Created</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Share these temporary credentials with the staff member:
          </Typography>
          <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 2 }}>
            <Typography variant="body2"><strong>Email:</strong> {newLoginInfo?.email}</Typography>
            <Typography variant="body2"><strong>Temp Password:</strong> {newLoginInfo?.password}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewLoginInfo(null)} variant="contained">Got it</Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
