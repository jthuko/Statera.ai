// src/pages/hiring/index.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Alert, Avatar, Badge, Box, Button, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer,
  FormControl, IconButton, InputLabel, LinearProgress, MenuItem, Select,
  Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  Add as AddIcon, Close as CloseIcon, Delete as DeleteIcon,
  Download as DownloadIcon, FileUpload as UploadIcon,
  PersonAdd as PersonAddIcon, CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon, ArrowForward as ArrowForwardIcon,
  Block as BlockIcon, CalendarToday as CalToday, DateRange as DateRange,
} from "@mui/icons-material";
import { useFacility } from "../../context/facility";
import {
  listCandidates, createCandidate, updateCandidate, deleteCandidate,
  toggleChecklistItem, addChecklistItem, deleteChecklistItem,
  uploadCandidateDocument, downloadCandidateDocument, deleteCandidateDocument,
  moveToOnboarding, rejectCandidate, getHiringDashboard,
  formatFileSize,
  type CandidateDto, type HiringDashboard,
} from "../../api/hiring";

const POSITIONS = ["CNA", "CMA", "RN", "LPN", "SW", "Other"];
const STATUS_COLORS: Record<string, string> = {
  Applied: "#0ea5e9", Interviewing: "#f59e0b", Offered: "#8b5cf6",
  Onboarding: "#10b981", Hired: "#22c55e", Rejected: "#ef4444",
};

const HIRING_STATUSES = ["Applied", "Interviewing", "Offered"];

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 120, bgcolor: "rgba(255,255,255,0.04)", borderRadius: 2, p: 2, border: "1px solid", borderColor: "divider" }}>
      <Typography variant="h4" fontWeight={700} sx={{ color: "#0ea5e9" }}>{value}</Typography>
      <Typography variant="body2" fontWeight={600}>{label}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
  );
}

function initials(c: CandidateDto) {
  return ((c.firstName[0] ?? "") + (c.lastName[0] ?? "")).toUpperCase();
}

