import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, Alert } from "react-native";
import { Text, Card, Button, ActivityIndicator, Divider, TextInput } from "react-native-paper";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { getMyProfile, updateMyProfile, MyProfileDto } from "../../src/api/staff";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  useEffect(() => {
    getMyProfile().then(p => {
      setProfile(p);
      setPhone(p.phone ?? "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function startEdit() {
    setPhone(profile?.phone ?? "");
    setEmergencyName("");
    setEmergencyPhone("");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        phone: phone.trim() || null,
        emergencyContactName: emergencyName.trim() || null,
        emergencyContactPhone: emergencyPhone.trim() || null,
      });
      setProfile(updated);
      setEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

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

  if (editing) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text variant="titleMedium" style={styles.editTitle}>Edit Profile</Text>
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              outlineColor="rgba(255,255,255,0.2)"
              activeOutlineColor="#4db6ac"
            />
            <TextInput
              label="Emergency Contact Name"
              value={emergencyName}
              onChangeText={setEmergencyName}
              mode="outlined"
              style={styles.input}
              outlineColor="rgba(255,255,255,0.2)"
              activeOutlineColor="#4db6ac"
            />
            <TextInput
              label="Emergency Contact Phone"
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              outlineColor="rgba(255,255,255,0.2)"
              activeOutlineColor="#4db6ac"
            />
          </Card.Content>
        </Card>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
          buttonColor="#00897b"
          textColor="#fff"
        >
          Save Changes
        </Button>
        <Button
          mode="text"
          onPress={() => setEditing(false)}
          disabled={saving}
          textColor="rgba(255,255,255,0.5)"
          style={{ marginTop: 4 }}
        >
          Cancel
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {(profile?.firstName ?? user?.email ?? "?")[0].toUpperCase()}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color="#4db6ac" style={{ marginTop: 12 }} />
        ) : (
          <>
            <Text variant="titleLarge" style={styles.name}>
              {profile ? `${profile.firstName} ${profile.lastName}` : user?.email}
            </Text>
            <Text variant="bodyMedium" style={styles.role}>{profile?.role}</Text>
          </>
        )}
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <InfoRow label="Email" value={profile?.email ?? user?.email ?? "—"} />
          <Divider style={styles.divider} />
          <InfoRow label="Phone" value={profile?.phone ?? "—"} />
          <Divider style={styles.divider} />
          <InfoRow
            label="License Expires"
            value={profile?.licenseExpiresOn ? dayjs(profile.licenseExpiresOn).format("MMM D, YYYY") : "—"}
            warn={profile?.licenseExpiresOn ? dayjs(profile.licenseExpiresOn).isBefore(dayjs(), "day") : false}
          />
        </Card.Content>
      </Card>

      <Button
        mode="outlined"
        onPress={startEdit}
        style={styles.editBtn}
        textColor="#4db6ac"
      >
        Edit Profile
      </Button>

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

function InfoRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ paddingVertical: 10 }}>
      <Text variant="labelSmall" style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{label}</Text>
      <Text variant="bodyMedium" style={{ color: warn ? "#ef5350" : "#e0f2f1" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  content: { padding: 20, paddingBottom: 40 },
  editTitle: { color: "#e0f2f1", fontWeight: "700", marginBottom: 16 },
  avatarWrap: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(0,137,123,0.25)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#4db6ac",
    marginBottom: 12,
  },
  avatarLetter: { color: "#4db6ac", fontSize: 28, fontWeight: "700" },
  name: { color: "#e0f2f1", fontWeight: "700" },
  role: { color: "rgba(255,255,255,0.5)", marginTop: 4 },
  card: {
    backgroundColor: "#0d2137", borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  input: { marginBottom: 12, backgroundColor: "#112240" },
  divider: { backgroundColor: "rgba(255,255,255,0.07)" },
  editBtn: { borderColor: "#4db6ac", borderRadius: 8, marginBottom: 10 },
  saveBtn: { borderRadius: 8, marginBottom: 8 },
  logoutBtn: { borderColor: "#ef5350", borderRadius: 8 },
});
