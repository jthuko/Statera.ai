// src/api/hiring.ts
import axios from "axios";

const BASE = "/api/v1/hiring";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChecklistItemDto {
  id: string;
  name: string;
  isChecked: boolean;
  checkedUtc?: string | null;
  documentId?: string | null;
}

export interface CandidateDocumentDto {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedUtc: string;
}

export interface CandidateDto {
  id: string;
  facilityId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  status: "Applied" | "Interviewing" | "Offered" | "Onboarding" | "Hired" | "Rejected";
  appliedUtc: string;
  onboardingStartedUtc?: string | null;
  hiredUtc?: string | null;
  notes?: string | null;
  linkedStaffId?: string | null;
  checklistItems: ChecklistItemDto[];
  documents: CandidateDocumentDto[];
  allChecked: boolean;
  checklistPct: number;
}

export interface ChecklistTemplateDto {
  id?: string | null;
  name: string;
  isDefault: boolean;
  sortOrder: number;
}

export interface StaffDocumentDto {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedUtc: string;
}

export interface HiringDashboard {
  active: number;
  inHiring: number;
  inOnboarding: number;
  totalHired: number;
  appliedInRange: number;
  onboardedInRange: number;
  hiredInRange: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadBlob(url: string, fileName: string) {
  const token = localStorage.getItem("statera:accessToken");
  const res = await axios.get(url, {
    responseType: "blob",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

// ── Checklist Templates ───────────────────────────────────────────────────────

export async function listTemplates(facilityId: string): Promise<ChecklistTemplateDto[]> {
  const res = await axios.get(`${BASE}/templates`, { params: { facilityId } });
  return res.data;
}

export async function addTemplate(facilityId: string, name: string): Promise<ChecklistTemplateDto> {
  const res = await axios.post(`${BASE}/templates`, { facilityId, name });
  return res.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await axios.delete(`${BASE}/templates/${id}`);
}

// ── Candidates ────────────────────────────────────────────────────────────────

export async function listCandidates(
  facilityId: string,
  status?: string,
  from?: string,
  to?: string
): Promise<CandidateDto[]> {
  const res = await axios.get(`${BASE}/candidates`, {
    params: { facilityId, status, from, to },
  });
  return res.data;
}

export async function getCandidate(id: string): Promise<CandidateDto> {
  const res = await axios.get(`${BASE}/candidates/${id}`);
  return res.data;
}

export async function createCandidate(data: {
  facilityId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  notes?: string;
}): Promise<CandidateDto> {
  const res = await axios.post(`${BASE}/candidates`, data);
  return res.data;
}

export async function updateCandidate(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    position?: string;
    notes?: string;
    status?: string;
  }
): Promise<void> {
  await axios.put(`${BASE}/candidates/${id}`, data);
}

export async function deleteCandidate(id: string): Promise<void> {
  await axios.delete(`${BASE}/candidates/${id}`);
}

// ── Status transitions ────────────────────────────────────────────────────────

export async function moveToOnboarding(id: string): Promise<void> {
  await axios.post(`${BASE}/candidates/${id}/onboard`);
}

export async function hireCandidate(id: string): Promise<{ staffId: string }> {
  const res = await axios.post(`${BASE}/candidates/${id}/hire`);
  return res.data;
}

export async function rejectCandidate(id: string): Promise<void> {
  await axios.post(`${BASE}/candidates/${id}/reject`);
}

// ── Checklist items ───────────────────────────────────────────────────────────

export async function toggleChecklistItem(
  candidateId: string,
  itemId: string,
  isChecked: boolean
): Promise<void> {
  await axios.put(`${BASE}/candidates/${candidateId}/checklist/${itemId}`, { isChecked });
}

export async function addChecklistItem(
  candidateId: string,
  name: string
): Promise<ChecklistItemDto> {
  const res = await axios.post(`${BASE}/candidates/${candidateId}/checklist`, { name });
  return res.data;
}

export async function deleteChecklistItem(candidateId: string, itemId: string): Promise<void> {
  await axios.delete(`${BASE}/candidates/${candidateId}/checklist/${itemId}`);
}

// ── Candidate documents ───────────────────────────────────────────────────────

export async function uploadCandidateDocument(
  candidateId: string,
  file: File
): Promise<CandidateDocumentDto> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await axios.post(`${BASE}/candidates/${candidateId}/documents`, fd);
  return res.data;
}

export async function downloadCandidateDocument(
  candidateId: string,
  docId: string,
  fileName: string
): Promise<void> {
  await downloadBlob(`${BASE}/candidates/${candidateId}/documents/${docId}`, fileName);
}

export async function deleteCandidateDocument(
  candidateId: string,
  docId: string
): Promise<void> {
  await axios.delete(`${BASE}/candidates/${candidateId}/documents/${docId}`);
}

// ── Staff documents ───────────────────────────────────────────────────────────

export async function listStaffDocuments(staffId: string): Promise<StaffDocumentDto[]> {
  const res = await axios.get(`${BASE}/staff/${staffId}/documents`);
  return res.data;
}

export async function uploadStaffDocument(
  staffId: string,
  file: File
): Promise<StaffDocumentDto> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await axios.post(`${BASE}/staff/${staffId}/documents`, fd);
  return res.data;
}

export async function downloadStaffDocument(
  staffId: string,
  docId: string,
  fileName: string
): Promise<void> {
  await downloadBlob(`${BASE}/staff/${staffId}/documents/${docId}`, fileName);
}

export async function deleteStaffDocument(staffId: string, docId: string): Promise<void> {
  await axios.delete(`${BASE}/staff/${staffId}/documents/${docId}`);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getHiringDashboard(
  facilityId: string,
  from: string,
  to: string
): Promise<HiringDashboard> {
  const res = await axios.get(`${BASE}/dashboard`, { params: { facilityId, from, to } });
  return res.data;
}
