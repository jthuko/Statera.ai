import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, Card, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import { getMyProfile, MyProfileDto } from "../../src/api/staff";
import { getActiveEntry, TimeClockEntryDto } from "../../src/api/timeclock";

export default function DashboardScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MyProfileDto | null>(null);
  const [clockEntry, setClockEntry] = useState<TimeClockEntryDto | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMyProfile().catch(() => null),
      getActiveEntry(user?.staffId ?? undefined).catch(() => null),
    ]).then(([p, c]) => {
      setProfile(p);
      setClockEntry(c);
    }).finally(() => setLoading(false));
  }, [user?.staffId]);

  const hour = dayjs().hour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = profile ? profile.firstName : (user?.email?.split("@")[0] ?? "");

  const licenseExpired = profile?.licenseExpiresOn
    ? dayjs(profile.licenseExpiresOn).isBefore(dayjs(), "day")
    : false;

  const isClockedIn = clockEntry && clockEntry.status === "ClockedIn";
  const isOnLunch = clockEntry && clockEntry.status === "OnLunch";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.greeting}>{greeting}, {name}</Text>
      <Text variant="bodyMedium" style={styles.date}>{dayjs().format("dddd, MMMM D, YYYY")}</Text>

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
      ) : (
        <>
          {/* Clock-in status */}
          <Card style={[styles.card, isClockedIn || isOnLunch ? styles.clockedInCard : styles.clockedOutCard]}>
            <Card.Content>
              <View style={styles.clockRow}>
                <MaterialCommunityIcons
                  name={isClockedIn ? "clock-check" : isOnLunch ? "food-fork-drink" : "clock-outline"}
                  size={22}
                  color={isClockedIn ? "#4db6ac" : isOnLunch ? "#f57c00" : "rgba(255,255,255,0.35)"}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text variant="titleSmall" style={styles.cardLabel}>
                    {isClockedIn ? "CLOCKED IN" : isOnLunch ? "ON LUNCH" : "NOT CLOCKED IN"}
                  </Text>
                  {clockEntry && (
                    <Text variant="bodySmall" style={styles.clockTime}>
                      Since {dayjs(clockEntry.clockInUtc).format("h:mm a")}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusDot, {
                  backgroundColor: isClockedIn ? "#4db6ac" : isOnLunch ? "#f57c00" : "rgba(255,255,255,0.2)"
                }]} />
              </View>
            </Card.Content>
          </Card>

          {licenseExpired && (
            <Card style={[styles.card, styles.warnCard]}>
              <Card.Content>
                <Text variant="titleSmall" style={{ color: "#ef5350" }}>License Expired</Text>
                <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                  Your license expired on {dayjs(profile!.licenseExpiresOn).format("MMM D, YYYY")}.
                  Please contact your administrator.
                </Text>
              </Card.Content>
            </Card>
          )}

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.cardLabel}>YOUR ROLE</Text>
              <Text variant="titleLarge" style={styles.cardValue}>{profile?.role ?? "—"}</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.cardLabel}>CONTACT</Text>
              <Text variant="bodyMedium" style={styles.cardValue}>{profile?.email ?? user?.email ?? "—"}</Text>
              {profile?.phone && (
                <Text variant="bodyMedium" style={[styles.cardValue, { marginTop: 4 }]}>{profile.phone}</Text>
              )}
            </Card.Content>
          </Card>

          {profile?.licenseExpiresOn && !licenseExpired && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.cardLabel}>LICENSE EXPIRES</Text>
                <Text variant="bodyMedium" style={styles.cardValue}>
                  {dayjs(profile.licenseExpiresOn).format("MMM D, YYYY")}
                </Text>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { color: "#e0f2f1", fontWeight: "700" },
  date: { color: "rgba(255,255,255,0.5)", marginTop: 4, marginBottom: 24 },
  card: {
    backgroundColor: "#0d2137",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  clockedInCard: { borderColor: "rgba(77,182,172,0.4)" },
  clockedOutCard: { borderColor: "rgba(255,255,255,0.08)" },
  warnCard: { borderColor: "rgba(239,83,80,0.4)" },
  clockRow: { flexDirection: "row", alignItems: "center" },
  cardLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
  cardValue: { color: "#e0f2f1" },
  clockTime: { color: "rgba(255,255,255,0.55)" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
