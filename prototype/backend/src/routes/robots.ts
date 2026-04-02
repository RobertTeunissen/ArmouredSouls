import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { canEquipToSlot, validateOffhandEquipment, isSlotAvailable, validateNoDuplicateEquip } from '../utils/weaponValidation';
import { calculateMaxHP, calculateMaxShield } from '../utils/robotCalculations';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/common/eventLogger';
import { trackSpending } from '../services/economy/spendingTracker';
import { getConfig } from '../config/env';
import { getNextCronOccurrence } from '../utils/scheduleUtils';
import logger from '../config/logger';
import { assignLeagueInstance } from '../services/league/leagueInstanceService';
import { RobotError, RobotErrorCode } from '../errors/robotErrors';

const router = express.Router();

const ROBOT_CREATION_COST = 500000;
const _MAX_ATTRIBUTE_LEVEL = 50;

// Get cap for academy level (from STABLE_SYSTEM.md)
const getCapForLevel = (level: number): number => {
  const capMap: { [key: number]: number } = {
    0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
    5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
  };
  return capMap[level] || 10;
};

// Map attribute to its group and corresponding training academy
const attributeToAcademy: { [key: string]: string } = {
  // Combat Systems
  'combatPower': 'combat_training_academy',
  'targetingSystems': 'combat_training_academy',
  'criticalSystems': 'combat_training_academy',
  'penetration': 'combat_training_academy',
  'weaponControl': 'combat_training_academy',
  'attackSpeed': 'combat_training_academy',
  // Defensive Systems
  'armorPlating': 'defense_training_academy',
  'shieldCapacity': 'defense_training_academy',
  'evasionThrusters': 'defense_training_academy',
  'damageDampeners': 'defense_training_academy',
  'counterProtocols': 'defense_training_academy',
  // Chassis & Mobility
  'hullIntegrity': 'mobility_training_academy',
  'servoMotors': 'mobility_training_academy',
  'gyroStabilizers': 'mobility_training_academy',
  'hydraulicSystems': 'mobility_training_academy',
  'powerCore': 'mobility_training_academy',
  // AI Processing + Team Coordination
  'combatAlgorithms': 'ai_training_academy',
  'threatAnalysis': 'ai_training_academy',
  'adaptiveAI': 'ai_training_academy',
  'logicCores': 'ai_training_academy',
  'syncProtocols': 'ai_training_academy',
  'supportSystems': 'ai_training_academy',
  'formationTactics': 'ai_training_academy',
};

