/**
 * Image_Library (Spec #45 R30).
 *
 * The one part of a Season_Rollover that deliberately preserves user-generated
 * content. Robot rows are deleted at rollover; their uploaded image files are
 * not, so a player can rebuild the same character next season and archived
 * seasons keep rendering the robots they describe.
 *
 * Scoped strictly to the owning user. A player never sees, selects, or copies
 * another player's upload — uploads pass through content moderation and could
 * be anything, so cross-stable access is both a copyright and an abuse concern.
 *
 * Everything here operates inside `uploads/user-robots/` only. Generated_Stable
 * robots reference shared build assets under `/assets/robots/`, which this
 * module never touches.
 *
 * @module services/moderation/imageLibraryService
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { loadEnvConfig } from '../../config/env';
import { SeasonError, SeasonErrorCode } from '../../errors';
import { fileStorageService, type OrphanCleanupResult } from './fileStorageService';

const UPLOAD_URL_PREFIX = '/uploads/user-robots';

/** A retained image plus the cost of deleting it. */
export interface RetainedImage {
  path: string;
  uploadedAt: Date;
  /** Current robots using this image. */
  currentRobotCount: number;
  /** Archived seasons whose robot rows reference this image. */
  archivedSeasonCount: number;
}

/** What deleting an image would affect. */
export interface DeleteImpact {
  path: string;
  affectedRobotNames: string[];
  affectedSeasonNumbers: number[];
}

// ─── Ownership ───────────────────────────────────────────────────────

/**
 * Assert that an image path belongs to the caller.
 *
 * Two layers: the existing `getAbsolutePath` traversal guard rejects `..`
 * sequences, and this then requires the resolved path to sit inside the
 * caller's own directory. Failure is a generic 403 that reveals nothing about
 * whether the file exists.
 */
export function assertOwnership(userId: number, relativePath: string): string {
  const expectedPrefix = `${UPLOAD_URL_PREFIX}/${userId}/`;

  let absolute: string;
  try {
    absolute = fileStorageService.getAbsolutePath(relativePath);
  } catch {
    throw new SeasonError(SeasonErrorCode.IMAGE_NOT_OWNED, 'Access denied', 403);
  }

  if (!relativePath.startsWith(expectedPrefix)) {
    throw new SeasonError(SeasonErrorCode.IMAGE_NOT_OWNED, 'Access denied', 403);
  }

  // Belt and braces: the RESOLVED absolute path must also sit under the user's
  // own directory, so a crafted path that passes the prefix check but resolves
  // elsewhere still fails — for example `.../1/../12/x.webp`.
  //
  // The trailing separator matters. Without it, user 1's directory prefix
  // (`.../user-robots/1`) also matches user 12's directory
  // (`.../user-robots/12/...`), so a traversal into a numerically-prefixed
  // neighbour would be granted.
  const userDirAbsolute =
    fileStorageService.getAbsolutePath(`${UPLOAD_URL_PREFIX}/${userId}/`) + path.sep;
  if (!absolute.startsWith(userDirAbsolute)) {
    throw new SeasonError(SeasonErrorCode.IMAGE_NOT_OWNED, 'Access denied', 403);
  }

  return absolute;
}

// ─── Listing ─────────────────────────────────────────────────────────

