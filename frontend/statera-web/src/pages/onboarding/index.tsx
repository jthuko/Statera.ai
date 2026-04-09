// src/pages/onboarding/index.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Alert, Avatar, Box, Button, CircularProgress, Chip, Divider, Drawer,
  IconButton, Stack, Tooltip, Typography, LinearProgress,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Close as CloseIcon,
  Download as DownloadIcon, FileUpload as UploadIcon, HowToReg as HireIcon,
  Delete as DeleteIcon, CalendarToday as CalToday, DateRange as DateRangeIcon,
} from "@mui/icons-material";
import { useFacility } from "../../context/facility";
import {
  listCandidates, hireCandidate, deleteCandidateDocument,
  uploadCandidateDocument, downloadCandidateDocument,
  getHiringDashboard, formatFileSize,
  type CandidateDto, type HiringDashboard,
} from "../../api/hiring";
import { useNavigate } from "react-router-dom";

function StatCard({ label, value, color = "#0ea5e9" }: { label: string; value: number; color?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 120, bgcolor: "rgba(255,255,255,0.04)", borderRadius: 2, p: 2, border: "1px solid", borderColor: "divider" }}>
      <Typography variant="h4" fontWeight={700} sx={{ color }}>{value}</Typography>
      <Typography variant="body2" fontWeight={600}>{label}</Typography>
    </Box>
  );
}

function initials(c: CandidateDto) {
  return ((c.firstName[0] ?? "") + (c.lastName[0] ?? "")).toUpperCase();
}

export default function OnboardingPage() {
  const { selected: facility } = useFacility();
  const facilityId = facility?.id ?? "";
  const nav = useNavigate();

  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<HiringDashboard | null>(null);
  const [dateMode, setDateMode] = useState<"day" | "week">("day");
  const [selected, setSelected] = useState<CandidateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useCallback(() => {
    const now = dayjs();
    if (dateMode === "day") return { from: now.startOf("day").toISOString(), to: now.endOf("day").toISOString() };
    return { from: now.startOf("week").toISOString(), to: now.endOf("week").toISOString() };
  }, [dateMode]);

  const load = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [list, dash] = await Promise.all([
        listCandidates(facilityId, "Onboarding"),
        getHiringDashboard(facilityId, dateRange().from, dateRange().to),
      ]);
      setCandidates(list);
      setDashboard(dash);
    } catch {
      setError("Failed to load onboarding candidates.");
    } finally {
      setLoading(false);
    }
  }, [facilityId, dateRange]);

  useEffect(() => { load(); }, [load]);

  const refreshSelected = async (id: string) => {
    const fresh = await listCandidates(facilityId, "Onboarding");
    setCandidates(fresh);
    const c = fresh.find(x => x.id === id);
    if (c) setSelected(c);
    else setSelected(null);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Onboarding</Typography>
          <Typography variant="body2" color="text.secondary">Review candidates ready to be hired</Typography>
        </Box>
        {/* Day/Week toggle */}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Today"><IconButton size="small" onClick={() => setDateMode("day")}
            sx={{ bgcolor: dateMode === "day" ? "rgba(14,165,233,0.15)" : "transparent" }}>
            <CalToday fontSize="small" sx={{ color: dateMode === "day" ? "#0ea5e9" : "text.secondary" }} />
          </IconButton></Tooltip>
          <Tooltip title="This Week"><IconButton size="small" onClick={() => setDateMode("week")}
            sx={{ bgcolor: dateMode === "week" ? "rgba(14,165,233,0.15)" : "transparent" }}>
            <DateRangeIcon fontSize="small" sx={{ color: dateMode === "week" ? "#0ea5e9" : "text.secondary" }} />
          </IconButton></Tooltip>
        </Stack>
      </Stack>

      {/* Dashboard */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        {dashboard && <>
          <StatCard label="In Onboarding" value={dashboard.inOnboarding} color="#10b981" />
          <StatCard label={dateMode === "day" ? "Onboarded Today" : "Onboarded This Week"} value={dashboard.onboardedInRange} color="#0ea5e9" />
          <StatCard label={dateMode === "day" ? "Hired Today" : "Hired This Week"} value={dashboard.hiredInRange} color="#8b5cf6" />
          <StatCard label="Total Hired" value={dashboard.totalHired} color="#22c55e" />
        </>}
        {loading && !dashboard && <CircularProgress size={24} />}
      </Stack>

      {/* Candidate list */}
      {loading ? (
        <Box sx={{ textAlign: "center", pt: 6 }}><CircularProgress /></Box>
      ) : candidates.length === 0 ? (
        <Box sx={{ textAlign: "center", pt: 8, opacity: 0.5 }}>
          <HireIcon sx={{ fontSize: 56, color: "text.secondary", mb: 2 }} />
          <Typography variant="body1" color="text.secondary">No candidates in onboarding.</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            Move candidates from the Hiring pipeline to get started.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {candidates.map(c => (
            <OnboardingRow key={c.id} candidate={c} onClick={() => setSelected(c)} />
          ))}
        </Stack>
      )}

      {/* Detail drawer */}
      <OnboardingDrawer
        candidate={selected}
        onClose={() => setSelected(null)}
        onRefresh={() => { if (selected) refreshSelected(selected.id); }}
        onHired={(staffId) => { setSelected(null); load(); nav(`/app/staff/${staffId}`); }}
        setError={setError}
      />
    </Box>
  );
}

