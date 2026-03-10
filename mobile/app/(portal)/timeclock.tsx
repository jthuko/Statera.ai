import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView, StyleSheet, View, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Text, Button, TextInput, ActivityIndicator, Divider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useAuth } from "../../src/auth/AuthContext";
import {
  clockIn, clockOut, lunchOut, lunchReturn,
  getActiveEntry, listTimeClockEntries, submitCorrection,
  TimeClockEntryDto,
} from "../../src/api/timeclock";

dayjs.extend(duration);

const STATUS_COLOR: Record<string, string> = {
  ClockedIn: "#2e7d32",
  OnLunch: "#f57c00",
  ClockedOut: "rgba(255,255,255,0.4)",
  Approved: "#2e7d32",
  Denied: "#c62828",
  Adjusted: "#1565c0",
  PendingCorrection: "#f57c00",
};

const STATUS_LABEL: Record<string, string> = {
  ClockedIn: "Clocked In",
  OnLunch: "On Lunch",
  ClockedOut: "Clocked Out",
  Approved: "Approved",
  Denied: "Denied",
  Adjusted: "Adjusted",
  PendingCorrection: "Pending Correction",
};

function elapsed(from: string, to?: string | null): string {
  const start = dayjs(from);
  const end = to ? dayjs(to) : dayjs();
  const diff = end.diff(start);
  const d = dayjs.duration(diff);
  const h = Math.floor(d.asHours());
  const m = d.minutes();
  return `${h}h ${m}m`;
}

