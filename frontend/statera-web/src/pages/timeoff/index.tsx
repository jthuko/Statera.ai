// src/pages/timeoff/index.tsx
import * as React from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, InputLabel, List, ListItemButton, ListItemText,
  MenuItem, Select, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SearchIcon from "@mui/icons-material/Search";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";

import TimeOffTable from "../../components/timeoff/TimeOffTable";
import TimeOffFormDialog, { TimeOffFormValues } from "../../components/timeoff/TimeOffFormDialog";
import { createTimeOff, changeTimeOffStatus } from "../../api/timeoff";
import { listStaff, StaffDto } from "../../api/staff";
import { useFacility } from "../../context/facility";
import { useAuth } from "../../auth/useAuth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OFF_TYPES = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ─── Assign Off Days Dialog ───────────────────────────────────────────────────

interface AssignOffDaysDialogProps {
  open: boolean; staff: StaffDto | null;
  onClose: () => void;
  onSave: (staffId: string, start: Dayjs, end: Dayjs, type: string) => Promise<void>;
}

function AssignOffDaysDialog({ open, staff, onClose, onSave }: AssignOffDaysDialogProps) {
  const [start, setStart] = React.useState<Dayjs | null>(dayjs());
  const [end, setEnd]     = React.useState<Dayjs | null>(dayjs());
  const [type, setType]   = React.useState("Vacation");
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) { setStart(dayjs()); setEnd(dayjs()); setType("Vacation"); setErr(null); }
  }, [open]);

  const canSave = !!start && !!end && !end.isBefore(start);

  async function handleSave() {
    if (!staff || !start || !end) return;
    setBusy(true); setErr(null);
    try {
      await onSave(staff.id, start.startOf("day"), end.endOf("day"), type);
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to assign off days.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Assign Off Days — {staff ? `${staff.firstName} ${staff.lastName}` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <DatePicker label="Start date" value={start} onChange={d => {
            if (d && start && end) {
              const diffDays = end.diff(start, "day");
              setEnd(d.add(diffDays, "day"));
            }
            setStart(d);
          }} />
          <DatePicker label="End date"   value={end}   onChange={d => setEnd(d)} minDate={start ?? undefined} />
          <TextField select label="Type" value={type} onChange={e => setType(e.target.value)}>
            {OFF_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave || busy}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Assign & Approve"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimeOffPage() {
  const { facilities, selected, setSelectedId } = useFacility();
  const { user } = useAuth();
  const isOwner    = user?.systemRole === "Owner";
  const facilityId = selected?.id;

  const [tab, setTab]           = React.useState(0);
  const [open, setOpen]         = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [staff, setStaff]             = React.useState<StaffDto[]>([]);
  const [staffSearch, setStaffSearch] = React.useState("");
  const [staffLoading, setStaffLoading] = React.useState(false);
  const [selectedStaff, setSelectedStaff] = React.useState<StaffDto | null>(null);
  const [assignOpen, setAssignOpen]   = React.useState(false);

  React.useEffect(() => {
    if (tab !== 1 || !facilityId) return;
    setStaffLoading(true);
    listStaff(facilityId)
      .then(s => setStaff(s))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false));
  }, [tab, facilityId]);

  React.useEffect(() => {
    const fn = () => setRefreshKey(k => k + 1);
    window.addEventListener("timeoff:refresh", fn);
    return () => window.removeEventListener("timeoff:refresh", fn);
  }, []);

  async function handleCreate(values: TimeOffFormValues) {
    if (!values.startUtc || !values.endUtc) return;
    await createTimeOff({
      staffId: values.staffId, type: values.type,
      startUtc: values.startUtc.toDate().toISOString(),
      endUtc:   values.endUtc.toDate().toISOString(),
      reason:   values.reason ?? undefined,
    });
    setOpen(false);
    window.dispatchEvent(new Event("timeoff:refresh"));
  }

  async function handleAssignOffDays(staffId: string, start: Dayjs, end: Dayjs, type: string) {
    const res = await createTimeOff({
      staffId, type,
      startUtc: start.toISOString(), endUtc: end.toISOString(),
      reason: "Admin-assigned off days",
    });
    await changeTimeOffStatus(res.id, "Approved");
    window.dispatchEvent(new Event("timeoff:refresh"));
  }

  const filteredStaff = staff.filter(s =>
    staffSearch === "" ||
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="lg" sx={{ py: 3 }}>

        {/* ── Header ── */}
        <Card variant="outlined" sx={{
          mb: 2.5,
          background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
          borderColor: "rgba(0,137,123,0.25)",
        }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }}
              justifyContent="space-between" gap={2}>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{
                  width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
                }}>
                  <BeachAccessIcon sx={{ color: "#4db6ac", fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Time Off</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Manage requests and staff off days
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center">
                {isOwner && (
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Facility</InputLabel>
                    <Select label="Facility" value={facilityId ?? ""}
                      onChange={e => setSelectedId(String(e.target.value))}>
                      {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                )}
                <Button variant="contained" startIcon={<BeachAccessIcon />} onClick={() => setOpen(true)}>
                  New Request
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* ── Tabs ── */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2.5 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Requests" />
            <Tab label="Staff Off Days" />
          </Tabs>
        </Box>

        {/* ── Requests tab ── */}
        {tab === 0 && (
          <TimeOffTable key={refreshKey} facilityId={facilityId} />
        )}

        {/* ── Staff Off Days tab ── */}
        {tab === 1 && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

            {/* Staff list panel */}
            <Card variant="outlined" sx={{
              width: { md: 280 }, flexShrink: 0,
              borderColor: "rgba(255,255,255,0.06)",
            }}>
              <Box sx={{ p: 1.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <TextField
                  size="small" fullWidth placeholder="Search staff…"
                  value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                  InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} /> }}
                />
              </Box>
              {staffLoading ? (
                <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} sx={{ color: "#4db6ac" }} /></Box>
              ) : (
                <List dense disablePadding sx={{ maxHeight: 520, overflowY: "auto" }}>
                  {filteredStaff.map(s => (
                    <ListItemButton
                      key={s.id}
                      selected={selectedStaff?.id === s.id}
                      onClick={() => setSelectedStaff(s)}
                      sx={{
                        py: 1, px: 1.5,
                        "&.Mui-selected": {
                          bgcolor: "rgba(0,137,123,0.15)",
                          borderLeft: "3px solid #4db6ac",
                        },
                        "&.Mui-selected:hover": { bgcolor: "rgba(0,137,123,0.2)" },
                      }}
                    >
                      <Avatar sx={{
                        width: 32, height: 32, fontSize: 12, fontWeight: 700, mr: 1.5, flexShrink: 0,
                        bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac",
                        border: "1px solid rgba(0,137,123,0.3)",
                      }}>
                        {getInitials(`${s.firstName} ${s.lastName}`)}
                      </Avatar>
                      <ListItemText
                        primary={`${s.firstName} ${s.lastName}`}
                        secondary={s.role ?? undefined}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: selectedStaff?.id === s.id ? 600 : 400 }}
                        secondaryTypographyProps={{ fontSize: 11 }}
                      />
                    </ListItemButton>
                  ))}
                  {filteredStaff.length === 0 && (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">No staff found.</Typography>
                    </Box>
                  )}
                </List>
              )}
            </Card>

            {/* Right panel */}
            <Box sx={{ flex: 1 }}>
              {selectedStaff ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Avatar sx={{
                      width: 40, height: 40, fontSize: 15, fontWeight: 700,
                      bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac",
                      border: "1px solid rgba(0,137,123,0.3)",
                    }}>
                      {getInitials(`${selectedStaff.firstName} ${selectedStaff.lastName}`)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600}>{selectedStaff.firstName} {selectedStaff.lastName}</Typography>
                      {selectedStaff.role && (
                        <Chip label={selectedStaff.role} size="small"
                          sx={{ height: 18, fontSize: 11, mt: 0.25 }} />
                      )}
                    </Box>
                    <Button variant="contained" startIcon={<PersonAddIcon />}
                      onClick={() => setAssignOpen(true)}>
                      Assign Off Days
                    </Button>
                  </Stack>
                  <TimeOffTable
                    key={`${refreshKey}-${selectedStaff.id}`}
                    facilityId={facilityId}
                    staffId={selectedStaff.id}
                  />
                </>
              ) : (
                <Box sx={{
                  textAlign: "center", py: 8,
                  border: "2px dashed", borderColor: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                }}>
                  <EventBusyIcon sx={{ fontSize: 48, color: "text.disabled", opacity: 0.3, mb: 1 }} />
                  <Typography color="text.secondary" fontWeight={500}>No staff selected</Typography>
                  <Typography variant="caption" color="text.disabled">
                    Select a staff member from the list to view or assign off days
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        )}

        {/* ── Dialogs ── */}
        <TimeOffFormDialog
          open={open}
          onClose={() => setOpen(false)}
          onSubmit={handleCreate}
          initial={{}}
        />

        <AssignOffDaysDialog
          open={assignOpen}
          staff={selectedStaff}
          onClose={() => setAssignOpen(false)}
          onSave={handleAssignOffDays}
        />

      </Container>
    </LocalizationProvider>
  );
}
