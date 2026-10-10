/**
 * Automaton_Image_Store: admin uploads of Robot_Blueprint images (Spec #55,
 * R3.2, R3.10, R9.8, R11.6, design §16, task 9.2).
 *
 * Upload flow: the robot upload's file validation (`fileValidationService`,
 * magic bytes and dimensions, sharp only) → 512×512 WebP
 * (`imageProcessingService`, quality 80) → `uploads/automatons/{catalogueKey}/
 * {uuid}.webp` → the blueprint's `imageUrl` and every robot built from it
 * updated in one transaction. Content moderation is not applied (admin-only,
 * audited; the changelog image precedent). Old files are never deleted
 * automatically, because archived seasons may reference them; only deleting a
 * Draft_Automaton removes its directory (R2.6).
 *
 * Every path is built from validated components (a Catalogue_Key matching
 * `^[a-z0-9-]{3,40}$` and a generated UUID file name) and checked to resolve
 * inside the store, mirroring `fileStorageService.getAbsolutePath`.
 */
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import { fileValidationService } from '../moderation/fileValidationService';
import { imageProcessingService } from '../moderation/imageProcessingService';
import { CATALOGUE_KEY_PATTERN } from './automatonCatalogueService';

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
/** `app/backend/uploads/automatons` (served by `/uploads/*`). */
export const DEFAULT_AUTOMATON_UPLOAD_DIR = path.join(BACKEND_ROOT, 'uploads', 'automatons');
export const AUTOMATON_UPLOAD_URL_PREFIX = '/uploads/automatons';
/** `{uuid}.webp`, the only file name the store writes. */
const UPLOAD_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

let uploadDir = DEFAULT_AUTOMATON_UPLOAD_DIR;

/** Point the store at another directory (tests). Returns the previous one. */
export function setAutomatonUploadDir(dir: string): string {
  const previous = uploadDir;
  uploadDir = path.resolve(dir);
  return previous;
}

/** The directory the store currently writes to. */
export function getAutomatonUploadDir(): string {
  return uploadDir;
}

function invalidPath(): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_IMAGE_INVALID, 'Invalid image path', 400);
}

/**
 * Absolute path of a store directory or file, from validated components only.
 * Throws for a key or file name that is not exactly the expected shape, or a
 * result outside the store (path traversal).
 */
export function resolveAutomatonImagePath(catalogueKey: string, fileName?: string): string {
  if (!CATALOGUE_KEY_PATTERN.test(catalogueKey)) throw invalidPath();
  let resolved = path.join(uploadDir, catalogueKey);
  if (fileName !== undefined) {
    if (!UPLOAD_FILE_PATTERN.test(fileName) || path.basename(fileName) !== fileName) throw invalidPath();
    resolved = path.join(resolved, fileName);
  }
  if (!resolved.startsWith(uploadDir + path.sep)) throw invalidPath();
  return resolved;
}

/** True when `imageUrl` is an upload of this Catalogue_Key in the store (`/uploads/automatons/{key}/{uuid}.webp`). */
export function isAutomatonUploadUrl(imageUrl: string, catalogueKey: string): boolean {
  const prefix = `${AUTOMATON_UPLOAD_URL_PREFIX}/${catalogueKey}/`;
  return imageUrl.startsWith(prefix) && UPLOAD_FILE_PATTERN.test(imageUrl.slice(prefix.length));
}

export interface StoredBlueprintImage {
  imageUrl: string;
  /** Live robots whose image changed with the blueprint (0 or 1). */
  robotsUpdated: number;
}

/**
 * Validate, process and store an uploaded image for one Robot_Blueprint and
 * set it on the blueprint and its live robot in one transaction (R3.10). The
 * blueprint is looked up first, so an unknown key or slot writes no file; a
 * failed transaction removes the file it wrote.
 */
export async function storeBlueprintImage(
  catalogueKey: string,
  slot: number,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredBlueprintImage> {
  const directory = resolveAutomatonImagePath(catalogueKey);
  const blueprint = await prisma.automatonRobotBlueprint.findFirst({
    where: { profile: { catalogueKey }, slotIndex: slot },
    select: { id: true },
  });
  if (!blueprint) {
    const profile = await prisma.automatonProfile.findUnique({ where: { catalogueKey }, select: { id: true } });
    throw profile
      ? new AutomatonError(AutomatonErrorCode.AUTOMATON_BLUEPRINT_NOT_FOUND, `Stable ${catalogueKey} has no blueprint in slot ${slot}`, 404)
      : new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_FOUND, `No Automaton stable ${catalogueKey}`, 404);
  }

  const validation = await fileValidationService.validateImage(buffer, mimeType);
  if (!validation.valid) {
    throw new AutomatonError(AutomatonErrorCode.AUTOMATON_IMAGE_INVALID, validation.error ?? 'Invalid image', 400);
  }
  let processed: Buffer;
  try {
    processed = await imageProcessingService.processImage(buffer);
  } catch {
    throw new AutomatonError(AutomatonErrorCode.AUTOMATON_IMAGE_INVALID, 'The image could not be processed', 400);
  }

  const fileName = `${randomUUID()}.webp`;
  const filePath = resolveAutomatonImagePath(catalogueKey, fileName);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, processed);
  const imageUrl = `${AUTOMATON_UPLOAD_URL_PREFIX}/${catalogueKey}/${fileName}`;
  try {
    const robotsUpdated = await prisma.$transaction(async (tx) => {
      await tx.automatonRobotBlueprint.update({ where: { id: blueprint.id }, data: { imageUrl } });
      const robots = await tx.robot.updateMany({ where: { automatonBlueprintId: blueprint.id }, data: { imageUrl } });
      return robots.count;
    });
    return { imageUrl, robotsUpdated };
  } catch (error) {
    await fs.unlink(filePath).catch(() => undefined);
    throw error;
  }
}

/**
 * Remove a Draft_Automaton's upload directory (R2.6). Never throws: a failure
 * is logged and the profile deletion stands.
 */
export async function deleteProfileImages(catalogueKey: string): Promise<void> {
  try {
    await fs.rm(resolveAutomatonImagePath(catalogueKey), { recursive: true, force: true });
  } catch (error) {
    logger.error(`[automaton-images] Could not remove uploads of ${catalogueKey}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
