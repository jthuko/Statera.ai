// src/pages/demand-templates/editor.tsx
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, Container, Stack, Typography, Alert, Snackbar
} from "@mui/material";
import DemandTemplateForm from "../../components/demand-templates/DemandTemplateForm";
import ApplyToRangeDialog from "../../components/demand-templates/ApplyToRangeDialog";
import ValidationPanel from "../../components/demand-templates/ValidationPanel";
import StatusChip from "../../components/demand-templates/StatusChip";
import {
  createDemandTemplate,
  updateDemandTemplate,
  getDemandTemplate,
  validateDemandTemplate,
  approveDemandTemplate,
  publishDemandTemplate,
  applyTemplateToRange,
  type DemandTemplate,
  type CreateDemandTemplateRequest,
  type UpdateDemandTemplateRequest,
  type ValidationIssue,
  type Guid,
} from "../../api/demandTemplates";
import { useFacility } from "../../context/facility";

export default function DemandTemplateEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // "new" or Guid
  const isNew = id === "new";
  const { selected } = useFacility();
  const facilityId = selected?.id as Guid;

  const [model, setModel] = React.useState<DemandTemplate | null>(null);
  const [issues, setIssues] = React.useState<ValidationIssue[]>([]);
  const [applyOpen, setApplyOpen] = React.useState<boolean>(false);
  const [toast, setToast] = React.useState<string>("");

  const load = React.useCallback(async () => {
    if (isNew) return;
    const data = await getDemandTemplate(id as Guid);
    setModel(data);
  }, [id, isNew]);

  React.useEffect(() => {
    if (!isNew) load();
  }, [isNew, load]);

  const handleSubmit = async (payload: CreateDemandTemplateRequest | UpdateDemandTemplateRequest) => {
    if (isNew) {
      const created = await createDemandTemplate(payload as CreateDemandTemplateRequest);
      setToast("Template created.");
      navigate(`/demand-templates/${created.id}`);
    } else {
      const updated = await updateDemandTemplate(id as Guid, payload as UpdateDemandTemplateRequest);
      setModel(updated);
      setToast("Changes saved.");
    }
  };

  const handleValidate = async () => {
    const list = await validateDemandTemplate((isNew ? (model?.id as Guid) : (id as Guid)) ?? (id as Guid));
    setIssues(list);
    setToast("Validation complete.");
  };

  const handleApprove = async () => {
    const updated = await approveDemandTemplate(id as Guid);
    setModel(updated);
    setToast("Template approved.");
  };

  const handlePublish = async () => {
    const updated = await publishDemandTemplate(id as Guid);
    setModel(updated);
    setToast("Template published.");
  };

  const handleApply = async (payload: Parameters<typeof applyTemplateToRange>[1]) => {
    await applyTemplateToRange(id as Guid, payload);
    setToast("Applied to range.");
  };

  const headerTitle = isNew ? "New Demand Template" : model?.name ?? "Loading...";

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">{headerTitle}</Typography>
        {!isNew && model && <StatusChip status={model.status} />}
        <Box sx={{ flexGrow: 1 }} />
        {!isNew && (
          <Button variant="outlined" onClick={() => setApplyOpen(true)}>Apply to Range</Button>
        )}
      </Stack>

      {isNew && !facilityId && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No facility selected — select a facility to create a template under it.
        </Alert>
      )}

      <DemandTemplateForm
        mode={isNew ? "create" : "edit"}
        value={model ?? undefined}
        facilityId={facilityId as Guid}
        onSubmit={handleSubmit}
        onValidate={!isNew ? handleValidate : undefined}
        onApprove={!isNew ? handleApprove : undefined}
        onPublish={!isNew ? handlePublish : undefined}
      />

      <ValidationPanel issues={issues} />

      <ApplyToRangeDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApply={handleApply}
        defaultRole={model?.role ?? null}
        defaultUnitId={model?.unitId ?? null}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast("")}
        message={toast}
      />
    </Container>
  );
}
