// src/pages/ChatPage.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  IconButton, InputAdornment, InputLabel, List, ListItemButton,
  MenuItem, Select, Stack, TextField, Tooltip, Typography, Badge,
} from "@mui/material";
import {
  Add as AddIcon, Send as SendIcon, Group as GroupIcon,
  PersonAdd as PersonAddIcon, Done as DoneIcon, DoneAll as DoneAllIcon,
  Search as SearchIcon, MoreVert as MoreVertIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import isYesterday from "dayjs/plugin/isYesterday";
import { useAuth } from "../auth/useAuth";
import { useFacility } from "../context/facility";
import {
  listRooms, createRoom, listMessages, sendMessage, markRoomRead,
  listUsers,
  type ChatRoomDto, type ChatMessageDto, type AppUserDto,
} from "../api/chat";

dayjs.extend(isToday);
dayjs.extend(isYesterday);

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#f97316",
];

function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function roomDisplayName(room: ChatRoomDto, currentUserId?: string): string {
  if (room.name) return room.name;
  const other = room.members.find(m => m.userId !== currentUserId);
  return other?.displayName ?? "Direct Message";
}

function formatTimestamp(utc: string): string {
  const d = dayjs(utc);
  if (d.isToday()) return d.format("h:mm a");
  if (d.isYesterday()) return "Yesterday";
  return d.format("MMM D");
}

function formatDayLabel(utc: string): string {
  const d = dayjs(utc);
  if (d.isToday()) return "Today";
  if (d.isYesterday()) return "Yesterday";
  return d.format("MMMM D, YYYY");
}

// ── Room Avatar ───────────────────────────────────────────────────────────────
function RoomAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const color = avatarColor(name);
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: color, fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {name[0]?.toUpperCase()}
    </Avatar>
  );
}

