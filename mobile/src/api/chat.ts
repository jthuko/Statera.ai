import api from "./axios";

export interface AppUserDto {
  id: string;
  email: string;
  systemRole: string;
  displayName?: string | null;
}

export interface ChatRoomDto {
  id: string;
  facilityId: string;
  name?: string | null;
  type: "Direct" | "Group";
  createdUtc: string;
  lastMessage?: string | null;
  unreadCount: number;
  members: { userId: string; displayName?: string }[];
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

export async function listUsers(): Promise<AppUserDto[]> {
  const { data } = await api.get<AppUserDto[]>("/auth/users");
  return data;
}

export async function listRooms(): Promise<ChatRoomDto[]> {
  const { data } = await api.get<ChatRoomDto[]>("/chat/rooms");
  return data;
}

export async function createRoom(payload: {
  facilityId: string;
  type: "Direct" | "Group";
  memberUserIds: string[];
}): Promise<ChatRoomDto> {
  const { data } = await api.post<ChatRoomDto>("/chat/rooms", payload);
  return data;
}

export async function listMessages(roomId: string): Promise<ChatMessageDto[]> {
  const { data } = await api.get<ChatMessageDto[]>(`/chat/rooms/${roomId}/messages`);
  return data;
}

export async function sendMessage(roomId: string, content: string): Promise<ChatMessageDto> {
  const { data } = await api.post<ChatMessageDto>(`/chat/rooms/${roomId}/messages`, { content });
  return data;
}

export async function markRoomRead(roomId: string): Promise<void> {
  await api.post(`/chat/rooms/${roomId}/read`);
}
