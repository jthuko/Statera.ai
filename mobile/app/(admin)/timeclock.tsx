import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, Alert } from "react-native";
import { Text, Button, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import { listAdminTimeClock, reviewTimeClock, AdminTimeClockEntry } from "../../src/api/admin";

const STATUS_COLOR: Record<string, string> = {
  ClockedIn: "#2e7d32", OnLunch: "#f57c00", ClockedOut: "rgba(255,255,255,0.4)",
  Approved: "#2e7d32", Denied: "#c62828", Adjusted: "#1565c0", PendingCorrection: "#9c27b0",
};

const STATUS_LABEL: Record<string, string> = {
  ClockedIn: "Clocked In", OnLunch: "On Lunch", ClockedOut: "Clocked Out",
  Approved: "Approved", Denied: "Denied", Adjusted: "Adjusted", PendingCorrection: "Needs Review",
};

type FilterStatus = "PendingCorrection" | "ClockedIn" | "ClockedOut";

export default function AdminTimeClockScreen() {
  const { user } = useAuth();
  const facilityId = user?.facilityIds?.[0];

  const [filter, setFilter] = useState<FilterStatus>("PendingCorrection");
  const [items, setItems] = useState<AdminTimeClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facilityId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await listAdminTimeClock({ facilityId, status: filter, pageSize: 50 });
      setItems(res.items);
    } catch { setError("Failed to load."); }
    finally { setLoading(false); }
  }, [facilityId, filter]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(entry: AdminTimeClockEntry, status: "Approved" | "Denied") {
    Alert.alert(
      `${status} Correction`,
      `${status === "Approved" ? "Apply" : "Deny"} the time correction for ${entry.staffName ?? "this staff"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status,
          style: status === "Denied" ? "destructive" : "default",
          onPress: async () => {
            setReviewBusy(entry.id); setError(null);
            try {
              await reviewTimeClock(entry.id, status);
              await load();
            } catch { setError("Failed to update."); }
            finally { setReviewBusy(null); }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.root}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {([
          { key: "PendingCorrection", label: "Corrections" },
          { key: "ClockedIn", label: "Active" },
          { key: "ClockedOut", label: "History" },
        ] as { key: FilterStatus; label: string }[]).map(f => (
          <Button
            key={f.key}
            mode={filter === f.key ? "contained" : "outlined"}
            buttonColor={filter === f.key ? "#00897b" : undefined}
            textColor={filter === f.key ? "#fff" : "rgba(255,255,255,0.5)"}
            compact
            onPress={() => setFilter(f.key)}
            style={styles.filterBtn}
          >
            {f.label}
          </Button>
        ))}
      </View>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="clock-check-outline" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>
            {filter === "PendingCorrection" ? "No pending corrections" :
             filter === "ClockedIn" ? "Nobody clocked in" : "No entries"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map(entry => {
            const workedMin = entry.durationMinutes;
            const isBusy = reviewBusy === entry.id;
            const statusColor = STATUS_COLOR[entry.status] ?? "rgba(255,255,255,0.4)";

            return (
              <View key={entry.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={styles.staffName}>
                      {entry.staffName ?? "Unknown Staff"}
                    </Text>
                    <Text variant="bodySmall" style={styles.time}>
                      {dayjs(entry.clockInUtc).format("ddd MMM D · h:mm a")}
                      {entry.clockOutUtc ? ` – ${dayjs(entry.clockOutUtc).format("h:mm a")}` : ""}
                    </Text>
                    {workedMin != null && (
                      <Text variant="bodySmall" style={styles.duration}>
                        {Math.floor(workedMin / 60)}h {workedMin % 60}m worked
                        {entry.lunchMinutes ? ` · ${entry.lunchMinutes}m lunch` : ""}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {STATUS_LABEL[entry.status] ?? entry.status}
                    </Text>
                  </View>
                </View>

                {/* Correction details */}
                {entry.correctionNotes && (
                  <View style={styles.correctionBox}>
                    <Text variant="labelSmall" style={styles.correctionLabel}>CORRECTION REQUEST</Text>
                    <Text variant="bodySmall" style={styles.correctionNote}>"{entry.correctionNotes}"</Text>
                    {entry.correctedClockInUtc && (
                      <Text variant="bodySmall" style={styles.correctionDetail}>
                        Requested: {dayjs(entry.correctedClockInUtc).format("h:mm a")}
                        {entry.correctedClockOutUtc ? ` – ${dayjs(entry.correctedClockOutUtc).format("h:mm a")}` : ""}
                      </Text>
                    )}
                  </View>
                )}

                {filter === "PendingCorrection" && (
                  <View style={styles.actionRow}>
                    <Button
                      mode="contained" compact buttonColor="#2e7d32" textColor="#fff"
                      loading={isBusy} disabled={!!reviewBusy}
                      onPress={() => handleReview(entry, "Approved")}
                      style={{ flex: 1 }} icon="check"
                    >
                      Apply
                    </Button>
                    <Button
                      mode="outlined" compact textColor="#ef5350"
                      loading={isBusy} disabled={!!reviewBusy}
                      onPress={() => handleReview(entry, "Denied")}
                      style={[{ flex: 1 }, styles.denyBtn]} icon="close"
                    >
                      Deny
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  filterRow: {
    flexDirection: "row", gap: 8, padding: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  filterBtn: { flex: 1, borderRadius: 8 },
  errorBox: { margin: 16, padding: 12, backgroundColor: "rgba(239,83,80,0.1)", borderRadius: 8 },
  errorText: { color: "#ef5350" },
  empty: { flex: 1, alignItems: "center", marginTop: 60 },
  emptyText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontWeight: "600" },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: "#0d2137", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  staffName: { color: "#e0f2f1", fontWeight: "700" },
  time: { color: "rgba(255,255,255,0.6)", marginTop: 2 },
  duration: { color: "#4db6ac", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: "600" },
  correctionBox: {
    marginTop: 10, padding: 10,
    backgroundColor: "rgba(156,39,176,0.08)", borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(156,39,176,0.2)",
  },
  correctionLabel: { color: "#ce93d8", fontSize: 10, letterSpacing: 0.6, marginBottom: 4 },
  correctionNote: { color: "rgba(255,255,255,0.6)", fontStyle: "italic" },
  correctionDetail: { color: "#e0f2f1", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  denyBtn: { borderColor: "#ef5350" },
});
