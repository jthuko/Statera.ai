import api from "./axios";

export interface MyProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  licenseExpiresOn?: string | null;
  facilityId: string;
}

export interface UpdateMyProfileRequest {
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export async function getMyProfile(): Promise<MyProfileDto> {
  const { data } = await api.get<MyProfileDto>("/staff/me");
  return data;
}

export async function updateMyProfile(req: UpdateMyProfileRequest): Promise<MyProfileDto> {
  const { data } = await api.put<MyProfileDto>("/staff/me/profile", req);
  return data;
}