export default function HiringPage() {
  const { selected: facility } = useFacility();
  const facilityId = facility?.id ?? "";

  const [tab, setTab] = useState(0);                // 0=All, 1=Applied, 2=Interviewing, 3=Offered
  const [dateMode, setDateMode] = useState<"day" | "week">("day");
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<HiringDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CandidateDto | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const tabStatus = [undefined, "Applied", "Interviewing", "Offered"][tab];

  const dateRange = useCallback(() => {
    const now = dayjs();
    if (dateMode === "day") {
      return { from: now.startOf("day").toISOString(), to: now.endOf("day").toISOString() };
    }
    return { from: now.startOf("week").toISOString(), to: now.endOf("week").toISOString() };
  }, [dateMode]);

  const load = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [list, dash] = await Promise.all([
        listCandidates(facilityId, undefined).then(r =>
          r.filter(c => HIRING_STATUSES.includes(c.status))
        ),
        getHiringDashboard(facilityId, dateRange().from, dateRange().to),
      ]);
      setCandidates(list);
      setDashboard(dash);
    } catch {
      setError("Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  }, [facilityId, dateRange]);

  useEffect(() => { load(); }, [load]);

  const filtered = candidates.filter(c => !tabStatus || c.status === tabStatus);

  // Refresh selected candidate after changes
  const refreshSelected = async (id: string) => {
    const fresh = await listCandidates(facilityId);
    const c = fresh.find(x => x.id === id);
    if (c) setSelected(c);
    setCandidates(fresh.filter(x => HIRING_STATUSES.includes(x.status)));
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Hiring Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">Track candidates through your hiring process</Typography>
        </Box>
        <Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setAddOpen(true)}
          sx={{ bgcolor: "#0ea5e9", "&:hover": { bgcolor: "#0284c7" } }}>
          Add Candidate
        </Button>
      </Stack>

      {/* Dashboard */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        {dashboard && <>
          <StatCard label="Active Pipeline" value={dashboard.inHiring} />
          <StatCard label={dateMode === "day" ? "Applied Today" : "Applied This Week"} value={dashboard.appliedInRange} />
          <StatCard label="In Onboarding" value={dashboard.inOnboarding} />
          <StatCard label="Total Hired" value={dashboard.totalHired} />
        </>}
        {loading && !dashboard && <CircularProgress size={24} />}

        {/* Day/Week toggle */}
        <Box sx={{ ml: "auto !important", display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Today"><IconButton size="small" onClick={() => setDateMode("day")}
            sx={{ bgcolor: dateMode === "day" ? "rgba(14,165,233,0.15)" : "transparent" }}>
            <CalToday fontSize="small" sx={{ color: dateMode === "day" ? "#0ea5e9" : "text.secondary" }} />
          </IconButton></Tooltip>
          <Tooltip title="This Week"><IconButton size="small" onClick={() => setDateMode("week")}
            sx={{ bgcolor: dateMode === "week" ? "rgba(14,165,233,0.15)" : "transparent" }}>
            <DateRange fontSize="small" sx={{ color: dateMode === "week" ? "#0ea5e9" : "text.secondary" }} />
          </IconButton></Tooltip>
        </Box>
      </Stack>

      {/* Status tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`All (${candidates.length})`} />
          <Tab label={`Applied (${candidates.filter(c => c.status === "Applied").length})`} />
          <Tab label={`Interviewing (${candidates.filter(c => c.status === "Interviewing").length})`} />
          <Tab label={`Offered (${candidates.filter(c => c.status === "Offered").length})`} />
        </Tabs>
      </Box>

      {/* Candidate list */}
      {loading ? (
        <Box sx={{ textAlign: "center", pt: 6 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", pt: 8, opacity: 0.5 }}>
          <Typography variant="body1" color="text.secondary">No candidates in this stage.</Typography>
          <Button startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ mt: 2 }}>Add your first candidate</Button>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map(c => (
            <CandidateRow
              key={c.id}
              candidate={c}
              onClick={() => setSelected(c)}
            />
          ))}
        </Stack>
      )}

      {/* Candidate detail drawer */}
      <CandidateDrawer
        candidate={selected}
        onClose={() => setSelected(null)}
        onRefresh={() => { if (selected) refreshSelected(selected.id); load(); }}
        onReload={load}
        setError={setError}
      />

      {/* Add candidate dialog */}
      <AddCandidateDialog
        open={addOpen}
        facilityId={facilityId}
        onClose={() => setAddOpen(false)}
        onCreated={(c) => { setCandidates(prev => [c, ...prev]); setAddOpen(false); setSelected(c); }}
        setError={setError}
      />
    </Box>
  );
}

// ─── Candidate Row ────────────────────────────────────────────────────────────
function CandidateRow({ candidate: c, onClick }: { candidate: CandidateDto; onClick: () => void }) {
  const checkedCount = c.checklistItems.filter(i => i.isChecked).length;
  const totalCount   = c.checklistItems.length;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex", alignItems: "center", gap: 2, p: 2,
        borderRadius: 2, border: "1px solid", borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.02)", cursor: "pointer",
        "&:hover": { bgcolor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)" },
        transition: "all 0.15s",
      }}
    >
      <Avatar sx={{ bgcolor: STATUS_COLORS[c.status] ?? "#546e7a", fontWeight: 700, width: 42, height: 42 }}>
        {initials(c)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography fontWeight={600} noWrap>{c.firstName} {c.lastName}</Typography>
          <Chip label={c.status} size="small"
            sx={{ bgcolor: STATUS_COLORS[c.status] + "22", color: STATUS_COLORS[c.status], fontWeight: 600, fontSize: 11 }} />
          {c.position && <Chip label={c.position} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {c.email ?? c.phone ?? "No contact info"} · Applied {dayjs(c.appliedUtc).format("MMM D, YYYY")}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 120, textAlign: "right" }}>
        <Typography variant="caption" color="text.secondary" display="block">{checkedCount}/{totalCount} items</Typography>
        <LinearProgress
          variant="determinate"
          value={c.checklistPct}
          sx={{ height: 6, borderRadius: 3, mt: 0.5,
            bgcolor: "rgba(255,255,255,0.1)",
            "& .MuiLinearProgress-bar": { bgcolor: c.checklistPct === 100 ? "#10b981" : "#0ea5e9" }
          }}
        />
      </Box>
      <Badge badgeContent={c.documents.length} color="primary" sx={{ ml: 1 }}>
        <Typography variant="caption" color="text.secondary">docs</Typography>
      </Badge>
    </Box>
  );
}