export default function TimeClockScreen() {
  const { user } = useAuth();
  const [active, setActive] = useState<TimeClockEntryDto | null>(null);
  const [history, setHistory] = useState<TimeClockEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [correctionEntry, setCorrectionEntry] = useState<TimeClockEntryDto | null>(null);

  // live clock tick every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const [act, hist] = await Promise.all([
        getActiveEntry(user?.staffId),
        listTimeClockEntries({ staffId: user?.staffId, page: 1, pageSize: 20 }),
      ]);
      setActive(act);
      setHistory(hist.items.filter(e => e.status !== "ClockedIn" && e.status !== "OnLunch"));
    } catch { setError("Failed to load time clock."); }
    finally { setLoading(false); }
  }, [user?.staffId]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: "in" | "out" | "lunch-out" | "lunch-return") {
    if (!user?.facilityIds?.[0] && action === "in") {
      setError("No facility assigned."); return;
    }
    setBusy(true); setError(null);
    try {
      switch (action) {
        case "in":          await clockIn(user!.facilityIds![0], user?.staffId); break;
        case "out":         await clockOut(user?.staffId); break;
        case "lunch-out":   await lunchOut(user?.staffId); break;
        case "lunch-return": await lunchReturn(user?.staffId); break;
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Action failed.");
    } finally { setBusy(false); }
  }

  function confirmClockOut() {
    Alert.alert("Clock Out", "Are you sure you want to clock out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clock Out", style: "destructive", onPress: () => handleAction("out") },
    ]);
  }

  const isClockedIn = active?.status === "ClockedIn";
  const isOnLunch   = active?.status === "OnLunch";

  return (
    <View style={styles.root}>
      {/* Active punch card */}
      <View style={styles.clockCard}>
        <View style={styles.clockCardTop}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#4db6ac" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={styles.clockTitle}>Time Clock</Text>
            {active ? (
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: STATUS_COLOR[active.status] }]} />
                <Text style={[styles.statusLabel, { color: STATUS_COLOR[active.status] }]}>
                  {STATUS_LABEL[active.status]}
                </Text>
                <Text style={styles.elapsed}>
                  · {elapsed(isClockedIn ? active.clockInUtc : active.lunchOutUtc!, null)}
                </Text>
              </View>
            ) : (
              <Text style={styles.notClockedIn}>Not clocked in</Text>
            )}
          </View>
        </View>

        {active && (
          <View style={styles.clockMeta}>
            <MetaItem icon="login" label="Clocked in" value={dayjs(active.clockInUtc).format("h:mm a")} />
            {active.lunchOutUtc && (
              <MetaItem icon="food-fork-drink" label="Lunch out" value={dayjs(active.lunchOutUtc).format("h:mm a")} />
            )}
            {active.lunchInUtc && (
              <MetaItem icon="keyboard-return" label="Lunch return" value={dayjs(active.lunchInUtc).format("h:mm a")} />
            )}
            {active.lunchMinutes != null && (
              <MetaItem icon="timer-outline" label="Lunch" value={`${active.lunchMinutes} min`} />
            )}
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {!active && (
            <Button
              mode="contained" buttonColor="#00897b" textColor="#fff"
              loading={busy} disabled={busy} onPress={() => handleAction("in")}
              icon="login" style={{ flex: 1 }}
            >
              Clock In
            </Button>
          )}
          {isClockedIn && (
            <>
              <Button
                mode="outlined" textColor="#f57c00"
                loading={busy} disabled={busy} onPress={() => handleAction("lunch-out")}
                icon="food-fork-drink" style={[styles.actionBtn, { borderColor: "#f57c00" }]}
              >
                Lunch Out
              </Button>
              <Button
                mode="outlined" textColor="#ef5350"
                loading={busy} disabled={busy} onPress={confirmClockOut}
                icon="logout" style={[styles.actionBtn, { borderColor: "#ef5350" }]}
              >
                Clock Out
              </Button>
            </>
          )}
          {isOnLunch && (
            <>
              <Button
                mode="outlined" textColor="#4db6ac"
                loading={busy} disabled={busy} onPress={() => handleAction("lunch-return")}
                icon="keyboard-return" style={[styles.actionBtn, { borderColor: "#4db6ac" }]}
              >
                Return from Lunch
              </Button>
              <Button
                mode="outlined" textColor="#ef5350"
                loading={busy} disabled={busy} onPress={confirmClockOut}
                icon="logout" style={[styles.actionBtn, { borderColor: "#ef5350" }]}
              >
                Clock Out
              </Button>
            </>
          )}
        </View>
      </View>

      {/* History */}
      <View style={styles.historyHeader}>
        <Text variant="labelMedium" style={styles.historyTitle}>RECENT ENTRIES</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clock-remove-outline" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No time clock history yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {history.map(entry => {
            const workedMin = entry.clockOutUtc
              ? dayjs(entry.clockOutUtc).diff(dayjs(entry.clockInUtc), "minute") - (entry.lunchMinutes ?? 0)
              : null;
            const workedH = workedMin != null ? Math.floor(workedMin / 60) : null;
            const workedM = workedMin != null ? workedMin % 60 : null;

            return (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryCard}
                onPress={() => setCorrectionEntry(entry)}
                activeOpacity={0.8}
              >
                <View style={styles.entryRow}>
                  <View>
                    <Text variant="bodyMedium" style={styles.entryDate}>
                      {dayjs(entry.clockInUtc).format("ddd, MMM D")}
                    </Text>
                    <Text variant="bodySmall" style={styles.entryTime}>
                      {dayjs(entry.clockInUtc).format("h:mm a")}
                      {entry.clockOutUtc ? ` – ${dayjs(entry.clockOutUtc).format("h:mm a")}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {workedH != null && (
                      <Text variant="bodyMedium" style={styles.entryHours}>{workedH}h {workedM}m</Text>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[entry.status] + "22" }]}>
                      <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[entry.status] }]}>
                        {STATUS_LABEL[entry.status]}
                      </Text>
                    </View>
                  </View>
                </View>
                {entry.lunchMinutes != null && (
                  <Text variant="bodySmall" style={styles.entryLunch}>Lunch: {entry.lunchMinutes} min</Text>
                )}
                {entry.adminNotes && (
                  <Text variant="bodySmall" style={styles.entryNotes}>{entry.adminNotes}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <CorrectionModal
        entry={correctionEntry}
        onClose={() => setCorrectionEntry(null)}
        onSubmitted={() => { setCorrectionEntry(null); load(); }}
      />
    </View>
  );
}

function MetaItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <MaterialCommunityIcons name={icon as any} size={14} color="rgba(255,255,255,0.4)" />
      <Text variant="bodySmall" style={styles.metaLabel}>{label}</Text>
      <Text variant="bodySmall" style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function CorrectionModal({ entry, onClose, onSubmitted }: {
  entry: TimeClockEntryDto | null; onClose: () => void; onSubmitted: () => void;
}) {
  const [clockInVal, setClockInVal] = useState("");
  const [clockOutVal, setClockOutVal] = useState("");
  const [lunchOutVal, setLunchOutVal] = useState("");
  const [lunchInVal, setLunchInVal] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setClockInVal(entry.clockInUtc ? dayjs(entry.clockInUtc).format("YYYY-MM-DD HH:mm") : "");
      setClockOutVal(entry.clockOutUtc ? dayjs(entry.clockOutUtc).format("YYYY-MM-DD HH:mm") : "");
      setLunchOutVal(entry.lunchOutUtc ? dayjs(entry.lunchOutUtc).format("YYYY-MM-DD HH:mm") : "");
      setLunchInVal(entry.lunchInUtc ? dayjs(entry.lunchInUtc).format("YYYY-MM-DD HH:mm") : "");
      setNotes("");
      setError(null);
    }
  }, [entry]);

  async function handleSubmit() {
    if (!entry) return;
    setBusy(true); setError(null);
    try {
      await submitCorrection(entry.id, {
        notes,
        clockInUtc: clockInVal ? dayjs(clockInVal).toISOString() : undefined,
        clockOutUtc: clockOutVal ? dayjs(clockOutVal).toISOString() : null,
        lunchOutUtc: lunchOutVal ? dayjs(lunchOutVal).toISOString() : null,
        lunchInUtc: lunchInVal ? dayjs(lunchInVal).toISOString() : null,
      });
      onSubmitted();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to submit correction.");
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={!!entry} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}>
          <Text variant="titleLarge" style={styles.modalTitle}>Request Correction</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text variant="bodySmall" style={styles.correctionHint}>
            Edit the times below and add a note explaining the correction. Your manager will review it.
          </Text>

          <FieldLabel>Clock In (YYYY-MM-DD HH:mm)</FieldLabel>
          <TextInput mode="outlined" value={clockInVal} onChangeText={setClockInVal}
            outlineColor="rgba(255,255,255,0.15)" activeOutlineColor="#4db6ac" style={styles.input} />

          <FieldLabel>Clock Out (YYYY-MM-DD HH:mm)</FieldLabel>
          <TextInput mode="outlined" value={clockOutVal} onChangeText={setClockOutVal}
            outlineColor="rgba(255,255,255,0.15)" activeOutlineColor="#4db6ac" style={styles.input} />

          <FieldLabel>Lunch Out (optional)</FieldLabel>
          <TextInput mode="outlined" value={lunchOutVal} onChangeText={setLunchOutVal}
            outlineColor="rgba(255,255,255,0.15)" activeOutlineColor="#4db6ac" style={styles.input} />

          <FieldLabel>Lunch Return (optional)</FieldLabel>
          <TextInput mode="outlined" value={lunchInVal} onChangeText={setLunchInVal}
            outlineColor="rgba(255,255,255,0.15)" activeOutlineColor="#4db6ac" style={styles.input} />

          <FieldLabel>Reason / Notes</FieldLabel>
          <TextInput mode="outlined" value={notes} onChangeText={setNotes}
            placeholder="Explain the correction…" multiline numberOfLines={3}
            outlineColor="rgba(255,255,255,0.15)" activeOutlineColor="#4db6ac" style={styles.input} />

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button mode="outlined" onPress={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</Button>
          <Button mode="contained" buttonColor="#00897b" textColor="#fff"
            onPress={handleSubmit} loading={busy} disabled={busy || !notes}
            style={{ flex: 1 }}>
            Submit
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text variant="labelMedium" style={styles.fieldLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },

  // clock card
  clockCard: {
    margin: 16, backgroundColor: "#0d2137", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16,
  },
  clockCardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(0,137,123,0.2)", borderWidth: 1, borderColor: "rgba(0,137,123,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  clockTitle: { color: "#e0f2f1", fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: "600" },
  elapsed: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  notClockedIn: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 },
  clockMeta: { gap: 4, marginBottom: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  metaValue: { color: "#e0f2f1", fontSize: 12 },
  errorBox: { padding: 10, backgroundColor: "rgba(239,83,80,0.1)", borderRadius: 8, marginBottom: 10 },
  errorText: { color: "#ef5350", fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1 },

  // history
  historyHeader: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
  historyTitle: { color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 0.8 },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  entryCard: {
    backgroundColor: "#0d2137", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  entryDate: { color: "#e0f2f1", fontWeight: "600" },
  entryTime: { color: "rgba(255,255,255,0.5)", marginTop: 2 },
  entryHours: { color: "#4db6ac", fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  entryLunch: { color: "rgba(255,255,255,0.4)", marginTop: 6 },
  entryNotes: { color: "rgba(255,255,255,0.5)", marginTop: 4, fontStyle: "italic" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, marginTop: 40 },
  emptyText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontWeight: "600" },

  // correction modal
  modal: { flex: 1, backgroundColor: "#0d2137" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { color: "#e0f2f1", fontWeight: "700" },
  modalBody: { padding: 20, gap: 4 },
  correctionHint: { color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: "#112240", marginBottom: 4 },
  modalFooter: {
    flexDirection: "row", gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
});
