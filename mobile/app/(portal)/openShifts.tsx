import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, Card, Button, Chip, ActivityIndicator, IconButton } from "react-native-paper";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import {
  listOpenShifts, claimShift, withdrawRequest, listMyRequests,
  OpenShiftDto, OpenShiftRequestDto,
} from "../../src/api/openShifts";

export default function OpenShiftsScreen() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const [shifts, setShifts] = useState<OpenShiftDto[]>([]);
  const [myRequests, setMyRequests] = useState<OpenShiftRequestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = weekStart.endOf("week");

  const load = useCallback(async () => {
    const facilityId = user?.facilityIds?.[0];
    if (!facilityId) return;
    setLoading(true);
    try {
      const [data, reqs] = await Promise.all([
        listOpenShifts(facilityId, {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
          status: "Open",
        }),
        listMyRequests(),
      ]);
      setShifts(data);
      setMyRequests(reqs);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.facilityIds, weekStart]);

  useEffect(() => { load(); }, [load]);

  async function handleClaim(shift: OpenShiftDto) {
    setClaimBusy(shift.id); setError(null);
    try {
      await claimShift(shift.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to request shift.");
    } finally { setClaimBusy(null); }
  }

  async function handleWithdraw(shift: OpenShiftDto) {
    if (!shift.myRequestId) return;
    setClaimBusy(shift.id); setError(null);
    try {
      await withdrawRequest(shift.id, shift.myRequestId);
      await load();
    } catch { setError("Failed to withdraw."); }
    finally { setClaimBusy(null); }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Week nav */}
      <View style={styles.nav}>
        <IconButton icon="chevron-left" iconColor="#4db6ac" onPress={() => setWeekStart(w => w.subtract(1, "week"))} />
        <Text variant="titleSmall" style={styles.navLabel}>
          {weekStart.format("MMM D")} – {weekEnd.format("MMM D, YYYY")}
        </Text>
        <IconButton icon="chevron-right" iconColor="#4db6ac" onPress={() => setWeekStart(w => w.add(1, "week"))} />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
      ) : shifts.length === 0 ? (
        <Text style={styles.empty}>No open shifts available this week.</Text>
      ) : (
        shifts.map(shift => (
          <Card key={shift.id} style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.role}>{shift.role}</Text>
              <Text variant="bodySmall" style={styles.time}>
                {dayjs(shift.startUtc).format("ddd MMM D · h:mm a")} – {dayjs(shift.endUtc).format("h:mm a")}
              </Text>
              {shift.notes && (
                <Text variant="bodySmall" style={styles.notes}>{shift.notes}</Text>
              )}
              <View style={styles.actionRow}>
                {!shift.myRequestStatus && (
                  <Button
                    mode="contained"
                    compact
                    buttonColor="#00897b"
                    textColor="#fff"
                    loading={claimBusy === shift.id}
                    disabled={!!claimBusy}
                    onPress={() => handleClaim(shift)}
                    style={styles.claimBtn}
                  >
                    Request
                  </Button>
                )}
                {shift.myRequestStatus === "Pending" && (
                  <View style={styles.statusRow}>
                    <Chip style={styles.pendingChip} textStyle={{ color: "#f57c00", fontSize: 11 }}>Pending</Chip>
                    <Button
                      compact mode="text" textColor="rgba(255,255,255,0.5)"
                      disabled={!!claimBusy}
                      onPress={() => handleWithdraw(shift)}
                    >
                      Withdraw
                    </Button>
                  </View>
                )}
                {shift.myRequestStatus === "Approved" && (
                  <Chip style={styles.approvedChip} textStyle={{ color: "#2e7d32", fontSize: 11 }}>Approved</Chip>
                )}
                {shift.myRequestStatus === "Denied" && (
                  <Chip style={styles.deniedChip} textStyle={{ color: "#757575", fontSize: 11 }}>Denied</Chip>
                )}
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  content: { padding: 16, paddingBottom: 40 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  navLabel: { color: "#e0f2f1", fontWeight: "600" },
  card: {
    backgroundColor: "#0d2137", borderRadius: 10, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  role: { color: "#4db6ac", fontWeight: "700", marginBottom: 2 },
  time: { color: "#e0f2f1", marginBottom: 4 },
  notes: { color: "rgba(255,255,255,0.5)", marginBottom: 6 },
  actionRow: { marginTop: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  claimBtn: { alignSelf: "flex-start", borderRadius: 6 },
  pendingChip: { backgroundColor: "rgba(245,124,0,0.15)" },
  approvedChip: { backgroundColor: "rgba(46,125,50,0.15)" },
  deniedChip: { backgroundColor: "rgba(97,97,97,0.15)" },
  empty: { color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 48 },
  errorText: { color: "#ef5350", marginBottom: 12 },
});