// ─── Candidate Drawer ─────────────────────────────────────────────────────────
function CandidateDrawer({
  candidate, onClose, onRefresh, onReload, setError,
}: {
  candidate: CandidateDto | null;
  onClose: () => void;
  onRefresh: () => void;
  onReload: () => void;
  setError: (e: string | null) => void;
}) {
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const c = candidate;
  if (!c) return null;

  const allChecked = c.allChecked;
  const canOnboard = allChecked && c.status !== "Onboarding" && c.status !== "Hired";

  async function handleToggle(itemId: string, checked: boolean) {
    try {
      await toggleChecklistItem(c.id, itemId, checked);
      onRefresh();
    } catch { setError("Failed to update checklist."); }
  }

  async function handleAddItem() {
    if (!newItemName.trim()) return;
    setAddingItem(true);
    try {
      await addChecklistItem(c.id, newItemName.trim());
      setNewItemName("");
      onRefresh();
    } catch { setError("Failed to add checklist item."); }
    finally { setAddingItem(false); }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteChecklistItem(c.id, itemId);
      onRefresh();
    } catch { setError("Failed to remove item."); }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await uploadCandidateDocument(c.id, file);
      onRefresh();
    } catch { setError("Failed to upload document."); }
    finally { setUploading(false); }
  }

  async function handleDeleteDoc(docId: string) {
    try {
      await deleteCandidateDocument(c.id, docId);
      onRefresh();
    } catch { setError("Failed to delete document."); }
  }

  async function handleStatusChange(newStatus: string) {
    setStatusChanging(true);
    try {
      await updateCandidate(c.id, { status: newStatus });
      onRefresh();
    } catch { setError("Failed to update status."); }
    finally { setStatusChanging(false); }
  }

  async function handleOnboard() {
    setBusy("onboard");
    try {
      await moveToOnboarding(c.id);
      onClose();
      onReload();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to move to onboarding.");
    } finally { setBusy(null); }
  }

  async function handleReject() {
    setBusy("reject");
    try {
      await rejectCandidate(c.id);
      onClose();
      onReload();
    } catch { setError("Failed to reject candidate."); }
    finally { setBusy(null); setDeleteConfirm(false); }
  }

  async function handleDelete() {
    setBusy("delete");
    try {
      await deleteCandidate(c.id);
      onClose();
      onReload();
    } catch { setError("Failed to delete candidate."); }
    finally { setBusy(null); }
  }

  return (
    <Drawer
      anchor="right"
      open={!!candidate}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, p: 0, display: "flex", flexDirection: "column" } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar sx={{ bgcolor: STATUS_COLORS[c.status] ?? "#546e7a", width: 44, height: 44, fontWeight: 700 }}>
          {initials(c)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} noWrap>{c.firstName} {c.lastName}</Typography>
          <Typography variant="caption" color="text.secondary">{c.position ?? "No position"} · {c.email ?? c.phone ?? "No contact"}</Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
        {/* Status */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={c.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusChanging}
            >
              {["Applied", "Interviewing", "Offered"].map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {statusChanging && <CircularProgress size={16} />}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Checklist */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Document Checklist ({c.checklistItems.filter(i => i.isChecked).length}/{c.checklistItems.length})
        </Typography>
        <LinearProgress
          variant="determinate"
          value={c.checklistPct}
          sx={{ mb: 2, height: 8, borderRadius: 4,
            bgcolor: "rgba(255,255,255,0.1)",
            "& .MuiLinearProgress-bar": { bgcolor: c.checklistPct === 100 ? "#10b981" : "#0ea5e9" }
          }}
        />
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {c.checklistItems.map(item => (
            <Stack key={item.id} direction="row" alignItems="center" spacing={1}
              sx={{ p: 1, borderRadius: 1.5, bgcolor: item.isChecked ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                border: "1px solid", borderColor: item.isChecked ? "rgba(16,185,129,0.2)" : "divider" }}>
              <Checkbox
                size="small"
                checked={item.isChecked}
                onChange={e => handleToggle(item.id, e.target.checked)}
                sx={{ p: 0.5, color: "text.disabled", "&.Mui-checked": { color: "#10b981" } }}
              />
              <Typography variant="body2" sx={{ flex: 1, textDecoration: item.isChecked ? "line-through" : "none", opacity: item.isChecked ? 0.6 : 1 }}>
                {item.name}
              </Typography>
              {item.isChecked && <CheckCircleIcon sx={{ fontSize: 16, color: "#10b981" }} />}
              <IconButton size="small" onClick={() => handleDeleteItem(item.id)} sx={{ opacity: 0.4, "&:hover": { opacity: 1 } }}>
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
          ))}
        </Stack>

        {/* Add checklist item */}
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          <TextField
            size="small" fullWidth placeholder="Add checklist item…"
            value={newItemName} onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddItem(); }}
          />
          <Button variant="outlined" size="small" onClick={handleAddItem} disabled={addingItem || !newItemName.trim()}>
            {addingItem ? <CircularProgress size={16} /> : <AddIcon />}
          </Button>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Documents */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Documents ({c.documents.length})</Typography>
          <Button size="small" startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outlined">
            Upload
          </Button>
          <input
            ref={fileInputRef} type="file" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ""; } }}
          />
        </Stack>

        {c.documents.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>No documents uploaded yet.</Typography>
        ) : (
          <Stack spacing={0.75} sx={{ mb: 3 }}>
            {c.documents.map(doc => (
              <Stack key={doc.id} direction="row" alignItems="center" spacing={1}
                sx={{ p: 1.25, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap fontWeight={500}>{doc.fileName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(doc.fileSizeBytes)} · {dayjs(doc.uploadedUtc).format("MMM D, YYYY")}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => downloadCandidateDocument(c.id, doc.id, doc.fileName)}>
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" onClick={() => handleDeleteDoc(doc.id)}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        {/* Notes */}
        {c.notes && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Notes</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{c.notes}</Typography>
          </>
        )}
      </Box>

      {/* Footer actions */}
      <Box sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Stack spacing={1}>
          <Tooltip title={!allChecked ? "Complete all checklist items first" : ""} arrow>
            <span>
              <Button
                fullWidth
                variant="contained"
                startIcon={busy === "onboard" ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
                disabled={!canOnboard || busy === "onboard"}
                onClick={handleOnboard}
                sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}
              >
                Move to Onboarding
              </Button>
            </span>
          </Tooltip>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="outlined" color="error" startIcon={<BlockIcon />}
              onClick={() => setDeleteConfirm(true)} disabled={!!busy}>
              Reject
            </Button>
            <Button fullWidth variant="outlined" color="error" startIcon={<DeleteIcon />}
              onClick={handleDelete} disabled={!!busy}>
              Delete
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Reject confirm */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)} maxWidth="xs">
        <DialogTitle>Reject Candidate?</DialogTitle>
        <DialogContent>
          <Typography>Mark {c.firstName} {c.lastName} as rejected?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleReject} disabled={busy === "reject"}>
            {busy === "reject" ? <CircularProgress size={16} /> : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}

// ─── Add Candidate Dialog ─────────────────────────────────────────────────────
function AddCandidateDialog({
  open, facilityId, onClose, onCreated, setError,
}: {
  open: boolean; facilityId: string;
  onClose: () => void; onCreated: (c: CandidateDto) => void;
  setError: (e: string | null) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) return;
    setBusy(true);
    try {
      const c = await createCandidate({ facilityId, firstName, lastName, email: email || undefined, phone: phone || undefined, position: position || undefined, notes: notes || undefined });
      // Reset form
      setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setPosition(""); setNotes("");
      onCreated(c);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to create candidate.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Candidate</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={2}>
            <TextField size="small" label="First Name *" fullWidth value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
            <TextField size="small" label="Last Name *" fullWidth value={lastName} onChange={e => setLastName(e.target.value)} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField size="small" label="Email" fullWidth value={email} onChange={e => setEmail(e.target.value)} type="email" />
            <TextField size="small" label="Phone" fullWidth value={phone} onChange={e => setPhone(e.target.value)} />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel>Position</InputLabel>
            <Select label="Position" value={position} onChange={e => setPosition(e.target.value)}>
              <MenuItem value="">— Select —</MenuItem>
              {POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Notes" fullWidth multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate}
          disabled={busy || !firstName.trim() || !lastName.trim()}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Add Candidate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
