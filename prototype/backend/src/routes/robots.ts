import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { canEquipToSlot, validateOffhandEquipment, isSlotAvailable } from '../utils/weaponValidation';
import { calculateMaxHP, calculateMaxShield } from '../utils/robotCalculations';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/eventLogger';

const router = express.Router();

const ROBOT_CREATION_COST = 500000;
const MAX_ATTRIBUTE_LEVEL = 50;

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

// Get all robots from all users
router.get('/all/robots', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
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

    res.json(robots);
  } catch (error) {
    console.error('All robots list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all robots for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Robot list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new robot
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    // Validate robot name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Robot name is required' });
    }

    if (name.length < 1 || name.length > 50) {
      return res.status(400).json({ error: 'Robot name must be between 1 and 50 characters' });
    }

    // Check if a robot with this name already exists for the user
    const existingRobot = await prisma.robot.findFirst({
      where: {
        userId,
        name,
      },
    });

    if (existingRobot) {
      return res.status(400).json({ error: 'You already have a robot with this name' });
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
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough currency
    if (user.currency < ROBOT_CREATION_COST) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Check Roster Expansion limit
    // Level 0 = 1 robot, Level 1 = 2 robots, ..., Level 9 = 10 robots
    const rosterLevel = user.facilities[0]?.level || 0;
    const maxRobots = rosterLevel + 1;
    
    const currentRobotCount = await prisma.robot.count({
      where: { userId },
    });

    if (currentRobotCount >= maxRobots) {
      return res.status(400).json({ 
        error: `Robot limit reached. Upgrade Roster Expansion facility to create more robots. Current limit: ${maxRobots}` 
      });
    }

    // Create robot in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct currency
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - ROBOT_CREATION_COST },
      });

      // Create robot with all attributes at level 1 (defaults in schema)
      // Calculate initial HP and Shield directly from default values
      const hullIntegrity = 1; // Default level (Decimal 1.00 in schema)
      const shieldCapacity = 1; // Default level (Decimal 1.00 in schema)
      
      // Formula: maxHP = 50 + (hullIntegrity × 5), maxShield = shieldCapacity × 2
      // Using direct calculation since all attributes are at default values
      const maxHP = 50 + (hullIntegrity * 5); // = 55 HP
      const maxShield = shieldCapacity * 2; // = 2 Shield
      
      const robot = await tx.robot.create({
        data: {
          userId,
          name,
          currentHP: maxHP,
          maxHP: maxHP,
          currentShield: maxShield,
          maxShield: maxShield,
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
      const currentCycle = cycleMetadata?.totalCycles || 0;

      // Log robot purchase (we don't have a ROBOT_PURCHASE event type, so use credit_change)
      await eventLogger.logCreditChange(
        currentCycle,
        userId,
        -ROBOT_CREATION_COST,
        result.user.currency,
        'other'
      );

      // Get user's stable name for logging
      const userForLog = await prisma.user.findUnique({
        where: { id: userId },
        select: { stableName: true },
      });
      const stableInfo = userForLog?.stableName ? ` (${userForLog.stableName})` : '';

      // Console log for cycle logs
      console.log(`[Robot] | User ${userId}${stableInfo} | Created: "${name}" | Cost: ₡${ROBOT_CREATION_COST.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);
    } catch (logError) {
      console.error('Failed to log robot creation event:', logError);
      // Don't fail the request if logging fails
    }

    res.status(201).json({
      robot: result.robot,
      currency: result.user.currency,
      message: 'Robot created successfully',
    });
  } catch (error) {
    console.error('Robot creation error:', error);
    
    // Handle unique constraint violation (as a fallback safety check)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(400).json({ error: 'You already have a robot with this name' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific robot by ID (any logged-in user can view any robot)
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      console.log(`Invalid robot ID received: ${req.params.id}`);
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    console.log(`Fetching robot with ID: ${robotId}`);

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
      console.log(`Robot not found with ID: ${robotId}`);
      return res.status(404).json({ error: 'Robot not found' });
    }

    console.log(`Successfully fetched robot: ${robot.name} (ID: ${robot.id})`);
    res.json(robot);
  } catch (error) {
    console.error('Robot fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Equip main weapon
router.put('/:id/equip-main-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { weaponInventoryId } = req.body;

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    if (!weaponInventoryId || isNaN(parseInt(weaponInventoryId))) {
      return res.status(400).json({ error: 'Valid weapon inventory ID is required' });
    }

    const weaponInvIdNum = parseInt(weaponInventoryId);

    // Get robot with current weapons
    const robot = await prisma.robot.findFirst({
      where: { id: robotId, userId },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    // Get weapon to equip
    const weaponInv = await prisma.weaponInventory.findFirst({
      where: { id: weaponInvIdNum, userId },
      include: { 
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });

    if (!weaponInv) {
      return res.status(404).json({ error: 'Weapon not found in your inventory' });
    }

    // Check if weapon is equipped to another robot
    const equippedToOther = weaponInv.robotsMain.concat(weaponInv.robotsOffhand)
      .find(r => r.id !== robotId);
    
    if (equippedToOther) {
      return res.status(400).json({ 
        error: `Weapon is already equipped to ${equippedToOther.name}`,
      });
    }

    // Validate weapon can be equipped in main slot
    const validation = canEquipToSlot(weaponInv.weapon, 'main', robot.loadoutType);
    if (!validation.canEquip) {
      return res.status(400).json({ 
        error: validation.reason,
      });
    }

    // Update robot with new weapon and recalculate stats
    const updatedRobot = await prisma.robot.update({
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
      message: 'Main weapon equipped successfully',
    });
  } catch (error) {
    console.error('Main weapon equip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Equip offhand weapon
router.put('/:id/equip-offhand-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { weaponInventoryId } = req.body;

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    if (!weaponInventoryId || isNaN(parseInt(weaponInventoryId))) {
      return res.status(400).json({ error: 'Valid weapon inventory ID is required' });
    }

    const weaponInvIdNum = parseInt(weaponInventoryId);

    // Get robot with current weapons
    const robot = await prisma.robot.findFirst({
      where: { id: robotId, userId },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    // Check if offhand slot is available for this loadout
    if (!isSlotAvailable('offhand', robot.loadoutType)) {
      return res.status(400).json({ 
        error: `Offhand slot not available for ${robot.loadoutType} loadout`,
      });
    }

    // Get weapon to equip
    const weaponInv = await prisma.weaponInventory.findFirst({
      where: { id: weaponInvIdNum, userId },
      include: { 
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });

    if (!weaponInv) {
      return res.status(404).json({ error: 'Weapon not found in your inventory' });
    }

    // Check if weapon is equipped to another robot
    const equippedToOther = weaponInv.robotsMain.concat(weaponInv.robotsOffhand)
      .find(r => r.id !== robotId);
    
    if (equippedToOther) {
      return res.status(400).json({ 
        error: `Weapon is already equipped to ${equippedToOther.name}`,
      });
    }

    // Validate weapon can be equipped in offhand slot
    const slotValidation = canEquipToSlot(weaponInv.weapon, 'offhand', robot.loadoutType);
    if (!slotValidation.canEquip) {
      return res.status(400).json({ 
        error: slotValidation.reason,
      });
    }

    // Validate offhand equipment requirements
    const offhandValidation = validateOffhandEquipment(
      weaponInv.weapon,
      robot.mainWeaponId !== null,
      robot.loadoutType
    );
    if (!offhandValidation.valid) {
      return res.status(400).json({ 
        error: offhandValidation.reason,
      });
    }

    // Update robot with new weapon and recalculate stats
    const updatedRobot = await prisma.robot.update({
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
      message: 'Offhand weapon equipped successfully',
    });
  } catch (error) {
    console.error('Offhand weapon equip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unequip main weapon
router.delete('/:id/unequip-main-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
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
      return res.status(404).json({ error: 'Robot not found' });
    }

    if (!robot.mainWeaponId) {
      return res.status(400).json({ error: 'No main weapon equipped' });
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
  } catch (error) {
    console.error('Main weapon unequip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unequip offhand weapon
router.delete('/:id/unequip-offhand-weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
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
      return res.status(404).json({ error: 'Robot not found' });
    }

    if (!robot.offhandWeaponId) {
      return res.status(400).json({ error: 'No offhand weapon equipped' });
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
  } catch (error) {
    console.error('Offhand weapon unequip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change loadout type
router.put('/:id/loadout-type', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { loadoutType } = req.body;

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    // Validate loadout type
    const validLoadouts = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
    if (!loadoutType || !validLoadouts.includes(loadoutType)) {
      return res.status(400).json({ 
        error: 'Invalid loadout type. Must be one of: single, weapon_shield, two_handed, dual_wield',
      });
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
      return res.status(404).json({ error: 'Robot not found' });
    }

    // Check if current weapons are compatible with new loadout
    const { canChangeLoadout } = await import('../utils/weaponValidation');
    const validation = canChangeLoadout(
      loadoutType,
      robot.mainWeapon?.weapon || null,
      robot.offhandWeapon?.weapon || null
    );

    if (!validation.canChange) {
      return res.status(400).json({ 
        error: 'Cannot change loadout type',
        conflicts: validation.conflicts,
        message: 'Please unequip incompatible weapons before changing loadout type',
      });
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
  } catch (error) {
    console.error('Loadout type change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update robot stance (offensive, defensive, balanced)
router.patch('/:id/stance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);
    const { stance } = req.body;

    // Validate stance value
    if (!stance || typeof stance !== 'string') {
      return res.status(400).json({ error: 'Stance is required and must be a string' });
    }

    const normalizedStance = stance.toLowerCase();
    if (!['offensive', 'defensive', 'balanced'].includes(normalizedStance)) {
      return res.status(400).json({ 
        error: 'Invalid stance. Must be one of: offensive, defensive, balanced',
        code: 'INVALID_STANCE',
      });
    }

    // Check if robot exists and belongs to user
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    if (robot.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this robot' });
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
  } catch (error) {
    console.error('Stance update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update robot yield threshold (0-50)
router.patch('/:id/yield-threshold', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);
    const { yieldThreshold } = req.body;

    // Validate yield threshold
    if (yieldThreshold === undefined || yieldThreshold === null) {
      return res.status(400).json({ error: 'Yield threshold is required' });
    }

    const threshold = Number(yieldThreshold);
    if (isNaN(threshold)) {
      return res.status(400).json({ 
        error: 'Yield threshold must be a number',
        code: 'INVALID_YIELD_THRESHOLD',
      });
    }

    if (threshold < 0 || threshold > 50) {
      return res.status(400).json({ 
        error: 'Yield threshold must be between 0 and 50',
        code: 'INVALID_YIELD_THRESHOLD',
      });
    }

    // Check if robot exists and belongs to user
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    if (robot.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this robot' });
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
  } catch (error) {
    console.error('Yield threshold update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/robots/:id/matches
 * Get paginated match history for a specific robot
 */
router.get('/:id/matches', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
      select: { id: true, name: true, userId: true },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
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
      const thisRobot = isRobot1 ? battle.robot1 : battle.robot2;
      const opponent = isRobot1 ? battle.robot2 : battle.robot1;
      const won = battle.winnerId === robotId;

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
          finalHP: isRobot1 ? battle.robot1FinalHP : battle.robot2FinalHP,
          damageDealt: isRobot1 ? battle.robot1DamageDealt : battle.robot2DamageDealt,
          eloBefore: isRobot1 ? battle.robot1ELOBefore : battle.robot2ELOBefore,
          eloAfter: isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter,
        },
        opponent: {
          id: opponent.id,
          name: opponent.name,
          owner: opponent.user.username,
          finalHP: isRobot1 ? battle.robot2FinalHP : battle.robot1FinalHP,
          damageDealt: isRobot1 ? battle.robot2DamageDealt : battle.robot1DamageDealt,
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
  } catch (error) {
    console.error('Robot matches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/robots/:id/upcoming
 * Get upcoming scheduled matches for a specific robot
 */
router.get('/:id/upcoming', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
      select: { id: true, name: true, userId: true },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
    }

    // Get scheduled matches
    const matches = await prisma.scheduledMatch.findMany({
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
  } catch (error) {
    console.error('Robot upcoming matches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Repair all robots
router.post('/repair-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
      return res.status(400).json({ error: 'No robots need repair' });
    }

    // Calculate total cost
    const totalBaseCost = robotsNeedingRepair.reduce((sum, robot) => sum + robot.calculatedRepairCost, 0);
    const finalCost = Math.floor(totalBaseCost * (1 - discount / 100));

    // Check if user has enough credits
    if (user.currency < finalCost) {
      return res.status(400).json({ 
        error: 'Insufficient credits',
        required: finalCost,
        current: user.currency,
      });
    }

    // Perform repairs in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct cost from user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - finalCost },
      });

      // Repair all robots (restore HP to max, clear repairCost)
      const updatedRobots = await Promise.all(
        robotsNeedingRepair.map(robot =>
          tx.robot.update({
            where: { id: robot.id },
            data: {
              currentHP: robot.maxHP,
              currentShield: robot.maxShield,
              repairCost: 0,
              battleReadiness: 100,
            },
          })
        )
      );

      return { user: updatedUser, robots: updatedRobots };
    });

    res.json({
      success: true,
      repairedCount: robotsNeedingRepair.length,
      totalBaseCost,
      discount,
      finalCost,
      newCurrency: result.user.currency,
      message: `Successfully repaired ${robotsNeedingRepair.length} robot(s) for ₡${finalCost.toLocaleString()}`,
    });
  } catch (error) {
    console.error('Repair all robots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get robot rankings
router.get('/:id/rankings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
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
      return res.status(404).json({ error: 'Robot scores not found' });
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
  } catch (error) {
    console.error('Robot rankings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get robot performance by context (leagues, tournaments, tag teams)
router.get('/:id/performance-context', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
      select: { id: true, name: true },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
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
        robot1DamageDealt: true,
        robot2DamageDealt: true,
        robot1FinalHP: true,
        robot2FinalHP: true,
        robot1ELOBefore: true,
        robot1ELOAfter: true,
        robot2ELOBefore: true,
        robot2ELOAfter: true,
        team1ActiveRobotId: true,
        team1ReserveRobotId: true,
        team2ActiveRobotId: true,
        team2ReserveRobotId: true,
        createdAt: true,
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
    const getBattleResult = (battle: any) => {
      if (battle.winnerId === null) return 'draw';
      
      // For tag team battles, check team membership and ELO change
      if (battle.battleType === 'tag_team') {
        const isTeam1 = battle.team1ActiveRobotId === robotId || battle.team1ReserveRobotId === robotId;
        const isTeam2 = battle.team2ActiveRobotId === robotId || battle.team2ReserveRobotId === robotId;
        
        // Check ELO change to determine win/loss
        let eloChange = 0;
        if (isTeam1) {
          eloChange = battle.robot1ELOAfter - battle.robot1ELOBefore;
        } else if (isTeam2) {
          eloChange = battle.robot2ELOAfter - battle.robot2ELOBefore;
        }
        
        if (eloChange > 0) return 'win';
        if (eloChange < 0) return 'loss';
        return 'draw';
      }
      
      return battle.winnerId === robotId ? 'win' : 'loss';
    };

    // Helper to get robot's damage dealt and taken
    const getBattleStats = (battle: any) => {
      if (battle.battleType === 'tag_team') {
        // For tag team battles, use the team's stats
        const isTeam1 = battle.team1ActiveRobotId === robotId || battle.team1ReserveRobotId === robotId;
        const isTeam2 = battle.team2ActiveRobotId === robotId || battle.team2ReserveRobotId === robotId;
        
        if (isTeam1) {
          return {
            damageDealt: battle.robot1DamageDealt,
            damageTaken: battle.robot2DamageDealt,
            eloChange: battle.robot1ELOAfter - battle.robot1ELOBefore,
          };
        } else if (isTeam2) {
          return {
            damageDealt: battle.robot2DamageDealt,
            damageTaken: battle.robot1DamageDealt,
            eloChange: battle.robot2ELOAfter - battle.robot2ELOBefore,
          };
        }
      }
      
      const isRobot1 = battle.robot1Id === robotId;
      return {
        damageDealt: isRobot1 ? battle.robot1DamageDealt : battle.robot2DamageDealt,
        damageTaken: isRobot1 
          ? battle.robot2DamageDealt 
          : battle.robot1DamageDealt,
        eloChange: isRobot1 
          ? battle.robot1ELOAfter - battle.robot1ELOBefore 
          : battle.robot2ELOAfter - battle.robot2ELOBefore,
      };
    };

    // Process league battles
    const leagueBattles = battles.filter(b => b.battleType === 'league');
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
        const tournamentMatches = await prisma.tournamentMatch.findMany({
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
  } catch (error) {
    console.error('Robot performance context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update robot appearance (imageUrl)
router.put('/:id/appearance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { imageUrl } = req.body;

    console.log('Appearance update request:', { userId, robotId, imageUrl });

    // Validate input
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.log('Invalid imageUrl:', imageUrl);
      return res.status(400).json({ error: 'Invalid imageUrl' });
    }

    // Basic validation - must be a path to our assets
    if (!imageUrl.startsWith('/src/assets/robots/')) {
      console.log('Invalid image path:', imageUrl);
      return res.status(400).json({ error: 'Invalid image path' });
    }

    // Check robot ownership
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      console.log('Robot not found:', robotId);
      return res.status(404).json({ error: 'Robot not found' });
    }

    if (robot.userId !== userId) {
      console.log('Ownership mismatch:', { robotUserId: robot.userId, requestUserId: userId });
      return res.status(403).json({ error: 'You do not own this robot' });
    }

    console.log('Updating robot with imageUrl...');
    
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

    console.log('Robot updated successfully');

    res.json({
      success: true,
      robot: updatedRobot,
      message: 'Robot image updated successfully',
    });
  } catch (error) {
    console.error('Update robot appearance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent battles for a robot
// Get upcoming matches for a robot
router.get('/:id/upcoming-matches', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    // Verify robot exists and get battle readiness info
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
      include: {
        mainWeapon: true,
        offhandWeapon: true,
      },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
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
    const scheduledMatches = await prisma.scheduledMatch.findMany({
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
    const tournamentMatches = await prisma.tournamentMatch.findMany({
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
    const tagTeamMatches = await prisma.tagTeamMatch.findMany({
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
          scheduledTime: new Date().toISOString(), // Tournament matches don't have specific scheduled times
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
  } catch (error) {
    console.error('Upcoming matches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk upgrade robot attributes (atomic transaction)
router.post('/:id/upgrades', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { upgrades } = req.body;

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    if (!upgrades || typeof upgrades !== 'object' || Object.keys(upgrades).length === 0) {
      console.log('Invalid upgrades object:', upgrades);
      return res.status(400).json({ error: 'Upgrades object is required' });
    }

    // Get robot
    const robot = await prisma.robot.findFirst({
      where: {
        id: robotId,
        userId, // Ensure user owns this robot
      },
    });

    if (!robot) {
      return res.status(404).json({ error: 'Robot not found' });
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
      return res.status(404).json({ error: 'User not found' });
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
        return res.status(400).json({ error: `Invalid attribute: ${attribute}` });
      }

      const { currentLevel, plannedLevel } = upgrade as any;

      if (typeof currentLevel !== 'number' || typeof plannedLevel !== 'number') {
        return res.status(400).json({ error: `Invalid upgrade data for ${attribute}` });
      }

      if (plannedLevel <= currentLevel) {
        return res.status(400).json({ error: `Planned level must be greater than current level for ${attribute}` });
      }

      // Get current level from robot
      const robotCurrentLevelValue = robot[attribute as keyof typeof robot];
      const robotCurrentLevel = typeof robotCurrentLevelValue === 'number' 
        ? robotCurrentLevelValue 
        : (robotCurrentLevelValue as any).toNumber();

      // Verify current level matches
      if (Math.floor(robotCurrentLevel) !== Math.floor(currentLevel)) {
        return res.status(400).json({ 
          error: `Current level mismatch for ${attribute}. Expected ${Math.floor(robotCurrentLevel)}, got ${Math.floor(currentLevel)}` 
        });
      }

      // Check academy cap
      const academyType = attributeToAcademy[attribute];
      const academyLevel = academyLevels[academyType as keyof typeof academyLevels] || 0;
      const cap = getCapForLevel(academyLevel);

      if (plannedLevel > cap) {
        return res.status(400).json({ 
          error: `Attribute ${attribute} exceeds cap of ${cap}. Upgrade the corresponding academy to increase the cap.` 
        });
      }

      // Calculate cost for this attribute
      const discountPercent = trainingLevel * 5; // 5% per level
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
      return res.status(400).json({ 
        error: 'Insufficient credits',
        required: totalCost,
        current: user.currency,
      });
    }

    // Perform all upgrades in a single atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct currency
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - totalCost },
      });

      // Build update data object
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

      console.log(`[AttributeUpgrade] User ${userId} | Robot ${robotId} (${robot.name}) | Attributes: ${upgradeOperations.length} | Total Cost: ₡${totalCost.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

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
        console.log(`[AttributeUpgrade]   ${op.attribute} | ${op.fromLevel}→${op.toLevel} | ₡${op.cost.toLocaleString()}`);
      }
    } catch (logError) {
      console.error('[AttributeUpgrade] ERROR logging upgrades:', logError);
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
  } catch (error) {
    console.error('Bulk robot upgrade error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
