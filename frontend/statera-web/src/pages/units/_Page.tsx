// src/pages/units/index.tsx
import * as React from "react";
import {
  Box, Button, Container, Divider, MenuItem, Stack, TextField, Typography,
  Dialog, DialogContent, DialogTitle, DialogActions,
} from "@mui/material";

import { useFacility } from "../../context/facility";
import UnitsTable from "../../components/units/UnitsTable";
import UnitFormDialog, { UnitFormValues } from "../../components/units/UnitFormDialog";

import {
  listUnits, createUnit, updateUnit, deleteUnit, normalizeUnitPayload, UNIT_TYPES
} from "../../api/units";
import type {
  UnitDto, CreateUnitUnderFacilityRequest, UpdateUnitRequest, UnitType, Unit
} from "../../api/units";



import type { Facility } from "../../api/facilities/types";

export default function UnitsPage() {
  const { facilities, selected, setSelectedId, loading: loadingFacilities } = useFacility();

  const [rows, setRows] = React.useState<UnitDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<UnitDto | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UnitDto | null>(null);

  const currentFacilityId = selected?.id ?? "";

  const load = async (facilityId: string) => {
    if (!facilityId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listUnits(facilityId);
      setRows(data);
    } catch (e) {
      console.error("Failed to load units", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (currentFacilityId) load(currentFacilityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFacilityId]);

  const onCreate = async (values: UnitFormValues) => {
    if (!currentFacilityId) return;

    const payload: CreateUnitUnderFacilityRequest = {
      name: values.name.trim(),
      type: values.type?.trim() || null,
      floor: values.floor?.trim() || null,
      capacity:
        values.capacity === undefined || values.capacity === null || (values.capacity as any) === ""
          ? null
          : Number(values.capacity),
      notes: values.notes?.trim() || null,
      isActive: Boolean(values.isActive),
    };

    await createUnit(currentFacilityId, payload);
    setCreateOpen(false);
    await load(currentFacilityId);
  };

  const onEditSave = async (values: UnitFormValues) => {
    if (!editTarget) return;

    const delta: UpdateUnitRequest = {
      name: values.name?.trim(),
      type: values.type?.trim() || null,
      floor: values.floor?.trim() || null,
      capacity:
        values.capacity === undefined || values.capacity === null || (values.capacity as any) === ""
          ? null
          : Number(values.capacity),
      notes: values.notes?.trim() || null,
      isActive: Boolean(values.isActive),
      // facilityId is not needed for update unless you support moving units across facilities
    };

    const updated = await updateUnit(editTarget.id, delta);
    setEditTarget(null);

    // refresh list (or update locally)
    await load(currentFacilityId);
    // Or optimistic update:
    // setRows(r => r.map(u => (u.id === updated.id ? updated : u)));
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    await deleteUnit(deleteTarget.id);
    setDeleteTarget(null);
    await load(currentFacilityId);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Units</Typography>
        <Stack direction="row" spacing={2}>
          {facilities.length > 1 && (
            <TextField
              select
              label="Facility"
              size="small"
              value={selected?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              sx={{ minWidth: 260 }}
              disabled={loadingFacilities}
            >
              {facilities.map((f: Facility) => (
                <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
              ))}
            </TextField>
          )}
          <Button variant="contained" onClick={() => setCreateOpen(true)}>New Unit</Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Box>
        <UnitsTable
          rows={rows}
          onEdit={(u) => setEditTarget(u)}
          onDelete={(u) => setDeleteTarget(u)}
        />
        {loading && <Typography mt={2} color="text.secondary">Loading units…</Typography>}
      </Box>

      {/* Create */}
      <UnitFormDialog
        open={createOpen}
        mode="create"
        onCancel={() => setCreateOpen(false)}
        onSave={onCreate}
      />

      {/* Edit */}
      <UnitFormDialog
        open={!!editTarget}
        mode="edit"
        initial={editTarget ?? undefined}
        onCancel={() => setEditTarget(null)}
        onSave={onEditSave}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Unit</DialogTitle>
        <DialogContent>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={doDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
