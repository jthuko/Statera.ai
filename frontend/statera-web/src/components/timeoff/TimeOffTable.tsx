// src/components/timeoff/TimeOffTable.tsx
import * as React from "react";
import {
  Box, Button, Chip, Divider, MenuItem,
  Stack, TextField, Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";

import { listTimeOff, TimeOffRequestDto, TimeOffStatus } from "../../api/timeoff";
import TimeOffReviewDialog from "./TimeOffReviewDialog";

interface Props {
  facilityId?: string;
  unitId?: string;
  staffId?: string;
}

export default function TimeOffTable({ facilityId, unitId, staffId }: Props) {
  const [status, setStatus] = React.useState<TimeOffStatus | "All">("All");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [rows, setRows] = React.useState<TimeOffRequestDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [reviewing, setReviewing] = React.useState<TimeOffRequestDto | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTimeOff({
        facilityId,
        unitId,
        staffId,
        status: status === "All" ? undefined : status,
        q: q || undefined,
        page: page + 1,
        pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [facilityId, unitId, staffId, status, q, page, pageSize]);

  React.useEffect(() => { load(); }, [load]);

  const cols: GridColDef<TimeOffRequestDto>[] = [
    { field: "staffName", headerName: "Staff", width: 180 },
    { field: "type", headerName: "Type", width: 120 },
    {
      field: "startUtc",
      headerName: "Period",
      width: 250,
      renderCell: (p: any) => (
        <Typography variant="body2" noWrap>
          {dayjs(p.row.startUtc).format("MMM D")} – {dayjs(p.row.endUtc).format("MMM D, YYYY")}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            ({Math.max(1, dayjs(p.row.endUtc).diff(dayjs(p.row.startUtc), "day"))}d)
          </Typography>
        </Typography>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (p: any) => {
        const s: TimeOffStatus = p.value ?? "Pending";
        const color =
          s === "Approved" ? "success"
          : s === "Denied" ? "error"
          : s === "Cancelled" ? "warning"
          : "default";
        return <Chip size="small" color={color as any} label={s} />;
      },
    },
    { field: "reason", headerName: "Reason", flex: 1, minWidth: 180 },
    {
      field: "actions",
      headerName: "",
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (p: any) => (
        <Button
          size="small"
          variant={p.row.status === "Pending" ? "contained" : "outlined"}
          color={p.row.status === "Pending" ? "primary" : "inherit"}
          onClick={() => setReviewing(p.row)}
        >
          {p.row.status === "Pending" ? "Review" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        mb={1}
      >
        <Typography variant="h6">Time-Off Requests</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            select label="Status" size="small" value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            sx={{ minWidth: 160 }}
          >
            {(["All", "Pending", "Approved", "Denied", "Cancelled"] as const).map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Search staff or reason"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      <div style={{ height: 520, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={cols}
          getRowId={(r) => r.id}
          rowCount={total}
          pagination
          paginationMode="server"
          {...({ paginationModel: { page, pageSize } } as any)}
          {...({ onPaginationModelChange: (m: any) => {
            setPage(m.page);
            setPageSize(m.pageSize);
          }} as any)}
          {...({ page, onPageChange: setPage } as any)}
          {...({ pageSize, onPageSizeChange: setPageSize } as any)}
          pageSizeOptions={[10, 25, 50, 100]}
          loading={loading}
        />
      </div>

      <TimeOffReviewDialog
        open={!!reviewing}
        request={reviewing}
        onClose={() => setReviewing(null)}
        onRefresh={load}
      />
    </Box>
  );
}
