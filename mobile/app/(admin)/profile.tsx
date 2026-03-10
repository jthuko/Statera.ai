import { StyleSheet, View, Alert } from "react-native";
import { ScrollView } from "react-native";
import { Text, Button, Card, Divider } from "react-native-paper";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  Owner: "Owner",
  FacilityAdmin: "Facility Admin",
  Staff: "Staff",
};

export default function AdminProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {(user?.email ?? "?")[0].toUpperCase()}
          </Text>
        </View>
        <Text variant="titleLarge" style={styles.email}>{user?.email}</Text>
        <Text variant="bodyMedium" style={styles.role}>
          {ROLE_LABEL[user?.systemRole ?? ""] ?? user?.systemRole}
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <InfoRow label="Account Type" value={ROLE_LABEL[user?.systemRole ?? ""] ?? "—"} />
          <Divider style={styles.divider} />
          <InfoRow label="Facilities" value={`${user?.facilityIds?.length ?? 0} facility`} />
          <Divider style={styles.divider} />
          <InfoRow label="Full Admin Panel" value="statera-ai.com" />
        </Card.Content>
      </Card>

      <Button
        mode="outlined"
        onPress={handleLogout}
        style={styles.logoutBtn}
        textColor="#ef5350"
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 10 }}>
      <Text variant="labelSmall" style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{label}</Text>
      <Text variant="bodyMedium" style={{ color: "#e0f2f1" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  content: { padding: 20, paddingBottom: 40 },
  avatarWrap: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(0,137,123,0.25)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#4db6ac",
    marginBottom: 12,
  },
  avatarLetter: { color: "#4db6ac", fontSize: 28, fontWeight: "700" },
  email: { color: "#e0f2f1", fontWeight: "700" },
  role: { color: "rgba(255,255,255,0.5)", marginTop: 4 },
  card: {
    backgroundColor: "#0d2137", borderRadius: 12, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  divider: { backgroundColor: "rgba(255,255,255,0.07)" },
  logoutBtn: { borderColor: "#ef5350", borderRadius: 8 },
});
