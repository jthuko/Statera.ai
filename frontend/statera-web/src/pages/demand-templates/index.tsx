// src/pages/demand-templates/index.tsx
import * as React from "react";
import {
  Box, Button, Container, Divider, IconButton, Pagination, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Toolbar, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StatusChip from "../../components/demand-templates/StatusChip";
import {
  listDemandTemplates, deleteDemandTemplate, DemandTemplate, DemandTemplateStatus, Guid
} from "../../api/demandTemplates";
import { useNavigate } from "react-router-dom";
import { useFacility } from "../../context/facility"; // assumes you have this context

export default function DemandTemplatesListPage() {
  const navigate = useNavigate();
  const { selected } = useFacility(); // facility.id: Guid
  const facilityId = selected?.id as Guid;

  const [q, setQ] = React.useState<string>("");
  const [status, setStatus] = React.useState<DemandTemplateStatus | "">("");
  const [page, setPage] = React.useState<number>(1);
  const [pageSize] = React.useState<number>(10);
  const [rows, setRows] = React.useState<DemandTemplate[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(false);

  const load = React.useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await listDemandTemplates(facilityId, q || undefined, (status || undefined) as DemandTemplateStatus | undefined, page, pageSize);
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [facilityId, q, status, page, pageSize]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (id: Guid) => {
    if (!confirm("Delete this template?")) return;
    await deleteDemandTemplate(id);
    await load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Toolbar disableGutters>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Demand Templates</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/demand-templates/new")}
        >
          New Template
        </Button>
      </Toolbar>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, role..."
            fullWidth
          />
          <TextField
            label="Status"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            sx={{ minWidth: 200 }}
          >
            <option value=""></option>
            <option value="Draft">Draft</option>
            <option value="Review">Review</option>
            <option value="Approved">Approved</option>
            <option value="Published">Published</option>
          </TextField>
          <Button variant="outlined" onClick={() => { setPage(1); load(); }}>
            Apply
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>UnitId</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.role || "-"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{r.unitId || "-"}</TableCell>
                <TableCell><StatusChip status={r.status} /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/demand-templates/${r.id}`)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => onDelete(r.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}

            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                    {loading ? "Loading..." : "No templates yet."}
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
