// src/pages/timeoff/index.tsx
import * as React from "react";
import { Box, Button, Container } from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

import TimeOffTable from "../../components/timeoff/TimeOffTable";
import TimeOffFormDialog, {
  TimeOffFormValues,
} from "../../components/timeoff/TimeOffFormDialog";
import { createTimeOff } from "../../api/timeoff";
import { useFacility } from "../../context/facility";

export default function TimeOffPage() {
  const { selected } = useFacility();
    const facilityId = selected?.id;

  const [open, setOpen] = React.useState(false);

  async function handleCreate(values: TimeOffFormValues) {
    if (!values.startUtc || !values.endUtc) return;
    await createTimeOff({
      staffId: values.staffId,
      type: values.type,
      startUtc: values.startUtc.toDate().toISOString(), // send UTC ISO
      endUtc: values.endUtc.toDate().toISOString(),
      reason: values.reason ?? undefined,
    });
    setOpen(false);
    // Option A: Let the user click "Apply" on the table
    // Option B: emit a simple custom event the table can listen for to auto-reload
    window.dispatchEvent(new Event("timeoff:refresh"));
  }

  // Optional: simple event bus to refresh the table when a new item is created
  const [refreshKey, setRefreshKey] = React.useState(0);
  React.useEffect(() => {
    const fn = () => setRefreshKey((k) => k + 1);
    window.addEventListener("timeoff:refresh", fn);
    return () => window.removeEventListener("timeoff:refresh", fn);
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button variant="contained" onClick={() => setOpen(true)}>
            New Time-Off Request
          </Button>
        </Box>

        {/* Pass facilityId to filter server-side via Staff join */}
        <TimeOffTable key={refreshKey} facilityId={facilityId} />

        <TimeOffFormDialog
          open={open}
          onClose={() => setOpen(false)}
          onSubmit={handleCreate}
          initial={{}} // you can set default staffId here if you want
        />
      </Container>
    </LocalizationProvider>
  );
}
