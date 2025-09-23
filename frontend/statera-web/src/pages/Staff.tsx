import { useEffect, useState } from "react";
import { Box, Alert } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Page from "./_Page";
import { listStaff, StaffRow } from "../api/endpoints";
import { useNavigate } from "react-router-dom";

const cols: GridColDef[] = [
  { field: "id", headerName: "ID", width: 250 }, // GUIDs are long; give them space
  { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
  { field: "role", headerName: "Role", width: 160 },
  { field: "unit", headerName: "Unit", width: 160 },
];

export default function Staff() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await listStaff();
        if (!alive) return;
        setRows(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load staff.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Page title="Staff">
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      <Box sx={{ height: 560 }}>
        <DataGrid
          columns={cols}
          rows={rows}
          loading={loading}
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          onRowClick={(p) => nav(`/staff/${p.id}`)} // id is string
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>
    </Page>
  );
}