// ─── Onboarding Row ───────────────────────────────────────────────────────────
function OnboardingRow({ candidate: c, onClick }: { candidate: CandidateDto; onClick: () => void }) {
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
      <Avatar sx={{ bgcolor: "#10b981", fontWeight: 700, width: 44, height: 44 }}>
        {initials(c)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography fontWeight={600} noWrap>{c.firstName} {c.lastName}</Typography>
          {c.position && <Chip label={c.position} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {c.email ?? c.phone ?? "No contact"} · Onboarding since {dayjs(c.onboardingStartedUtc).format("MMM D, YYYY")}
        </Typography>
      </Box>

      {/* Checklist status pills */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 280 }}>
        {c.checklistItems.slice(0, 5).map(item => (
          <Chip
            key={item.id}
            label={item.name}
            size="small"
            icon={item.isChecked
              ? <CheckCircleIcon sx={{ fontSize: "14px !important", color: "#10b981 !important" }} />
              : <CancelIcon sx={{ fontSize: "14px !important", color: "#ef4444 !important" }} />}
            sx={{ fontSize: 10, bgcolor: item.isChecked ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: item.isChecked ? "#10b981" : "#ef4444", border: "none" }}
          />
        ))}
        {c.checklistItems.length > 5 && (
          <Chip label={`+${c.checklistItems.length - 5} more`} size="small" sx={{ fontSize: 10 }} />
        )}
      </Stack>

      <Box sx={{ minWidth: 80, textAlign: "right" }}>
        <Typography variant="caption" fontWeight={600}
          sx={{ color: c.allChecked ? "#10b981" : "#f59e0b" }}>
          {checkedCount}/{totalCount}
        </Typography>
        <LinearProgress
          variant="determinate" value={c.checklistPct}
          sx={{ height: 5, borderRadius: 3, mt: 0.5, bgcolor: "rgba(255,255,255,0.1)",
            "& .MuiLinearProgress-bar": { bgcolor: c.allChecked ? "#10b981" : "#f59e0b" } }}
        />
      </Box>
    </Box>
  );
}

// ─── Onboarding Drawer ────────────────────────────────────────────────────────
function OnboardingDrawer({
  candidate, onClose, onRefresh, onHired, setError,
}: {
  candidate: CandidateDto | null;
  onClose: () => void;
  onRefresh: () => void;
  onHired: (staffId: string) => void;
  setError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const c = candidate;
  if (!c) return null;

  async function handleHire() {
    setBusy(true);
    try {
      const res = await hireCandidate(c.id);
      onHired(res.staffId);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to hire candidate.");
    } finally { setBusy(false); }
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

  return (
    <Drawer
      anchor="right"
      open={!!candidate}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, display: "flex", flexDirection: "column" } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar sx={{ bgcolor: "#10b981", width: 44, height: 44, fontWeight: 700 }}>{initials(c)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} noWrap>{c.firstName} {c.lastName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {c.position ?? "No position"} · Onboarding since {dayjs(c.onboardingStartedUtc).format("MMM D, YYYY")}
          </Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
        {/* Contact info */}
        {(c.email || c.phone) && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid", borderColor: "divider" }}>
            {c.email && <Typography variant="body2"><strong>Email:</strong> {c.email}</Typography>}
            {c.phone && <Typography variant="body2"><strong>Phone:</strong> {c.phone}</Typography>}
          </Box>
        )}

        {/* Checklist status — read-only on onboarding page */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Checklist Status
        </Typography>
        <LinearProgress
          variant="determinate" value={c.checklistPct}
          sx={{ mb: 2, height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.1)",
            "& .MuiLinearProgress-bar": { bgcolor: c.allChecked ? "#10b981" : "#f59e0b" } }}
        />
        <Stack spacing={0.75} sx={{ mb: 3 }}>
          {c.checklistItems.map(item => (
            <Stack key={item.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ p: 1.25, borderRadius: 1.5,
                bgcolor: item.isChecked ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.06)",
                border: "1px solid",
                borderColor: item.isChecked ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)" }}>
              {item.isChecked
                ? <CheckCircleIcon sx={{ color: "#10b981", fontSize: 20, flexShrink: 0 }} />
                : <CancelIcon sx={{ color: "#ef4444", fontSize: 20, flexShrink: 0 }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500}>{item.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.isChecked ? `Complete · ${dayjs(item.checkedUtc).format("MMM D")}` : "Incomplete"}
                </Typography>
              </Box>
              <Chip
                label={item.isChecked ? "Complete" : "Incomplete"}
                size="small"
                sx={{ fontSize: 10, fontWeight: 600,
                  bgcolor: item.isChecked ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                  color: item.isChecked ? "#10b981" : "#ef4444" }}
              />
            </Stack>
          ))}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Documents */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Documents ({c.documents.length})</Typography>
          <Button size="small" startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()} disabled={uploading} variant="outlined">
            Upload
          </Button>
          <input ref={fileInputRef} type="file" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ""; } }} />
        </Stack>

        {c.documents.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>No documents uploaded.</Typography>
        ) : (
          <Stack spacing={0.75}>
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
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Tooltip title={!c.allChecked ? "All checklist items must be complete before hiring" : ""} arrow>
          <span>
            <Button
              fullWidth variant="contained"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <HireIcon />}
              disabled={!c.allChecked || busy}
              onClick={handleHire}
              sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, py: 1.25, fontSize: 15, fontWeight: 700 }}
            >
              {c.allChecked ? "Hire & Add to Staff" : `Complete all items to hire (${c.checklistItems.filter(i => i.isChecked).length}/${c.checklistItems.length})`}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Drawer>
  );
}
