import express, { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/common/eventLogger';
import { trackSpending } from '../services/economy/spendingTracker';
import logger from '../config/logger';
import { RobotError, RobotErrorCode } from '../errors/robotErrors';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { positiveIntParam, robotImagePath } from '../utils/securityValidation';
import { getIdempotencyKey, idempotencyHeadersSchema } from '../utils/idempotency';
import { findCompletedEconomicRequest } from '../services/financial/economicRequestReplayService';
import { verifyRobotOwnership } from '../middleware/ownership';
import { securityMonitor } from '../services/security/securityMonitor';
import { handleMulterError } from '../middleware/handleMulterError';

// Service imports
import { sanitizeRobotForPublic, SENSITIVE_ROBOT_FIELDS } from '../services/robot/robotSanitizer';
import {
  findUserRobots,
  findRobotById,
  getPerformanceContext,
  invalidateUserRobotsCache,
} from '../services/robot/robotQueryService';
import { getRobotProfile } from '../services/robot/robot-profile-service';
import {
  requireRobotRef,
  updateRobotAppearance,
  getRobotPlacementStanding,
  getEventLogCycleNumber,
  getStableNameForLog,
} from '../services/robot/robotLookupService';
import { executeUpgradeTransaction } from '../services/robot/robotUpgradeService';
import {
  equipMainWeapon,
  equipOffhandWeapon,
  unequipMainWeapon,
  unequipOffhandWeapon,
  changeLoadoutType,
} from '../services/robot/robotWeaponService';
import { repairAllRobots } from '../services/robot/robotRepairService';
import {
  ROBOT_CREATION_COST,
  validateRobotName,
  checkRosterCapacity,
  createRobotTransaction,
} from '../services/robot/robotCreationService';
import {
  contentModerationService,
  uploadRateLimiter,
  handleImagePreview,
  handleImageConfirm,
} from '../services/moderation';
import { assertSelectable } from '../services/moderation/imageLibraryService';
import { achievementService } from '../services/achievement';
import { getEntityHistory } from '../services/league/leagueHistoryService';
import { computeSchedulingEligibility } from '../services/robot/robotSchedulingEligibilityService';
import { updateStance, updateYieldThreshold } from '../services/robot/robotSettingsService';
import type { UnlockedAchievement } from '../shared/types';

// Re-export for backward compatibility (stables.ts imports from here)
export { sanitizeRobotForPublic, SENSITIVE_ROBOT_FIELDS };

const router = express.Router();

// --- Zod schemas for robot routes ---

const robotIdParamsSchema = z.object({
  id: positiveIntParam,
});

/**
 * Robot-specific name wording, matching `validateRobotName` in
 * `services/robot/robotCreationService.ts` so the sentence is the same whichever layer
 * rejects. The shared `safeName` primitive stays generic because team names and weapon
 * custom names use it too.
 */
const robotNameSchema = z
  .string({ message: 'Robot name is required' })
  .min(1, 'Robot name must be between 1 and 50 characters')
  .max(50, 'Robot name must be between 1 and 50 characters')
  .regex(
    /^[a-zA-Z0-9 _\-'.!]+$/,
    'Robot name can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, periods, and exclamation marks',
  );

const createRobotBodySchema = z.object({
  name: robotNameSchema,
});

const equipWeaponBodySchema = z.object({
  weaponInventoryId: z.coerce.number().int().positive(),
});

const loadoutTypeBodySchema = z.object({
  loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']),
});

// The messages are user-facing: `validateRequest` builds the response's `error`
// string from the failing issues, and these schemas run in front of the handlers'
// own checks below, so the wording here is what reaches the player. It matches the
// handlers' wording deliberately — a request rejected at either layer reads the same.
const stanceBodySchema = z.object({
  stance: z
    .string({ message: 'Stance is required and must be a string' })
    .min(1, 'Stance is required and must be a string')
    // A length bound, described as one. It previously carried the "must be one of"
    // message, which is misleading: this check only enforces length, and the one-of
    // check happens in the handler. A 25-character stance would have been told it was
    // not one of three values when the real problem was its length.
    //
    // Deliberately NOT a `z.enum` of the three stances: the handler lowercases before
    // comparing, so 'OFFENSIVE' is accepted today and an enum here would start
    // rejecting it. The one-of check stays where the normalisation is.
    .max(20, 'Stance must be 20 characters or less'),
});

const yieldThresholdBodySchema = z.object({
  yieldThreshold: z.coerce
    .number({ message: 'Yield threshold is required and must be a number' })
    .min(0, 'Yield threshold must be between 0 and 50')
    .max(50, 'Yield threshold must be between 0 and 50'),
});

const appearanceBodySchema = z.object({
  imageUrl: robotImagePath,
});

const upgradesBodySchema = z.object({
  upgrades: z.record(z.string(), z.object({
    currentLevel: z.number().int().nonnegative(),
    plannedLevel: z.number().int().positive(),
  })),
});

// --- Multer config for image uploads (memory storage, 2 MB limit) ---
// MIME filtering removed — magic-byte validation in fileValidationService is authoritative
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// --- Zod schemas for image upload routes ---
const imageParamsSchema = z.object({ id: positiveIntParam });
const imageQuerySchema = z.object({ acknowledgeRobotLikeness: z.enum(['true']).optional() });
const confirmBodySchema = z.object({ confirmationToken: z.string().uuid() });

// The client checks this before presenting the custom-upload flow. It is
// authenticated because only signed-in players can upload an image, and only
// exposes a player-safe state rather than model or infrastructure errors.
router.get(
  '/image-moderation-status',
  authenticateToken,
  validateRequest({}),
  (_req: AuthRequest, res: Response) => {
    res.json(contentModerationService.getAvailability());
  },
);

// Get all robots for the authenticated user
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robots = await findUserRobots(userId);
  res.json(robots);
});

