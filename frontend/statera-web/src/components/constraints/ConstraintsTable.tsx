// src/components/constraints/ConstraintsTable.tsx
import * as React from "react";
import {
  Paper, Toolbar, Typography, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Button, Chip, Stack, CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  ConstraintDto, Guid,
} from "../../api/constraints";

export default function ConstraintsTable(props: {
  loading: boolean;
  rows: ConstraintDto[];
  onCreate: () => void;
  onEdit: (row: ConstraintDto) => void;
  onDelete: (row: ConstraintDto) => void;
}) {
  const { loading, rows, onCreate, onEdit, onDelete } = props;

  return (
    <Paper elevation={1}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h6">Constraints & Rules</Typography>
        <Tooltip title="Create rule">
          <span>
            <IconButton color="primary" onClick={onCreate}>
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Toolbar>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Scope</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2">Loading…</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" sx={{ py: 3 }}>
                    No constraints yet. Click + to create your first rule.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.scope}</TableCell>
                  <TableCell>{r.unitId ?? ""}</TableCell>
                  <TableCell>{r.role ?? ""}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>
                    <code style={{ fontSize: 12 }}>{r.value}</code>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={r.isActive ? "Active" : "Inactive"}
                      color={r.isActive ? "success" : "default"}
                      variant={r.isActive ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell>{r.updatedOn ?? r.createdOn}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton size="small" onClick={() => onEdit(r)}><EditIcon fontSize="small"/></IconButton>
                      <IconButton size="small" color="error" onClick={() => onDelete(r)}><DeleteIcon fontSize="small"/></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
