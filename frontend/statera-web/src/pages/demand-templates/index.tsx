// src/pages/demand-templates/index.tsx
import * as React from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, FormControl, IconButton, InputLabel, MenuItem,
  Pagination, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EventNoteIcon from "@mui/icons-material/EventNote";
import SearchIcon from "@mui/icons-material/Search";
import {
  listDemandTemplates, deleteDemandTemplate, DemandTemplate, DemandTemplateStatus, Guid,
} from "../../api/demandTemplates";
import { useNavigate } from "react-router-dom";
import { useFacility } from "../../context/facility";
import { useAuth } from "../../auth/useAuth";
import { listUnits } from "../../api/units";

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_META: Record<DemandTemplateStatus, { bg: string; color: string; border: string; leftBorder: string }> = {
  Draft:     { bg: "rgba(120,120,120,0.08)", color: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.18)", leftBorder: "rgba(255,255,255,0.15)" },
  Review:    { bg: "rgba(2,136,209,0.08)",   color: "#90caf9",              border: "rgba(2,136,209,0.3)",    leftBorder: "#0288d1" },
  Approved:  { bg: "rgba(46,125,50,0.08)",   color: "#a5d6a7",              border: "rgba(46,125,50,0.3)",    leftBorder: "#2e7d32" },
  Published: { bg: "rgba(0,137,123,0.1)",    color: "#4db6ac",              border: "rgba(0,137,123,0.35)",   leftBorder: "#00897b" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemandTemplatesListPage() {
  const navigate = useNavigate();
  const { facilities, selected, setSelectedId } = useFacility();
  const { user }    = useAuth();
  const isOwner     = user?.systemRole === "Owner";
  const facilityId  = selected?.id as Guid | undefined;

  const [q, setQ]           = React.useState("");
  const [status, setStatus] = React.useState<DemandTemplateStatus | "">("");
  const [page, setPage]     = React.useState(1);
  const [pageSize]          = React.useState(10);
  const [rows, setRows]     = React.useState<DemandTemplate[]>([]);
  const [total, setTotal]   = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [unitMap, setUnitMap] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await listDemandTemplates(
        facilityId,
        q || undefined,
        (status || undefined) as DemandTemplateStatus | undefined,
        page, pageSize,
      );
      setRows(res.items);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, [facilityId, q, status, page, pageSize]);

  React.useEffect(() => {
    if (!facilityId) return;
    listUnits(facilityId)
      .then(units => {
        const map: Record<string, string> = {};
        units.forEach(u => { map[u.id] = u.name; });
        setUnitMap(map);
      })
      .catch(() => {});
  }, [facilityId]);

  React.useEffect(() => { load(); }, [load]);

  const onDelete = async (id: Guid) => {
    if (!confirm("Delete this template?")) return;
    await deleteDemandTemplate(id);
    await load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
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
                <EventNoteIcon sx={{ color: "#4db6ac", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Demand Templates</Typography>
                {total > 0 && !loading && (
                  <Typography variant="caption" color="text.secondary">
                    {total} template{total !== 1 ? "s" : ""}
                  </Typography>
                )}
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
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate("/demand-templates/new")}
                disabled={!facilityId}
                sx={{ bgcolor: "#00897b", "&:hover": { bgcolor: "#00796b" } }}
              >
                New Template
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Filters ── */}
      <Card variant="outlined" sx={{ mb: 2, borderColor: "rgba(255,255,255,0.06)" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" flexWrap="wrap">
            <TextField
              size="small" label="Search name or role" value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} /> }}
            />
            <TextField
              select size="small" label="Status" value={status}
              onChange={e => { setStatus(e.target.value as any); setPage(1); }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              {(["Draft", "Review", "Approved", "Published"] as DemandTemplateStatus[]).map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            {(q || status) && (
              <Button size="small" sx={{ color: "text.secondary", fontSize: 12 }}
                onClick={() => { setQ(""); setStatus(""); setPage(1); }}>
                Clear
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {!facilityId && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>Select a facility to view demand templates.</Alert>
      )}

      {/* ── Table ── */}
      {facilityId && (
        <Box sx={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 1.5, overflow: "hidden" }}>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow sx={{
                  "& th": {
                    bgcolor: "rgba(0,55,55,0.55)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                    py: 1.25,
                    whiteSpace: "nowrap",
                  },
                }}>
                  <TableCell sx={{ pl: 2 }}>Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" sx={{ pr: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, border: 0 }}>
                      <CircularProgress size={26} sx={{ color: "#4db6ac" }} />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 8, border: 0 }}>
                      <EventNoteIcon sx={{ fontSize: 40, color: "text.disabled", opacity: 0.25, mb: 1, display: "block", mx: "auto" }} />
                      <Typography color="text.secondary" variant="body2">
                        {q || status ? "No templates match the current filters." : "No demand templates yet. Create one to get started."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(r => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.Draft;
                    return (
                      <TableRow
                        key={r.id}
                        hover
                        sx={{
                          borderLeft: `3px solid ${meta.leftBorder}`,
                          "& td": { borderBottom: "1px solid rgba(255,255,255,0.05)", py: 1.25 },
                          "&:last-child td": { borderBottom: 0 },
                          "&:hover": { bgcolor: "rgba(255,255,255,0.025) !important" },
                        }}
                      >
                        {/* Name */}
                        <TableCell sx={{ pl: 2 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {r.name}
                          </Typography>
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          {r.role ? (
                            <Chip label={r.role} size="small" variant="outlined"
                              sx={{ height: 20, fontSize: 11, borderColor: "rgba(255,255,255,0.15)" }} />
                          ) : (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          )}
                        </TableCell>

                        {/* Unit */}
                        <TableCell>
                          <Typography variant="body2" color={r.unitId ? "text.primary" : "text.disabled"}>
                            {r.unitId ? (unitMap[r.unitId] ?? r.unitId.slice(0, 8) + "…") : "—"}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            label={r.status}
                            size="small"
                            sx={{
                              height: 20, fontSize: 11,
                              bgcolor: meta.bg,
                              color: meta.color,
                              border: `1px solid ${meta.border}`,
                            }}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="right" sx={{ pr: 1.5 }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/demand-templates/${r.id}`)}
                                sx={{
                                  color: "rgba(255,255,255,0.4)",
                                  "&:hover": { color: "#4db6ac", bgcolor: "rgba(0,137,123,0.1)" },
                                }}
                              >
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => onDelete(r.id)}
                                sx={{
                                  color: "rgba(255,255,255,0.3)",
                                  "&:hover": { color: "#ef9a9a", bgcolor: "rgba(198,40,40,0.1)" },
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <Box sx={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              bgcolor: "rgba(0,20,20,0.3)",
              px: 2, py: 1,
              display: "flex", justifyContent: "flex-end",
            }}>
              <Pagination
                page={page}
                count={totalPages}
                onChange={(_, p) => setPage(p)}
                size="small"
                sx={{
                  "& .MuiPaginationItem-root": {
                    color: "rgba(255,255,255,0.5)",
                    "&:hover": { bgcolor: "rgba(0,137,123,0.15)", color: "#4db6ac" },
                    "&.Mui-selected": { bgcolor: "rgba(0,137,123,0.25)", color: "#4db6ac", border: "1px solid rgba(0,137,123,0.4)" },
                  },
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
}