/** List the caller's own retained images with their usage counts. */
export async function listImages(userId: number): Promise<RetainedImage[]> {
  const userDir = fileStorageService.getAbsolutePath(`${UPLOAD_URL_PREFIX}/${userId}/`);

  let entries: string[];
  try {
    entries = (await fs.readdir(userDir)).filter((f) => f.endsWith('.webp'));
  } catch {
    return []; // no directory yet — the player has uploaded nothing
  }

  const paths = entries.map((f) => `${UPLOAD_URL_PREFIX}/${userId}/${f}`);
  if (paths.length === 0) return [];

  const [robots, archived] = await Promise.all([
    prisma.robot.findMany({
      where: { userId, imageUrl: { in: paths } },
      select: { imageUrl: true },
    }),
    prisma.robotSeasonArchive.findMany({
      where: { imageUrl: { in: paths }, stableArchive: { userId } },
      select: { imageUrl: true, stableArchive: { select: { seasonNumber: true } } },
    }),
  ]);

  const robotCounts = new Map<string, number>();
  for (const r of robots) {
    if (r.imageUrl) robotCounts.set(r.imageUrl, (robotCounts.get(r.imageUrl) ?? 0) + 1);
  }
  const seasonSets = new Map<string, Set<number>>();
  for (const a of archived) {
    if (!a.imageUrl) continue;
    const set = seasonSets.get(a.imageUrl) ?? new Set<number>();
    set.add(a.stableArchive.seasonNumber);
    seasonSets.set(a.imageUrl, set);
  }

  const results: RetainedImage[] = [];
  for (const relativePath of paths) {
    let uploadedAt: Date;
    try {
      const stat = await fs.stat(fileStorageService.getAbsolutePath(relativePath));
      uploadedAt = stat.mtime;
    } catch {
      continue; // file vanished between readdir and stat
    }
    results.push({
      path: relativePath,
      uploadedAt,
      currentRobotCount: robotCounts.get(relativePath) ?? 0,
      archivedSeasonCount: seasonSets.get(relativePath)?.size ?? 0,
    });
  }

  return results.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

/** Count the caller's retained images. */
export async function countImages(userId: number): Promise<number> {
  return (await listImages(userId)).length;
}

// ─── Cap enforcement ─────────────────────────────────────────────────

/**
 * Reject a new upload when the stable is already at the cap.
 *
 * Deliberately refuses rather than evicting: silently destroying a player's
 * artwork to make room for a new upload is worse than telling them to delete
 * one. Deletion is the player's decision.
 */
export async function assertUploadCapacity(userId: number): Promise<void> {
  const limit = loadEnvConfig().retainedImagesPerStable;
  const current = await countImages(userId);
  if (current >= limit) {
    throw new SeasonError(
      SeasonErrorCode.IMAGE_LIMIT_REACHED,
      `You have reached the limit of ${limit} saved images. Delete one before uploading another.`,
      400,
      { limit, current },
    );
  }
}

// ─── Selection ───────────────────────────────────────────────────────

/**
 * Validate that the caller may apply this image to a robot.
 *
 * Content moderation is deliberately NOT re-run: the image passed moderation
 * when it was first uploaded, and re-running it would burden a reuse flow
 * whose whole point is to make rebuilding cheap.
 */
export async function assertSelectable(userId: number, relativePath: string): Promise<void> {
  const absolute = assertOwnership(userId, relativePath);
  try {
    await fs.access(absolute);
  } catch {
    throw new SeasonError(SeasonErrorCode.IMAGE_NOT_OWNED, 'Access denied', 403);
  }
}

// ─── Deletion ────────────────────────────────────────────────────────

/** Report what deleting an image would affect, so the prompt can name it. */
export async function getImpact(userId: number, relativePath: string): Promise<DeleteImpact> {
  assertOwnership(userId, relativePath);

  const [robots, archived] = await Promise.all([
    prisma.robot.findMany({
      where: { userId, imageUrl: relativePath },
      select: { name: true },
    }),
    prisma.robotSeasonArchive.findMany({
      where: { imageUrl: relativePath, stableArchive: { userId } },
      select: { stableArchive: { select: { seasonNumber: true } } },
    }),
  ]);

  return {
    path: relativePath,
    affectedRobotNames: robots.map((r) => r.name),
    affectedSeasonNumbers: [...new Set(archived.map((a) => a.stableArchive.seasonNumber))].sort(
      (a, b) => b - a,
    ),
  };
}

/**
 * Delete one of the caller's own images.
 *
 * Current robots using it fall back to the default icon (`imageUrl` null).
 * Archived robot rows have their image path nulled so history renders a default
 * silhouette rather than a broken reference — the single deliberate mutation of
 * an archive row, confined to a cosmetic column.
 */
export async function deleteImage(
  userId: number,
  relativePath: string,
  confirmed: boolean,
): Promise<DeleteImpact> {
  assertOwnership(userId, relativePath);

  if (!confirmed) {
    throw new SeasonError(
      SeasonErrorCode.CONFIRMATION_REQUIRED,
      'Deleting an image is permanent — confirmation is required',
      400,
      await getImpact(userId, relativePath),
    );
  }

  const impact = await getImpact(userId, relativePath);

  await prisma.$transaction(async (tx) => {
    await tx.robot.updateMany({
      where: { userId, imageUrl: relativePath },
      data: { imageUrl: null },
    });
    await tx.robotSeasonArchive.updateMany({
      where: { imageUrl: relativePath, stableArchive: { userId } },
      data: { imageUrl: null },
    });
  });

  await fileStorageService.deleteImage(relativePath);
  logger.info(`[image-library] User ${userId} deleted ${relativePath}`);
  return impact;
}

/** Delete a user's entire image directory. Used when an account is removed. */
export async function deleteAllImagesForUser(userId: number): Promise<void> {
  const userDir = fileStorageService.getAbsolutePath(`${UPLOAD_URL_PREFIX}/${userId}/`);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
    logger.info(`[image-library] Removed image directory for deleted user ${userId}`);
  } catch (error) {
    logger.error(
      `[image-library] Failed to remove image directory for user ${userId} — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ─── Orphan sweep ────────────────────────────────────────────────────

/**
 * Build the archive-aware referenced set and run the orphan sweep.
 *
 * This is the critical companion to retention: without archive paths in the
 * referenced set, the sweep would delete exactly the files the archive depends
 * on, so retention would appear to work at rollover and silently fail later.
 */
export async function cleanupSeasonOrphans(): Promise<OrphanCleanupResult> {
  const [liveRobots, archivedRobots] = await Promise.all([
    prisma.robot.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
    prisma.robotSeasonArchive.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
  ]);

  const referenced = new Set<string>();
  for (const r of liveRobots) if (r.imageUrl) referenced.add(r.imageUrl);
  for (const a of archivedRobots) if (a.imageUrl) referenced.add(a.imageUrl);

  // Retained-but-unused images must survive the sweep too: a player who
  // deleted a robot keeps its artwork for next season. Include every file
  // still inside a live user's directory, up to the cap.
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    const images = await listImages(user.id);
    for (const image of images) referenced.add(image.path);
  }

  return fileStorageService.cleanupOrphans(referenced);
}

/** Resolve the uploads URL prefix, exported for tests. */
export function uploadUrlPrefix(): string {
  return UPLOAD_URL_PREFIX;
}

/** Re-exported for callers that need the raw path helper. */
export const imageLibraryPaths = { join: path.join };
