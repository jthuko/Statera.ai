import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Container, Snackbar,
  Stack, Typography, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RuleIcon from "@mui/icons-material/Rule";
import {
  ConstraintDto, CreateConstraintRequest, UpdateConstraintRequest,
  listConstraints, createConstraint, updateConstraint, deleteConstraint,
} from "../../api/constraints";
import { listUnits } from "../../api/units";
import ConstraintsTable from "../../components/constraints/ConstraintsTable";
import ConstraintFormDialog from "../../components/constraints/ConstraintFormDialog";
import { useFacility } from "../../context/facility";

type DialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; row: ConstraintDto };

export default function ConstraintsRulesPage() {
  const { facilities, selected: facility, setSelectedId } = useFacility();
  const facilityId = facility?.id ?? "";

  const [rows, setRows]       = useState<ConstraintDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [units, setUnits]     = useState<{ id: string; name: string }[]>([]);
  const [dialog, setDialog]   = useState<DialogState>({ mode: "closed" });
  const [toast, setToast]     = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const reload = useCallback(async () => {
    if (!facilityId) { setRows([]); return; }
    setLoading(true);
    try {
      const data = await listConstraints(facilityId);
      setRows(data);
    } catch {
      setToast({ msg: "Failed to load constraints", sev: "error" });
    } finally { setLoading(false); }
  }, [facilityId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!facilityId) { setUnits([]); return; }
    listUnits(facilityId)
      .then(u => setUnits(u.map(x => ({ id: x.id, name: x.name }))))
      .catch(() => setUnits([]));
  }, [facilityId]);

  async function handleCreate(payload: CreateConstraintRequest | UpdateConstraintRequest) {
    try {
      await createConstraint(facilityId, payload as CreateConstraintRequest);
      setToast({ msg: "Constraint created.", sev: "success" });
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? "Failed to create constraint.", sev: "error" });
    }
  }

  async function handleEdit(payload: CreateConstraintRequest | UpdateConstraintRequest) {
    if (dialog.mode !== "edit") return;
    try {
      await updateConstraint(facilityId, dialog.row.id, payload as UpdateConstraintRequest);
      setToast({ msg: "Constraint updated.", sev: "success" });
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? "Failed to update constraint.", sev: "error" });
    }
  }

  async function handleDelete(row: ConstraintDto) {
    if (!confirm(`Delete this ${row.type} constraint?`)) return;
    try {
      await deleteConstraint(facilityId, row.id);
      setToast({ msg: "Constraint deleted.", sev: "success" });
      reload();
    } catch {
      setToast({ msg: "Failed to delete constraint.", sev: "error" });
    }
  }

  const activeCount   = rows.filter(r => r.isActive).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>

      {/* ── Header ── */}
      <Card variant="outlined" sx={{
        mb: 2.5,
        background: "linear-gradient(90deg, rgba(0,77,77,0.4) 0%, rgba(0,77,77,0.08) 100%)",
        borderColor: "rgba(0,137,123,0.25)",
      }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={2}>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{
                width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.3)",
              }}>
                <RuleIcon sx={{ color: "#4db6ac", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Constraints & Rules</Typography>
                {facilityId && !loading && (
                  <Typography variant="caption" color="text.secondary">
                    {activeCount} active · {inactiveCount} inactive · {rows.length} total
                  </Typography>
                )}
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>Facility</InputLabel>
                <Select label="Facility" value={facilityId}
                  onChange={e => setSelectedId(String(e.target.value))}>
                  {facilities.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                disabled={!facilityId}
                onClick={() => setDialog({ mode: "create" })}
              >
                New Rule
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {!facilityId && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Select a facility above to view and manage its scheduling rules.
        </Alert>
      )}

      {/* ── Table ── */}
      <ConstraintsTable
        loading={loading}
        rows={rows}
        units={units}
        onEdit={row => setDialog({ mode: "edit", row })}
        onDelete={handleDelete}
      />

      <ConstraintFormDialog
        open={dialog.mode === "create"}
        title="New Constraint" submitLabel="Create"
        units={units}
        onClose={() => setDialog({ mode: "closed" })}
        onSubmit={handleCreate}
      />

      {dialog.mode === "edit" && (
        <ConstraintFormDialog
          open title="Edit Constraint" submitLabel="Save"
          units={units} initial={dialog.row}
          onClose={() => setDialog({ mode: "closed" })}
          onSubmit={handleEdit}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)}>
        <Alert severity={toast?.sev ?? "success"} onClose={() => setToast(null)} sx={{ width: "100%" }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
