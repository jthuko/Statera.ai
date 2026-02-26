// src/pages/portal/PortalChat.tsx
// Staff portal: chat interface (mirrors admin chat but no group creation)
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Box, CircularProgress, Divider, IconButton, InputAdornment,
  List, ListItemButton, ListItemText, Stack, TextField, Typography,
  Badge, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar,
} from "@mui/material";
import { Send as SendIcon, Add as AddIcon } from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../../auth/useAuth";
import {
  listRooms, listMessages, sendMessage, markRoomRead, createRoom, listUsers,
  type ChatRoomDto, type ChatMessageDto, type AppUserDto,
} from "../../api/chat";

export default function PortalChat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // New message dialog
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AppUserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [startingDm, setStartingDm] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await listRooms());
    } catch { /* ignore */ }
    finally { setRoomsLoading(false); }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Poll for new messages every 5 s
  useEffect(() => {
    if (!selectedRoom) return;
    const id = setInterval(async () => {
      try {
        const msgs = await listMessages(selectedRoom.id);
        setMessages(msgs);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [selectedRoom]);

  async function selectRoom(room: ChatRoomDto) {
    setSelectedRoom(room);
    setMsgLoading(true);
    try {
      const msgs = await listMessages(room.id);
      setMessages(msgs);
      await markRoomRead(room.id);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unreadCount: 0 } : r));
    } catch (e: any) {
      setError("Failed to load messages.");
    } finally {
      setMsgLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!selectedRoom || !msgText.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedRoom.id, msgText.trim());
      setMessages(prev => [...prev, msg]);
      setMsgText("");
      await markRoomRead(selectedRoom.id);
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function openNewMsgDialog() {
    setNewMsgOpen(true);
    setUserSearch("");
    if (allUsers.length > 0) return;
    setUsersLoading(true);
    try {
      const users = await listUsers();
      setAllUsers(users.filter(u => u.id !== user?.id));
    } catch {
      setError("Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function startDm(target: AppUserDto) {
    setStartingDm(true);
    try {
      // Reuse existing DM if one already exists
      const existing = rooms.find(
        r => r.type === "Direct" && r.members.some(m => m.userId === target.id)
      );
      if (existing) {
        setNewMsgOpen(false);
        await selectRoom(existing);
        return;
      }
      const facilityId = user?.facilityIds?.[0] ?? "";
      const room = await createRoom({ facilityId, type: "Direct", memberUserIds: [target.id] });
      setRooms(prev => [room, ...prev]);
      setNewMsgOpen(false);
      await selectRoom(room);
    } catch {
      setError("Could not start conversation.");
    } finally {
      setStartingDm(false);
    }
  }

  const roomName = (room: ChatRoomDto) => {
    if (room.name) return room.name;
    const other = room.members.find(m => m.userId !== user?.id);
    return other?.displayName ?? "Direct Message";
  };

  if (roomsLoading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2, display: "flex", height: "calc(100vh - 148px)", gap: 0 }}>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 10, minWidth: 300 }}>{error}</Alert>}

      {/* Room list */}
      <Box sx={{ width: 200, borderRight: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            CONVERSATIONS
          </Typography>
          <IconButton size="small" onClick={openNewMsgDialog} title="New message">
            <AddIcon fontSize="small" />
          </IconButton>
        </Stack>
        <List dense disablePadding>
          {rooms.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No conversations yet.
            </Typography>
          )}
          {rooms.map(room => (
            <ListItemButton
              key={room.id}
              selected={selectedRoom?.id === room.id}
              onClick={() => selectRoom(room)}
              sx={{ py: 1 }}
            >
              <Badge badgeContent={room.unreadCount} color="error" sx={{ mr: 1 }}>
                <Box />
              </Badge>
              <ListItemText
                primary={roomName(room)}
                secondary={room.lastMessage ? room.lastMessage.content.slice(0, 30) : undefined}
                primaryTypographyProps={{ variant: "body2", fontWeight: room.unreadCount > 0 ? 700 : 400 }}
                secondaryTypographyProps={{ variant: "caption", noWrap: true }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Message area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selectedRoom ? (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
            <Typography color="text.secondary">No conversation selected</Typography>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openNewMsgDialog}>
              Start a new message
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography variant="subtitle1" fontWeight={600}>{roomName(selectedRoom)}</Typography>
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
              {msgLoading ? (
                <Box sx={{ textAlign: "center", pt: 4 }}><CircularProgress size={24} /></Box>
              ) : messages.length === 0 ? (
                <Typography color="text.secondary" variant="body2" sx={{ pt: 4, textAlign: "center" }}>
                  No messages yet. Say hello!
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {messages.map(m => {
                    const isMe = m.senderUserId === user?.id;
                    return (
                      <Stack key={m.id} direction={isMe ? "row-reverse" : "row"} spacing={1} alignItems="flex-end">
                        <Box
                          sx={{
                            maxWidth: "75%",
                            px: 1.5, py: 1,
                            borderRadius: 2,
                            background: isMe ? "rgba(0,120,180,0.35)" : "rgba(255,255,255,0.08)",
                          }}
                        >
                          {!isMe && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {m.senderName ?? m.senderUserId}
                            </Typography>
                          )}
                          <Typography variant="body2">{m.content}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" align={isMe ? "right" : "left"}>
                            {dayjs(m.sentUtc).format("h:mm a")}
                          </Typography>
                        </Box>
                      </Stack>
                    );
                  })}
                  <div ref={bottomRef} />
                </Stack>
              )}
            </Box>

            <Divider />
            <Box sx={{ px: 2, py: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type a message…"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={sending}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleSend} disabled={!msgText.trim() || sending}>
                        {sending ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </>
        )}
      </Box>
      {/* New Message dialog */}
      <Dialog open={newMsgOpen} onClose={() => setNewMsgOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Message</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus fullWidth size="small" placeholder="Search by name or email…"
            value={userSearch} onChange={e => setUserSearch(e.target.value)}
            sx={{ mb: 1 }}
          />
          {usersLoading ? (
            <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={24} /></Box>
          ) : (
            <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
              {allUsers
                .filter(u => {
                  const q = userSearch.toLowerCase();
                  return q === "" || u.email.toLowerCase().includes(q);
                })
                .map(u => (
                  <ListItemButton
                    key={u.id}
                    onClick={() => startDm(u)}
                    disabled={startingDm}
                  >
                    <Avatar sx={{ width: 32, height: 32, mr: 1.5, fontSize: 14 }}>
                      {(u.displayName ?? u.email)[0].toUpperCase()}
                    </Avatar>
                    <ListItemText
                      primary={u.displayName ?? u.email}
                      secondary={u.systemRole !== u.displayName ? u.email : undefined}
                      primaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                ))}
              {allUsers.length > 0 && allUsers.filter(u => {
                const q = userSearch.toLowerCase();
                return q === "" || u.email.toLowerCase().includes(q);
              }).length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No users match your search.</Typography>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewMsgOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