// ── Room List Item ────────────────────────────────────────────────────────────
function RoomItem({ room, selected, currentUserId, onClick }: {
  room: ChatRoomDto; selected: boolean; currentUserId?: string; onClick: () => void;
}) {
  const name = roomDisplayName(room, currentUserId);
  const hasUnread = room.unreadCount > 0;

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        px: 1.5, py: 1.25, gap: 1.5, borderRadius: 1.5, mx: 0.5, mb: 0.25,
        bgcolor: selected ? "rgba(14,165,233,0.12)" : "transparent",
        "&:hover": { bgcolor: selected ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.05)" },
        transition: "background 0.15s",
      }}
    >
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        <RoomAvatar name={name} size={42} />
        {room.type === "Group" && (
          <Box sx={{
            position: "absolute", bottom: -2, right: -2,
            width: 16, height: 16, borderRadius: "50%",
            bgcolor: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid", borderColor: "background.paper",
          }}>
            <GroupIcon sx={{ fontSize: 9, color: "#fff" }} />
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" fontWeight={hasUnread ? 700 : 500} noWrap sx={{ flex: 1, mr: 1 }}>
            {name}
          </Typography>
          {room.lastMessageUtc && (
            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, fontSize: 10 }}>
              {formatTimestamp(room.lastMessageUtc)}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color={hasUnread ? "text.primary" : "text.secondary"}
            noWrap sx={{ flex: 1, mr: 1, fontWeight: hasUnread ? 600 : 400 }}>
            {room.lastMessage ?? "No messages yet"}
          </Typography>
          {hasUnread && (
            <Box sx={{
              minWidth: 18, height: 18, borderRadius: 9, bgcolor: "#ef4444",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1, px: 0.5 }}>
                {room.unreadCount > 99 ? "99+" : room.unreadCount}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </ListItemButton>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ChatPage() {
  const { user } = useAuth();
  const { selected: selectedFacility } = useFacility();
  const facilityId = selectedFacility?.id;

  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selected, setSelected] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomSearch, setRoomSearch] = useState("");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRooms = useCallback(async () => {
    try { setRooms(await listRooms()); } catch { /* ignore */ }
    finally { setRoomsLoading(false); }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    if (!selected) return;
    const id = setInterval(async () => {
      try { setMessages(await listMessages(selected.id)); } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function selectRoom(room: ChatRoomDto) {
    setSelected(room);
    setMsgLoading(true);
    try {
      const msgs = await listMessages(room.id);
      setMessages(msgs);
      await markRoomRead(room.id);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unreadCount: 0 } : r));
    } catch {
      setError("Failed to load messages.");
    } finally {
      setMsgLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleSend() {
    if (!selected || !msgText.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(selected.id, msgText.trim());
      setMessages(prev => [...prev, msg]);
      setMsgText("");
      await markRoomRead(selected.id);
      loadRooms();
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const otherMembers = selected?.members?.filter(m => m.userId !== user?.id) ?? [];
  const isReadByAll = (sentUtc: string) =>
    otherMembers.length > 0 && otherMembers.every(m =>
      m.lastReadUtc && new Date(m.lastReadUtc).getTime() >= new Date(sentUtc).getTime()
    );

  const filteredRooms = rooms.filter(r => {
    if (!roomSearch) return true;
    return roomDisplayName(r, user?.id).toLowerCase().includes(roomSearch.toLowerCase());
  });

  // Group messages by day for date separators
  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessageDto[] }[]>((acc, m) => {
    const day = dayjs(m.sentUtc).format("YYYY-MM-DD");
    const last = acc[acc.length - 1];
    if (last && last.date === day) { last.msgs.push(m); }
    else { acc.push({ date: day, msgs: [m] }); }
    return acc;
  }, []);

  if (roomsLoading) return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
      <CircularProgress />
    </Box>
  );

  const selectedName = selected ? roomDisplayName(selected, user?.id) : "";

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 88px)", borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}
          sx={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20, minWidth: 300 }}>
          {error}
        </Alert>
      )}

      {/* ── Sidebar ── */}
      <Box sx={{
        width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid", borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.02)",
      }}>
        {/* Sidebar header */}
        <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: 16 }}>Messages</Typography>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="New Direct Message" arrow>
                <IconButton size="small" onClick={() => setNewDmOpen(true)}
                  sx={{ bgcolor: "rgba(255,255,255,0.05)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}>
                  <PersonAddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="New Group" arrow>
                <IconButton size="small" onClick={() => setNewGroupOpen(true)}
                  sx={{ bgcolor: "rgba(255,255,255,0.05)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}>
                  <GroupIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          {/* Search */}
          <TextField
            size="small" fullWidth placeholder="Search conversations…"
            value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} /></InputAdornment>,
              sx: { borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", fontSize: 13 },
            }}
            sx={{ "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.08)" } }}
          />
        </Box>

        {/* Room list */}
        <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
          {filteredRooms.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {roomSearch ? "No conversations match your search." : "No conversations yet."}
              </Typography>
              {!roomSearch && (
                <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setNewDmOpen(true)}>
                  Start a message
                </Button>
              )}
            </Box>
          ) : (
            <List disablePadding>
              {filteredRooms.map(room => (
                <RoomItem
                  key={room.id}
                  room={room}
                  selected={selected?.id === room.id}
                  currentUserId={user?.id}
                  onClick={() => selectRoom(room)}
                />
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* ── Thread pane ── */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
        {!selected ? (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, opacity: 0.5 }}>
            <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SendIcon sx={{ fontSize: 28, color: "text.secondary", transform: "rotate(-30deg)" }} />
            </Box>
            <Typography variant="body1" color="text.secondary" fontWeight={500}>Select a conversation</Typography>
            <Typography variant="body2" color="text.disabled">or start a new one</Typography>
          </Box>
        ) : (
          <>
            {/* Thread header */}
            <Box sx={{
              px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider",
              display: "flex", alignItems: "center", gap: 1.5,
              bgcolor: "rgba(255,255,255,0.02)",
            }}>
              <RoomAvatar name={selectedName} size={36} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>{selectedName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selected.type === "Group"
                    ? `${selected.members.length} members`
                    : "Direct Message"}
                </Typography>
              </Box>
            </Box>

            {/* Messages */}
            <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
              {msgLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}><CircularProgress size={24} /></Box>
              ) : messages.length === 0 ? (
                <Box sx={{ textAlign: "center", pt: 6, opacity: 0.5 }}>
                  <RoomAvatar name={selectedName} size={56} />
                  <Typography variant="body1" fontWeight={600} sx={{ mt: 2 }}>{selectedName}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    This is the beginning of your conversation.
                  </Typography>
                </Box>
              ) : (
                <>
                  {groupedMessages.map(({ date, msgs }) => (
                    <Box key={date}>
                      {/* Date separator */}
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ my: 2 }}>
                        <Divider sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
                          {formatDayLabel(msgs[0].sentUtc)}
                        </Typography>
                        <Divider sx={{ flex: 1 }} />
                      </Stack>
                      <Stack spacing={0.5}>
                        {msgs.map((m, i) => {
                          const isMe = m.senderUserId === user?.id;
                          const prevMsg = msgs[i - 1];
                          const isFirstInGroup = !prevMsg || prevMsg.senderUserId !== m.senderUserId;
                          const senderName = m.senderName ?? m.senderUserId;
                          const color = avatarColor(senderName);

                          return (
                            <Stack
                              key={m.id}
                              direction={isMe ? "row-reverse" : "row"}
                              spacing={1}
                              alignItems="flex-end"
                              sx={{ mt: isFirstInGroup && i > 0 ? 1.5 : 0 }}
                            >
                              {/* Avatar (only for first message in group, others side) */}
                              {!isMe ? (
                                <Box sx={{ width: 32, flexShrink: 0 }}>
                                  {isFirstInGroup && (
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: color, fontSize: 12, fontWeight: 700 }}>
                                      {getInitials(senderName)}
                                    </Avatar>
                                  )}
                                </Box>
                              ) : (
                                <Box sx={{ width: 32, flexShrink: 0 }} />
                              )}

                              <Box sx={{ maxWidth: "68%" }}>
                                {!isMe && isFirstInGroup && selected.type === "Group" && (
                                  <Typography variant="caption" fontWeight={700} sx={{ color, ml: 1.5, mb: 0.25, display: "block" }}>
                                    {senderName}
                                  </Typography>
                                )}
                                <Box
                                  sx={{
                                    px: 1.5, py: 1,
                                    borderRadius: isMe
                                      ? "16px 16px 4px 16px"
                                      : "16px 16px 16px 4px",
                                    background: isMe
                                      ? "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
                                      : "rgba(255,255,255,0.08)",
                                    border: isMe ? "none" : "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  <Typography variant="body2" sx={{ color: isMe ? "#fff" : "text.primary", lineHeight: 1.5, wordBreak: "break-word" }}>
                                    {m.content}
                                  </Typography>
                                </Box>
                                <Stack direction="row" alignItems="center" justifyContent={isMe ? "flex-end" : "flex-start"}
                                  spacing={0.5} sx={{ mt: 0.25, px: 0.5 }}>
                                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                                    {dayjs(m.sentUtc).format("h:mm a")}
                                  </Typography>
                                  {isMe && (
                                    isReadByAll(m.sentUtc)
                                      ? <DoneAllIcon sx={{ fontSize: 12, color: "#0ea5e9" }} />
                                      : <DoneIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                                  )}
                                </Stack>
                              </Box>
                            </Stack>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </Box>

            {/* Input */}
            <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "rgba(255,255,255,0.01)" }}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <TextField
                  inputRef={inputRef}
                  fullWidth multiline maxRows={4}
                  size="small"
                  placeholder={`Message ${selectedName}…`}
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={sending}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      bgcolor: "rgba(255,255,255,0.04)",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                      "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                      "&.Mui-focused fieldset": { borderColor: "#0ea5e9" },
                    },
                  }}
                />
                <IconButton
                  onClick={handleSend}
                  disabled={!msgText.trim() || sending}
                  sx={{
                    width: 40, height: 40, flexShrink: 0,
                    bgcolor: msgText.trim() ? "#0ea5e9" : "rgba(255,255,255,0.06)",
                    color: msgText.trim() ? "#fff" : "text.disabled",
                    "&:hover": { bgcolor: msgText.trim() ? "#0284c7" : "rgba(255,255,255,0.1)" },
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Stack>
            </Box>
          </>
        )}
      </Box>

      {/* Dialogs */}
      <NewGroupDialog
        open={newGroupOpen}
        facilityId={facilityId ?? ""}
        onClose={() => setNewGroupOpen(false)}
        onCreated={(room) => { setRooms(prev => [room, ...prev]); setNewGroupOpen(false); selectRoom(room); }}
      />
      <NewDmDialog
        open={newDmOpen}
        facilityId={facilityId ?? ""}
        onClose={() => setNewDmOpen(false)}
        onCreated={(room) => { setRooms(prev => { const exists = prev.find(r => r.id === room.id); return exists ? prev : [room, ...prev]; }); setNewDmOpen(false); selectRoom(room); }}
      />
    </Box>
  );
}

// ─── New Group Dialog ─────────────────────────────────────────────────────────
function NewGroupDialog({ open, facilityId, onClose, onCreated }: {
  open: boolean; facilityId: string;
  onClose: () => void; onCreated: (room: ChatRoomDto) => void;
}) {
  const [name, setName] = useState("");
  const [users, setUsers] = useState<AppUserDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) listUsers().then(setUsers).catch(() => setUsers([]));
    if (!open) { setName(""); setSelected([]); setError(null); }
  }, [open]);

  async function handleCreate() {
    if (!facilityId || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const room = await createRoom({ facilityId, type: "Group", name: name.trim(), memberUserIds: selected });
      onCreated(room);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create group.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (role: string) => role === "Owner" ? "Owner" : role === "FacilityAdmin" ? "Admin" : "Staff";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Group Chat</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            size="small" label="Group name" value={name}
            onChange={e => setName(e.target.value)} autoFocus
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Add members</InputLabel>
            <Select
              multiple label="Add members"
              value={selected}
              onChange={e => setSelected(typeof e.target.value === "string" ? [e.target.value] : e.target.value as string[])}
              renderValue={sel => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(sel as string[]).map(id => {
                    const u = users.find(x => x.id === id);
                    return <Chip key={id} label={u?.displayName ?? u?.email ?? id} size="small" />;
                  })}
                </Box>
              )}
            >
              {users.length === 0 && <MenuItem disabled>No other users found</MenuItem>}
              {users.map(u => (
                <MenuItem key={u.id} value={u.id}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: avatarColor(u.displayName ?? u.email), fontSize: 11 }}>
                      {(u.displayName ?? u.email)[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{u.displayName ?? u.email}</Typography>
                      <Typography variant="caption" color="text.secondary">{roleLabel(u.systemRole)}</Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={busy || !name.trim()}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Create Group"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── New DM Dialog ────────────────────────────────────────────────────────────
function NewDmDialog({ open, facilityId, onClose, onCreated }: {
  open: boolean; facilityId: string;
  onClose: () => void; onCreated: (room: ChatRoomDto) => void;
}) {
  const [users, setUsers] = useState<AppUserDto[]>([]);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) listUsers().then(setUsers).catch(() => setUsers([]));
    if (!open) { setTargetId(""); setSearch(""); setError(null); }
  }, [open]);

  async function handleCreate() {
    if (!facilityId || !targetId) return;
    setBusy(true); setError(null);
    try {
      const room = await createRoom({ facilityId, type: "Direct", memberUserIds: [targetId] });
      onCreated(room);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to start DM.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (role: string) => role === "Owner" ? "Owner" : role === "FacilityAdmin" ? "Admin" : "Staff";

  const filtered = users.filter(u => {
    if (!search) return true;
    return (u.displayName ?? u.email).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Direct Message</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            size="small" fullWidth placeholder="Search by name or email…"
            value={search} onChange={e => setSearch(e.target.value)} autoFocus
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
          />
          <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                {search ? "No users match your search." : "No other users found."}
              </Typography>
            ) : (
              <List disablePadding>
                {filtered.map(u => (
                  <ListItemButton
                    key={u.id}
                    selected={targetId === u.id}
                    onClick={() => setTargetId(u.id)}
                    sx={{ borderRadius: 1.5, mb: 0.25 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(u.displayName ?? u.email), fontSize: 13, fontWeight: 700 }}>
                        {(u.displayName ?? u.email)[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>{u.displayName ?? u.email}</Typography>
                        <Typography variant="caption" color="text.secondary">{roleLabel(u.systemRole)}</Typography>
                      </Box>
                      {targetId === u.id && <DoneIcon sx={{ fontSize: 16, color: "#0ea5e9" }} />}
                    </Stack>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={busy || !targetId}>
          {busy ? <CircularProgress size={18} color="inherit" /> : "Start Chat"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
