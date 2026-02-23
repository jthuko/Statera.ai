import api from "./axios";

export interface AppUserDto {
  id: string;
  email: string;
  systemRole: string;
}

export async function listUsers(): Promise<AppUserDto[]> {
  const { data } = await api.get<AppUserDto[]>("/auth/users");
  return data;
}

export interface ChatRoomDto {
  id: string;
  facilityId: string;
  name?: string | null;
  type: "Direct" | "Group";
  createdByUserId: string;
  createdUtc: string;
  lastMessage?: string | null;
  lastMessageUtc?: string | null;
  unreadCount: number;
  members: ChatRoomMemberDto[];
}

export interface ChatRoomMemberDto {
  userId: string;
  displayName?: string;
  joinedUtc: string;
  lastReadUtc?: string | null;
}

export interface ChatMessageDto {
  id: string;
  roomId: string;
  senderUserId: string;
  senderName?: string;
  content: string;
  sentUtc: string;
  isDeleted: boolean;
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export async function listRooms(): Promise<ChatRoomDto[]> {
  const { data } = await api.get<ChatRoomDto[]>("/chat/rooms");
  return data;
}

export interface CreateRoomPayload {
  facilityId: string;
  type: "Direct" | "Group";
  name?: string;
  memberUserIds: string[];
}

export async function createRoom(payload: CreateRoomPayload): Promise<ChatRoomDto> {
  const { data } = await api.post<ChatRoomDto>("/chat/rooms", payload);
  return data;
}

export async function addRoomMember(roomId: string, userId: string): Promise<void> {
  await api.post(`/chat/rooms/${roomId}/members`, { userId });
}

export async function removeRoomMember(roomId: string, userId: string): Promise<void> {
  await api.delete(`/chat/rooms/${roomId}/members/${userId}`);
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listMessages(roomId: string, before?: string, limit = 50): Promise<ChatMessageDto[]> {
  const { data } = await api.get<ChatMessageDto[]>(`/chat/rooms/${roomId}/messages`, {
    params: { before, limit },
  });
  return data;
}

export async function sendMessage(roomId: string, content: string): Promise<ChatMessageDto> {
  const { data } = await api.post<ChatMessageDto>(`/chat/rooms/${roomId}/messages`, { content });
  return data;
}

export async function markRoomRead(roomId: string): Promise<void> {
  await api.post(`/chat/rooms/${roomId}/read`);
}
