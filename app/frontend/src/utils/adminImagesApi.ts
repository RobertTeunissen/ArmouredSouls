/**
 * Typed API of the admin Image Uploads page (`/admin/image-uploads`).
 * Mirrors `app/backend/src/services/moderation/adminImagesService.ts`.
 */
import { api } from './api';
import type {
  CleanupPreview,
  CleanupResult,
  ImageDetail,
  ImagesFilter,
  ImagesOverview,
  ImagesPage,
  RemoveImageResult,
} from '@shared/types';

export const getImagesOverview = (signal?: AbortSignal): Promise<ImagesOverview> =>
  api.get<ImagesOverview>('/api/admin/images/overview', { signal });

export const getImagesInUse = (filter: ImagesFilter, q: string, page: number, signal?: AbortSignal): Promise<ImagesPage> =>
  api.get<ImagesPage>('/api/admin/images', { params: { filter, q, page }, signal });

export const getImageDetail = (id: number, signal?: AbortSignal): Promise<ImageDetail> =>
  api.get<ImageDetail>(`/api/admin/images/${id}`, { signal });

export const removeImage = (id: number, reason: string): Promise<RemoveImageResult> =>
  api.delete<RemoveImageResult>(`/api/admin/images/${id}`, { data: { confirm: true, reason } });

export const getCleanupPreview = (signal?: AbortSignal): Promise<CleanupPreview> =>
  api.get<CleanupPreview>('/api/admin/images/cleanup', { signal });

export const runImageCleanup = (): Promise<CleanupResult> =>
  api.post<CleanupResult>('/api/admin/images/cleanup');
