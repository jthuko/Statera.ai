import { useMemo } from "react";
import { Box, Chip, Divider, IconButton, MenuItem, Stack, TextField, Tooltip } from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import RuleCard from "./RuleCard";
import { LicenseRequirement } from "../../api/rules/types";

export default function LicenseRequirementEditor({
  items,
  setItems,
  availableRoles,
}: {
  items: LicenseRequirement[];
  setItems: (next: LicenseRequirement[]) => void;
  availableRoles: { id: string; name: string }[];
}) {
  const roleOptions = useMemo(() => availableRoles ?? [], [availableRoles]);

  const addRow = () =>
    setItems([
      ...items,
      { roleId: roleOptions[0]?.id ?? "", roleName: roleOptions[0]?.name ?? "", requiredLicenses: [] },
    ]);

  const update = (idx: number, patch: Partial<LicenseRequirement>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch } as LicenseRequirement;
    setItems(next);
  };

  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  return (
    <RuleCard title="License Requirements" subheader="Which licenses each role must hold to be scheduled.">
      <Stack spacing={2}>
        {items.map((row, idx) => (
          <Box key={idx} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
              <TextField
                select
                fullWidth
                label="Role"
                value={row.roleId}
                onChange={(e) => {
                  const role = roleOptions.find((r) => r.id === e.target.value);
                  update(idx, { roleId: e.target.value, roleName: role?.name ?? "" });
                }}
              >
                {roleOptions.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                label="Required Licenses (comma-separated)"
                value={row.requiredLicenses.join(", ")}
                onChange={(e) =>
                  update(idx, {
                    requiredLicenses: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
              />

              <Tooltip title="Remove">
                <IconButton color="error" onClick={() => remove(idx)}>
                  <Delete />
                </IconButton>
              </Tooltip>
            </Stack>

            {row.requiredLicenses.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {row.requiredLicenses.map((lic, i) => (
                    <Chip key={i} label={lic} />
                  ))}
                </Stack>
              </>
            )}
          </Box>
        ))}

        <Box>
          <Tooltip title="Add requirement">
            <IconButton color="primary" onClick={addRow}>
              <Add />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>
    </RuleCard>
  );
}
