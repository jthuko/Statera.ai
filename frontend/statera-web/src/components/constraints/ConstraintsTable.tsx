// src/components/constraints/ConstraintsTable.tsx
import * as React from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, IconButton,
  Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RuleIcon from "@mui/icons-material/Rule";
import dayjs from "dayjs";
import { ConstraintDto } from "../../api/constraints";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_META: Record<string, { bg: string; color: string; border: string }> = {
  Facility: { bg: "rgba(0,137,123,0.15)", color: "#4db6ac",  border: "rgba(0,137,123,0.35)" },
  Unit:     { bg: "rgba(21,101,192,0.15)", color: "#90caf9", border: "rgba(21,101,192,0.35)" },
  Role:     { bg: "rgba(106,27,154,0.15)", color: "#ce93d8", border: "rgba(106,27,154,0.35)" },
};

// Human-friendly labels for constraint types
const TYPE_LABELS: Record<string, string> = {
  MaxHoursPerWeek:            "Max hrs / week",
  MinRestBetweenShiftsHours:  "Min rest (hrs)",
  MaxConsecutiveDays:         "Max consec. days",
  OvertimeCapHours:           "Overtime cap (hrs)",
  LicenseRequired:            "License required",
  UnitCoverageRatio:          "Coverage ratio",
  ShiftPreference:            "Shift preference",
  MinStaffPerDay:             "Min staff / day",
  MinStaffPerShift:           "Min staff / shift",
  RequiredHeadcount:          "Required headcount",
};

function fmtType(t: string) {
  return TYPE_LABELS[t] ?? t;
}

function fmtDate(iso?: string | null) {
  return iso ? dayjs(iso).format("MMM D, YYYY") : "—";
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConstraintsTableProps {
  loading: boolean;
  rows: ConstraintDto[];
  units?: { id: string; name: string }[];
  onEdit: (row: ConstraintDto) => void;
  onDelete: (row: ConstraintDto) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConstraintsTable({ loading, rows, units = [], onEdit, onDelete }: ConstraintsTableProps) {
  const unitMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    units.forEach(u => (m[u.id] = u.name));
    return m;
  }, [units]);

  return (
    <Box sx={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 1.5, overflow: "hidden" }}>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 680 }}>

          {/* ── Header ── */}
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
              <TableCell sx={{ pl: 2 }}>Scope</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right" sx={{ pr: 2 }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          {/* ── Body ── */}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6, border: 0 }}>
                  <CircularProgress size={26} sx={{ color: "#4db6ac" }} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8, border: 0 }}>
                  <RuleIcon sx={{ fontSize: 40, color: "text.disabled", opacity: 0.25, mb: 1, display: "block", mx: "auto" }} />
                  <Typography color="text.secondary" variant="body2">
                    No constraints yet. Click <strong>New Rule</strong> to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map(r => {
                const scopeMeta = SCOPE_META[r.scope] ?? SCOPE_META.Facility;
                const unitName  = r.unitId ? (unitMap[r.unitId] ?? r.unitId.slice(0, 8) + "…") : "—";
                const borderColor = r.isActive ? "#00897b" : "rgba(255,255,255,0.08)";

                return (
                  <TableRow
                    key={r.id}
                    hover
                    sx={{
                      borderLeft: `3px solid ${borderColor}`,
                      "& td": { borderBottom: "1px solid rgba(255,255,255,0.05)", py: 1.25 },
                      "&:last-child td": { borderBottom: 0 },
                      "&:hover": { bgcolor: "rgba(255,255,255,0.025) !important" },
                    }}
                  >
                    {/* Scope */}
                    <TableCell sx={{ pl: 2 }}>
                      <Chip
                        label={r.scope}
                        size="small"
                        sx={{
                          height: 20, fontSize: 11,
                          bgcolor: scopeMeta.bg,
                          color: scopeMeta.color,
                          border: `1px solid ${scopeMeta.border}`,
                        }}
                      />
                    </TableCell>

                    {/* Unit */}
                    <TableCell>
                      <Typography variant="body2" color={unitName === "—" ? "text.disabled" : "text.primary"}>
                        {unitName}
                      </Typography>
                    </TableCell>

                    {/* Role */}
                    <TableCell>
                      {r.role ? (
                        <Chip
                          label={r.role}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11, borderColor: "rgba(255,255,255,0.15)" }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} noWrap>
                        {fmtType(r.type)}
                      </Typography>
                    </TableCell>

                    {/* Value */}
                    <TableCell>
                      <Chip
                        label={r.value}
                        size="small"
                        sx={{
                          bgcolor: "rgba(0,77,77,0.35)", color: "#4db6ac",
                          border: "1px solid rgba(0,137,123,0.3)",
                          fontWeight: 700, fontSize: 12, height: 22,
                        }}
                      />
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.isActive ? "Active" : "Inactive"}
                        color={r.isActive ? "success" : "default"}
                        variant={r.isActive ? "filled" : "outlined"}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    </TableCell>

                    {/* Notes */}
                    <TableCell sx={{ maxWidth: 160 }}>
                      {r.notes ? (
                        <Tooltip title={r.notes} arrow>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 150 }}>
                            {r.notes}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* Updated */}
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDate(r.updatedOn ?? r.createdOn)}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" sx={{ pr: 1.5 }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => onEdit(r)}
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
                            onClick={() => onDelete(r)}
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
    </Box>
  );
}
