/**
 * Typed API of the admin Image Uploads page (`/admin/image-uploads`).
 * Mirrors `app/backend/src/services/moderation/adminImagesService.ts`.
 */
import { api } from './api';

export type ImagesFilter = 'all' | 'anyway';

export interface ImageOwner {
  userId: number;
  stableName: string | null;
  username: string | null;
  stableType: 'human' | 'generated' | 'automaton' | null;
}

export interface ImagesOverview {
  generatedAt: string;
  inUse: { images: number; robots: number; stables: number };
  savedNotInUse: number;
  season: {
    number: number | null;
    startedAt: string | null;
    uploads: number;
    firstWeekUploads: number;
    weeks: { start: string; uploads: number }[];
  };
  moderation: {
    windowDays: number;
    saved: number;
    blocked: number;
    warned: number;
    uploadedAnyway: number;
    gaveUp: number;
    filterOffline: number;
  };
  storage: {
    files: number;
    bytes: number;
    orphanFiles: number;
    missing: { robots: number; archived: number };
  };
}

export interface ImageTile {
  id: number;
  imageUrl: string;
  owner: ImageOwner;
  robotCount: number;
  robotNames: string[];
  uploadedAt: string;
  uploadedAnyway: boolean;
}

export interface ImagesPage {
  images: ImageTile[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; anyway: number };
}

export interface ModerationScores {
  drawing: number;
  hentai: number;
  neutral: number;
  porn: number;
  sexy: number;
}

export interface ImageDetail {
  id: number;
  imageUrl: string;
  owner: ImageOwner;
  uploadedAt: string;
  fileSize: number;
  uploadedAnyway: boolean;
  robots: { id: number; name: string }[];
  archivedSeasons: number[];
  library: { saved: number; limit: number };
  moderation: { scores: ModerationScores; robotLikenessScore: number | null } | null;
  thresholds: { nsfw: { porn: number; hentai: number; sexy: number }; robotLikeness: number };
}

export interface RemoveImageResult {
  imageUrl: string;
  robotsCleared: number;
  archivedCleared: number;
}

export interface CleanupPreview {
  orphanFiles: { imageUrl: string; bytes: number }[];
  orphanCount: number;
  orphanBytes: number;
  missing: { robots: number; archived: number; paths: string[] };
}

export interface CleanupResult {
  filesDeleted: number;
  bytesReclaimed: number;
  referencesCleared: { robots: number; archived: number };
  errors: string[];
}

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
