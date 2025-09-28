import * as React from "react";
import {
  Box,
  IconButton,
  Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip,
  Chip,
  Stack,
  Typography
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import type { Unit} from "../../api/units";

type Props = {
  rows: Unit[];
  onEdit: (u: Unit) => void;
  onDelete: (u: Unit) => void;
};

export default function UnitsTable({ rows, onEdit, onDelete }: Props) {
  return (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Floor</TableCell>
            <TableCell align="right">Capacity</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Box p={3} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    No units yet.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
          {rows.map((u) => (
            <TableRow key={u.id} hover>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.type}</TableCell>
              <TableCell>{u.floor ?? "-"}</TableCell>
              <TableCell align="right">{u.capacity ?? "-"}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={u.isActive ? "Active" : "Inactive"} color={u.isActive ? "success" : "default"} />
                </Stack>
              </TableCell>
              <TableCell sx={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {u.notes ?? ""}
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => onEdit(u)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => onDelete(u)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
