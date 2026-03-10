import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, Card, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import { getClockedInCount, listAdminTimeClock, listAdminTimeOff } from "../../src/api/admin";

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const facilityId = user?.facilityIds?.[0];

  const [clockedIn, setClockedIn] = useState<number | null>(null);
  const [pendingTimeOff, setPendingTimeOff] = useState<number | null>(null);
  const [pendingCorrections, setPendingCorrections] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!facilityId) { setLoading(false); return; }
    try {
      const [count, timeOff, corrections] = await Promise.all([
        getClockedInCount(facilityId),
        listAdminTimeOff({ facilityId, status: "Pending", pageSize: 1 }),
        listAdminTimeClock({ facilityId, status: "PendingCorrection", pageSize: 1 }),
      ]);
      setClockedIn(count);
      setPendingTimeOff(timeOff.total);
      setPendingCorrections(corrections.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  const hour = dayjs().hour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user?.email?.split("@")[0] ?? "";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.greeting}>{greeting}, {name}</Text>
      <Text variant="bodyMedium" style={styles.date}>{dayjs().format("dddd, MMMM D, YYYY")}</Text>

      <Text variant="labelMedium" style={styles.sectionLabel}>TODAY AT A GLANCE</Text>

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
      ) : (
        <>
          <StatCard
            icon="account-clock-outline"
            iconColor="#4db6ac"
            label="Currently Clocked In"
            value={clockedIn ?? 0}
            bg="rgba(0,137,123,0.15)"
          />
          <StatCard
            icon="beach"
            iconColor="#f57c00"
            label="Pending Time Off Requests"
            value={pendingTimeOff ?? 0}
            bg="rgba(245,124,0,0.12)"
            highlight={(pendingTimeOff ?? 0) > 0}
          />
          <StatCard
            icon="clock-alert-outline"
            iconColor="#9c27b0"
            label="Pending Clock Corrections"
            value={pendingCorrections ?? 0}
            bg="rgba(156,39,176,0.12)"
            highlight={(pendingCorrections ?? 0) > 0}
          />

          <Card style={styles.webCard}>
            <Card.Content style={styles.webCardContent}>
              <MaterialCommunityIcons name="web" size={20} color="#4db6ac" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="titleSmall" style={styles.webCardTitle}>Full Admin Panel</Text>
                <Text variant="bodySmall" style={styles.webCardSub}>
                  Scheduler, staff management, billing, and more at statera-ai.com
                </Text>
              </View>
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ icon, iconColor, label, value, bg, highlight = false }: {
  icon: string; iconColor: string; label: string; value: number; bg: string; highlight?: boolean;
}) {
  return (
    <Card style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Card.Content style={styles.statCardContent}>
        <View style={[styles.statIcon, { backgroundColor: bg }]}>
          <MaterialCommunityIcons name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelSmall" style={styles.statLabel}>{label}</Text>
          <Text variant="headlineMedium" style={[styles.statValue, highlight && { color: iconColor }]}>
            {value}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { color: "#e0f2f1", fontWeight: "700" },
  date: { color: "rgba(255,255,255,0.5)", marginTop: 4, marginBottom: 24 },
  sectionLabel: { color: "rgba(255,255,255,0.4)", letterSpacing: 0.8, fontSize: 11, marginBottom: 12 },
  statCard: {
    backgroundColor: "#0d2137", borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  statCardHighlight: { borderColor: "rgba(245,124,0,0.3)" },
  statCardContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  statIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  statValue: { color: "#e0f2f1", fontWeight: "700" },
  webCard: {
    backgroundColor: "#0d2137", borderRadius: 12, marginTop: 8,
    borderWidth: 1, borderColor: "rgba(0,137,123,0.2)",
  },
  webCardContent: { flexDirection: "row", alignItems: "center" },
  webCardTitle: { color: "#e0f2f1", fontWeight: "600" },
  webCardSub: { color: "rgba(255,255,255,0.4)", marginTop: 2 },
});
