import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, Alert } from "react-native";
import { Text, Button, ActivityIndicator, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import { listAdminTimeOff, reviewTimeOff, AdminTimeOffRequest } from "../../src/api/admin";

const TYPE_COLOR: Record<string, string> = {
  Vacation: "#00897b", Sick: "#c62828", Personal: "#1565c0",
  Unpaid: "#6a1b9a", Other: "#455a64",
};

type FilterStatus = "Pending" | "Approved" | "Denied";

export default function AdminTimeOffScreen() {
  const { user } = useAuth();
  const facilityId = user?.facilityIds?.[0];

  const [filter, setFilter] = useState<FilterStatus>("Pending");
  const [items, setItems] = useState<AdminTimeOffRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facilityId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await listAdminTimeOff({ facilityId, status: filter, pageSize: 50 });
      setItems(res.items);
      setTotal(res.total);
    } catch { setError("Failed to load."); }
    finally { setLoading(false); }
  }, [facilityId, filter]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(item: AdminTimeOffRequest, status: "Approved" | "Denied") {
    Alert.alert(
      `${status} Request`,
      `${status === "Approved" ? "Approve" : "Deny"} ${item.staffName}'s ${item.type.toLowerCase()} request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status,
          style: status === "Denied" ? "destructive" : "default",
          onPress: async () => {
            setReviewBusy(item.id); setError(null);
            try {
              await reviewTimeOff(item.id, status);
              await load();
            } catch { setError("Failed to update status."); }
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
        {(["Pending", "Approved", "Denied"] as FilterStatus[]).map(f => (
          <Button
            key={f}
            mode={filter === f ? "contained" : "outlined"}
            buttonColor={filter === f ? "#00897b" : undefined}
            textColor={filter === f ? "#fff" : "rgba(255,255,255,0.5)"}
            compact
            onPress={() => setFilter(f)}
            style={styles.filterBtn}
          >
            {f}
          </Button>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
      )}

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="beach" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No {filter.toLowerCase()} requests</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map(item => {
            const days = Math.ceil(dayjs(item.endUtc).diff(dayjs(item.startUtc), "day", true));
            const typeColor = TYPE_COLOR[item.type] ?? "#455a64";
            const isBusy = reviewBusy === item.id;

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text variant="bodyMedium" style={styles.staffName}>{item.staffName}</Text>
                    <Text variant="bodySmall" style={styles.dateRange}>
                      {dayjs(item.startUtc).format("MMM D")} – {dayjs(item.endUtc).format("MMM D, YYYY")}
                      <Text style={styles.daySub}> · {days} day{days !== 1 ? "s" : ""}</Text>
                    </Text>
                  </View>
                  <View style={[styles.typeChip, { backgroundColor: typeColor + "22", borderColor: typeColor + "44" }]}>
                    <Text style={{ color: typeColor, fontSize: 11, fontWeight: "600" }}>{item.type}</Text>
                  </View>
                </View>

                {item.reason && (
                  <Text variant="bodySmall" style={styles.reason}>"{item.reason}"</Text>
                )}

                {filter === "Pending" && (
                  <View style={styles.actionRow}>
                    <Button
                      mode="contained" compact buttonColor="#2e7d32" textColor="#fff"
                      loading={isBusy} disabled={!!reviewBusy}
                      onPress={() => handleReview(item, "Approved")}
                      style={{ flex: 1 }}
                      icon="check"
                    >
                      Approve
                    </Button>
                    <Button
                      mode="outlined" compact textColor="#ef5350"
                      loading={isBusy} disabled={!!reviewBusy}
                      onPress={() => handleReview(item, "Denied")}
                      style={[{ flex: 1 }, styles.denyBtn]}
                      icon="close"
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontWeight: "600" },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: "#0d2137", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  staffName: { color: "#e0f2f1", fontWeight: "700" },
  dateRange: { color: "rgba(255,255,255,0.6)", marginTop: 2 },
  daySub: { color: "rgba(255,255,255,0.35)" },
  typeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  reason: { color: "rgba(255,255,255,0.45)", fontStyle: "italic", marginBottom: 10 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  denyBtn: { borderColor: "#ef5350" },
});