// Create a new robot
router.post('/', authenticateToken, ...validated({ body: createRobotBodySchema, headers: idempotencyHeadersSchema }, async (req: AuthRequest, res: Response, { body }) => {
  const userId = req.user!.userId;
  const { name } = body;
  const requestKey = getIdempotencyKey(req.headers);
  const requestFacts = { name: String(name).trim() };
  const replay = await findCompletedEconomicRequest<{ robot: unknown; currency: number; message: string }>(userId, 'robot_creation', requestKey, requestFacts);
  if (replay) {
    res.status(201).json({ ...replay.response, achievementUnlocks: [], replayed: true });
    return;
  }

  const trimmedName = await validateRobotName(name);
  const user = await checkRosterCapacity(userId);
  const result = await createRobotTransaction(userId, trimmedName, requestKey);
  if (result.replayed) {
    res.status(201).json({ robot: result.robot, currency: result.user.currency, message: 'Robot created successfully', achievementUnlocks: [], replayed: true });
    return;
  }
  const createdRobot = result.robot as { id: number };

  // Log robot creation event
  try {
    const currentCycle = await getEventLogCycleNumber();

    await eventLogger.logRobotPurchase(
      currentCycle, userId, createdRobot.id, name,
      ROBOT_CREATION_COST, user.currency, result.user.currency
    );

    const stableName = await getStableNameForLog(userId);
    const stableInfo = stableName ? ` (${stableName})` : '';

    logger.info(`[Robot] | User ${userId}${stableInfo} | Created: "${name}" | Cost: ₡${ROBOT_CREATION_COST.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

    await trackSpending(userId, 'robots', ROBOT_CREATION_COST);
    securityMonitor.trackRobotCreation(userId, { sourceIp: req.ip || undefined, endpoint: req.originalUrl });
  } catch (logError) {
    logger.error('Failed to log robot creation event:', logError);
  }

  res.status(201).json({
    robot: result.robot,
    currency: result.user.currency,
    message: 'Robot created successfully',
    achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, createdRobot.id, {
          type: 'robot_created',
          data: { robotId: createdRobot.id, robotName: trimmedName },
        });
      } catch { return []; }
    })(),
  });

  // Invalidate robot list cache after creation
  invalidateUserRobotsCache(userId);
}));

// Get a specific robot by ID
router.get('/:id', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const userId = req.user!.userId;
  const robotId = params.id;

  const robot = await findRobotById(robotId);

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  res.json(robot.userId === userId ? robot : sanitizeRobotForPublic(robot));
}));

// Public robot profile (#504): per-mode standings with rank, form, achievements, accolades.
router.get('/:id/profile', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const profile = await getRobotProfile(params.id);
  if (!profile) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }
  res.json(profile);
}));

// Equip main weapon
router.put('/:id/equip-main-weapon', authenticateToken, ...validated({ params: robotIdParamsSchema, body: equipWeaponBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const userId = req.user!.userId;
  const robotId = params.id;
  const finalRobot = await equipMainWeapon(userId, robotId, body.weaponInventoryId);

  let achievementUnlocks: UnlockedAchievement[] = [];
  try {
    achievementUnlocks = await achievementService.checkAndAward(userId, robotId, {
      type: 'weapon_equipped',
      data: { robotId, slot: 'main' },
    });
  } catch { /* achievement failures don't block */ }

  res.json({ robot: finalRobot, message: 'Main weapon equipped successfully', achievementUnlocks });
  invalidateUserRobotsCache(userId);
}));

// Equip offhand weapon
router.put('/:id/equip-offhand-weapon', authenticateToken, ...validated({ params: robotIdParamsSchema, body: equipWeaponBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const userId = req.user!.userId;
  const robotId = params.id;
  const finalRobot = await equipOffhandWeapon(userId, robotId, body.weaponInventoryId);

  let achievementUnlocks: UnlockedAchievement[] = [];
  try {
    achievementUnlocks = await achievementService.checkAndAward(userId, robotId, {
      type: 'weapon_equipped',
      data: { robotId, slot: 'offhand' },
    });
  } catch { /* achievement failures don't block */ }

  res.json({ robot: finalRobot, message: 'Offhand weapon equipped successfully', achievementUnlocks });
  invalidateUserRobotsCache(userId);
}));

// Unequip main weapon
router.delete('/:id/unequip-main-weapon', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const userId = req.user!.userId;
  const robotId = params.id;

  const finalRobot = await unequipMainWeapon(userId, robotId);
  res.json({ robot: finalRobot, message: 'Main weapon unequipped successfully' });
  invalidateUserRobotsCache(userId);
}));

// Unequip offhand weapon
router.delete('/:id/unequip-offhand-weapon', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const userId = req.user!.userId;
  const robotId = params.id;

  const finalRobot = await unequipOffhandWeapon(userId, robotId);
  res.json({ robot: finalRobot, message: 'Offhand weapon unequipped successfully' });
  invalidateUserRobotsCache(userId);
}));

// Change loadout type
router.put('/:id/loadout-type', authenticateToken, ...validated({ params: robotIdParamsSchema, body: loadoutTypeBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const userId = req.user!.userId;
  const robotId = params.id;
  const { loadoutType } = body;

  const validLoadouts = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
  if (!loadoutType || !validLoadouts.includes(loadoutType)) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
      'Invalid loadout type. Must be one of: single, weapon_shield, two_handed, dual_wield',
      400
    );
  }

  const finalRobot = await changeLoadoutType(userId, robotId, loadoutType);
  res.json({ robot: finalRobot, message: `Loadout type changed to ${loadoutType}` });
  invalidateUserRobotsCache(userId);
}));

// Update robot stance
router.patch('/:id/stance', authenticateToken, ...validated({ params: robotIdParamsSchema, body: stanceBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const robotId = params.id;
  const { stance } = body;

  // Spec #55 task 2.5: normalisation, ownership and the update live in robotSettingsService.
  const { robot: stanceRobot, stance: normalizedStance } = await updateStance(req.user!.userId, robotId, stance);

  let achievementUnlocks: UnlockedAchievement[] = [];
  try {
    achievementUnlocks = await achievementService.checkAndAward(req.user!.userId, robotId, {
      type: 'stance_changed',
      data: { robotId, stance: normalizedStance },
    });
  } catch { /* achievement failures don't block */ }

  res.json({ ...stanceRobot, message: `Stance updated to ${normalizedStance}`, achievementUnlocks });
}));

// Update robot yield threshold
router.patch('/:id/yield-threshold', authenticateToken, ...validated({ params: robotIdParamsSchema, body: yieldThresholdBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const robotId = params.id;
  const { yieldThreshold } = body;

  // Spec #55 task 2.5: range checks, ownership and the update live in robotSettingsService.
  const { robot: thresholdRobot, yieldThreshold: threshold } = await updateYieldThreshold(req.user!.userId, robotId, yieldThreshold);

  res.json({ ...thresholdRobot, message: `Yield threshold updated to ${threshold}%` });
}));

// Repair all robots
router.post('/repair-all', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const result = await repairAllRobots(userId);

  // Spec #48 Requirement 18: the Repair Bay discount is applied EXACTLY ONCE,
  // by the Shared_Repair_Module when it produced `calculatedRepairCost`. This loop
  // previously re-applied `result.discount` to that already-discounted quote, which
  // understated every manual repair row in the audit log — the source every repair
  // total is read from. `result.discount` is still recorded as `discountPercent`
  // because it is a record of what applied, not an input to either money figure.
  // Required financial and robot_repair records are written by
  // `repairAllRobots` inside the same transaction as the balance and robot
  // state. The route keeps only the established response contract.

  res.json({
    success: true,
    repairedCount: result.repairedCount,
    totalBaseCost: result.totalBaseCost,
    discount: result.discount,
    manualRepairDiscount: result.manualRepairDiscount,
    preDiscountCost: result.preDiscountCost,
    finalCost: result.finalCost,
    newCurrency: result.newCurrency,
    message: `Successfully repaired ${result.repairedCount} robot(s) for ₡${result.finalCost.toLocaleString()}`,
  });

  invalidateUserRobotsCache(userId);
});

// Get robot performance by context (leagues, tournaments, tag teams)
router.get('/:id/performance-context', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const robotId = params.id;

  await requireRobotRef(robotId);
  const result = await getPerformanceContext(robotId);
  res.json(result);
}));

// Update robot appearance (imageUrl)
router.put('/:id/appearance', authenticateToken, ...validated({ params: robotIdParamsSchema, body: appearanceBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const userId = req.user!.userId;
  const robotId = params.id;
  // `robotImagePath` (appearanceBodySchema) already allowed only preset and
  // upload .webp paths.
  const { imageUrl } = body;

  await verifyRobotOwnership(prisma, robotId, userId);

  // An uploaded image must come from the caller's own Image_Library and still
  // exist (generic 403 otherwise). Until Nov 2026 this check existed but was
  // never called, so another stable's upload path was accepted.
  if (imageUrl.startsWith('/uploads/')) {
    await assertSelectable(userId, imageUrl);
  }

  // Spec #45 R30: the previous upload is deliberately NOT deleted when a robot
  // switches to a preset. Uploaded images belong to the player's Image_Library,
  // survive the season reset, and may be referenced by archived seasons — so
  // swapping a robot's appearance must not destroy the artwork. Players delete
  // images explicitly through the Image_Library, which reports what it affects.

  const appearanceRobot = await updateRobotAppearance(robotId, imageUrl);
  logger.info('Robot appearance updated', { userId, robotId });

  // E32 "Ready for My Close-Up" counts any of the player's own images, so a
  // returning player who reuses last season's upload from the Image_Library
  // earns it too (issue #601). Presets don't count.
  let achievementUnlocks: UnlockedAchievement[] = [];
  if (imageUrl.startsWith('/uploads/')) {
    try {
      achievementUnlocks = await achievementService.checkAndAward(userId, robotId, {
        type: 'robot_image_uploaded',
        data: { robotId },
      });
    } catch { /* achievement failures don't block */ }
  }

  res.json({ success: true, robot: appearanceRobot, message: 'Robot image updated successfully', achievementUnlocks });
}));

// Get scheduling eligibility report for a robot
router.get('/:id/scheduling-eligibility', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const robotId = params.id;
  await verifyRobotOwnership(prisma, robotId, req.user!.userId);
  const report = await computeSchedulingEligibility(robotId);
  res.json(report);
}));

// Bulk upgrade robot attributes (atomic transaction)
router.post('/:id/upgrades', authenticateToken, ...validated({ params: robotIdParamsSchema, body: upgradesBodySchema, headers: idempotencyHeadersSchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const userId = req.user!.userId;
  const robotId = params.id;
  const { upgrades } = body;
  const requestKey = getIdempotencyKey(req.headers);
  const replay = await findCompletedEconomicRequest<{ robot: unknown; currency: number; totalCost: number; upgradeOperations: unknown[] }>(userId, 'attribute_upgrade', requestKey, { robotId, upgrades });
  if (replay) {
    const count = replay.response.upgradeOperations.length;
    res.json({ success: true, robot: replay.response.robot, currency: replay.response.currency, totalCost: replay.response.totalCost, upgradesApplied: count, message: `Successfully upgraded ${count} attribute${count > 1 ? 's' : ''}`, achievementUnlocks: [], replayed: true });
    return;
  }

  if (!upgrades || typeof upgrades !== 'object' || Object.keys(upgrades).length === 0) {
    logger.info('Invalid upgrades object:', upgrades);
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Upgrades object is required', 400);
  }

  const result = await executeUpgradeTransaction(userId, robotId, upgrades, requestKey);
  if (result.replayed) {
    const count = result.upgradeOperations.length;
    res.json({ success: true, robot: result.robot, currency: result.user.currency, totalCost: result.totalCost, upgradesApplied: count, message: `Successfully upgraded ${count} attribute${count > 1 ? 's' : ''}`, achievementUnlocks: [], replayed: true });
    return;
  }

  // Log attribute upgrade events
  try {
    const currentCycle = await getEventLogCycleNumber();

    logger.info(`[AttributeUpgrade] User ${userId} | Robot ${robotId} | Attributes: ${result.upgradeOperations.length} | Total Cost: ₡${result.totalCost.toLocaleString()} | Balance: ₡${result.user.currency.toLocaleString()}`);

    await trackSpending(userId, 'attributes', result.totalCost);

    for (const op of result.upgradeOperations) {
      await eventLogger.logAttributeUpgrade(currentCycle, robotId, op.attribute, op.fromLevel, op.toLevel, op.cost, userId);
      logger.info(`[AttributeUpgrade]   ${op.attribute} | ${op.fromLevel}→${op.toLevel} | ₡${op.cost.toLocaleString()}`);
    }
  } catch (logError) {
    logger.error('[AttributeUpgrade] ERROR logging upgrades:', logError);
  }

  res.json({
    success: true,
    robot: result.robot,
    currency: result.user.currency,
    totalCost: result.totalCost,
    upgradesApplied: result.upgradeOperations.length,
    message: `Successfully upgraded ${result.upgradeOperations.length} attribute${result.upgradeOperations.length > 1 ? 's' : ''}`,
    achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, robotId, {
          type: 'attribute_upgraded',
          data: { robotId, upgrades: result.upgradeOperations },
        });
      } catch { return []; }
    })(),
  });
}));

// Upload image preview (Step 1: validate, moderate, process, return base64 preview)
router.post(
  '/:id/image',
  authenticateToken,
  uploadRateLimiter,
  multerUpload.single('image'),
  handleMulterError,
  validateRequest({ params: imageParamsSchema, query: imageQuerySchema }),
  handleImagePreview as never,
);

// Confirm image upload (Step 2: store to disk, update robot)
router.put(
  '/:id/image/confirm',
  authenticateToken,
  validateRequest({ params: imageParamsSchema, body: confirmBodySchema }),
  handleImageConfirm as never,
);

// Get league history for a robot
router.get('/:id/league-history', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const robotId = params.id;

  await requireRobotRef(robotId);
  const data = await getEntityHistory('robot', robotId);
  res.json({ data });
}));

// Get KotH standing for a robot (current tier, LP, stats)
router.get('/:id/koth-standing', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (_req: AuthRequest, res: Response, { params }) => {
  res.json({ standing: await getRobotPlacementStanding(params.id, 'koth') });
}));

// Get Grand Melee standing for a robot (current tier, LP, stats)
router.get('/:id/grand-melee-standing', authenticateToken, ...validated({ params: robotIdParamsSchema }, async (_req: AuthRequest, res: Response, { params }) => {
  res.json({ standing: await getRobotPlacementStanding(params.id, 'grand_melee') });
}));

export default router;
