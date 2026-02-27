import api from "./axios";

export type IntegrationProvider = "Gusto" | "QuickBooks";

export interface FacilityIntegrationStatus {
  provider: IntegrationProvider;
  connected: boolean;
  updatedUtc?: string | null;
  externalCompanyId?: string | null;
}

export async function listFacilityIntegrations(facilityId: string): Promise<FacilityIntegrationStatus[]> {
  const { data } = await api.get<FacilityIntegrationStatus[]>(`/facilities/${facilityId}/integrations`);
  return data;
}

export async function connectFacilityIntegration(facilityId: string, provider: IntegrationProvider): Promise<{ authUrl: string }> {
  const { data } = await api.post<{ authUrl: string }>(`/facilities/${facilityId}/integrations/${provider.toLowerCase()}/connect`);
  return data;
}

export async function disconnectFacilityIntegration(facilityId: string, provider: IntegrationProvider): Promise<void> {
  await api.post(`/facilities/${facilityId}/integrations/${provider.toLowerCase()}/disconnect`);
}

export interface ExportTimesheetsRequest {
  fromUtc: string;
  toUtc: string;
  staffId?: string | null;
  status?: string | null;
  dryRun?: boolean;
}

export interface ExportTimesheetsResult {
  exported: number;
  skipped: number;
  errors: { entryId: string; error: string; detail?: string }[];
}

export async function exportTimesheetsToProvider(
  facilityId: string,
  provider: IntegrationProvider,
  payload: ExportTimesheetsRequest
): Promise<ExportTimesheetsResult> {
  const { data } = await api.post<ExportTimesheetsResult>(
    `/facilities/${facilityId}/integrations/${provider.toLowerCase()}/export-timesheets`,
    payload
  );
  return data;
}
