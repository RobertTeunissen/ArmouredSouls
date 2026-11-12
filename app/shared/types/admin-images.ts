/**
 * Wire contracts for the admin Images page (`/api/admin/images*`; backend
 * `services/moderation/adminImagesService.ts`).
 */

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
  /** Null for files uploaded before the inventory existed. */
  moderation: {
    scores: ModerationScores;
    robotLikenessScore: number | null;
  } | null;
  thresholds: { nsfw: ModerationThresholds; robotLikeness: number };
}

export interface ImageOwner {
  userId: number;
  stableName: string | null;
  username: string | null;
  stableType: 'human' | 'generated' | 'automaton' | null;
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

export type ImagesFilter = 'all' | 'anyway';

export interface ImagesOverview {
  generatedAt: string;
  inUse: { images: number; robots: number; stables: number };
  savedNotInUse: number;
  season: {
    number: number | null;
    /** When the season's row was created: the preparation window opens then. */
    startedAt: string | null;
    uploads: number;
    firstWeekUploads: number;
    /** Monday 00:00 UTC of every week from the season's first week to now. */
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
    /** References whose file no longer exists. */
    missing: { robots: number; archived: number };
  };
}

export interface ImagesPage {
  images: ImageTile[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; anyway: number };
}

export interface RemoveImageResult {
  imageUrl: string;
  robotsCleared: number;
  archivedCleared: number;
}

/** `uploaded_images.moderation_scores`: the nsfwjs class scores at upload. */
export interface ModerationScores {
  drawing: number;
  hentai: number;
  neutral: number;
  porn: number;
  sexy: number;
}

export interface ModerationThresholds {
  porn: number;
  hentai: number;
  sexy: number;
}
