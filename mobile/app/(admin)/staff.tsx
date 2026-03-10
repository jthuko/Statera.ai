import { useCallback, useEffect, useState } from "react";
import {
  FlatList, Modal, ScrollView, StyleSheet, TouchableOpacity, View, Alert,
} from "react-native";
import {
  Text, Searchbar, ActivityIndicator, FAB, TextInput, Button, Switch,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../../src/auth/AuthContext";
import {
  listStaffDirectory, createStaff, updateStaff, deleteStaff,
  StaffDirectoryEntry,
} from "../../src/api/admin";

const EMPLOYMENT_TYPES = ["FullTime", "PartTime", "PerDiem", "Contract"];

interface StaffForm {
  firstName: string;
  lastName: string;
  role: string;
  employmentType: string;
  email: string;
  phone: string;
  active: boolean;
}

const emptyForm = (): StaffForm => ({
  firstName: "", lastName: "", role: "",
  employmentType: "FullTime", email: "", phone: "", active: true,
});

function formFromEntry(s: StaffDirectoryEntry): StaffForm {
  return {
    firstName: s.firstName, lastName: s.lastName, role: s.role,
    employmentType: "FullTime", email: s.email ?? "", phone: s.phone ?? "",
    active: s.active,
  };
}

export default function AdminStaffScreen() {
  const { user } = useAuth();
  const facilityId = user?.facilityIds?.[0];

  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!facilityId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await listStaffDirectory(facilityId, { active: activeOnly || undefined });
      setStaff(data);
    } catch { setError("Failed to load staff."); }
    finally { setLoading(false); }
  }, [facilityId, activeOnly]);

  useEffect(() => { load(); }, [load]);

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    return q === "" ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      (s.role ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q);
  });

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setModalVisible(true);
  }

  function openEdit(s: StaffDirectoryEntry) {
    setEditingId(s.id);
    setForm(formFromEntry(s));
    setFormError(null);
    setModalVisible(true);
  }

  function confirmDelete(s: StaffDirectoryEntry) {
    Alert.alert(
      "Delete Staff",
      `Remove ${s.firstName} ${s.lastName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await deleteStaff(s.id);
              setStaff(prev => prev.filter(x => x.id !== s.id));
            } catch {
              Alert.alert("Error", "Failed to delete staff member.");
            }
          },
        },
      ],
    );
  }

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.role.trim()) {
      setFormError("First name, last name, and role are required.");
      return;
    }
    if (!facilityId) { setFormError("No facility found."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        const updated = await updateStaff(editingId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role.trim(),
          employmentType: form.employmentType,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          active: form.active,
        });
        setStaff(prev => prev.map(s => s.id === editingId ? { ...s, ...updated } : s));
      } else {
        const created = await createStaff({
          facilityId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role.trim(),
          employmentType: form.employmentType,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          active: form.active,
        });
        setStaff(prev => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Failed to save. Please try again.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const licenseWarningSoon = (entry: StaffDirectoryEntry) => {
    if (!entry.licenseExpiresOn) return false;
    return dayjs(entry.licenseExpiresOn).diff(dayjs(), "day") <= 30;
  };

  const licenseExpired = (entry: StaffDirectoryEntry) => {
    if (!entry.licenseExpiresOn) return false;
    return dayjs(entry.licenseExpiresOn).isBefore(dayjs(), "day");
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Searchbar
          placeholder="Search name, role, email…"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ color: "#e0f2f1" }}
          iconColor="#4db6ac"
          placeholderTextColor="rgba(255,255,255,0.4)"
        />
        <TouchableOpacity
          style={[styles.activeToggle, activeOnly && styles.activeToggleOn]}
          onPress={() => setActiveOnly(v => !v)}
        >
          <Text style={{ color: activeOnly ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Active only
          </Text>
        </TouchableOpacity>
      </View>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {loading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="account-group-outline" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No staff found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: s }) => {
            const isOpen = expanded === s.id;
            const expired = licenseExpired(s);
            const warnSoon = !expired && licenseWarningSoon(s);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpanded(isOpen ? null : s.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>
                      {s.firstName[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text variant="bodyMedium" style={styles.name}>
                        {s.firstName} {s.lastName}
                      </Text>
                      {!s.active && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveText}>Inactive</Text>
                        </View>
                      )}
                      {expired && (
                        <View style={styles.expiredBadge}>
                          <Text style={styles.expiredText}>License expired</Text>
                        </View>
                      )}
                      {warnSoon && (
                        <View style={styles.warnBadge}>
                          <Text style={styles.warnText}>Expiring soon</Text>
                        </View>
                      )}
                    </View>
                    <Text variant="bodySmall" style={styles.role}>{s.role}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="rgba(255,255,255,0.3)"
                  />
                </View>

                {isOpen && (
                  <View style={styles.details}>
                    {s.email && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="email-outline" size={14} color="rgba(255,255,255,0.4)" />
                        <Text variant="bodySmall" style={styles.detailText}>{s.email}</Text>
                      </View>
                    )}
                    {s.phone && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="phone-outline" size={14} color="rgba(255,255,255,0.4)" />
                        <Text variant="bodySmall" style={styles.detailText}>{s.phone}</Text>
                      </View>
                    )}
                    {s.licenseExpiresOn && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="card-account-details-outline"
                          size={14}
                          color={expired ? "#ef5350" : warnSoon ? "#f57c00" : "rgba(255,255,255,0.4)"}
                        />
                        <Text
                          variant="bodySmall"
                          style={[styles.detailText, expired && { color: "#ef5350" }, warnSoon && { color: "#f57c00" }]}
                        >
                          License expires {dayjs(s.licenseExpiresOn).format("MMM D, YYYY")}
                        </Text>
                      </View>
                    )}
                    {/* Edit / Delete actions */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(s)}>
                        <MaterialCommunityIcons name="pencil-outline" size={15} color="#4db6ac" />
                        <Text style={styles.actionBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => confirmDelete(s)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={15} color="#ef5350" />
                        <Text style={[styles.actionBtnText, { color: "#ef5350" }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListHeaderComponent={
            <Text variant="labelSmall" style={styles.countLabel}>
              {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
            </Text>
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={openAdd}
      />

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text variant="titleMedium" style={styles.modalTitle}>
                {editingId ? "Edit Staff Member" : "Add Staff Member"}
              </Text>

              <TextInput
                label="First Name *"
                value={form.firstName}
                onChangeText={v => setForm(f => ({ ...f, firstName: v }))}
                mode="outlined"
                style={styles.input}
                outlineColor="rgba(255,255,255,0.2)"
                activeOutlineColor="#4db6ac"
              />
              <TextInput
                label="Last Name *"
                value={form.lastName}
                onChangeText={v => setForm(f => ({ ...f, lastName: v }))}
                mode="outlined"
                style={styles.input}
                outlineColor="rgba(255,255,255,0.2)"
                activeOutlineColor="#4db6ac"
              />
              <TextInput
                label="Role *"
                value={form.role}
                onChangeText={v => setForm(f => ({ ...f, role: v }))}
                mode="outlined"
                style={styles.input}
                outlineColor="rgba(255,255,255,0.2)"
                activeOutlineColor="#4db6ac"
                placeholder="e.g. RN, LPN, CNA"
              />

              <Text style={styles.fieldLabel}>Employment Type</Text>
              <View style={styles.etRow}>
                {EMPLOYMENT_TYPES.map(et => (
                  <TouchableOpacity
                    key={et}
                    style={[styles.etChip, form.employmentType === et && styles.etChipSelected]}
                    onPress={() => setForm(f => ({ ...f, employmentType: et }))}
                  >
                    <Text style={[styles.etChipText, form.employmentType === et && styles.etChipTextSelected]}>
                      {et}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                label="Email"
                value={form.email}
                onChangeText={v => setForm(f => ({ ...f, email: v }))}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                outlineColor="rgba(255,255,255,0.2)"
                activeOutlineColor="#4db6ac"
              />
              <TextInput
                label="Phone"
                value={form.phone}
                onChangeText={v => setForm(f => ({ ...f, phone: v }))}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                outlineColor="rgba(255,255,255,0.2)"
                activeOutlineColor="#4db6ac"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={form.active}
                  onValueChange={v => setForm(f => ({ ...f, active: v }))}
                  color="#00897b"
                />
              </View>

              {formError && <Text style={styles.formError}>{formError}</Text>}

              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                style={styles.submitBtn}
                buttonColor="#00897b"
                textColor="#fff"
              >
                {editingId ? "Save Changes" : "Add Staff"}
              </Button>
              <Button
                mode="text"
                onPress={() => setModalVisible(false)}
                disabled={submitting}
                textColor="rgba(255,255,255,0.5)"
                style={{ marginTop: 4, marginBottom: 16 }}
              >
                Cancel
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  topBar: { padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  searchbar: { backgroundColor: "#0d2137" },
  activeToggle: {
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  activeToggleOn: { backgroundColor: "#00897b", borderColor: "#00897b" },
  errorBox: { margin: 16, padding: 12, backgroundColor: "rgba(239,83,80,0.1)", borderRadius: 8 },
  errorText: { color: "#ef5350" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontWeight: "600" },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  countLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.6, marginBottom: 8 },
  card: {
    backgroundColor: "#0d2137", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,137,123,0.25)", alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { color: "#4db6ac", fontWeight: "700", fontSize: 15 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { color: "#e0f2f1", fontWeight: "600" },
  role: { color: "rgba(255,255,255,0.45)", marginTop: 2 },
  inactiveBadge: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  inactiveText: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
  expiredBadge: { backgroundColor: "rgba(239,83,80,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  expiredText: { color: "#ef5350", fontSize: 10 },
  warnBadge: { backgroundColor: "rgba(245,124,0,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  warnText: { color: "#f57c00", fontSize: 10 },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { color: "rgba(255,255,255,0.6)" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(77,182,172,0.3)",
  },
  deleteBtn: { borderColor: "rgba(239,83,80,0.3)" },
  actionBtnText: { color: "#4db6ac", fontSize: 13 },
  fab: { position: "absolute", bottom: 24, right: 20, backgroundColor: "#00897b" },
  // Modal
  modalOverlay: {
    flex: 1, justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    backgroundColor: "#0d2137", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "90%", paddingHorizontal: 20, paddingTop: 20,
  },
  modalTitle: { color: "#e0f2f1", fontWeight: "700", marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: "#112240" },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8, marginTop: 4 },
  etRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  etChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  etChipSelected: { backgroundColor: "#00897b", borderColor: "#00897b" },
  etChipText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  etChipTextSelected: { color: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  switchLabel: { color: "#e0f2f1", fontSize: 15 },
  formError: { color: "#ef5350", marginBottom: 10, fontSize: 13 },
  submitBtn: { borderRadius: 8, marginBottom: 8 },
});