// Fields to strip from robot data when viewed by non-owners
// These are competitively sensitive: exact attribute levels, battle config, and current combat state
const SENSITIVE_ROBOT_FIELDS = [
  // 23 core attributes
  'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
  'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
  'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
  'syncProtocols', 'supportSystems', 'formationTactics',
  // Battle configuration
  'yieldThreshold', 'stance', 'loadoutType',
  // Current combat state
  'currentHP', 'currentShield', 'damageTaken',
  // Equipment details
  'mainWeaponId', 'offhandWeaponId', 'mainWeapon', 'offhandWeapon',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeRobotForPublic(robot: any): any {
  if (!robot) return robot;
  const sanitized = { ...robot };
  for (const field of SENSITIVE_ROBOT_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

// Get all robots from all users
router.get('/all/robots', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const robots = await prisma.robot.findMany({
    include: {
      user: {
        select: {
          username: true,
        },
      },
      mainWeapon: {
        include: {
          weapon: true,
        },
      },
      offhandWeapon: {
        include: {
          weapon: true,
        },
      },
    },
    orderBy: { elo: 'desc' },
  });

  // Strip sensitive fields from robots the user doesn't own
  const sanitizedRobots = robots.map(robot =>
    robot.userId === userId ? robot : sanitizeRobotForPublic(robot)
  );

  res.json(sanitizedRobots);
});

// Get all robots for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const robots = await prisma.robot.findMany({
    where: { userId },
    include: {
      mainWeapon: {
        include: {
          weapon: true,
        },
      },
      offhandWeapon: {
        include: {
          weapon: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(robots);
});

// Create a new robot
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { name } = req.body;

  // Validate robot name
  if (!name || typeof name !== 'string') {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Robot name is required', 400);
  }

  if (name.length < 1 || name.length > 50) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Robot name must be between 1 and 50 characters', 400);
  }

  // Check if a robot with this name already exists (globally unique)
  const existingRobot = await prisma.robot.findFirst({
    where: { name },
  });

  if (existingRobot) {
    throw new RobotError(RobotErrorCode.ROBOT_NAME_TAKEN, 'A robot with this name already exists. Please choose a different name.', 400);
  }

  // Get user's current currency
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      facilities: {
        where: { facilityType: 'roster_expansion' },
      },
    },
  });

  if (!user) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);
  }

  // Check if user has enough currency
  if (user.currency < ROBOT_CREATION_COST) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Insufficient credits', 400);
  }

  // Check Roster Expansion limit
  // Level 0 = 1 robot, Level 1 = 2 robots, ..., Level 9 = 10 robots
  const rosterLevel = user.facilities[0]?.level || 0;
  const maxRobots = rosterLevel + 1;
  
  const currentRobotCount = await prisma.robot.count({
    where: { userId },
  });

  if (currentRobotCount >= maxRobots) {
    throw new RobotError(
      RobotErrorCode.MAX_ROBOTS_REACHED, 
      `Robot limit reached. Upgrade Roster Expansion facility to create more robots. Current limit: ${maxRobots}`,
      400
    );
  }

  // Create robot in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Re-read user inside transaction to prevent race conditions (stale balance exploit)
    const freshUser = await tx.user.findUnique({
      where: { id: userId },
      include: {
        facilities: {
          where: { facilityType: 'roster_expansion' },
        },
      },
    });

    if (!freshUser || freshUser.currency < ROBOT_CREATION_COST) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Insufficient credits', 400);
    }

    // Re-verify roster limit inside transaction
    const freshRobotCount = await tx.robot.count({ where: { userId } });
    const freshRosterLevel = freshUser.facilities[0]?.level || 0;
    const freshMaxRobots = freshRosterLevel + 1;
    if (freshRobotCount >= freshMaxRobots) {
      throw new RobotError(
        RobotErrorCode.MAX_ROBOTS_REACHED,
        `Robot limit reached. Upgrade Roster Expansion facility to create more robots. Current limit: ${freshMaxRobots}`,
        400
      );
    }

    // Atomic currency decrement to prevent double-spend
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: ROBOT_CREATION_COST } },
    });

    // Create robot with all attributes at level 1 (defaults in schema)
    // Calculate initial HP and Shield directly from default values
    const hullIntegrity = 1; // Default level (Decimal 1.00 in schema)
    const shieldCapacity = 1; // Default level (Decimal 1.00 in schema)
    
    // Formula: maxHP = 50 + (hullIntegrity × 5), maxShield = shieldCapacity × 2
    // Using direct calculation since all attributes are at default values
    const maxHP = 50 + (hullIntegrity * 5); // = 55 HP
    const maxShield = shieldCapacity * 4; // = 4 Shield
    
    // Assign to least-full bronze instance instead of relying on schema default
    const bronzeLeagueId = await assignLeagueInstance('bronze');

    const robot = await tx.robot.create({
      data: {
        userId,
        name,
        currentHP: maxHP,
        maxHP: maxHP,
        currentShield: maxShield,
        maxShield: maxShield,
        leagueId: bronzeLeagueId,
      },
      include: {
        mainWeapon: {
          include: {
            weapon: true,
          },
        },
        offhandWeapon: {
          include: {
            weapon: true,
          },
        },
      },
    });

    return { user: updatedUser, robot };
  });

  // Log robot creation event
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    // Log robot purchase with new dedicated event type
    await eventLogger.logRobotPurchase(
      currentCycle,
      userId,
      result.robot.id,
      name,
      ROBOT_CREATION_COST,
      user.currency,
      result.user.currency
    );

    // Get user's stable name for logging
    const userForLog = await prisma.user.findUnique({
      where: { id: userId },
      select: { stableName: true },
    });
    const stableInfo = userForLog?.stableName ? ` (${userForLog.stableName})` : '';

    // Console log for cycle logs
    logger.info(`[Robot] | User ${userId}${stableInfo} | Created: "${name}" | Cost: ₡${ROBOT_CREATION_COST.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

    // Track spending for onboarding budget comparison
    await trackSpending(userId, 'robots', ROBOT_CREATION_COST);
  } catch (logError) {
    logger.error('Failed to log robot creation event:', logError);
    // Don't fail the request if logging fails
  }

  res.status(201).json({
    robot: result.robot,
    currency: result.user.currency,
    message: 'Robot created successfully',
  });
});

// Get a specific robot by ID (any logged-in user can view, but sensitive data is owner-only)
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  const robot = await prisma.robot.findUnique({
    where: {
      id: robotId,
    },
    include: {
      mainWeapon: {
        include: {
          weapon: true,
        },
      },
      offhandWeapon: {
        include: {
          weapon: true,
        },
      },
      user: {
        select: {
          username: true,
          stableName: true,
        },
      },
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Strip sensitive fields if the requesting user doesn't own this robot
  res.json(robot.userId === userId ? robot : sanitizeRobotForPublic(robot));
});



// Equip main weapon
router.put('/:id/equip-main-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { weaponInventoryId } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  if (!weaponInventoryId || isNaN(parseInt(weaponInventoryId))) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Valid weapon inventory ID is required', 400);
  }

  const weaponInvIdNum = parseInt(weaponInventoryId);

  // All reads and writes inside a transaction to prevent concurrent equip exploit
  const finalRobot = await prisma.$transaction(async (tx) => {
    // Get robot with current weapons
    const robot = await tx.robot.findFirst({
      where: { id: robotId, userId },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    if (!robot) {
      throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
    }

    // Get weapon to equip
    const weaponInv = await tx.weaponInventory.findFirst({
      where: { id: weaponInvIdNum, userId },
      include: { 
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });

    if (!weaponInv) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Weapon not found in your inventory', 404);
    }

    // Check if weapon is already equipped anywhere
    const allEquipped = weaponInv.robotsMain.concat(weaponInv.robotsOffhand);

    const equippedToOther = allEquipped.find(r => r.id !== robotId);
    if (equippedToOther) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
        `Weapon is already equipped to ${equippedToOther.name}`,
        400
      );
    }

    // Check if weapon is already equipped to this robot in the offhand slot
    const dupCheck = validateNoDuplicateEquip(weaponInvIdNum, 'main', robot);
    if (!dupCheck.valid) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, dupCheck.reason!, 400);
    }

    // Validate weapon can be equipped in main slot
    const validation = canEquipToSlot(weaponInv.weapon, 'main', robot.loadoutType);
    if (!validation.canEquip) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, validation.reason!, 400);
    }

    // Update robot with new weapon and recalculate stats
    const updatedRobot = await tx.robot.update({
      where: { id: robotId },
      data: { mainWeaponId: weaponInvIdNum },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    // Recalculate max HP and Shield
    const maxHP = calculateMaxHP(updatedRobot);
    const maxShield = calculateMaxShield(updatedRobot);

    // Update HP and Shield if they increased (don't decrease current values)
    return tx.robot.update({
      where: { id: robotId },
      data: {
        maxHP,
        maxShield,
        currentHP: Math.min(updatedRobot.currentHP, maxHP),
        currentShield: Math.min(updatedRobot.currentShield, maxShield),
      },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });
  });

  res.json({
    robot: finalRobot,
    message: 'Main weapon equipped successfully',
  });
});

// Equip offhand weapon
router.put('/:id/equip-offhand-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { weaponInventoryId } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  if (!weaponInventoryId || isNaN(parseInt(weaponInventoryId))) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Valid weapon inventory ID is required', 400);
  }

  const weaponInvIdNum = parseInt(weaponInventoryId);

  // All reads and writes inside a transaction to prevent concurrent equip exploit
  const finalRobot = await prisma.$transaction(async (tx) => {
    // Get robot with current weapons
    const robot = await tx.robot.findFirst({
      where: { id: robotId, userId },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    if (!robot) {
      throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
    }

    // Check if offhand slot is available for this loadout
    if (!isSlotAvailable('offhand', robot.loadoutType)) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
        `Offhand slot not available for ${robot.loadoutType} loadout`,
        400
      );
    }

    // Get weapon to equip
    const weaponInv = await tx.weaponInventory.findFirst({
      where: { id: weaponInvIdNum, userId },
      include: { 
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });

    if (!weaponInv) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Weapon not found in your inventory', 404);
    }

    // Check if weapon is already equipped anywhere
    const allEquipped = weaponInv.robotsMain.concat(weaponInv.robotsOffhand);

    const equippedToOther = allEquipped.find(r => r.id !== robotId);
    if (equippedToOther) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
        `Weapon is already equipped to ${equippedToOther.name}`,
        400
      );
    }

    // Check if weapon is already equipped to this robot in the main slot
    const dupCheck = validateNoDuplicateEquip(weaponInvIdNum, 'offhand', robot);
    if (!dupCheck.valid) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, dupCheck.reason!, 400);
    }

    // Validate weapon can be equipped in offhand slot
    const slotValidation = canEquipToSlot(weaponInv.weapon, 'offhand', robot.loadoutType);
    if (!slotValidation.canEquip) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, slotValidation.reason!, 400);
    }

    // Validate offhand equipment requirements
    const offhandValidation = validateOffhandEquipment(
      weaponInv.weapon,
      robot.mainWeaponId !== null,
      robot.loadoutType
    );
    if (!offhandValidation.valid) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, offhandValidation.reason!, 400);
    }

    // Update robot with new weapon and recalculate stats
    const updatedRobot = await tx.robot.update({
      where: { id: robotId },
      data: { offhandWeaponId: weaponInvIdNum },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    // Recalculate max HP and Shield
    const maxHP = calculateMaxHP(updatedRobot);
    const maxShield = calculateMaxShield(updatedRobot);

    // Update HP and Shield
    return tx.robot.update({
      where: { id: robotId },
      data: {
        maxHP,
        maxShield,
        currentHP: Math.min(updatedRobot.currentHP, maxHP),
        currentShield: Math.min(updatedRobot.currentShield, maxShield),
      },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });
  });

  res.json({
    robot: finalRobot,
    message: 'Offhand weapon equipped successfully',
  });
});

// Unequip main weapon
router.delete('/:id/unequip-main-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Get robot
  const robot = await prisma.robot.findFirst({
    where: { id: robotId, userId },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (!robot.mainWeaponId) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No main weapon equipped', 400);
  }

  // Update robot and recalculate stats
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { mainWeaponId: null },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  // Recalculate max HP and Shield
  const maxHP = calculateMaxHP(updatedRobot);
  const maxShield = calculateMaxShield(updatedRobot);

  // Update HP and Shield
  const finalRobot = await prisma.robot.update({
    where: { id: robotId },
    data: {
      maxHP,
      maxShield,
      currentHP: Math.min(updatedRobot.currentHP, maxHP),
      currentShield: Math.min(updatedRobot.currentShield, maxShield),
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({
    robot: finalRobot,
    message: 'Main weapon unequipped successfully',
  });
});

// Unequip offhand weapon
router.delete('/:id/unequip-offhand-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Get robot
  const robot = await prisma.robot.findFirst({
    where: { id: robotId, userId },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (!robot.offhandWeaponId) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No offhand weapon equipped', 400);
  }

  // Update robot and recalculate stats
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { offhandWeaponId: null },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  // Recalculate max HP and Shield
  const maxHP = calculateMaxHP(updatedRobot);
  const maxShield = calculateMaxShield(updatedRobot);

  // Update HP and Shield
  const finalRobot = await prisma.robot.update({
    where: { id: robotId },
    data: {
      maxHP,
      maxShield,
      currentHP: Math.min(updatedRobot.currentHP, maxHP),
      currentShield: Math.min(updatedRobot.currentShield, maxShield),
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({
    robot: finalRobot,
    message: 'Offhand weapon unequipped successfully',
  });
});

// Change loadout type
router.put('/:id/loadout-type', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { loadoutType } = req.body;

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Validate loadout type
  const validLoadouts = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
  if (!loadoutType || !validLoadouts.includes(loadoutType)) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
      'Invalid loadout type. Must be one of: single, weapon_shield, two_handed, dual_wield',
      400
    );
  }

  // Get robot with current weapons
  const robot = await prisma.robot.findFirst({
    where: { id: robotId, userId },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Check if current weapons are compatible with new loadout
  const { canChangeLoadout } = await import('../utils/weaponValidation');
  const validation = canChangeLoadout(
    loadoutType,
    robot.mainWeapon?.weapon || null,
    robot.offhandWeapon?.weapon || null
  );

  if (!validation.canChange) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
      'Cannot change loadout type. Please unequip incompatible weapons before changing loadout type',
      400,
      { conflicts: validation.conflicts }
    );
  }

  // Update loadout type and recalculate stats
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { loadoutType },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  // Recalculate max HP and Shield with new loadout bonuses
  const maxHP = calculateMaxHP(updatedRobot);
  const maxShield = calculateMaxShield(updatedRobot);

  // Update HP and Shield
  const finalRobot = await prisma.robot.update({
    where: { id: robotId },
    data: {
      maxHP,
      maxShield,
      currentHP: Math.min(updatedRobot.currentHP, maxHP),
      currentShield: Math.min(updatedRobot.currentShield, maxShield),
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({
    robot: finalRobot,
    message: `Loadout type changed to ${loadoutType}`,
  });
});

// Update robot stance (offensive, defensive, balanced)
router.patch('/:id/stance', authenticateToken, async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const { stance } = req.body;

  // Validate stance value
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

  // Check if robot exists and belongs to user
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== req.user!.userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_OWNED, 'Not authorized to modify this robot', 403);
  }

  // Update stance
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { stance: normalizedStance },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({
    ...updatedRobot,
    message: `Stance updated to ${normalizedStance}`,
  });
});

// Update robot yield threshold (0-50)
router.patch('/:id/yield-threshold', authenticateToken, async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const { yieldThreshold } = req.body;

  // Validate yield threshold
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

  // Check if robot exists and belongs to user
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== req.user!.userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_OWNED, 'Not authorized to modify this robot', 403);
  }

  // Update yield threshold
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { yieldThreshold: threshold },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  res.json({
    ...updatedRobot,
    message: `Yield threshold updated to ${threshold}%`,
  });
});

/**
 * GET /api/robots/:id/matches
 * Get paginated match history for a specific robot
 */
router.get('/:id/matches', authenticateToken, async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Verify robot exists
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true, userId: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Get total count
  const total = await prisma.battle.count({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
      ],
    },
  });

  // Get battles with pagination
  const battles = await prisma.battle.findMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
      ],
    },
    include: {
      robot1: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      robot2: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      participants: true, // Include BattleParticipant data
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  // Format response
  const formattedBattles = battles.map(battle => {
    const isRobot1 = battle.robot1Id === robotId;
    const _thisRobot = isRobot1 ? battle.robot1 : battle.robot2;
    const opponent = isRobot1 ? battle.robot2 : battle.robot1;
    const won = battle.winnerId === robotId;
    
    // Get participant data
    const thisParticipant = battle.participants.find(p => p.robotId === robotId);
    const opponentId = isRobot1 ? battle.robot2Id : battle.robot1Id;
    const opponentParticipant = battle.participants.find(p => p.robotId === opponentId);

    return {
      battleId: battle.id,
      createdAt: battle.createdAt,
      leagueType: battle.leagueType,
      result: {
        won,
        isDraw: battle.winnerId === null,
        duration: battle.durationSeconds,
      },
      thisRobot: {
        finalHP: thisParticipant?.finalHP || 0,
        damageDealt: thisParticipant?.damageDealt || 0,
        eloBefore: thisParticipant?.eloBefore || 0,
        eloAfter: thisParticipant?.eloAfter || 0,
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        owner: opponent.user.username,
        finalHP: opponentParticipant?.finalHP || 0,
        damageDealt: opponentParticipant?.damageDealt || 0,
      },
    };
  });

  res.json({
    data: formattedBattles,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
    robot: {
      id: robot.id,
      name: robot.name,
    },
  });
});

/**
 * GET /api/robots/:id/upcoming
 * Get upcoming scheduled matches for a specific robot
 */
router.get('/:id/upcoming', authenticateToken, async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Verify robot exists
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true, userId: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Get scheduled matches
  const matches = await prisma.scheduledLeagueMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
      ],
    },
    include: {
      robot1: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      robot2: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });

  // Format response
  const formattedMatches = matches.map(match => {
    const isRobot1 = match.robot1Id === robotId;
    const opponent = isRobot1 ? match.robot2 : match.robot1;

    return {
      matchId: match.id,
      scheduledFor: match.scheduledFor,
      leagueType: match.leagueType,
      opponent: {
        id: opponent.id,
        name: opponent.name,
        elo: opponent.elo,
        owner: opponent.user.username,
      },
    };
  });

  res.json({
    matches: formattedMatches,
    total: formattedMatches.length,
    robot: {
      id: robot.id,
      name: robot.name,
    },
  });
});

// Repair all robots
router.post('/repair-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);
  }

  // Get repair bay facility for discount
  const repairBay = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'repair_bay',
      },
    },
  });

  const repairBayLevel = repairBay?.level || 0;

  // Get all user's robots (we'll filter by HP damage)
  const allRobots = await prisma.robot.findMany({
    where: { userId },
  });

  // Count active robots (excluding system robots like "Bye Robot")
  const activeRobotCount = allRobots.filter(r => r.name !== 'Bye Robot').length;

  // New formula: discount = repairBayLevel × (5 + activeRobotCount), capped at 90%
  const discount = Math.min(90, repairBayLevel * (5 + activeRobotCount));

  // Repair cost per HP point (matches frontend calculation)
  const REPAIR_COST_PER_HP = 50;

  // Filter robots that need repair and calculate costs
  const robotsNeedingRepair = allRobots
    .map(robot => {
      let repairCost = 0;
      
      // Use backend repairCost if set, otherwise calculate from HP damage
      if (robot.repairCost > 0) {
        repairCost = robot.repairCost;
      } else if (robot.currentHP < robot.maxHP) {
        const hpDamage = robot.maxHP - robot.currentHP;
        repairCost = hpDamage * REPAIR_COST_PER_HP;
      }
      
      return { ...robot, calculatedRepairCost: repairCost };
    })
    .filter(robot => robot.calculatedRepairCost > 0);

  if (robotsNeedingRepair.length === 0) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No robots need repair', 400);
  }

  // Calculate total cost
  const MANUAL_REPAIR_DISCOUNT = 0.5;
  const totalBaseCost = robotsNeedingRepair.reduce((sum, robot) => sum + robot.calculatedRepairCost, 0);
  const costAfterRepairBay = Math.floor(totalBaseCost * (1 - discount / 100));
  const finalCost = Math.floor(costAfterRepairBay * MANUAL_REPAIR_DISCOUNT);

  // Manual repairs are always allowed, even with negative balance.
  // This is the ONLY transaction permitted when a player has negative credits,
  // incentivizing active play during financial hardship.

  // Perform repairs in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Atomic currency decrement to prevent double-spend on concurrent requests
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: finalCost } },
    });

    // Repair all robots (restore HP to max, clear repairCost, track lifetime cost)
    const updatedRobots = await Promise.all(
      robotsNeedingRepair.map(robot => {
        const perRobotCostAfterRepairBay = Math.floor(robot.calculatedRepairCost * (1 - discount / 100));
        const perRobotFinalCost = Math.floor(perRobotCostAfterRepairBay * MANUAL_REPAIR_DISCOUNT);
        return tx.robot.update({
          where: { id: robot.id },
          data: {
            currentHP: robot.maxHP,
            currentShield: robot.maxShield,
            repairCost: 0,
            battleReadiness: 100,
            totalRepairsPaid: {
              increment: perRobotFinalCost,
            },
          },
        });
      })
    );

    return { user: updatedUser, robots: updatedRobots };
  });

  // Log repair events for each repaired robot
  try {
    for (const robot of robotsNeedingRepair) {
      const perRobotBaseCost = robot.calculatedRepairCost;
      const perRobotCostAfterRepairBay = Math.floor(perRobotBaseCost * (1 - discount / 100));
      const perRobotFinalCost = Math.floor(perRobotCostAfterRepairBay * MANUAL_REPAIR_DISCOUNT);
      const damageRepaired = robot.maxHP - robot.currentHP;

      await eventLogger.logRobotRepair(
        userId,
        robot.id,
        perRobotFinalCost,
        damageRepaired,
        discount,
        undefined,
        'manual',
        50,
        perRobotCostAfterRepairBay
      );
    }
  } catch (logError) {
    logger.error('Failed to log manual repair events:', logError);
    // Don't fail the request if logging fails
  }

  res.json({
    success: true,
    repairedCount: robotsNeedingRepair.length,
    totalBaseCost,
    discount,
    manualRepairDiscount: 50,
    preDiscountCost: costAfterRepairBay,
    finalCost,
    newCurrency: result.user.currency,
    message: `Successfully repaired ${robotsNeedingRepair.length} robot(s) for ₡${finalCost.toLocaleString()}`,
  });
});

// Get robot rankings
router.get('/:id/rankings', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Verify robot exists and belongs to the requesting user
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Get all robots for ranking calculations
  const allRobots = await prisma.robot.findMany({
    select: {
      id: true,
      // Combat category attributes
      combatPower: true,
      targetingSystems: true,
      criticalSystems: true,
      penetration: true,
      weaponControl: true,
      attackSpeed: true,
      // Defense category attributes
      armorPlating: true,
      shieldCapacity: true,
      evasionThrusters: true,
      damageDampeners: true,
      counterProtocols: true,
      // Chassis category attributes
      hullIntegrity: true,
      servoMotors: true,
      gyroStabilizers: true,
      hydraulicSystems: true,
      powerCore: true,
      // AI category attributes
      combatAlgorithms: true,
      threatAnalysis: true,
      adaptiveAI: true,
      logicCores: true,
      // Team category attributes
      syncProtocols: true,
      supportSystems: true,
      formationTactics: true,
      // Performance metrics
      damageDealtLifetime: true,
      wins: true,
      losses: true,
      elo: true,
      kills: true,
    },
  });

  const totalRobots = allRobots.length;

  // Helper function to calculate category sum
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calculateCategorySum = (robot: any, attributes: string[]) => {
    return attributes.reduce((sum, attr) => {
      const value = robot[attr];
      return sum + (typeof value === 'number' ? value : value.toNumber());
    }, 0);
  };

  // Calculate category sums for all robots
  const robotsWithScores = allRobots.map(r => {
    const combatSum = calculateCategorySum(r, [
      'combatPower', 'targetingSystems', 'criticalSystems', 
      'penetration', 'weaponControl', 'attackSpeed'
    ]);
    const defenseSum = calculateCategorySum(r, [
      'armorPlating', 'shieldCapacity', 'evasionThrusters', 
      'damageDampeners', 'counterProtocols'
    ]);
    const chassisSum = calculateCategorySum(r, [
      'hullIntegrity', 'servoMotors', 'gyroStabilizers', 
      'hydraulicSystems', 'powerCore'
    ]);
    const aiSum = calculateCategorySum(r, [
      'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores'
    ]);
    const teamSum = calculateCategorySum(r, [
      'syncProtocols', 'supportSystems', 'formationTactics'
    ]);

    const totalBattles = r.wins + r.losses;
    const winRate = totalBattles > 0 ? (r.wins / totalBattles) * 100 : 0;
    const kdRatio = r.losses > 0 ? r.kills / r.losses : r.kills;

    return {
      id: r.id,
      combatSum,
      defenseSum,
      chassisSum,
      aiSum,
      teamSum,
      damageDealt: r.damageDealtLifetime,
      winRate,
      elo: r.elo,
      kdRatio,
    };
  });

  // Helper function to calculate rank and percentile
  const calculateRanking = (value: number, allValues: number[]) => {
    const sortedValues = [...allValues].sort((a, b) => b - a); // Descending order
    const rank = sortedValues.findIndex(v => v === value) + 1;
    const percentile = (1 - (rank - 1) / totalRobots) * 100;
    return { rank, total: totalRobots, percentile, value };
  };

  // Find current robot's scores
  const currentRobotScores = robotsWithScores.find(r => r.id === robotId);
  
  if (!currentRobotScores) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot scores not found', 404);
  }

  // Calculate rankings for each category
  const rankings = {
    combatCategory: calculateRanking(
      currentRobotScores.combatSum,
      robotsWithScores.map(r => r.combatSum)
    ),
    defenseCategory: calculateRanking(
      currentRobotScores.defenseSum,
      robotsWithScores.map(r => r.defenseSum)
    ),
    chassisCategory: calculateRanking(
      currentRobotScores.chassisSum,
      robotsWithScores.map(r => r.chassisSum)
    ),
    aiCategory: calculateRanking(
      currentRobotScores.aiSum,
      robotsWithScores.map(r => r.aiSum)
    ),
    teamCategory: calculateRanking(
      currentRobotScores.teamSum,
      robotsWithScores.map(r => r.teamSum)
    ),
    totalDamageDealt: calculateRanking(
      currentRobotScores.damageDealt,
      robotsWithScores.map(r => r.damageDealt)
    ),
    winRate: calculateRanking(
      currentRobotScores.winRate,
      robotsWithScores.map(r => r.winRate)
    ),
    elo: calculateRanking(
      currentRobotScores.elo,
      robotsWithScores.map(r => r.elo)
    ),
    kdRatio: calculateRanking(
      currentRobotScores.kdRatio,
      robotsWithScores.map(r => r.kdRatio)
    ),
  };

  res.json(rankings);
});

// Get robot performance by context (leagues, tournaments, tag teams)
router.get('/:id/performance-context', authenticateToken, async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Verify robot exists
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Get all battles for this robot (including tag team battles where robot is active or reserve)
  const battles = await prisma.battle.findMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
        { team1ActiveRobotId: robotId },
        { team1ReserveRobotId: robotId },
        { team2ActiveRobotId: robotId },
        { team2ReserveRobotId: robotId },
      ],
    },
    select: {
      id: true,
      battleType: true,
      leagueType: true,
      tournamentId: true,
      robot1Id: true,
      robot2Id: true,
      winnerId: true,
      team1ActiveRobotId: true,
      team1ReserveRobotId: true,
      team2ActiveRobotId: true,
      team2ReserveRobotId: true,
      createdAt: true,
      participants: true, // Get BattleParticipant data
      tournament: {
        select: {
          id: true,
          name: true,
          totalParticipants: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Helper to determine if robot won, lost, or drew
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getBattleResult = (battle: any) => {
    if (battle.winnerId === null) return 'draw';
    
    // For tag team battles, check team membership and ELO change
    if (battle.battleType === 'tag_team') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const participant = battle.participants.find((p: any) => p.robotId === robotId);
      if (!participant) return 'draw';
      
      const eloChange = participant.eloAfter - participant.eloBefore;
      if (eloChange > 0) return 'win';
      if (eloChange < 0) return 'loss';
      return 'draw';
    }
    
    return battle.winnerId === robotId ? 'win' : 'loss';
  };

  // Helper to get robot's damage dealt and taken
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getBattleStats = (battle: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participant = battle.participants.find((p: any) => p.robotId === robotId);
    if (!participant) {
      return { damageDealt: 0, damageTaken: 0, eloChange: 0 };
    }
    
    // Get opponent's damage (damage taken by this robot)
    let damageTaken = 0;
    if (battle.battleType === 'tag_team') {
      // For tag team, sum damage from all opponents
      const opponentTeam = participant.team === 1 ? 2 : 1;
        damageTaken = battle.participants
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((p: any) => p.team === opponentTeam)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .reduce((sum: number, p: any) => sum + p.damageDealt, 0);
      } else {
        // For 1v1, get opponent's damage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opponent = battle.participants.find((p: any) => p.robotId !== robotId);
        damageTaken = opponent?.damageDealt || 0;
      }
      
      return {
        damageDealt: participant.damageDealt,
        damageTaken,
        eloChange: participant.eloAfter - participant.eloBefore,
      };
    };

    // Process league battles
    const leagueBattles = battles.filter(b => b.battleType === 'league');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leagueStatsMap = new Map<string, any>();

    leagueBattles.forEach(battle => {
      const leagueName = battle.leagueType;
      if (!leagueStatsMap.has(leagueName)) {
        leagueStatsMap.set(leagueName, {
          leagueName,
          leagueIcon: `🏆`, // Could be customized per league
          wins: 0,
          losses: 0,
          draws: 0,
          damageDealt: 0,
          damageTaken: 0,
          eloChange: 0,
          battlesPlayed: 0,
        });
      }

      const stats = leagueStatsMap.get(leagueName);
      const result = getBattleResult(battle);
      const battleStats = getBattleStats(battle);

      if (result === 'win') stats.wins++;
      else if (result === 'loss') stats.losses++;
      else stats.draws++;

      stats.damageDealt += battleStats.damageDealt;
      stats.damageTaken += battleStats.damageTaken;
      stats.eloChange += battleStats.eloChange;
      stats.battlesPlayed++;
    });

    const leagueStats = Array.from(leagueStatsMap.values()).map(stats => ({
      ...stats,
      winRate: stats.battlesPlayed > 0 
        ? ((stats.wins / stats.battlesPlayed) * 100).toFixed(1) 
        : '0.0',
    }));

    // Process tournament battles
    const tournamentBattles = battles.filter(b => b.battleType === 'tournament' && b.tournamentId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tournamentStatsMap = new Map<number, any>();

    tournamentBattles.forEach(battle => {
      const tournamentId = battle.tournamentId!;
      if (!tournamentStatsMap.has(tournamentId)) {
        tournamentStatsMap.set(tournamentId, {
          tournamentId,
          tournamentName: battle.tournament?.name || `Tournament #${tournamentId}`,
          tournamentDate: battle.createdAt,
          totalParticipants: battle.tournament?.totalParticipants || 0,
          wins: 0,
          losses: 0,
          damageDealt: 0,
          damageTaken: 0,
          placement: null, // Will be calculated later
        });
      }

      const stats = tournamentStatsMap.get(tournamentId);
      const result = getBattleResult(battle);
      const battleStats = getBattleStats(battle);

      if (result === 'win') stats.wins++;
      else if (result === 'loss') stats.losses++;

      stats.damageDealt += battleStats.damageDealt;
      stats.damageTaken += battleStats.damageTaken;
    });

    // Calculate tournament placements
    const tournamentStats = await Promise.all(
      Array.from(tournamentStatsMap.values()).map(async (stats) => {
        // Get tournament matches to determine placement
        const tournamentMatches = await prisma.scheduledTournamentMatch.findMany({
          where: {
            tournamentId: stats.tournamentId,
            OR: [
              { robot1Id: robotId },
              { robot2Id: robotId },
            ],
          },
          orderBy: {
            round: 'desc',
          },
        });

        // Determine placement based on highest round reached
        let placement = stats.totalParticipants; // Default to last place
        if (tournamentMatches.length > 0) {
          const highestRound = tournamentMatches[0].round;
          const wonFinal = tournamentMatches.some(m => m.winnerId === robotId && m.round === highestRound);
          
          // Simple placement logic: 2^(maxRounds - round) gives approximate placement
          if (wonFinal && highestRound === Math.ceil(Math.log2(stats.totalParticipants))) {
            placement = 1; // Won the tournament
          } else if (highestRound === Math.ceil(Math.log2(stats.totalParticipants))) {
            placement = 2; // Lost in finals
          } else if (highestRound === Math.ceil(Math.log2(stats.totalParticipants)) - 1) {
            placement = 3; // Lost in semi-finals (approximate)
          } else {
            placement = Math.pow(2, Math.ceil(Math.log2(stats.totalParticipants)) - highestRound + 1);
          }
        }

        return {
          ...stats,
          placement,
        };
      })
    );

    // Process tag team battles
    const tagTeamBattles = battles.filter(b => b.battleType === 'tag_team');
    const tagTeamStats = {
      totalBattles: tagTeamBattles.length,
      wins: 0,
      losses: 0,
      draws: 0,
      damageDealt: 0,
      damageTaken: 0,
    };

    tagTeamBattles.forEach(battle => {
      const result = getBattleResult(battle);
      const battleStats = getBattleStats(battle);

      if (result === 'win') tagTeamStats.wins++;
      else if (result === 'loss') tagTeamStats.losses++;
      else tagTeamStats.draws++;

      tagTeamStats.damageDealt += battleStats.damageDealt;
      tagTeamStats.damageTaken += battleStats.damageTaken;
    });

    const tagTeamStatsWithWinRate = {
      ...tagTeamStats,
      winRate: tagTeamStats.totalBattles > 0 
        ? ((tagTeamStats.wins / tagTeamStats.totalBattles) * 100).toFixed(1) 
        : '0.0',
    };

    res.json({
      leagues: leagueStats,
      tournaments: tournamentStats,
      tagTeam: tagTeamStatsWithWinRate,
    });
});

