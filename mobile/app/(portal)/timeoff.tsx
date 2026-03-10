import { useCallback, useEffect, useState } from "react";
import {
  ScrollView, StyleSheet, View, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Text, Button, TextInput, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import { listTimeOff, createTimeOff, TimeOffRequestDto } from "../../src/api/timeoff";

const OFF_TYPES = ["Vacation", "Sick", "Personal", "Unpaid", "Other"];

const TYPE_COLOR: Record<string, string> = {
  Vacation: "#00897b", Sick: "#c62828", Personal: "#1565c0",
  Unpaid: "#6a1b9a", Other: "#455a64",
};

const STATUS_BORDER: Record<string, string> = {
  Pending: "#f57c00", Approved: "#2e7d32", Denied: "#c62828", Cancelled: "rgba(255,255,255,0.1)",
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "#f57c00", Approved: "#2e7d32", Denied: "#ef5350", Cancelled: "rgba(255,255,255,0.3)",
};

export default function TimeOffScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<TimeOffRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.staffId) { setLoading(false); return; }
    try {
      const res = await listTimeOff({ staffId: user.staffId, page: 1, pageSize: 50 });
      setItems(res.items);
    } catch { setError("Failed to load time off."); }
    finally { setLoading(false); }
  }, [user?.staffId]);

  useEffect(() => { load(); }, [load]);

  const pending  = items.filter(r => r.status === "Pending").length;
  const approved = items.filter(r => r.status === "Approved").length;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="beach" size={20} color="#4db6ac" />
          </View>
          <View>
            <Text variant="titleMedium" style={styles.headerTitle}>My Time Off</Text>
            <View style={styles.chips}>
              {pending > 0 && (
                <View style={[styles.chip, { backgroundColor: "rgba(245,124,0,0.2)" }]}>
                  <Text style={{ color: "#f57c00", fontSize: 11 }}>{pending} pending</Text>
                </View>
              )}
              {approved > 0 && (
                <View style={[styles.chip, { backgroundColor: "rgba(46,125,50,0.2)" }]}>
                  <Text style={{ color: "#2e7d32", fontSize: 11 }}>{approved} approved</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <Button
          mode="contained"
          buttonColor="#00897b"
          textColor="#fff"
          compact
          onPress={() => setFormOpen(true)}
          icon="plus"
        >
          New Request
        </Button>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-remove-outline" size={48} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyTitle}>No time off requests yet</Text>
          <Text style={styles.emptySub}>Tap "New Request" to submit your first request</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map(r => {
            const days = Math.ceil(dayjs(r.endUtc).diff(dayjs(r.startUtc), "day", true));
            const typeColor = TYPE_COLOR[r.type] ?? "#455a64";
            return (
              <View key={r.id} style={[styles.card, { borderLeftColor: STATUS_BORDER[r.status] ?? "#fff2" }]}>
                <View style={styles.cardRow}>
                  <View style={[styles.typeChip, { backgroundColor: typeColor + "22", borderColor: typeColor + "44" }]}>
                    <Text style={{ color: typeColor, fontSize: 11, fontWeight: "600" }}>{r.type}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[r.status] + "22" }]}>
                    <Text style={{ color: STATUS_COLOR[r.status], fontSize: 11, fontWeight: "600" }}>{r.status}</Text>
                  </View>
                </View>
                <Text variant="bodyMedium" style={styles.dateRange}>
                  {dayjs(r.startUtc).format("MMM D")} – {dayjs(r.endUtc).format("MMM D, YYYY")}
                  <Text style={styles.dayCount}> · {days} day{days !== 1 ? "s" : ""}</Text>
                </Text>
                {r.reason && (
                  <Text variant="bodySmall" style={styles.reason}>{r.reason}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <NewRequestModal
        open={formOpen}
        staffId={user?.staffId ?? ""}
        onClose={() => setFormOpen(false)}
        onCreated={() => { setFormOpen(false); load(); }}
      />
    </View>
  );
}

function NewRequestModal({ open, staffId, onClose, onCreated }: {
  open: boolean; staffId: string; onClose: () => void; onCreated: () => void;
}) {
  const [type, setType] = useState("Vacation");
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType("Vacation"); setStartDate(dayjs().format("YYYY-MM-DD"));
    setEndDate(dayjs().format("YYYY-MM-DD")); setReason(""); setError(null);
  }

  async function handleSubmit() {
    if (!staffId) return;
    setBusy(true); setError(null);
    try {
      await createTimeOff({
        staffId, type,
        startUtc: dayjs(startDate).startOf("day").toISOString(),
        endUtc: dayjs(endDate).endOf("day").toISOString(),
        reason: reason || null,
      });
      reset(); onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to submit request.");
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}>
          <Text variant="titleLarge" style={styles.modalTitle}>New Time Off Request</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <MaterialCommunityIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {/* Type selector */}
          <Text variant="labelMedium" style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {OFF_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && { backgroundColor: "#00897b", borderColor: "#00897b" }]}
                onPress={() => setType(t)}
              >
                <Text style={{ color: type === t ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text variant="labelMedium" style={styles.fieldLabel}>Start Date</Text>
          <TextInput
            mode="outlined" value={startDate}
            onChangeText={v => {
              const diff = dayjs(endDate).diff(dayjs(startDate), "day");
              setStartDate(v);
              setEndDate(dayjs(v).add(diff, "day").format("YYYY-MM-DD"));
            }}
            placeholder="YYYY-MM-DD"
            outlineColor="rgba(255,255,255,0.15)"
            activeOutlineColor="#4db6ac"
            style={styles.input}
            keyboardType="numeric"
          />

          <Text variant="labelMedium" style={styles.fieldLabel}>End Date</Text>
          <TextInput
            mode="outlined" value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            outlineColor="rgba(255,255,255,0.15)"
            activeOutlineColor="#4db6ac"
            style={styles.input}
            keyboardType="numeric"
          />

          <Text variant="labelMedium" style={styles.fieldLabel}>Reason (optional)</Text>
          <TextInput
            mode="outlined" value={reason}
            onChangeText={setReason}
            placeholder="Enter reason…"
            multiline numberOfLines={3}
            outlineColor="rgba(255,255,255,0.15)"
            activeOutlineColor="#4db6ac"
            style={styles.input}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button mode="outlined" onPress={() => { reset(); onClose(); }} disabled={busy} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            mode="contained" buttonColor="#00897b" textColor="#fff"
            onPress={handleSubmit}
            loading={busy} disabled={busy || !startDate || !endDate}
            style={{ flex: 1 }}
          >
            Submit
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: "rgba(0,137,123,0.2)", borderWidth: 1, borderColor: "rgba(0,137,123,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#e0f2f1", fontWeight: "700" },
  chips: { flexDirection: "row", gap: 6, marginTop: 2 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: "#0d2137", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderLeftWidth: 3,
  },
  cardRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  typeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dateRange: { color: "#e0f2f1", fontWeight: "600" },
  dayCount: { color: "rgba(255,255,255,0.4)", fontWeight: "400" },
  reason: { color: "rgba(255,255,255,0.5)", marginTop: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { color: "rgba(255,255,255,0.5)", fontWeight: "600", marginTop: 12, fontSize: 16 },
  emptySub: { color: "rgba(255,255,255,0.3)", marginTop: 6, textAlign: "center" },
  errorBox: { margin: 16, padding: 12, backgroundColor: "rgba(239,83,80,0.1)", borderRadius: 8 },
  errorText: { color: "#ef5350" },
  modal: { flex: 1, backgroundColor: "#0d2137" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { color: "#e0f2f1", fontWeight: "700" },
  modalBody: { padding: 20, gap: 4 },
  modalFooter: {
    flexDirection: "row", gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  fieldLabel: { color: "rgba(255,255,255,0.5)", marginBottom: 6, marginTop: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  input: { backgroundColor: "#112240", marginBottom: 4 },
});
