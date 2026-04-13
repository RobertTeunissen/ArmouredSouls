import { api } from './api';
import apiClient from './apiClient';

export interface ChangelogEntry {
  id: number;
  title: string;
  body: string;
  category: 'balance' | 'feature' | 'bugfix' | 'economy';
  status: 'draft' | 'published';
  imageUrl: string | null;
  publishDate: string | null;
  sourceType: 'spec' | 'commit' | 'manual' | null;
  sourceRef: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedChangelogResult {
  entries: ChangelogEntry[];
  total: number;
  page: number;
  perPage: number;
}

// Player endpoints

export async function fetchPublishedEntries(
  page: number,
  perPage: number,
  category?: string,
): Promise<PaginatedChangelogResult> {
  const params: Record<string, unknown> = { page, perPage };
  if (category) params.category = category;
  return api.get<PaginatedChangelogResult>('/api/changelog', params);
}

export async function fetchUnreadEntries(): Promise<ChangelogEntry[]> {
  return api.get<ChangelogEntry[]>('/api/changelog/unread');
}

export async function fetchUnreadCount(): Promise<number> {
  const result = await api.get<{ count: number }>('/api/changelog/unread/count');
  return result.count;
}

export async function dismissChangelog(): Promise<void> {
  await api.post<void>('/api/changelog/dismiss');
}

// Admin endpoints

export async function fetchAllEntries(
  page: number,
  perPage: number,
): Promise<PaginatedChangelogResult> {
  return api.get<PaginatedChangelogResult>('/api/changelog/admin', { page, perPage });
}

export interface CreateChangelogData {
  title: string;
  body: string;
  category: 'balance' | 'feature' | 'bugfix' | 'economy';
  status?: 'draft' | 'published';
  imageUrl?: string | null;
  sourceType?: 'spec' | 'commit' | 'manual';
  sourceRef?: string;
}

export interface UpdateChangelogData {
  title?: string;
  body?: string;
  category?: 'balance' | 'feature' | 'bugfix' | 'economy';
  status?: 'draft' | 'published';
  imageUrl?: string | null;
}

export async function createEntry(data: CreateChangelogData): Promise<ChangelogEntry> {
  return api.post<ChangelogEntry>('/api/changelog/admin', data);
}

export async function updateEntry(id: number, data: UpdateChangelogData): Promise<ChangelogEntry> {
  return api.put<ChangelogEntry>(`/api/changelog/admin/${id}`, data);
}

export async function deleteEntry(id: number): Promise<void> {
  await api.delete<void>(`/api/changelog/admin/${id}`);
}

export async function publishEntry(id: number): Promise<ChangelogEntry> {
  return api.post<ChangelogEntry>(`/api/changelog/admin/${id}/publish`);
}

export async function uploadChangelogImage(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ imageUrl: string }>('/api/changelog/admin/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
