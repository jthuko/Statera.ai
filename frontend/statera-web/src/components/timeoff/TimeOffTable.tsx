// src/components/timeoff/TimeOffTable.tsx
import * as React from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, IconButton,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead,
  TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import FilterListIcon from "@mui/icons-material/FilterList";
import dayjs from "dayjs";

import { listTimeOff, TimeOffRequestDto, TimeOffStatus } from "../../api/timeoff";
import TimeOffReviewDialog from "./TimeOffReviewDialog";

interface Props {
  facilityId?: string;
  unitId?: string;
  staffId?: string;
}

const STATUS_META: Record<TimeOffStatus, { color: "default" | "warning" | "success" | "error"; border: string; bg: string }> = {
  Pending:   { color: "warning", border: "#f57c00", bg: "rgba(245,124,0,0.06)" },
  Approved:  { color: "success", border: "#2e7d32", bg: "rgba(46,125,50,0.06)" },
  Denied:    { color: "error",   border: "#c62828", bg: "rgba(198,40,40,0.06)" },
  Cancelled: { color: "default", border: "rgba(255,255,255,0.08)", bg: "transparent" },
};

const TYPE_COLOR: Record<string, string> = {
  Vacation: "#00897b", Sick: "#c62828", Personal: "#1565c0",
  Unpaid: "#6a1b9a", Other: "#455a64",
};

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

export default function TimeOffTable({ facilityId, unitId, staffId }: Props) {
  const [status, setStatus] = React.useState<TimeOffStatus | "All">("All");
  const [q, setQ]           = React.useState("");
  const [page, setPage]     = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [rows, setRows]     = React.useState<TimeOffRequestDto[]>([]);
  const [total, setTotal]   = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [reviewing, setReviewing] = React.useState<TimeOffRequestDto | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTimeOff({
        facilityId, unitId, staffId,
        status: status === "All" ? undefined : status,
        q: q || undefined,
        page: page + 1,
        pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [facilityId, unitId, staffId, status, q, page, pageSize]);

  React.useEffect(() => { load(); }, [load]);

  // Pending count badge
  const pendingCount = rows.filter(r => r.status === "Pending").length;

  return (
    <Box>
      {/* ── Filter bar ── */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
        flexWrap="wrap"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <FilterListIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }} />
          <TextField
            select label="Status" size="small" value={status}
            onChange={e => { setStatus(e.target.value as any); setPage(0); }}
            sx={{ minWidth: 150 }}
          >
            {(["All", "Pending", "Approved", "Denied", "Cancelled"] as const).map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            placeholder="Search name or reason…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(0); }}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.disabled", mr: 0.5 }} />,
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {pendingCount > 0 && (
            <Chip
              label={`${pendingCount} pending review`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
          {total > 0 && (
            <Chip
              label={`${total} total`}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: 11, borderColor: "rgba(255,255,255,0.12)", color: "text.secondary" }}
            />
          )}
        </Stack>
      </Stack>

      {/* ── Table ── */}
      <Box sx={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 1.5, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
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
                <TableCell sx={{ pl: 2 }}>Staff</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right" sx={{ pr: 2 }}>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, border: 0 }}>
                    <CircularProgress size={26} sx={{ color: "#4db6ac" }} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, border: 0 }}>
                    <BeachAccessIcon sx={{ fontSize: 40, color: "text.disabled", opacity: 0.25, mb: 1, display: "block", mx: "auto" }} />
                    <Typography color="text.secondary" variant="body2">
                      {status === "All" && !q ? "No time off requests found." : "No results match the current filters."}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(row => {
                  const meta      = STATUS_META[row.status] ?? STATUS_META.Cancelled;
                  const typeColor = TYPE_COLOR[row.type] ?? "#455a64";
                  const days      = Math.max(1, dayjs(row.endUtc).diff(dayjs(row.startUtc), "day"));
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        borderLeft: `3px solid ${meta.border}`,
                        background: meta.bg,
                        "& td": { borderBottom: "1px solid rgba(255,255,255,0.05)", py: 1.25 },
                        "&:last-child td": { borderBottom: 0 },
                        "&:hover": { bgcolor: "rgba(255,255,255,0.03) !important" },
                      }}
                    >
                      {/* Staff */}
                      <TableCell sx={{ pl: 2, pr: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{
                            width: 28, height: 28, fontSize: 10, fontWeight: 700, flexShrink: 0,
                            bgcolor: "rgba(0,137,123,0.2)", color: "#4db6ac",
                            border: "1px solid rgba(0,137,123,0.3)",
                          }}>
                            {getInitials(row.staffName)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 150 }}>
                            {row.staffName}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <Chip
                          label={row.type}
                          size="small"
                          sx={{
                            height: 20, fontSize: 11,
                            bgcolor: `${typeColor}20`,
                            color: typeColor,
                            border: `1px solid ${typeColor}44`,
                          }}
                        />
                      </TableCell>

                      {/* Period */}
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {dayjs(row.startUtc).format("MMM D")} – {dayjs(row.endUtc).format("MMM D, YYYY")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {days} day{days !== 1 ? "s" : ""}
                        </Typography>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Chip
                          label={row.status}
                          size="small"
                          color={meta.color}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </TableCell>

                      {/* Reason */}
                      <TableCell sx={{ maxWidth: 200 }}>
                        {row.reason ? (
                          <Tooltip title={row.reason} arrow>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 180 }}>
                              {row.reason}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Action */}
                      <TableCell align="right" sx={{ pr: 2 }}>
                        {row.status === "Pending" ? (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => setReviewing(row)}
                            sx={{
                              bgcolor: "#00897b", "&:hover": { bgcolor: "#00796b" },
                              fontSize: 11, py: 0.4, px: 1.5, minWidth: 0,
                            }}
                          >
                            Review
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setReviewing(row)}
                            sx={{
                              borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                              fontSize: 11, py: 0.4, px: 1.5, minWidth: 0,
                              "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" },
                            }}
                          >
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>

        {/* ── Pagination ── */}
        {total > 0 && (
          <Box sx={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            bgcolor: "rgba(0,20,20,0.3)",
          }}>
            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              sx={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                "& .MuiTablePagination-selectIcon": { color: "rgba(255,255,255,0.5)" },
                "& .MuiIconButton-root": { color: "rgba(255,255,255,0.5)", "&:hover": { color: "#4db6ac" } },
                "& .Mui-disabled": { opacity: 0.3 },
              }}
            />
          </Box>
        )}
      </Box>

      <TimeOffReviewDialog
        open={!!reviewing}
        request={reviewing}
        onClose={() => setReviewing(null)}
        onRefresh={load}
      />
    </Box>
  );
}
