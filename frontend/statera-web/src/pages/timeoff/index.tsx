// src/pages/timeoff/index.tsx
import * as React from "react";
import {
  Box, Button, Container, Typography, Tabs, Tab,
  Stack, FormControl, InputLabel, Select, MenuItem,
  List, ListItemButton, ListItemText, Paper, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Chip, CircularProgress,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
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

// ─── Assign Off Days Dialog ───────────────────────────────────────────────────
interface AssignOffDaysDialogProps {
  open: boolean;
  staff: StaffDto | null;
  onClose: () => void;
  onSave: (staffId: string, start: Dayjs, end: Dayjs, type: string) => Promise<void>;
}

const OFF_TYPES = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

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
    setBusy(true);
    setErr(null);
    try {
      await onSave(staff.id, start.startOf("day"), end.endOf("day"), type);
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to assign off days.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Assign Off Days — {staff ? `${staff.firstName} ${staff.lastName}` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <DatePicker
            label="Start date"
            value={start}
            onChange={d => setStart(d)}
          />
          <DatePicker
            label="End date"
            value={end}
            onChange={d => setEnd(d)}
            minDate={start ?? undefined}
          />
          <TextField
            select label="Type" value={type} onChange={e => setType(e.target.value)}
          >
            {OFF_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          {err && <Typography color="error" variant="body2">{err}</Typography>}
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
  const { facilities, selected } = useFacility();
  const { setSelectedId } = useFacility();
  const { user } = useAuth();
  const isOwner = user?.systemRole === "Owner";
  const facilityId = selected?.id;

  const [tab, setTab] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Staff list state
  const [staff, setStaff]           = React.useState<StaffDto[]>([]);
  const [staffSearch, setStaffSearch] = React.useState("");
  const [staffLoading, setStaffLoading] = React.useState(false);
  const [selectedStaff, setSelectedStaff] = React.useState<StaffDto | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);

  // Load staff when facility changes or tab switches to Staff Off Days
  React.useEffect(() => {
    if (tab !== 1 || !facilityId) return;
    setStaffLoading(true);
    listStaff(facilityId)
      .then(s => setStaff(s))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false));
  }, [tab, facilityId]);

  // Refresh event bus
  React.useEffect(() => {
    const fn = () => setRefreshKey(k => k + 1);
    window.addEventListener("timeoff:refresh", fn);
    return () => window.removeEventListener("timeoff:refresh", fn);
  }, []);

  async function handleCreate(values: TimeOffFormValues) {
    if (!values.startUtc || !values.endUtc) return;
    await createTimeOff({
      staffId: values.staffId,
      type: values.type,
      startUtc: values.startUtc.toDate().toISOString(),
      endUtc: values.endUtc.toDate().toISOString(),
      reason: values.reason ?? undefined,
    });
    setOpen(false);
    window.dispatchEvent(new Event("timeoff:refresh"));
  }

  async function handleAssignOffDays(staffId: string, start: Dayjs, end: Dayjs, type: string) {
    const res = await createTimeOff({
      staffId,
      type,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      reason: "Admin-assigned off days",
    });
    // Immediately approve so scheduling respects it
    await changeTimeOffStatus(res.id, "Approved");
    window.dispatchEvent(new Event("timeoff:refresh"));
  }

  const filteredStaff = staff.filter(s =>
    staffSearch === "" ||
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="lg" sx={{ py: 2 }}>

        {/* ── Header ── */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
          <Typography variant="h5">Time Off</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            {isOwner && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Facility</InputLabel>
                <Select
                  label="Facility"
                  value={facilityId ?? ""}
                  onChange={e => setSelectedId(String(e.target.value))}
                >
                  {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <Button variant="contained" onClick={() => setOpen(true)}>
              New Time-Off Request
            </Button>
          </Stack>
        </Box>

        {/* ── Tabs ── */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Requests" />
          <Tab label="Staff Off Days" />
        </Tabs>

        {/* ── Requests tab ── */}
        {tab === 0 && (
          <TimeOffTable key={refreshKey} facilityId={facilityId} />
        )}

        {/* ── Staff Off Days tab ── */}
        {tab === 1 && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {/* Staff list */}
            <Paper variant="outlined" sx={{ width: { md: 280 }, flexShrink: 0 }}>
              <Box sx={{ p: 1.5 }}>
                <TextField
                  size="small" fullWidth placeholder="Search staff…"
                  value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                />
              </Box>
              <Divider />
              {staffLoading ? (
                <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>
              ) : (
                <List dense disablePadding sx={{ maxHeight: 520, overflowY: "auto" }}>
                  {filteredStaff.map(s => (
                    <ListItemButton
                      key={s.id}
                      selected={selectedStaff?.id === s.id}
                      onClick={() => setSelectedStaff(s)}
                    >
                      <ListItemText
                        primary={`${s.firstName} ${s.lastName}`}
                        secondary={s.role ?? undefined}
                      />
                    </ListItemButton>
                  ))}
                  {filteredStaff.length === 0 && (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">No staff found.</Typography>
                    </Box>
                  )}
                </List>
              )}
            </Paper>

            {/* Selected staff panel */}
            <Box sx={{ flex: 1 }}>
              {selectedStaff ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      {selectedStaff.firstName} {selectedStaff.lastName}
                    </Typography>
                    {selectedStaff.role && <Chip label={selectedStaff.role} size="small" />}
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      variant="contained"
                      startIcon={<PersonAddIcon />}
                      onClick={() => setAssignOpen(true)}
                    >
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
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    Select a staff member from the list to view or assign their off days.
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
