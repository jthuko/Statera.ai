// src/pages/demand-templates/index.tsx
import * as React from "react";
import {
  Box, Button, Container, Divider, FormControl, IconButton, InputLabel,
  MenuItem, Pagination, Paper, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Toolbar, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StatusChip from "../../components/demand-templates/StatusChip";
import {
  listDemandTemplates, deleteDemandTemplate, DemandTemplate, DemandTemplateStatus, Guid
} from "../../api/demandTemplates";
import { useNavigate } from "react-router-dom";
import { useFacility } from "../../context/facility";
import { useAuth } from "../../auth/useAuth";
import { listUnits } from "../../api/units";

export default function DemandTemplatesListPage() {
  const navigate = useNavigate();
  const { facilities, selected, setSelectedId } = useFacility();
  const { user } = useAuth();
  const isOwner = user?.systemRole === "Owner";

  const facilityId = selected?.id as Guid | undefined;

  const [q, setQ] = React.useState<string>("");
  const [status, setStatus] = React.useState<DemandTemplateStatus | "">("");
  const [page, setPage] = React.useState<number>(1);
  const [pageSize] = React.useState<number>(10);
  const [rows, setRows] = React.useState<DemandTemplate[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [unitMap, setUnitMap] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await listDemandTemplates(
        facilityId,
        q || undefined,
        (status || undefined) as DemandTemplateStatus | undefined,
        page,
        pageSize
      );
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [facilityId, q, status, page, pageSize]);

  // Load unit names whenever facility changes
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
      <Toolbar disableGutters sx={{ gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Demand Templates</Typography>

        {/* Facility selector — Owners only */}
        {isOwner && (
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Facility</InputLabel>
            <Select
              label="Facility"
              value={facilityId ?? ""}
              onChange={e => setSelectedId(String(e.target.value))}
            >
              {facilities.map(f => (
                <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/demand-templates/new")}
          disabled={!facilityId}
        >
          New Template
        </Button>
      </Toolbar>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField
            label="Search name or role"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Status"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Review">Review</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Published">Published</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.role || "—"}</TableCell>
                <TableCell>{r.unitId ? (unitMap[r.unitId] ?? r.unitId) : "—"}</TableCell>
                <TableCell><StatusChip status={r.status} /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/demand-templates/${r.id}`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => onDelete(r.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                    {loading ? "Loading…" : facilityId ? "No templates yet." : "Select a facility to view templates."}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Divider />
        <Stack direction="row" justifyContent="flex-end" p={2}>
          <Pagination
            page={page}
            count={totalPages}
            onChange={(_, p) => setPage(p)}
            color="primary"
            size="small"
          />
        </Stack>
      </Paper>
    </Container>
  );
}
