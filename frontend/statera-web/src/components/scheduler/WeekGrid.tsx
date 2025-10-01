// src/components/scheduler/WeekGrid.tsx
import * as React from "react";
import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import dayjs, { Dayjs } from "dayjs";

export interface StaffRow {
  id: string;
  label: string; // Staff name
}

export interface AssignmentCell {
  id: string;
  staffId: string;
  dayISO: string; // date at 00:00 local
  startISO: string;
  endISO: string;
  roleName?: string;
  unitName?: string;
  notes?: string | null;
}

export interface WeekGridProps {
  weekStart: Dayjs; // Monday
  staff: StaffRow[];
  assignments: AssignmentCell[];
  onCreate: (staffId: string, dayISO: string) => void;
  onEdit: (assignmentId: string) => void;
}

const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function WeekGrid(props: WeekGridProps) {
  const { weekStart, staff, assignments, onCreate, onEdit } = props;

  const dayDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart]
  );

  const byStaffDay = React.useMemo(() => {
    const map = new Map<string, AssignmentCell[]>();
    assignments.forEach(a => {
      const key = `${a.staffId}:${dayjs(a.dayISO).format("YYYY-MM-DD")}`;
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    });
    return map;
  }, [assignments]);

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ display: "grid", gridTemplateColumns: `240px repeat(7, 1fr)`, bgcolor: "background.default" }}>
        <Box sx={{ p: 1.5, borderRight: 1, borderColor: "divider", fontWeight: 600 }}>Staff</Box>
        {dayDates.map((d, i) => (
          <Box key={i} sx={{ p: 1.5, borderRight: i < 6 ? 1 : 0, borderColor: "divider", textAlign: "center", fontWeight: 600 }}>
            {dayLabels[i]}<br />
            <Typography variant="caption">{d.format("MMM D")}</Typography>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {staff.map((s, rowIdx) => (
        <Box
          key={s.id}
          sx={{
            display: "grid",
            gridTemplateColumns: `240px repeat(7, 1fr)`,
            borderTop: 1,
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" }
          }}
        >
          <Box sx={{ p: 1.5, borderRight: 1, borderColor: "divider", fontWeight: 500 }}>
            {s.label}
          </Box>

          {dayDates.map((d, colIdx) => {
            const dayKey = d.format("YYYY-MM-DD");
            const key = `${s.id}:${dayKey}`;
            const items = byStaffDay.get(key) ?? [];
            return (
              <Box
                key={colIdx}
                sx={{
                  p: 1,
                  borderRight: colIdx < 6 ? 1 : 0,
                  borderColor: "divider",
                  minHeight: 64,
                  cursor: "pointer"
                }}
                onClick={() => onCreate(s.id, d.startOf("day").toISOString())}
              >
                {items.map(item => (
                  <Chip
                    key={item.id}
                    label={`${dayjs(item.startISO).format("HH:mm")}-${dayjs(item.endISO).format("HH:mm")} ${item.roleName ?? ""}`}
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onEdit(item.id); }}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
