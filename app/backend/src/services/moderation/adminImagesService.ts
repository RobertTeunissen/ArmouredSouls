/**
 * Admin Image Uploads page (`/admin/image-uploads`): "Is every image on a
 * robot acceptable?"
 *
 * - Overview: images in use, saved-but-unused, uploads this season (per week),
 *   moderation outcomes of the last 30 days (audit log), and storage.
 * - The images in use, newest first, with an image detail for the slide-over.
 * - Remove: for an image that got past the NSFW filter. Clears it from current
 *   robots and archived seasons, deletes the file, and audits the action.
 * - Cleanup: the archive- and library-aware orphan sweep plus clearing robot
 *   and archive references whose file is gone.
 *
 * Only player uploads (`/uploads/user-robots/`) are in scope; generated
 * stables use `/assets/robots/` and Automatons `/uploads/automatons/`.
 *
 * @module services/moderation/adminImagesService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { loadEnvConfig } from '../../config/env';
import { ModerationError, ModerationErrorCode } from '../../errors';
import { recordAction } from '../admin/adminAuditLogService';
import { fileStorageService } from './fileStorageService';
import { cleanupSeasonOrphans, referencedUploadPaths } from './imageLibraryService';
import { scanUploadFiles, syncUploadedImages } from './uploadedImageService';
import { MODERATION_THRESHOLDS, ROBOT_LIKENESS_THRESHOLD } from './contentModerationService';
import type {
  CleanupPreview,
  CleanupResult,
  ImageDetail,
  ImageOwner,
  ImagesFilter,
  ImagesOverview,
  ImagesPage,
  ImageTile,
  ModerationScores,
  ModerationThresholds,
  RemoveImageResult,
} from '../../shared/types';

export const UPLOAD_PREFIX = '/uploads/user-robots/';
export const IMAGES_PAGE_SIZE = 24;
/** Moderation outcomes are read from the audit log over this window (ACC keeps 30 days). */
export const MODERATION_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** Paths listed in the cleanup preview. */
const PREVIEW_LIMIT = 50;

function mondayUtc(at: Date): Date {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - offset * DAY_MS);
}

/** Upload counts per week from the week containing `start` up to the week containing `now`. */
export function weeklyBuckets(start: Date, now: Date, uploadedAt: Date[]): { start: string; uploads: number }[] {
  const first = mondayUtc(start);
  const last = mondayUtc(now);
  const weeks: { start: Date; uploads: number }[] = [];
  for (let t = first.getTime(); t <= last.getTime(); t += WEEK_MS) weeks.push({ start: new Date(t), uploads: 0 });
  for (const at of uploadedAt) {
    const index = Math.floor((at.getTime() - first.getTime()) / WEEK_MS);
    if (index >= 0 && index < weeks.length) weeks[index].uploads++;
  }
  return weeks.map((w) => ({ start: w.start.toISOString(), uploads: w.uploads }));
}

async function owners(userIds: number[]): Promise<Map<number, ImageOwner>> {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, username: true, stableName: true, stableType: true },
  });
  const map = new Map<number, ImageOwner>();
  for (const u of users) map.set(u.id, { userId: u.id, stableName: u.stableName, username: u.username, stableType: u.stableType });
  return map;
}

function ownerOrUnknown(map: Map<number, ImageOwner>, userId: number): ImageOwner {
  return map.get(userId) ?? { userId, stableName: null, username: null, stableType: null };
}

/** Robots and archive rows pointing at player uploads whose file is gone. */
async function missingReferences(onDisk: Set<string>): Promise<{ robots: string[]; archived: string[] }> {
  const [robots, archived] = await Promise.all([
    prisma.robot.findMany({ where: { imageUrl: { startsWith: UPLOAD_PREFIX } }, select: { imageUrl: true } }),
    prisma.robotSeasonArchive.findMany({ where: { imageUrl: { startsWith: UPLOAD_PREFIX } }, select: { imageUrl: true } }),
  ]);
  const gone = (url: string | null): url is string => url !== null && !onDisk.has(url);
  return {
    robots: robots.map((r) => r.imageUrl).filter(gone),
    archived: archived.map((a) => a.imageUrl).filter(gone),
  };
}

async function moderationCounts(since: Date): Promise<ImagesOverview['moderation']> {
  const grouped = await prisma.auditLog.groupBy({
    by: ['eventType'],
    where: {
      eventTimestamp: { gte: since },
      eventType: { in: ['image_upload_success', 'image_moderation_rejection', 'image_robot_likeness_warning', 'image_robot_likeness_override', 'image_moderation_unavailable'] },
    },
    _count: { _all: true },
  });
  const count = (type: string): number => grouped.find((g) => g.eventType === type)?._count._all ?? 0;
  const warned = count('image_robot_likeness_warning');
  const uploadedAnyway = count('image_robot_likeness_override');
  return {
    windowDays: MODERATION_WINDOW_DAYS,
    saved: count('image_upload_success'),
    blocked: count('image_moderation_rejection'),
    warned,
    uploadedAnyway,
    gaveUp: Math.max(0, warned - uploadedAnyway),
    filterOffline: count('image_moderation_unavailable'),
  };
}

