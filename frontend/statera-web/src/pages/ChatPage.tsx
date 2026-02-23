// src/pages/ChatPage.tsx
// Admin-side chat: room list, group creation, 1:1 and group messaging
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, InputAdornment,
  List, ListItemButton, ListItemText, MenuItem, Paper, Select,
  Stack, TextField, Tooltip, Typography, Badge, FormControl, InputLabel,
} from "@mui/material";
import {
  Add as AddIcon, Send as SendIcon, Group as GroupIcon,
  PersonAdd as PersonAddIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuth } from "../auth/useAuth";
import { useFacility } from "../context/facility";
import { listStaff, type StaffDto } from "../api/staff";
import {
  listRooms, createRoom, listMessages, sendMessage, markRoomRead,
  listUsers,
  type ChatRoomDto, type ChatMessageDto, type AppUserDto,
} from "../api/chat";

// ── Helpers ───────────────────────────────────────────────────────────────────
function roomDisplayName(room: ChatRoomDto, currentUserId?: string): string {
  if (room.name) return room.name;
  const other = room.members.find(m => m.userId !== currentUserId);
  return other?.displayName ?? "Direct Message";
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
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await listRooms());
    } catch { /* ignore */ }
    finally { setRoomsLoading(false); }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Poll for new messages in selected room
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(async () => {
      try {
        const msgs = await listMessages(selected.id);
        setMessages(msgs);
      } catch { /* ignore */ }
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
      // Refresh room list to update lastMessage
      loadRooms();
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  if (roomsLoading) return <Box sx={{ pt: 4, textAlign: "center" }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Chat</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setNewDmOpen(true)}>
            New DM
          </Button>
          <Button size="small" variant="contained" startIcon={<GroupIcon />} onClick={() => setNewGroupOpen(true)}>
            New Group
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={1} sx={{ display: "flex", height: "calc(100vh - 200px)", overflow: "hidden" }}>
        {/* Room list */}
        <Box sx={{ width: 240, borderRight: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 1.5, display: "block", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            Conversations
          </Typography>
          <Divider />
          <List dense disablePadding>
            {rooms.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No conversations yet.
              </Typography>
            )}
            {rooms.map(room => (
              <ListItemButton
                key={room.id}
                selected={selected?.id === room.id}
                onClick={() => selectRoom(room)}
                sx={{ py: 1.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={room.unreadCount > 0 ? 700 : 400} noWrap>
                        {roomDisplayName(room, user?.id)}
                      </Typography>
                      {room.unreadCount > 0 && (
                        <Chip label={room.unreadCount} size="small" color="error" sx={{ height: 16, "& .MuiChip-label": { px: 0.5, fontSize: 10 } }} />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {room.type === "Group" && <><GroupIcon sx={{ fontSize: 10, mr: 0.5 }} />Group · </>}
                      {room.lastMessage ?? "No messages yet"}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Message pane */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!selected ? (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography color="text.secondary">Select a conversation to start chatting.</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>{roomDisplayName(selected, user?.id)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selected.type === "Group" ? `${selected.members.length} members` : "Direct Message"}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
                {msgLoading ? (
                  <Box sx={{ textAlign: "center", pt: 4 }}><CircularProgress size={24} /></Box>
                ) : messages.length === 0 ? (
                  <Typography color="text.secondary" variant="body2" sx={{ pt: 4, textAlign: "center" }}>
                    No messages yet. Start the conversation!
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {messages.map(m => {
                      const isMe = m.senderUserId === user?.id;
                      return (
                        <Stack key={m.id} direction={isMe ? "row-reverse" : "row"} spacing={1} alignItems="flex-end">
                          <Box
                            sx={{
                              maxWidth: "70%",
                              px: 1.5, py: 1,
                              borderRadius: 2,
                              background: isMe ? "rgba(0,120,180,0.35)" : "rgba(255,255,255,0.08)",
                            }}
                          >
                            {!isMe && (
                              <Typography variant="caption" color="primary.light" display="block" fontWeight={600}>
                                {m.senderName ?? m.senderUserId}
                              </Typography>
                            )}
                            <Typography variant="body2">{m.content}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block" align={isMe ? "right" : "left"}>
                              {dayjs(m.sentUtc).format("MMM D · h:mm a")}
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
              <Box sx={{ px: 2, py: 1.5 }}>
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
      </Paper>

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
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && facilityId) {
      listStaff(facilityId).then(setStaff).catch(() => setStaff([]));
    }
    if (!open) { setName(""); setSelected([]); setError(null); }
  }, [open, facilityId]);

  async function handleCreate() {
    if (!facilityId || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      // Resolve staff user IDs — we need their AppUser IDs.
      // For now, use their staffId as a stand-in; the backend maps this.
      const memberIds = selected.map(sid => {
        const s = staff.find(x => x.id === sid);
        return s?.id ?? sid;
      });
      const room = await createRoom({ facilityId, type: "Group", name: name.trim(), memberUserIds: memberIds });
      onCreated(room);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Group Chat</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField size="small" label="Group name" value={name} onChange={e => setName(e.target.value)} />
          <FormControl size="small" fullWidth>
            <InputLabel>Add members</InputLabel>
            <Select
              multiple label="Add members"
              value={selected}
              onChange={e => setSelected(typeof e.target.value === "string" ? [e.target.value] : e.target.value as string[])}
              renderValue={sel => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(sel as string[]).map(id => {
                    const s = staff.find(x => x.id === id);
                    return <Chip key={id} label={s ? `${s.firstName} ${s.lastName}` : id} size="small" />;
                  })}
                </Box>
              )}
            >
              {staff.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.firstName} {s.lastName} {s.role ? `(${s.role})` : ""}</MenuItem>
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
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) listUsers().then(setUsers).catch(() => setUsers([]));
    if (!open) { setTargetId(""); setError(null); }
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Direct Message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select size="small" label="Select user"
            value={targetId} onChange={e => setTargetId(e.target.value)}
          >
            {users.length === 0 && <MenuItem disabled>No other users found</MenuItem>}
            {users.map(u => (
              <MenuItem key={u.id} value={u.id}>
                {u.email} <Chip label={roleLabel(u.systemRole)} size="small" sx={{ ml: 1, height: 16 }} />
              </MenuItem>
            ))}
          </TextField>
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
