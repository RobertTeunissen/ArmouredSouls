/**
 * Inventory of player uploads (`uploaded_images`) for the admin Image Uploads
 * page.
 *
 * The files under `uploads/user-robots/` stay the truth; this table adds what
 * the disk cannot hold (the moderation scores and the "upload anyway"
 * override, which the audit log loses after its retention window). Rows are
 * written on upload confirm and removed with the file; `syncUploadedImages`
 * reconciles both directions at startup and after every orphan sweep, and
 * backfills files that predate the table (without scores).
 *
 * Every write here is best-effort: a failure is logged and never fails the
 * player's upload or delete.
 *
 * @module services/moderation/uploadedImageService
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { Prisma } from '../../../generated/prisma';
import { fileStorageService } from './fileStorageService';

const UPLOAD_URL_PREFIX = '/uploads/user-robots';

export interface RecordUploadInput {
  imageUrl: string;
  userId: number;
  fileSize: number;
  moderationScores?: Record<string, number>;
  robotLikenessScore?: number;
  uploadedAnyway: boolean;
}

export interface SyncResult {
  added: number;
  removed: number;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Record a confirmed upload with its moderation result. */
export async function recordUpload(input: RecordUploadInput): Promise<void> {
  // Stored as ModerationScores (src/types/securityTypes.ts).
  const scores = input.moderationScores ? (input.moderationScores as unknown as Prisma.InputJsonValue) : undefined;
  try {
    await prisma.uploadedImage.upsert({
      where: { imageUrl: input.imageUrl },
      create: {
        imageUrl: input.imageUrl,
        userId: input.userId,
        uploadedAt: new Date(),
        fileSize: input.fileSize,
        moderationScores: scores,
        robotLikenessScore: input.robotLikenessScore ?? null,
        uploadedAnyway: input.uploadedAnyway,
      },
      update: {},
    });
  } catch (error) {
    logger.warn(`[uploaded-images] Could not record ${input.imageUrl}: ${message(error)}`);
  }
}

/** Forget a deleted file. */
export async function forgetUpload(imageUrl: string): Promise<void> {
  try {
    await prisma.uploadedImage.deleteMany({ where: { imageUrl } });
  } catch (error) {
    logger.warn(`[uploaded-images] Could not forget ${imageUrl}: ${message(error)}`);
  }
}

interface DiskFile {
  imageUrl: string;
  userId: number;
  size: number;
  mtime: Date;
}

/** Every `.webp` under `uploads/user-robots/{userId}/`. */
export async function scanUploadFiles(): Promise<DiskFile[]> {
  const root = path.dirname(fileStorageService.getAbsolutePath(`${UPLOAD_URL_PREFIX}/0`));
  let userDirs: string[];
  try {
    userDirs = (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && /^\d+$/.test(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  const files: DiskFile[] = [];
  for (const dir of userDirs) {
    let names: string[];
    try {
      names = (await fs.readdir(path.join(root, dir))).filter((f) => f.endsWith('.webp'));
    } catch {
      continue;
    }
    for (const name of names) {
      const imageUrl = `${UPLOAD_URL_PREFIX}/${dir}/${name}`;
      try {
        const stat = await fs.stat(fileStorageService.getAbsolutePath(imageUrl));
        files.push({ imageUrl, userId: Number(dir), size: stat.size, mtime: stat.mtime });
      } catch {
        // Vanished between readdir and stat, or a name the path guard rejects.
      }
    }
  }
  return files;
}

/**
 * Make the table match the disk: add a row (no scores) for every file without
 * one, and drop rows whose file is gone.
 */
export async function syncUploadedImages(): Promise<SyncResult> {
  const files = await scanUploadFiles();
  const rows = await prisma.uploadedImage.findMany({ select: { imageUrl: true } });
  const known = new Set(rows.map((r) => r.imageUrl));
  const onDisk = new Set(files.map((f) => f.imageUrl));

  const missing = files.filter((f) => !known.has(f.imageUrl));
  const stale = rows.map((r) => r.imageUrl).filter((url) => !onDisk.has(url));

  if (missing.length > 0) {
    await prisma.uploadedImage.createMany({
      data: missing.map((f) => ({ imageUrl: f.imageUrl, userId: f.userId, uploadedAt: f.mtime, fileSize: f.size })),
      skipDuplicates: true,
    });
  }
  if (stale.length > 0) {
    await prisma.uploadedImage.deleteMany({ where: { imageUrl: { in: stale } } });
  }
  if (missing.length > 0 || stale.length > 0) {
    logger.info(`[uploaded-images] Synced with disk: ${missing.length} added, ${stale.length} removed`);
  }
  return { added: missing.length, removed: stale.length };
}