// Update robot appearance (imageUrl)
router.put('/:id/appearance', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));
  const { imageUrl } = req.body;

  logger.info('Appearance update request:', { userId, robotId, imageUrl });

  // Validate input
  if (!imageUrl || typeof imageUrl !== 'string') {
    logger.info('Invalid imageUrl:', imageUrl);
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid imageUrl', 400);
  }

  // Basic validation - must be a path to our assets (either source path or built asset path)
  const isValidPath = imageUrl.startsWith('/src/assets/robots/') || 
                      imageUrl.startsWith('/assets/') ||
                      imageUrl.match(/^\/assets\/robot.*\.webp$/);
  
  if (!isValidPath) {
    logger.info('Invalid image path:', imageUrl);
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid image path', 400);
  }

  // Check robot ownership
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
  });

  if (!robot) {
    logger.info('Robot not found:', robotId);
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== userId) {
    logger.info('Ownership mismatch:', { robotUserId: robot.userId, requestUserId: userId });
    throw new RobotError(RobotErrorCode.ROBOT_NOT_OWNED, 'You do not own this robot', 403);
  }

  logger.info('Updating robot with imageUrl...');
  
  // Update appearance
  const updatedRobot = await prisma.robot.update({
    where: { id: robotId },
    data: {
      imageUrl,
    },
    include: {
      mainWeapon: {
        include: {
          weapon: true,
        },
      },
      offhandWeapon: {
        include: {
          weapon: true,
        },
      },
    },
  });

  logger.info('Robot updated successfully');

  res.json({
    success: true,
    robot: updatedRobot,
    message: 'Robot image updated successfully',
  });
});

