import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/common/eventLogger';
import { trackSpending } from '../services/economy/spendingTracker';
import logger from '../config/logger';
import { RobotError, RobotErrorCode } from '../errors/robotErrors';
import { validateRequest } from '../middleware/schemaValidator';
import { safeName, positiveIntParam } from '../utils/securityValidation';
import { verifyRobotOwnership } from '../middleware/ownership';
import { securityMonitor } from '../services/security/securityMonitor';

// Service imports
import { sanitizeRobotForPublic, SENSITIVE_ROBOT_FIELDS } from '../services/robot/robotSanitizer';
import {
  findAllRobots,
  findUserRobots,
  findRobotById,
  getMatchHistory,
  getUpcomingScheduledMatches,
  getUpcomingMatches,
  getPerformanceContext,
} from '../services/robot/robotQueryService';
import { getRobotRankings } from '../services/robot/robotRankingService';
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

// Re-export for backward compatibility (stables.ts imports from here)
export { sanitizeRobotForPublic, SENSITIVE_ROBOT_FIELDS };

const router = express.Router();

// --- Zod schemas for robot routes ---

const robotIdParamsSchema = z.object({
  id: positiveIntParam,
});

const createRobotBodySchema = z.object({
  name: safeName,
});

const equipWeaponBodySchema = z.object({
  weaponInventoryId: z.coerce.number().int().positive(),
});

const loadoutTypeBodySchema = z.object({
  loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']),
});

const stanceBodySchema = z.object({
  stance: z.string().min(1).max(20),
});

const yieldThresholdBodySchema = z.object({
  yieldThreshold: z.coerce.number().min(0).max(50),
});

const appearanceBodySchema = z.object({
  imageUrl: z.string().min(1).max(200),
});

const upgradesBodySchema = z.object({
  upgrades: z.record(z.string(), z.object({
    currentLevel: z.number().int().nonnegative(),
    plannedLevel: z.number().int().positive(),
  })),
});


// Get all robots from all users
router.get('/all/robots', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robots = await findAllRobots();

  const sanitizedRobots = robots.map(robot =>
    robot.userId === userId ? robot : sanitizeRobotForPublic(robot)
  );

  res.json(sanitizedRobots);
});

// Get all robots for the authenticated user
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robots = await findUserRobots(userId);
  res.json(robots);
});

