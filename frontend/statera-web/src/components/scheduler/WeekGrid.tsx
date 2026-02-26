// src/components/scheduler/WeekGrid.tsx
import * as React from "react";
import { Avatar, Box, Chip, Tooltip, Typography, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import dayjs, { Dayjs } from "dayjs";

export interface StaffRow {
  id: string;
  label: string;
  role?: string;
}

export interface AssignmentCell {
  id: string;
  staffId: string;
  dayISO: string;
  startISO: string;
  endISO: string;
  roleName?: string;
  unitName?: string;
  notes?: string | null;
}

export interface WeekGridProps {
  weekStart: Dayjs;
  staff: StaffRow[];
  assignments: AssignmentCell[];
  onCreate: (staffId: string, dayISO: string) => void;
  onEdit: (assignmentId: string) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Dark-mode role colors (light text for dark backgrounds)
const ROLE_COLORS_DARK: Record<string, { bg: string; border: string; text: string }> = {
  RN:    { bg: "rgba(21,101,192,0.18)",  border: "rgba(21,101,192,0.5)",  text: "#90caf9" },
  LPN:   { bg: "rgba(106,27,154,0.18)", border: "rgba(106,27,154,0.5)", text: "#ce93d8" },
  CNA:   { bg: "rgba(46,125,50,0.18)",  border: "rgba(46,125,50,0.5)",  text: "#a5d6a7" },
  MD:    { bg: "rgba(198,40,40,0.18)",  border: "rgba(198,40,40,0.5)",  text: "#ef9a9a" },
  PA:    { bg: "rgba(230,81,0,0.18)",   border: "rgba(230,81,0,0.5)",   text: "#ffcc80" },
  NP:    { bg: "rgba(0,151,167,0.18)",  border: "rgba(0,151,167,0.5)",  text: "#80deea" },
  CRNA:  { bg: "rgba(93,64,55,0.25)",   border: "rgba(93,64,55,0.6)",   text: "#bcaaa4" },
  RRT:   { bg: "rgba(69,90,100,0.25)",  border: "rgba(69,90,100,0.6)",  text: "#b0bec5" },
  EMT:   { bg: "rgba(106,27,154,0.18)", border: "rgba(106,27,154,0.5)", text: "#ce93d8" },
};
const DEFAULT_DARK = { bg: "rgba(0,137,123,0.15)", border: "rgba(0,137,123,0.4)", text: "#4db6ac" };

// Light-mode role colors (darker text for light backgrounds)
const ROLE_COLORS_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  RN:    { bg: "rgba(21,101,192,0.1)",  border: "rgba(21,101,192,0.4)",  text: "#1565c0" },
  LPN:   { bg: "rgba(106,27,154,0.1)", border: "rgba(106,27,154,0.4)", text: "#6a1b9a" },
  CNA:   { bg: "rgba(46,125,50,0.1)",  border: "rgba(46,125,50,0.4)",  text: "#2e7d32" },
  MD:    { bg: "rgba(198,40,40,0.1)",  border: "rgba(198,40,40,0.4)",  text: "#c62828" },
  PA:    { bg: "rgba(230,81,0,0.1)",   border: "rgba(230,81,0,0.4)",   text: "#e65100" },
  NP:    { bg: "rgba(0,151,167,0.1)",  border: "rgba(0,151,167,0.4)",  text: "#00695c" },
  CRNA:  { bg: "rgba(93,64,55,0.1)",   border: "rgba(93,64,55,0.4)",   text: "#4e342e" },
  RRT:   { bg: "rgba(69,90,100,0.1)",  border: "rgba(69,90,100,0.4)",  text: "#37474f" },
  EMT:   { bg: "rgba(106,27,154,0.1)", border: "rgba(106,27,154,0.4)", text: "#6a1b9a" },
};
const DEFAULT_LIGHT = { bg: "rgba(0,137,123,0.1)", border: "rgba(0,137,123,0.4)", text: "#00695c" };

function getInitials(label: string) {
  return label.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

const COL_STAFF_W = 200;

export default function WeekGrid({ weekStart, staff, assignments, onCreate, onEdit }: WeekGridProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const today = dayjs().format("YYYY-MM-DD");

  function getRoleColor(role?: string) {
    const map = isDark ? ROLE_COLORS_DARK : ROLE_COLORS_LIGHT;
    const def = isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
    return role ? (map[role.toUpperCase()] ?? def) : def;
  }

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

  // Theme-aware token shortcuts
  const borderColor    = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const borderColorSub = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const headerBg       = isDark ? "rgba(0,55,55,0.55)"    : "rgba(0,77,77,0.08)";
  const headerText     = isDark ? "rgba(255,255,255,0.5)"  : "rgba(0,0,0,0.45)";
  const dayNumColor    = isDark ? "rgba(255,255,255,0.7)"  : "rgba(0,0,0,0.7)";
  const timeColor      = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const unitColor      = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.4)";
  const rowHover       = isDark ? "rgba(255,255,255,0.015)": "rgba(0,0,0,0.02)";
  const cellHover      = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const todayBg        = isDark ? "rgba(0,137,123,0.05)"   : "rgba(0,137,123,0.05)";
  const todayHover     = isDark ? "rgba(0,137,123,0.1)"    : "rgba(0,137,123,0.08)";
  const todayHeaderBg  = isDark ? "rgba(0,137,123,0.15)"   : "rgba(0,137,123,0.1)";
  const emptyBorderColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)";

  if (staff.length === 0) {
    return (
      <Box sx={{
        py: 8, textAlign: "center",
        border: "2px dashed", borderColor: emptyBorderColor, borderRadius: 2,
      }}>
        <Typography color="text.secondary" fontWeight={500}>No staff match the current filters</Typography>
        <Typography variant="caption" color="text.disabled">Adjust filters or add staff to this facility</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      border: `1px solid ${borderColor}`,
      borderRadius: 2,
      overflow: "hidden",
      overflowX: "auto",
    }}>
      {/* ── Header row ── */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: `${COL_STAFF_W}px repeat(7, minmax(110px, 1fr))`,
        minWidth: COL_STAFF_W + 7 * 110,
        background: headerBg,
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <Box sx={{
          px: 2, py: 1.25,
          borderRight: `1px solid ${borderColor}`,
          display: "flex", alignItems: "center",
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: headerText, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Staff
          </Typography>
        </Box>

        {dayDates.map((d, i) => {
          const dateStr = d.format("YYYY-MM-DD");
          const isToday = dateStr === today;
          return (
            <Box key={i} sx={{
              px: 1, py: 1.25, textAlign: "center",
              borderRight: i < 6 ? `1px solid ${borderColor}` : "none",
              background: isToday ? todayHeaderBg : "transparent",
              position: "relative",
            }}>
              <Typography sx={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase",
                color: isToday ? "#00897b" : headerText,
              }}>
                {DAY_LABELS[i]}
              </Typography>
              <Typography sx={{
                fontSize: 14, fontWeight: isToday ? 800 : 500,
                color: isToday ? "#00897b" : dayNumColor,
                lineHeight: 1.2,
              }}>
                {d.format("D")}
              </Typography>
              {isToday && (
                <Box sx={{
                  position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                  width: 20, height: 2, borderRadius: 1, bgcolor: "#00897b",
                }} />
              )}
            </Box>
          );
        })}
      </Box>

      {/* ── Staff rows ── */}
      {staff.map((s, rowIdx) => {
        const rc = getRoleColor(s.role);
        return (
          <Box
            key={s.id}
            sx={{
              display: "grid",
              gridTemplateColumns: `${COL_STAFF_W}px repeat(7, minmax(110px, 1fr))`,
              minWidth: COL_STAFF_W + 7 * 110,
              borderTop: rowIdx === 0 ? "none" : `1px solid ${borderColorSub}`,
              "&:hover": { background: rowHover },
            }}
          >
            {/* Staff name cell */}
            <Box sx={{
              px: 1.5, py: 1,
              borderRight: `1px solid ${borderColorSub}`,
              display: "flex", alignItems: "center", gap: 1, minWidth: 0,
            }}>
              <Avatar sx={{
                width: 28, height: 28, fontSize: 10, fontWeight: 700, flexShrink: 0,
                bgcolor: rc.bg, color: rc.text,
                border: `1px solid ${rc.border}`,
              }}>
                {getInitials(s.label)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, color: "text.primary" }} noWrap>
                  {s.label}
                </Typography>
                {s.role && (
                  <Typography sx={{ fontSize: 10, color: rc.text, lineHeight: 1.2, fontWeight: 600 }}>
                    {s.role}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Day cells */}
            {dayDates.map((d, colIdx) => {
              const dateStr = d.format("YYYY-MM-DD");
              const isToday = dateStr === today;
              const key     = `${s.id}:${dateStr}`;
              const items   = byStaffDay.get(key) ?? [];

              return (
                <Box
                  key={colIdx}
                  onClick={() => onCreate(s.id, d.startOf("day").toISOString())}
                  sx={{
                    p: 0.75,
                    borderRight: colIdx < 6 ? `1px solid ${borderColorSub}` : "none",
                    minHeight: 60,
                    cursor: "pointer",
                    background: isToday ? todayBg : "transparent",
                    position: "relative",
                    transition: "background 0.12s",
                    "&:hover": {
                      background: isToday ? todayHover : cellHover,
                      "& .add-hint": { opacity: 1 },
                    },
                  }}
                >
                  {items.map(item => {
                    const roleC = getRoleColor(item.roleName);
                    return (
                      <Tooltip
                        key={item.id}
                        title={
                          <span>
                            {item.roleName && <><strong>{item.roleName}</strong><br /></>}
                            {dayjs(item.startISO).format("h:mm a")} – {dayjs(item.endISO).format("h:mm a")}
                            {item.unitName && <><br />{item.unitName}</>}
                            {item.notes && <><br />{item.notes}</>}
                          </span>
                        }
                        arrow
                      >
                        <Box
                          onClick={e => { e.stopPropagation(); onEdit(item.id); }}
                          sx={{
                            mb: 0.5, px: 0.75, py: 0.4, borderRadius: 1,
                            background: roleC.bg,
                            border: `1px solid ${roleC.border}`,
                            borderLeft: `3px solid ${roleC.text}`,
                            cursor: "pointer",
                            transition: "filter 0.1s",
                            "&:hover": { filter: "brightness(0.95)" },
                          }}
                        >
                          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: roleC.text, lineHeight: 1.2 }}>
                            {item.roleName ?? "Shift"}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: timeColor, lineHeight: 1.2 }}>
                            {dayjs(item.startISO).format("h:mm")}–{dayjs(item.endISO).format("h:mm a")}
                          </Typography>
                          {item.unitName && (
                            <Typography sx={{ fontSize: 9.5, color: unitColor, lineHeight: 1.2 }}>
                              {item.unitName}
                            </Typography>
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}

                  {items.length === 0 && (
                    <Box className="add-hint" sx={{
                      opacity: 0, transition: "opacity 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      height: "100%", minHeight: 44,
                    }}>
                      <AddIcon sx={{ fontSize: 16, color: "rgba(0,137,123,0.5)" }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