/** The cards, the weekly chart, the moderation block and the storage block. */
export async function getImagesOverview(now: Date = new Date()): Promise<ImagesOverview> {
  const [robots, inventory, season, moderation, files, referenced] = await Promise.all([
    prisma.robot.findMany({ where: { imageUrl: { startsWith: UPLOAD_PREFIX } }, select: { imageUrl: true, userId: true } }),
    prisma.uploadedImage.findMany({ select: { imageUrl: true, uploadedAt: true, fileSize: true } }),
    prisma.season.findFirst({ orderBy: { seasonNumber: 'desc' }, select: { seasonNumber: true, createdAt: true } }),
    moderationCounts(new Date(now.getTime() - MODERATION_WINDOW_DAYS * DAY_MS)),
    scanUploadFiles(),
    referencedUploadPaths(),
  ]);

  const liveUrls = new Set(robots.map((r) => r.imageUrl).filter((u): u is string => u !== null));
  const onDisk = new Set(files.map((f) => f.imageUrl));
  const missing = await missingReferences(onDisk);
  const seasonStart = season?.createdAt ?? null;
  const seasonUploads = seasonStart ? inventory.filter((i) => i.uploadedAt >= seasonStart) : [];
  const firstWeekEnd = seasonStart ? new Date(seasonStart.getTime() + WEEK_MS) : null;

  return {
    generatedAt: now.toISOString(),
    inUse: {
      images: liveUrls.size,
      robots: robots.length,
      stables: new Set(robots.map((r) => r.userId)).size,
    },
    savedNotInUse: inventory.filter((i) => !liveUrls.has(i.imageUrl)).length,
    season: {
      number: season?.seasonNumber ?? null,
      startedAt: seasonStart?.toISOString() ?? null,
      uploads: seasonUploads.length,
      firstWeekUploads: firstWeekEnd ? seasonUploads.filter((i) => i.uploadedAt < firstWeekEnd).length : 0,
      weeks: seasonStart ? weeklyBuckets(seasonStart, now, seasonUploads.map((i) => i.uploadedAt)) : [],
    },
    moderation,
    storage: {
      files: files.length,
      bytes: files.reduce((sum, f) => sum + f.size, 0),
      orphanFiles: files.filter((f) => !referenced.has(f.imageUrl)).length,
      missing: { robots: missing.robots.length, archived: missing.archived.length },
    },
  };
}

