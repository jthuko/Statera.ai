import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  TouchableOpacity, View,
} from "react-native";
import { Text, TextInput, IconButton, ActivityIndicator, Searchbar } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useAuth } from "../auth/AuthContext";
import {
  listRooms, listMessages, sendMessage, markRoomRead, createRoom, listUsers,
  ChatRoomDto, ChatMessageDto, AppUserDto,
} from "../api/chat";
import { listFacilities } from "../api/admin";

export default function ChatScreen() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AppUserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dmBusy, setDmBusy] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);

  const flatRef = useRef<FlatList>(null);

  // Resolve facility ID — from JWT claims first, fallback to /facilities API
  async function resolveFacilityId(): Promise<string> {
    const fromToken = user?.facilityIds?.[0];
    if (fromToken) return fromToken;
    const facilities = await listFacilities();
    if (facilities.length > 0) return facilities[0].id;
    throw new Error("No facility found");
  }

  const loadRooms = useCallback(async () => {
    try { setRooms(await listRooms()); }
    catch { /* ignore */ }
    finally { setRoomsLoading(false); }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    if (!selectedRoom) return;
    const id = setInterval(async () => {
      try { setMessages(await listMessages(selectedRoom.id)); } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [selectedRoom]);

  async function openRoom(room: ChatRoomDto) {
    setSelectedRoom(room);
    setMsgLoading(true);
    try {
      const msgs = await listMessages(room.id);
      setMessages(msgs);
      await markRoomRead(room.id);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unreadCount: 0 } : r));
    } catch { /* ignore */ }
    finally { setMsgLoading(false); }
  }

  async function handleSend() {
    if (!selectedRoom || !msgText.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedRoom.id, msgText.trim());
      setMessages(prev => [...prev, msg]);
      setMsgText("");
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  async function openPicker() {
    setPickerOpen(true);
    setSearch("");
    setDmError(null);
    if (allUsers.length > 0) return;
    setUsersLoading(true);
    try {
      const users = await listUsers();
      setAllUsers(users.filter(u => u.id !== user?.id));
    } catch { setDmError("Could not load users."); }
    finally { setUsersLoading(false); }
  }

  async function startDm(target: AppUserDto) {
    setDmBusy(true); setDmError(null);
    try {
      const existing = rooms.find(r => r.type === "Direct" && r.members.some(m => m.userId === target.id));
      if (existing) { setPickerOpen(false); await openRoom(existing); return; }
      const facilityId = await resolveFacilityId();
      const room = await createRoom({ facilityId, type: "Direct", memberUserIds: [target.id] });
      setRooms(prev => [room, ...prev]);
      setPickerOpen(false);
      await openRoom(room);
    } catch {
      setDmError("Could not start conversation.");
    } finally { setDmBusy(false); }
  }

  const roomName = (room: ChatRoomDto) => {
    if (room.name) return room.name;
    const other = room.members.find(m => m.userId !== user?.id);
    return other?.displayName ?? "Direct Message";
  };

  const filteredUsers = allUsers.filter(u => {
    const q = search.toLowerCase();
    return q === "" || (u.displayName ?? u.email).toLowerCase().includes(q);
  });

  // ── User picker ──────────────────────────────────────────────────────────────
  if (pickerOpen) {
    return (
      <View style={styles.root}>
        <View style={styles.pickerHeader}>
          <IconButton icon="arrow-left" iconColor="#4db6ac" onPress={() => setPickerOpen(false)} />
          <Text variant="titleMedium" style={styles.headerTitle}>New Message</Text>
        </View>
        <Searchbar
          placeholder="Search name or email…"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ color: "#e0f2f1" }}
          iconColor="#4db6ac"
          placeholderTextColor="rgba(255,255,255,0.4)"
        />
        {dmError && <Text style={styles.errorText}>{dmError}</Text>}
        {usersLoading ? (
          <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={u => u.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => startDm(item)} disabled={dmBusy}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {(item.displayName ?? item.email)[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ color: "#e0f2f1" }}>
                    {item.displayName ?? item.email}
                  </Text>
                  {item.displayName && (
                    <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.4)" }}>{item.email}</Text>
                  )}
                </View>
                {dmBusy && <ActivityIndicator size="small" color="#4db6ac" />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
          />
        )}
      </View>
    );
  }

  // ── Thread ───────────────────────────────────────────────────────────────────
  if (selectedRoom) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.threadHeader}>
          <IconButton icon="arrow-left" iconColor="#4db6ac" onPress={() => setSelectedRoom(null)} />
          <Text variant="titleMedium" style={styles.headerTitle}>{roomName(selectedRoom)}</Text>
        </View>
        {msgLoading ? (
          <ActivityIndicator color="#4db6ac" style={{ flex: 1 }} />
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item: m }) => {
              const isMe = m.senderUserId === user?.id;
              return (
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  {!isMe && <Text variant="labelSmall" style={styles.senderName}>{m.senderName}</Text>}
                  <Text variant="bodyMedium" style={{ color: "#e0f2f1" }}>{m.content}</Text>
                  <Text variant="labelSmall" style={styles.msgTime}>{dayjs(m.sentUtc).format("h:mm a")}</Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello!</Text>}
          />
        )}
        <View style={styles.inputRow}>
          <TextInput
            value={msgText}
            onChangeText={setMsgText}
            placeholder="Type a message…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            mode="outlined"
            style={styles.msgInput}
            outlineColor="rgba(255,255,255,0.15)"
            activeOutlineColor="#4db6ac"
            multiline
            onSubmitEditing={handleSend}
          />
          <IconButton
            icon="send"
            iconColor={msgText.trim() ? "#4db6ac" : "rgba(255,255,255,0.2)"}
            disabled={!msgText.trim() || sending}
            onPress={handleSend}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Room list ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={styles.listHeader}>
        <Text variant="titleMedium" style={styles.headerTitle}>Messages</Text>
        <IconButton icon="square-edit-outline" iconColor="#4db6ac" onPress={openPicker} />
      </View>
      {roomsLoading ? (
        <ActivityIndicator color="#4db6ac" style={{ marginTop: 32 }} />
      ) : rooms.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="chat-outline" size={48} color="rgba(255,255,255,0.15)" />
          <Text style={[styles.empty, { marginTop: 12 }]}>No conversations yet.</Text>
          <TouchableOpacity onPress={openPicker} style={styles.startBtn}>
            <Text style={{ color: "#4db6ac", fontWeight: "600" }}>Start a message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          renderItem={({ item: room }) => (
            <TouchableOpacity style={styles.roomRow} onPress={() => openRoom(room)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{roomName(room)[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={[styles.roomName, room.unreadCount > 0 && { fontWeight: "700" }]}>
                  {roomName(room)}
                </Text>
                {room.lastMessage && (
                  <Text variant="bodySmall" style={styles.lastMsg} numberOfLines={1}>{room.lastMessage}</Text>
                )}
              </View>
              {room.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{room.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  pickerHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  threadHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  headerTitle: { color: "#e0f2f1", fontWeight: "600", flex: 1 },
  roomRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,137,123,0.3)", alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#4db6ac", fontWeight: "700", fontSize: 16 },
  roomName: { color: "#e0f2f1" },
  lastMsg: { color: "rgba(255,255,255,0.4)", marginTop: 2 },
  badge: { backgroundColor: "#ef5350", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "rgba(255,255,255,0.4)", textAlign: "center" },
  startBtn: { marginTop: 16, padding: 12, borderWidth: 1, borderColor: "#4db6ac", borderRadius: 8 },
  searchbar: { margin: 12, backgroundColor: "#0d2137" },
  userRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)", gap: 12 },
  errorText: { color: "#ef5350", margin: 12 },
  msgList: { padding: 16, gap: 8, flexGrow: 1, justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 12, marginBottom: 4 },
  bubbleMe: { backgroundColor: "rgba(0,120,180,0.3)", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "rgba(255,255,255,0.07)", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  senderName: { color: "#4db6ac", marginBottom: 2 },
  msgTime: { color: "rgba(255,255,255,0.35)", marginTop: 4, alignSelf: "flex-end" },
  inputRow: { flexDirection: "row", alignItems: "center", padding: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  msgInput: { flex: 1, backgroundColor: "#0d2137", maxHeight: 100 },
});
