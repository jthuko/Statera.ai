export type Facility = {
  id: string;           // GUID from backend
  name: string;         // Facility name
  city?: string;
  state?: string;
  address?: string;
  zip?: string;
  adminUserId?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
};
