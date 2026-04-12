/**
 * Image Upload Handlers
 *
 * Two-step upload flow:
 *   1. handleImagePreview  — POST /:id/image  → validate, moderate, process, return base64 preview
 *   2. handleImageConfirm  — PUT  /:id/image/confirm → store to disk, update robot
 *
 * @module services/moderation/imageUploadHandlers
 */

import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../lib/prisma';
import { eventLogger } from '../common/eventLogger';
import { securityMonitor } from '../security/securityMonitor';
import { fileValidationService } from './fileValidationService';
import { contentModerationService } from './contentModerationService';
import { imageProcessingService } from './imageProcessingService';
import { pendingUploadCache } from './pendingUploadCache';
import { fileStorageService } from './fileStorageService';
import { SecuritySeverity } from '../security/securityLogger';
import logger from '../../config/logger';

/**
 * POST /api/robots/:id/image[?acknowledgeRobotLikeness=true]
 *
 * Validates, moderates, and processes the uploaded image.
 * Returns a base64 preview + confirmation token. No disk writes.
 */
export async function handleImagePreview(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const file = req.file;
  const acknowledgeRobotLikeness = req.query.acknowledgeRobotLikeness === 'true';

  // Step 1: Verify robot ownership
  const robot = await prisma.robot.findUnique({ where: { id: robotId } });
  if (!robot || robot.userId !== userId) {
    res.status(403).json({ error: 'Access denied', code: 'ROBOT_NOT_OWNED' });
    return;
  }

  // Step 2: Ensure file is present
  if (!file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  // Step 3: Validate file (magic bytes + dimensions)
  const validation = await fileValidationService.validateImage(file.buffer, file.mimetype);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, code: 'INVALID_IMAGE' });
    return;
  }

  // Step 4: Content moderation
  const moderation = await contentModerationService.classifyImage(file.buffer);

  logger.info(`[ImageUpload] Moderation result for robot ${robotId}: safe=${moderation.safe}, robotLikely=${moderation.robotLikely}, robotLikenessScore=${moderation.robotLikenessScore.toFixed(3)}, scores=${JSON.stringify(moderation.scores)}`);

  // 4a: Moderation unavailable → fail-closed
  if (moderation.reason === 'moderation_unavailable') {
    res.status(503).json({
      error: 'Image moderation service unavailable',
      code: 'MODERATION_UNAVAILABLE',
    });
    return;
  }

  // 4b: NSFW hard block (always enforced, even with acknowledgeRobotLikeness)
  if (!moderation.safe) {
    await eventLogger.logEvent(0, 'image_moderation_rejection' as never, {
      robotId,
      reason: moderation.reason,
      timestamp: new Date().toISOString(),
    }, { userId });

    securityMonitor['recordEvent']({
      severity: SecuritySeverity.WARNING,
      eventType: 'image_moderation_rejection',
      userId,
      details: { robotId, reason: moderation.reason },
      timestamp: new Date().toISOString(),
    });

    res.status(422).json({
      error: 'Image did not pass content moderation',
      code: 'IMAGE_MODERATION_FAILED',
    });
    return;
  }

  // 4c: Robot-likeness soft warning
  if (!moderation.robotLikely && !acknowledgeRobotLikeness) {
    await eventLogger.logEvent(0, 'image_robot_likeness_warning' as never, {
      robotId,
      robotLikenessScore: moderation.robotLikenessScore,
      timestamp: new Date().toISOString(),
    }, { userId });

    securityMonitor['recordEvent']({
      severity: SecuritySeverity.INFO,
      eventType: 'image_robot_likeness_warning',
      userId,
      details: { robotId, robotLikenessScore: moderation.robotLikenessScore },
      timestamp: new Date().toISOString(),
    });

    res.status(422).json({
      error: "This doesn't look like a robot",
      code: 'LOW_ROBOT_LIKENESS',
    });
    return;
  }

  // 4d: Robot-likeness override — log it
  if (!moderation.robotLikely && acknowledgeRobotLikeness) {
    await eventLogger.logEvent(0, 'image_robot_likeness_override' as never, {
      robotId,
      robotLikenessScore: moderation.robotLikenessScore,
      timestamp: new Date().toISOString(),
    }, { userId });

    securityMonitor['recordEvent']({
      severity: SecuritySeverity.INFO,
      eventType: 'image_robot_likeness_override',
      userId,
      details: { robotId, robotLikenessScore: moderation.robotLikenessScore },
      timestamp: new Date().toISOString(),
    });
  }

  // Step 5: Process image to 512×512 WebP
  const processedBuffer = await imageProcessingService.processImage(file.buffer);

  // Step 6: Store in PendingUploadCache
  const confirmationToken = randomUUID();
  pendingUploadCache.store(confirmationToken, {
    processedBuffer,
    userId,
    robotId,
    originalFileSize: file.size,
    originalDimensions: { width: validation.width!, height: validation.height! },
    acknowledgedRobotLikeness: acknowledgeRobotLikeness,
    createdAt: Date.now(),
  });

  // Step 7: Return base64 preview + token
  const base64Preview = `data:image/webp;base64,${processedBuffer.toString('base64')}`;
  res.status(200).json({
    preview: base64Preview,
    confirmationToken,
  });
}

/**
 * PUT /api/robots/:id/image/confirm
 *
 * Retrieves the processed image from cache, stores to disk, updates robot.
 */
export async function handleImageConfirm(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { confirmationToken } = req.body;

  // Step 1: Verify robot ownership
  const robot = await prisma.robot.findUnique({ where: { id: robotId } });
  if (!robot || robot.userId !== userId) {
    res.status(403).json({ error: 'Access denied', code: 'ROBOT_NOT_OWNED' });
    return;
  }

  // Step 2: Retrieve from cache
  const pending = pendingUploadCache.retrieve(confirmationToken);
  if (!pending) {
    res.status(410).json({
      error: 'Preview has expired. Please upload the image again.',
      code: 'PREVIEW_EXPIRED',
    });
    return;
  }

  // Step 3: Verify pending entry matches this user and robot
  if (pending.userId !== userId || pending.robotId !== robotId) {
    res.status(403).json({ error: 'Access denied', code: 'ROBOT_NOT_OWNED' });
    return;
  }

  // Step 4: Store to disk
  const imageUrl = await fileStorageService.storeImage(userId, pending.processedBuffer);

  // Step 5: Delete old custom image if exists
  if (robot.imageUrl && robot.imageUrl.startsWith('/uploads/')) {
    await fileStorageService.deleteImage(robot.imageUrl);
  }

  // Step 6: Update robot record
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { imageUrl },
  });

  // Step 7: Audit log success
  await eventLogger.logEvent(0, 'image_upload_success' as never, {
    robotId,
    imageUrl,
    fileSize: pending.originalFileSize,
    originalDimensions: pending.originalDimensions,
  }, { userId });

  // Step 8: Remove from cache
  pendingUploadCache.delete(confirmationToken);

  res.status(200).json({ success: true, robot: updatedRobot });
}
