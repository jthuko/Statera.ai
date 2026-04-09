// src/pages/portal/PortalChat.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  InputAdornment, List, ListItemButton, Stack, TextField, Typography,
} from "@mui/material";
import {
  Add as AddIcon, Send as SendIcon, PersonAdd as PersonAddIcon,
  Done as DoneIcon, DoneAll as DoneAllIcon, Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import isYesterday from "dayjs/plugin/isYesterday";
import { useAuth } from "../../auth/useAuth";
import {
  listRooms, listMessages, sendMessage, markRoomRead, createRoom, listUsers,
  type ChatRoomDto, type ChatMessageDto, type AppUserDto,
} from "../../api/chat";

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
      <RoomAvatar name={name} size={42} />
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
export default function PortalChat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selected, setSelected] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mobile: show list OR thread
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

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
    setMobileView("thread");
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

  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessageDto[] }[]>((acc, m) => {
    const day = dayjs(m.sentUtc).format("YYYY-MM-DD");
    const last = acc[acc.length - 1];
    if (last && last.date === day) { last.msgs.push(m); }
    else { acc.push({ date: day, msgs: [m] }); }
    return acc;
  }, []);

  const facilityId = user?.facilityIds?.[0] ?? "";
  const selectedName = selected ? roomDisplayName(selected, user?.id) : "";

  if (roomsLoading) return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{
      display: "flex", height: "calc(100vh - 148px)", borderRadius: 2,
      overflow: "hidden", border: "1px solid", borderColor: "divider",
    }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}
          sx={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20, minWidth: 300 }}>
          {error}
        </Alert>
      )}

      {/* ── Sidebar ── */}
      <Box sx={{
        width: { xs: mobileView === "list" ? "100%" : "0px", sm: 280 },
        maxWidth: { xs: mobileView === "list" ? "100%" : "0px", sm: 280 },
        flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid", borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.02)",
        overflow: "hidden",
        transition: "width 0.2s, max-width 0.2s",
      }}>
        {/* Sidebar header */}
        <Box sx={{ px: 1.5, pt: 1.5, pb: 1, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: 16 }}>Messages</Typography>
            <IconButton size="small" onClick={() => setNewDmOpen(true)}
              sx={{ bgcolor: "rgba(255,255,255,0.05)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
              title="New message">
              <PersonAddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        </Box>

        {/* Room list */}
        <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
          {rooms.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No conversations yet.
              </Typography>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDmOpen(true)}>
                Start a message
              </Button>
            </Box>
          ) : (
            <List disablePadding>
              {rooms.map(room => (
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
      <Box sx={{
        flex: 1, flexDirection: "column", overflow: "hidden",
        bgcolor: "background.default",
        display: { xs: mobileView === "thread" ? "flex" : "none", sm: "flex" },
      }}>
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
              {/* Mobile back button */}
              <IconButton
                size="small"
                onClick={() => { setMobileView("list"); setSelected(null); }}
                sx={{ display: { xs: "flex", sm: "none" }, mr: 0.5 }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <RoomAvatar name={selectedName} size={36} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>{selectedName}</Typography>
                <Typography variant="caption" color="text.secondary">Direct Message</Typography>
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

      {/* New DM dialog */}
      <NewDmDialog
        open={newDmOpen}
        facilityId={facilityId}
        currentUserId={user?.id}
        existingRooms={rooms}
        onClose={() => setNewDmOpen(false)}
        onCreated={(room) => {
          setRooms(prev => { const exists = prev.find(r => r.id === room.id); return exists ? prev : [room, ...prev]; });
          setNewDmOpen(false);
          selectRoom(room);
        }}
      />
    </Box>
  );
}

// ─── New DM Dialog ────────────────────────────────────────────────────────────
function NewDmDialog({ open, facilityId, currentUserId, existingRooms, onClose, onCreated }: {
  open: boolean; facilityId: string; currentUserId?: string;
  existingRooms: ChatRoomDto[];
  onClose: () => void; onCreated: (room: ChatRoomDto) => void;
}) {
  const [users, setUsers] = useState<AppUserDto[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) listUsers().then(u => setUsers(u.filter(x => x.id !== currentUserId))).catch(() => setUsers([]));
    if (!open) { setSearch(""); setError(null); }
  }, [open, currentUserId]);

  async function startDm(target: AppUserDto) {
    // Reuse existing DM if one already exists
    const existing = existingRooms.find(
      r => r.type === "Direct" && r.members.some(m => m.userId === target.id)
    );
    if (existing) { onCreated(existing); return; }

    setBusy(true); setError(null);
    try {
      const room = await createRoom({ facilityId, type: "Direct", memberUserIds: [target.id] });
      onCreated(room);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to start conversation.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true;
    return (u.displayName ?? u.email).toLowerCase().includes(search.toLowerCase())
      || u.email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Message</DialogTitle>
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
                    onClick={() => startDm(u)}
                    disabled={busy}
                    sx={{ borderRadius: 1.5, mb: 0.25 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(u.displayName ?? u.email), fontSize: 13, fontWeight: 700 }}>
                        {(u.displayName ?? u.email)[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>{u.displayName ?? u.email}</Typography>
                        <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                      </Box>
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
      </DialogActions>
    </Dialog>
  );
}