/** The images currently on a robot, newest upload first. */
export async function listImagesInUse(filter: ImagesFilter, q: string, page: number): Promise<ImagesPage> {
  const robots = await prisma.robot.findMany({
    where: { imageUrl: { startsWith: UPLOAD_PREFIX } },
    select: { name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });
  const robotsByUrl = new Map<string, string[]>();
  for (const r of robots) {
    if (!r.imageUrl) continue;
    robotsByUrl.set(r.imageUrl, [...(robotsByUrl.get(r.imageUrl) ?? []), r.name]);
  }
  const rows = await prisma.uploadedImage.findMany({
    where: { imageUrl: { in: [...robotsByUrl.keys()] } },
    orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
  });
  const ownerMap = await owners(rows.map((r) => r.userId));
  const all: ImageTile[] = rows.map((row) => {
    const robotNames = robotsByUrl.get(row.imageUrl) ?? [];
    return {
      id: row.id,
      imageUrl: row.imageUrl,
      owner: ownerOrUnknown(ownerMap, row.userId),
      robotCount: robotNames.length,
      robotNames,
      uploadedAt: row.uploadedAt.toISOString(),
      uploadedAnyway: row.uploadedAnyway,
    };
  });

  const needle = q.trim().toLowerCase();
  const matches = all.filter((tile) => {
    if (filter === 'anyway' && !tile.uploadedAnyway) return false;
    if (!needle) return true;
    return [tile.owner.stableName, tile.owner.username, ...tile.robotNames].some((v) => v?.toLowerCase().includes(needle));
  });
  const totalPages = Math.max(1, Math.ceil(matches.length / IMAGES_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    images: matches.slice((current - 1) * IMAGES_PAGE_SIZE, current * IMAGES_PAGE_SIZE),
    total: matches.length,
    page: current,
    pageSize: IMAGES_PAGE_SIZE,
    counts: { all: all.length, anyway: all.filter((t) => t.uploadedAnyway).length },
  };
}

async function findImage(id: number): Promise<{ id: number; imageUrl: string; userId: number; uploadedAt: Date; fileSize: number; uploadedAnyway: boolean; moderationScores: unknown; robotLikenessScore: number | null }> {
  const row = await prisma.uploadedImage.findUnique({ where: { id } });
  if (!row) throw new ModerationError(ModerationErrorCode.IMAGE_NOT_FOUND, 'Image not found', 404);
  return row;
}

/** Everything the slide-over shows. */
export async function getImageDetail(id: number): Promise<ImageDetail> {
  const row = await findImage(id);
  const [robots, archived, saved, ownerMap] = await Promise.all([
    prisma.robot.findMany({ where: { imageUrl: row.imageUrl }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.robotSeasonArchive.findMany({ where: { imageUrl: row.imageUrl }, select: { stableArchive: { select: { seasonNumber: true } } } }),
    prisma.uploadedImage.count({ where: { userId: row.userId } }),
    owners([row.userId]),
  ]);
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    owner: ownerOrUnknown(ownerMap, row.userId),
    uploadedAt: row.uploadedAt.toISOString(),
    fileSize: row.fileSize,
    uploadedAnyway: row.uploadedAnyway,
    robots,
    archivedSeasons: [...new Set(archived.map((a) => a.stableArchive.seasonNumber))].sort((a, b) => b - a),
    library: { saved, limit: loadEnvConfig().retainedImagesPerStable },
    moderation: row.moderationScores
      ? { scores: row.moderationScores as unknown as ModerationScores, robotLikenessScore: row.robotLikenessScore }
      : null,
    thresholds: { nsfw: { ...MODERATION_THRESHOLDS }, robotLikeness: ROBOT_LIKENESS_THRESHOLD },
  };
}

/**
 * Remove an image that got past the NSFW filter: its robots fall back to the
 * default frame, archived seasons lose the reference, and the file is deleted.
 * The player is not notified. Audited with the admin's id and the reason.
 */
export async function removeImage(adminUserId: number, id: number, reason: string): Promise<RemoveImageResult> {
  const row = await findImage(id);
  const [robots, archived] = await prisma.$transaction([
    prisma.robot.updateMany({ where: { imageUrl: row.imageUrl }, data: { imageUrl: null } }),
    prisma.robotSeasonArchive.updateMany({ where: { imageUrl: row.imageUrl }, data: { imageUrl: null } }),
    prisma.uploadedImage.delete({ where: { id: row.id } }),
  ]);
  await fileStorageService.deleteImage(row.imageUrl);
  const result: RemoveImageResult = { imageUrl: row.imageUrl, robotsCleared: robots.count, archivedCleared: archived.count };
  recordAction(adminUserId, 'image_removed', 'success', { ...result, ownerUserId: row.userId, reason });
  logger.info(`[admin-images] Admin ${adminUserId} removed ${row.imageUrl} (owner ${row.userId}): ${robots.count} robots, ${archived.count} archive rows`);
  return result;
}

/** What "Clean up" would do, without changing anything. */
export async function previewCleanup(): Promise<CleanupPreview> {
  const [files, referenced] = await Promise.all([scanUploadFiles(), referencedUploadPaths()]);
  const orphans = files.filter((f) => !referenced.has(f.imageUrl));
  const missing = await missingReferences(new Set(files.map((f) => f.imageUrl)));
  return {
    orphanFiles: orphans.slice(0, PREVIEW_LIMIT).map((f) => ({ imageUrl: f.imageUrl, bytes: f.size })),
    orphanCount: orphans.length,
    orphanBytes: orphans.reduce((sum, f) => sum + f.size, 0),
    missing: {
      robots: missing.robots.length,
      archived: missing.archived.length,
      paths: [...new Set([...missing.robots, ...missing.archived])].sort().slice(0, PREVIEW_LIMIT),
    },
  };
}

/** Delete orphan files and clear references whose file is gone. Audited. */
export async function runCleanup(adminUserId: number): Promise<CleanupResult> {
  const sweep = await cleanupSeasonOrphans();
  const files = await scanUploadFiles();
  const missing = await missingReferences(new Set(files.map((f) => f.imageUrl)));
  const paths = [...new Set([...missing.robots, ...missing.archived])];
  let robots = 0;
  let archived = 0;
  if (paths.length > 0) {
    const [r, a] = await prisma.$transaction([
      prisma.robot.updateMany({ where: { imageUrl: { in: paths } }, data: { imageUrl: null } }),
      prisma.robotSeasonArchive.updateMany({ where: { imageUrl: { in: paths } }, data: { imageUrl: null } }),
    ]);
    robots = r.count;
    archived = a.count;
  }
  await syncUploadedImages();
  const result: CleanupResult = {
    filesDeleted: sweep.filesDeleted,
    bytesReclaimed: sweep.bytesReclaimed,
    referencesCleared: { robots, archived },
    errors: sweep.errors.map(() => 'A file could not be deleted; see the server log.'),
  };
  recordAction(adminUserId, 'image_cleanup', sweep.errors.length > 0 ? 'failure' : 'success', {
    filesDeleted: result.filesDeleted,
    bytesReclaimed: result.bytesReclaimed,
    referencesCleared: result.referencesCleared,
    errorCount: sweep.errors.length,
  });
  return result;
}
