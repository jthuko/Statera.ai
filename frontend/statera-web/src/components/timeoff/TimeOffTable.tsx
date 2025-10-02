// frontend/src/components/timeoff/TimeOffTable.tsx
import * as React from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";

import {
  listTimeOff,
  changeTimeOffStatus,
  deleteTimeOff,
  TimeOffRequestDto,
  TimeOffStatus,
} from "../../api/timeoff";

import CheckIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";

interface Props {
  facilityId?: string;
  unitId?: string;
  staffId?: string;
}

export default function TimeOffTable({ facilityId, unitId, staffId }: Props) {
  const [status, setStatus] = React.useState<TimeOffStatus | "All">("All");
  const [q, setQ] = React.useState("");

  // Works on MUI X v5 and v6; we’ll adapt what we pass to DataGrid below.
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);

  const [rows, setRows] = React.useState<TimeOffRequestDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTimeOff({
        facilityId,
        unitId,
        staffId,
        status: status === "All" ? undefined : status,
        q: q || undefined,
        page: page + 1, // API is 1-based
        pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [facilityId, unitId, staffId, status, q, page, pageSize]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    await changeTimeOffStatus(id, "Approved");
    await load();
  }

  async function deny(id: string) {
    await changeTimeOffStatus(id, "Denied");
    await load();
  }

  async function remove(id: string) {
    await deleteTimeOff(id);
    await load();
  }

  // Keep the row generic for better inference; use `any` inside formatters to avoid TS churn between MUI versions.
  const cols: GridColDef<TimeOffRequestDto>[] = [
    { field: "id", headerName: "ID", width: 220 },
    { field: "staffName", headerName: "Staff", width: 180 },
    { field: "staffUnitId", headerName: "Unit", width: 160 },
    { field: "type", headerName: "Type", width: 120 },
    {
      field: "startUtc",
      headerName: "Start",
      width: 170,
      valueFormatter: (p: any) =>
        p?.value ? dayjs(p.value as string).format("YYYY-MM-DD HH:mm") : "",
    },
    {
      field: "endUtc",
      headerName: "End",
      width: 170,
      valueFormatter: (p: any) =>
        p?.value ? dayjs(p.value as string).format("YYYY-MM-DD HH:mm") : "",
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (p: any) => {
        const s: TimeOffStatus = p.value ?? "Pending";
        const color =
          s === "Approved"
            ? "success"
            : s === "Denied"
            ? "error"
            : s === "Cancelled"
            ? "warning"
            : "default";
        return <Chip size="small" color={color as any} label={s} />;
      },
    },
    { field: "reason", headerName: "Reason", flex: 1, minWidth: 220 },
    {
      field: "actions",
      headerName: "Actions",
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: (p: any) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Approve">
            <span>
              <IconButton
                size="small"
                onClick={() => approve(p.row.id)}
                disabled={p.row.status !== "Pending"}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Deny">
            <span>
              <IconButton
                size="small"
                onClick={() => deny(p.row.id)}
                disabled={p.row.status !== "Pending"}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                onClick={() => remove(p.row.id)}
                disabled={p.row.status !== "Pending"}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
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
            select
            label="Status"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            sx={{ minWidth: 160 }}
          >
            {(["All", "Pending", "Approved", "Denied", "Cancelled"] as const).map(
              (s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              )
            )}
          </TextField>
          <TextField
            size="small"
            label="Search reason"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <Button variant="outlined" onClick={load}>
            Apply
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      <div style={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={cols}
          getRowId={(r) => r.id}
          rowCount={total}
          pagination
          paginationMode="server"
          // v6 style:
          {...({ paginationModel: { page, pageSize } } as any)}
          {...({ onPaginationModelChange: (m: any) => {
            setPage(m.page);
            setPageSize(m.pageSize);
          }} as any)}
          // v5 compatibility (these props are ignored by v6):
          {...({ page, onPageChange: setPage } as any)}
          {...({ pageSize, onPageSizeChange: setPageSize } as any)}
          pageSizeOptions={[10, 25, 50, 100]}
          loading={loading}
        />
      </div>
    </Box>
  );
}
