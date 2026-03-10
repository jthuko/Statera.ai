import { useEffect, useState, useCallback } from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { Text, Card, ActivityIndicator, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import api from "../../src/api/axios";
import { useAuth } from "../../src/auth/AuthContext";

dayjs.extend(isoWeek);

interface AssignmentDto {
  id: string;
  startUtc: string;
  endUtc: string;
  role?: string;
  unitName?: string;
  notes?: string;
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(dayjs().startOf("day"));

  const weekEnd = weekStart.endOf("week");

  const load = useCallback(async () => {
    const staffId = user?.staffId;
    if (!staffId) return;
    setLoading(true);
    try {
      const { data } = await api.get<AssignmentDto[]>(`/staff/${staffId}/assignments`, {
        params: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
      });
      setAssignments(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.staffId, weekStart]);

  useEffect(() => { load(); }, [load]);

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
  const today = dayjs().format("YYYY-MM-DD");

  const byDate: Record<string, AssignmentDto[]> = {};
  for (const a of assignments) {
    const d = dayjs(a.startUtc).format("YYYY-MM-DD");
    (byDate[d] ??= []).push(a);
  }

  const selectedKey = selectedDay.format("YYYY-MM-DD");
  const selectedShifts = byDate[selectedKey] ?? [];

  function changeWeek(dir: 1 | -1) {
    const newWeek = weekStart.add(dir, "week");
    setWeekStart(newWeek);
    setSelectedDay(newWeek.startOf("week"));
  }

  return (
    <View style={styles.root}>
      {/* Week navigation */}
      <View style={styles.nav}>
        <IconButton icon="chevron-left" iconColor="#4db6ac" onPress={() => changeWeek(-1)} />
        <Text variant="titleSmall" style={styles.navLabel}>
          {weekStart.format("MMM D")} – {weekEnd.format("MMM D, YYYY")}
        </Text>
        <IconButton icon="chevron-right" iconColor="#4db6ac" onPress={() => changeWeek(1)} />
      </View>

      {/* Day strip */}
      <View style={styles.dayStrip}>
        {days.map(day => {
          const key = day.format("YYYY-MM-DD");
          const isToday = key === today;
          const isSelected = key === selectedKey;
          const hasShift = (byDate[key]?.length ?? 0) > 0;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => setSelectedDay(day.startOf("day"))}
            >
              <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
                {day.format("dd")[0]}
              </Text>
              <Text style={[styles.dayNum, isToday && styles.dayNumToday, isSelected && styles.dayTextSelected]}>
                {day.format("D")}
              </Text>
              {hasShift && (
                <View style={[styles.dot, isSelected && styles.dotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Shift list for selected day */}
      <ScrollView style={styles.shiftList} contentContainerStyle={styles.shiftContent}>
        <Text variant="labelSmall" style={styles.dayHeading}>
          {selectedDay.format("dddd, MMMM D")}
        </Text>

        {loading ? (
          <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
        ) : selectedShifts.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={40} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>No shifts scheduled</Text>
          </View>
        ) : (
          selectedShifts.map(s => (
            <Card key={s.id} style={styles.shiftCard}>
              <Card.Content>
                <View style={styles.shiftRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#4db6ac" />
                  <Text variant="bodyMedium" style={styles.shiftTime}>
                    {dayjs(s.startUtc).format("h:mm a")} – {dayjs(s.endUtc).format("h:mm a")}
                  </Text>
                </View>
                {s.role && (
                  <Text variant="bodySmall" style={styles.shiftMeta}>{s.role}</Text>
                )}
                {s.unitName && (
                  <Text variant="bodySmall" style={styles.shiftMeta}>{s.unitName}</Text>
                )}
                {s.notes && (
                  <Text variant="bodySmall" style={styles.shiftNotes}>{s.notes}</Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  navLabel: { color: "#e0f2f1", fontWeight: "600" },
  dayStrip: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayCell: {
    flex: 1, alignItems: "center", paddingVertical: 6,
    borderRadius: 10,
  },
  dayCellSelected: { backgroundColor: "rgba(0,137,123,0.25)" },
  dayName: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600" },
  dayNum: { color: "#e0f2f1", fontSize: 16, fontWeight: "600", marginTop: 2 },
  dayNumToday: { color: "#4db6ac" },
  dayTextSelected: { color: "#4db6ac" },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: "#4db6ac", marginTop: 4,
  },
  dotSelected: { backgroundColor: "#fff" },
  shiftList: { flex: 1 },
  shiftContent: { padding: 16, paddingBottom: 40 },
  dayHeading: {
    color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: 0.6,
    textTransform: "uppercase", marginBottom: 12,
  },
  empty: { alignItems: "center", marginTop: 48 },
  emptyText: { color: "rgba(255,255,255,0.35)", marginTop: 10 },
  shiftCard: {
    backgroundColor: "#0d2137", borderRadius: 10, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  shiftRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shiftTime: { color: "#e0f2f1", fontWeight: "600" },
  shiftMeta: { color: "rgba(255,255,255,0.5)", marginTop: 4 },
  shiftNotes: { color: "rgba(255,255,255,0.4)", marginTop: 4, fontStyle: "italic" },
});