// Create a new robot
router.post('/', authenticateToken, validateRequest({ body: createRobotBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { name } = req.body;

  const trimmedName = await validateRobotName(name);
  const user = await checkRosterCapacity(userId);
  const result = await createRobotTransaction(userId, trimmedName);

  // Log robot creation event
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    await eventLogger.logRobotPurchase(
      currentCycle, userId, result.robot.id, name,
      ROBOT_CREATION_COST, user.currency, result.user.currency
    );

    const userForLog = await prisma.user.findUnique({
      where: { id: userId },
      select: { stableName: true },
    });
    const stableInfo = userForLog?.stableName ? ` (${userForLog.stableName})` : '';

    logger.info(`[Robot] | User ${userId}${stableInfo} | Created: "${name}" | Cost: ₡${ROBOT_CREATION_COST.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

    await trackSpending(userId, 'robots', ROBOT_CREATION_COST);
    securityMonitor.trackRobotCreation(userId, { sourceIp: req.ip || undefined, endpoint: req.originalUrl });
    securityMonitor.trackSpending(userId, ROBOT_CREATION_COST, { sourceIp: req.ip || undefined, endpoint: req.originalUrl });
  } catch (logError) {
    logger.error('Failed to log robot creation event:', logError);
  }

  res.status(201).json({
    robot: result.robot,
    currency: result.user.currency,
    message: 'Robot created successfully',
  });
});

// Get a specific robot by ID
router.get('/:id', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await findRobotById(robotId);

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  res.json(robot.userId === userId ? robot : sanitizeRobotForPublic(robot));
});

// Equip main weapon
router.put('/:id/equip-main-weapon', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: equipWeaponBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { weaponInventoryId } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  if (!weaponInventoryId || isNaN(parseInt(weaponInventoryId))) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Valid weapon inventory ID is required', 400);
  }

  const finalRobot = await equipMainWeapon(userId, robotId, parseInt(weaponInventoryId));
  res.json({ robot: finalRobot, message: 'Main weapon equipped successfully' });
});

// Equip offhand weapon
router.put('/:id/equip-offhand-weapon', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: equipWeaponBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { weaponInventoryId } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  if (!weaponInventoryId || isNaN(parseInt(weaponInventoryId))) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Valid weapon inventory ID is required', 400);
  }

  const finalRobot = await equipOffhandWeapon(userId, robotId, parseInt(weaponInventoryId));
  res.json({ robot: finalRobot, message: 'Offhand weapon equipped successfully' });
});

// Unequip main weapon
router.delete('/:id/unequip-main-weapon', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const finalRobot = await unequipMainWeapon(userId, robotId);
  res.json({ robot: finalRobot, message: 'Main weapon unequipped successfully' });
});

// Unequip offhand weapon
router.delete('/:id/unequip-offhand-weapon', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const finalRobot = await unequipOffhandWeapon(userId, robotId);
  res.json({ robot: finalRobot, message: 'Offhand weapon unequipped successfully' });
});

// Change loadout type
router.put('/:id/loadout-type', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: loadoutTypeBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { loadoutType } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

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
});

// Update robot stance
router.patch('/:id/stance', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: stanceBodySchema }), async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const { stance } = req.body;

  if (!stance || typeof stance !== 'string') {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Stance is required and must be a string', 400);
  }

  const normalizedStance = stance.toLowerCase();
  if (!['offensive', 'defensive', 'balanced'].includes(normalizedStance)) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
      'Invalid stance. Must be one of: offensive, defensive, balanced',
      400
    );
  }

  await verifyRobotOwnership(prisma, robotId, req.user!.userId);

  const stanceRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { stance: normalizedStance },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({ ...stanceRobot, message: `Stance updated to ${normalizedStance}` });
});

// Update robot yield threshold
router.patch('/:id/yield-threshold', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: yieldThresholdBodySchema }), async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const { yieldThreshold } = req.body;

  if (yieldThreshold === undefined || yieldThreshold === null) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Yield threshold is required', 400);
  }

  const threshold = Number(yieldThreshold);
  if (isNaN(threshold)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Yield threshold must be a number', 400);
  }

  if (threshold < 0 || threshold > 50) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Yield threshold must be between 0 and 50', 400);
  }

  await verifyRobotOwnership(prisma, robotId, req.user!.userId);

  const thresholdRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { yieldThreshold: threshold },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({ ...thresholdRobot, message: `Yield threshold updated to ${threshold}%` });
});

// Get paginated match history
router.get('/:id/matches', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true, userId: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  const result = await getMatchHistory(robotId, robot.name, page, perPage);
  res.json(result);
});

// Get upcoming scheduled matches (simple)
router.get('/:id/upcoming', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true, userId: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  const result = await getUpcomingScheduledMatches(robotId, robot.name);
  res.json(result);
});

// Repair all robots
router.post('/repair-all', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const result = await repairAllRobots(userId);

  // Log repair events
  try {
    for (const robot of result.robotsNeedingRepair) {
      const perRobotCostAfterRepairBay = Math.floor(robot.calculatedRepairCost * (1 - result.discount / 100));
      const perRobotFinalCost = Math.floor(perRobotCostAfterRepairBay * 0.5);
      const damageRepaired = robot.maxHP - robot.currentHP;

      await eventLogger.logRobotRepair(
        userId, robot.id, perRobotFinalCost, damageRepaired,
        result.discount, undefined, 'manual', 50, perRobotCostAfterRepairBay
      );
    }
  } catch (logError) {
    logger.error('Failed to log manual repair events:', logError);
  }

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
});

// Get robot rankings
router.get('/:id/rankings', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await prisma.robot.findUnique({ where: { id: robotId } });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  const rankings = await getRobotRankings(robotId);

  if (Object.keys(rankings).length === 0) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot scores not found', 404);
  }

  res.json(rankings);
});

// Get robot performance by context (leagues, tournaments, tag teams)
router.get('/:id/performance-context', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  const result = await getPerformanceContext(robotId);
  res.json(result);
});

// Update robot appearance (imageUrl)
router.put('/:id/appearance', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: appearanceBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { imageUrl } = req.body;

  logger.info('Appearance update request:', { userId, robotId, imageUrl });

  if (!imageUrl || typeof imageUrl !== 'string') {
    logger.info('Invalid imageUrl:', imageUrl);
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid imageUrl', 400);
  }

  const safeImagePattern = /^\/(?:src\/)?assets\/robots?[\w/-]*\.webp$/;
  if (!safeImagePattern.test(imageUrl)) {
    logger.info('Invalid image path:', imageUrl);
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid image path. Must be a .webp file in the robots assets directory.', 400);
  }

  await verifyRobotOwnership(prisma, robotId, userId);

  logger.info('Updating robot with imageUrl...');
  
  const appearanceRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { imageUrl },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  logger.info('Robot updated successfully');

  res.json({ success: true, robot: appearanceRobot, message: 'Robot image updated successfully' });
});

// Get upcoming matches for a robot (with battle readiness)
router.get('/:id/upcoming-matches', authenticateToken, validateRequest({ params: robotIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    include: { mainWeapon: true, offhandWeapon: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  const result = await getUpcomingMatches(robotId, robot);
  res.json(result);
});

// Bulk upgrade robot attributes (atomic transaction)
router.post('/:id/upgrades', authenticateToken, validateRequest({ params: robotIdParamsSchema, body: upgradesBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { upgrades } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  if (!upgrades || typeof upgrades !== 'object' || Object.keys(upgrades).length === 0) {
    logger.info('Invalid upgrades object:', upgrades);
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Upgrades object is required', 400);
  }

  const result = await executeUpgradeTransaction(userId, robotId, upgrades);

  // Log attribute upgrade events
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    logger.info(`[AttributeUpgrade] User ${userId} | Robot ${robotId} | Attributes: ${result.upgradeOperations.length} | Total Cost: ₡${result.totalCost.toLocaleString()} | Balance: ₡${result.user.currency.toLocaleString()}`);

    await trackSpending(userId, 'attributes', result.totalCost);
    securityMonitor.trackSpending(userId, result.totalCost, { sourceIp: req.ip || undefined, endpoint: req.originalUrl });

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
  });
});

export default router;