// Get recent battles for a robot
// Get upcoming matches for a robot
router.get('/:id/upcoming-matches', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const robotId = parseInt(String(req.params.id));

  if (isNaN(robotId)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Invalid robot ID', 400);
  }

  // Verify robot exists and belongs to the requesting user
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    include: {
      mainWeapon: true,
      offhandWeapon: true,
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  if (robot.userId !== userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Calculate battle readiness
  const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
  const hasWeapons = robot.mainWeaponId !== null;
  const isReady = hpPercentage >= 50 && hasWeapons;
  const warnings: string[] = [];
  
  if (hpPercentage < 50) {
    warnings.push('HP below 50%');
  }
  if (!hasWeapons) {
    warnings.push('No weapons equipped');
  }

  // Fetch scheduled league matches
  const scheduledMatches = await prisma.scheduledLeagueMatch.findMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
      ],
      status: 'scheduled',
      scheduledFor: {
        gte: new Date(),
      },
    },
    include: {
      robot1: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      robot2: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });

  // Fetch upcoming tournament matches
  const tournamentMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
      ],
      status: 'scheduled',
    },
    include: {
      robot1: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      robot2: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      tournament: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Fetch upcoming tag team matches where this robot is involved
  const tagTeamMatches = await prisma.scheduledTagTeamMatch.findMany({
    where: {
      OR: [
        {
          team1: {
            OR: [
              { activeRobotId: robotId },
              { reserveRobotId: robotId },
            ],
          },
        },
        {
          team2: {
            OR: [
              { activeRobotId: robotId },
              { reserveRobotId: robotId },
            ],
          },
        },
      ],
      status: 'scheduled',
      scheduledFor: {
        gte: new Date(),
      },
    },
    include: {
      team1: {
        include: {
          activeRobot: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          reserveRobot: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      },
      team2: {
        include: {
          activeRobot: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          reserveRobot: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });

  // Format matches for response
  const formattedMatches = [
    // League matches
    ...scheduledMatches.map(match => {
      const opponent = match.robot1Id === robotId ? match.robot2 : match.robot1;
      return {
        matchId: match.id,
        opponentName: opponent.name,
        opponentPortrait: opponent.imageUrl || '/src/assets/robots/robot-1.png',
        scheduledTime: match.scheduledFor.toISOString(),
        battleType: 'league' as const,
        leagueContext: match.leagueType,
      };
    }),
    // Tournament matches
    ...tournamentMatches.map(match => {
      const opponent = match.robot1Id === robotId ? match.robot2 : match.robot1;
      return {
        matchId: match.id,
        opponentName: opponent?.name || 'TBD',
        opponentPortrait: opponent?.imageUrl || '/src/assets/robots/robot-1.png',
        scheduledTime: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
        battleType: 'tournament' as const,
        tournamentContext: match.tournament.name,
      };
    }),
    // Tag team matches
    ...tagTeamMatches.filter(match => match.team1 && match.team2).map(match => {
      const isTeam1 = match.team1!.activeRobotId === robotId || match.team1!.reserveRobotId === robotId;
      
      let teammates: string[];
      let opponentTeam: string[];
      
      if (isTeam1) {
        teammates = [
          match.team1!.activeRobotId === robotId ? match.team1!.reserveRobot.name : match.team1!.activeRobot.name,
        ];
        opponentTeam = [match.team2!.activeRobot.name, match.team2!.reserveRobot.name];
      } else {
        teammates = [
          match.team2!.activeRobotId === robotId ? match.team2!.reserveRobot.name : match.team2!.activeRobot.name,
        ];
        opponentTeam = [match.team1!.activeRobot.name, match.team1!.reserveRobot.name];
      }

      return {
        matchId: match.id,
        opponentName: opponentTeam[0], // Show first opponent
        opponentPortrait: '/src/assets/robots/robot-1.png',
        scheduledTime: match.scheduledFor.toISOString(),
        battleType: 'tag_team' as const,
        leagueContext: match.tagTeamLeague,
        teammates,
        opponentTeam,
      };
    }),
  ].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

  res.json({
    matches: formattedMatches,
    battleReadiness: {
      isReady,
      warnings,
    },
  });
});

// Bulk upgrade robot attributes (atomic transaction)
router.post('/:id/upgrades', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  // Get robot
  const robot = await prisma.robot.findFirst({
    where: {
      id: robotId,
      userId, // Ensure user owns this robot
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  }

  // Get user's current currency and Training Facility level
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      facilities: {
        where: { 
          facilityType: {
            in: ['training_facility', 'combat_training_academy', 'defense_training_academy', 'mobility_training_academy', 'ai_training_academy']
          }
        },
      },
    },
  });

  if (!user) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);
  }

  // Get facility levels
  const trainingLevel = user.facilities.find(f => f.facilityType === 'training_facility')?.level || 0;
  const academyLevels = {
    combat_training_academy: user.facilities.find(f => f.facilityType === 'combat_training_academy')?.level || 0,
    defense_training_academy: user.facilities.find(f => f.facilityType === 'defense_training_academy')?.level || 0,
    mobility_training_academy: user.facilities.find(f => f.facilityType === 'mobility_training_academy')?.level || 0,
    ai_training_academy: user.facilities.find(f => f.facilityType === 'ai_training_academy')?.level || 0,
  };

  // Validate all upgrades and calculate total cost
  const validAttributes = [
    'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
    'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
    'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
    'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
    'syncProtocols', 'supportSystems', 'formationTactics',
  ];

  let totalCost = 0;
  const upgradeOperations: Array<{ attribute: string; fromLevel: number; toLevel: number; cost: number }> = [];

  for (const [attribute, upgrade] of Object.entries(upgrades)) {
    if (!validAttributes.includes(attribute)) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Invalid attribute: ${attribute}`, 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { currentLevel, plannedLevel } = upgrade as any;

    if (typeof currentLevel !== 'number' || typeof plannedLevel !== 'number') {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Invalid upgrade data for ${attribute}`, 400);
    }

    if (plannedLevel <= currentLevel) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Planned level must be greater than current level for ${attribute}`, 400);
    }

    // Get current level from robot
    const robotCurrentLevelValue = robot[attribute as keyof typeof robot];
    const robotCurrentLevel = typeof robotCurrentLevelValue === 'number' 
      ? robotCurrentLevelValue 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (robotCurrentLevelValue as any).toNumber();

    // Verify current level matches
    if (Math.floor(robotCurrentLevel) !== Math.floor(currentLevel)) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
        `Current level mismatch for ${attribute}. Expected ${Math.floor(robotCurrentLevel)}, got ${Math.floor(currentLevel)}`,
        400
      );
    }

    // Check academy cap
    const academyType = attributeToAcademy[attribute];
    const academyLevel = academyLevels[academyType as keyof typeof academyLevels] || 0;
    const cap = getCapForLevel(academyLevel);

    if (plannedLevel > cap) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
        `Attribute ${attribute} exceeds cap of ${cap}. Upgrade the corresponding academy to increase the cap.`,
        400
      );
    }

    // Calculate cost for this attribute
    // Training Facility: 10% per level, capped at 90% (see docs/prd_core/STABLE_SYSTEM.md)
    const discountPercent = Math.min(trainingLevel * 10, 90);
    let attributeCost = 0;

    for (let level = Math.floor(currentLevel); level < plannedLevel; level++) {
      const baseCost = (level + 1) * 1500;
      const discountedCost = Math.floor(baseCost * (1 - discountPercent / 100));
      attributeCost += discountedCost;
    }

    totalCost += attributeCost;
    upgradeOperations.push({
      attribute,
      fromLevel: Math.floor(currentLevel),
      toLevel: plannedLevel,
      cost: attributeCost,
    });
  }

  // Check if user has enough currency
  if (user.currency < totalCost) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 
      'Insufficient credits',
      400,
      { required: totalCost, current: user.currency }
    );
  }

  // Perform all upgrades in a single atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // Re-read user inside transaction to prevent race conditions (stale balance exploit)
    const freshUser = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!freshUser || freshUser.currency < totalCost) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        'Insufficient credits',
        400,
        { required: totalCost, current: freshUser?.currency ?? 0 }
      );
    }

    // Atomic currency decrement to prevent double-spend
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: totalCost } },
    });

    // Build update data object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    for (const op of upgradeOperations) {
      updateData[op.attribute] = op.toLevel;
    }

    // Update all attributes at once
    const updatedRobot = await tx.robot.update({
      where: { id: robotId },
      data: updateData,
      include: {
        mainWeapon: {
          include: {
            weapon: true,
          },
        },
        offhandWeapon: {
          include: {
            weapon: true,
          },
        },
      },
    });

    // If hullIntegrity or shieldCapacity was upgraded, recalculate maxHP/maxShield
    const needsHPUpdate = upgradeOperations.some(op => op.attribute === 'hullIntegrity' || op.attribute === 'shieldCapacity');
    
    if (needsHPUpdate) {
      const maxHP = calculateMaxHP(updatedRobot);
      const maxShield = calculateMaxShield(updatedRobot);

      // Calculate current HP/Shield proportionally to maintain same percentage
      const hpPercentage = robot.maxHP > 0 ? robot.currentHP / robot.maxHP : 1;
      const shieldPercentage = robot.maxShield > 0 ? robot.currentShield / robot.maxShield : 1;

      const newCurrentHP = Math.round(maxHP * hpPercentage);
      const newCurrentShield = Math.round(maxShield * shieldPercentage);

      // Update robot with new HP/Shield values
      const finalRobot = await tx.robot.update({
        where: { id: robotId },
        data: {
          maxHP,
          maxShield,
          currentHP: Math.min(newCurrentHP, maxHP),
          currentShield: Math.min(newCurrentShield, maxShield),
        },
        include: {
          mainWeapon: {
            include: {
              weapon: true,
            },
          },
          offhandWeapon: {
            include: {
              weapon: true,
            },
          },
        },
      });

      return { user: updatedUser, robot: finalRobot };
    }

    return { user: updatedUser, robot: updatedRobot };
  });

  // Log attribute upgrade events
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    // Attribute upgrades done between cycles should be logged to the NEXT cycle
    // because the current cycle's snapshot has already been created
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    logger.info(`[AttributeUpgrade] User ${userId} | Robot ${robotId} (${robot.name}) | Attributes: ${upgradeOperations.length} | Total Cost: ₡${totalCost.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

    // Track spending for onboarding budget comparison
    await trackSpending(userId, 'attributes', totalCost);

    // Log each attribute upgrade
    for (const op of upgradeOperations) {
      await eventLogger.logAttributeUpgrade(
        currentCycle,
        robotId,
        op.attribute,
        op.fromLevel,
        op.toLevel,
        op.cost,
        userId  // Pass userId so it can be aggregated properly
      );
      logger.info(`[AttributeUpgrade]   ${op.attribute} | ${op.fromLevel}→${op.toLevel} | ₡${op.cost.toLocaleString()}`);
    }
  } catch (logError) {
    logger.error('[AttributeUpgrade] ERROR logging upgrades:', logError);
    // Don't fail the request if logging fails
  }

  res.json({
    success: true,
    robot: result.robot,
    currency: result.user.currency,
    totalCost,
    upgradesApplied: upgradeOperations.length,
    message: `Successfully upgraded ${upgradeOperations.length} attribute${upgradeOperations.length > 1 ? 's' : ''}`,
  });
});

export default router;
