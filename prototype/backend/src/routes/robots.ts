import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { canEquipToSlot, validateOffhandEquipment, isSlotAvailable } from '../utils/weaponValidation';
import { calculateMaxHP, calculateMaxShield } from '../utils/robotCalculations';

const router = express.Router();
const prisma = new PrismaClient();

const ROBOT_CREATION_COST = 500000;
const MAX_ATTRIBUTE_LEVEL = 50;

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

// Upgrade a robot attribute
router.put('/:id/upgrade', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { attribute } = req.body;

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    if (!attribute || typeof attribute !== 'string') {
      return res.status(400).json({ error: 'Attribute name is required' });
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

    // Validate attribute exists
    const validAttributes = [
      'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
      'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
      'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
      'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
      'syncProtocols', 'supportSystems', 'formationTactics',
    ];

    if (!validAttributes.includes(attribute)) {
      return res.status(400).json({ error: 'Invalid attribute name' });
    }

    // Get current level (convert Decimal to number)
    const currentLevelValue = robot[attribute as keyof typeof robot];
    const currentLevel = typeof currentLevelValue === 'number' 
      ? currentLevelValue 
      : (currentLevelValue as any).toNumber();

    if (typeof currentLevel !== 'number' || currentLevel >= MAX_ATTRIBUTE_LEVEL) {
      return res.status(400).json({ error: 'Attribute is already at maximum level or invalid' });
    }

    // Calculate upgrade cost based on floor of current level: (floor(current_level) + 1) × 1,000
    // This means 25.50 upgrades to 26.50 for the same cost as 25 to 26
    const baseCost = (Math.floor(currentLevel) + 1) * 1000;

    // Get user's current currency and Training Facility level
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        facilities: {
          where: { facilityType: 'training_facility' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Apply Training Facility discount
    const trainingLevel = user.facilities[0]?.level || 0;
    const discountPercent = trainingLevel * 5; // 5% per level
    const upgradeCost = Math.floor(baseCost * (1 - discountPercent / 100));

    // Get cap for academy level (from STABLE_SYSTEM.md)
    const getCapForLevel = (level: number): number => {
      const capMap: { [key: number]: number } = {
        0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
        5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
      };
      return capMap[level] || 10;
    };

    // Check Training Academy cap for this attribute
    const academyType = attributeToAcademy[attribute];
    let attributeCap = 10; // Base cap without any academy (Level 0)
    let academyName = 'Training Academy';

    if (academyType) {
      const academy = await prisma.facility.findFirst({
        where: {
          userId,
          facilityType: academyType,
        },
      });

      const academyLevel = academy?.level || 0;
      attributeCap = getCapForLevel(academyLevel);
      
      // Format academy name for error message
      academyName = academyType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace('Ai ', 'AI '); // Fix AI capitalization
    }

    const newLevel = Math.floor(currentLevel) + 1;

    // Enforce cap for ALL attributes (base 10, or increased by academy)
    if (newLevel > attributeCap) {
      return res.status(400).json({ 
        error: `Attribute cap of ${attributeCap} reached. Upgrade ${academyName} to increase cap.` 
      });
    }

    // Check if user has enough currency
    if (user.currency < upgradeCost) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Perform upgrade in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct currency
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - upgradeCost },
      });

      // Upgrade attribute (increment by 1, preserving decimal part from bonuses)
      const updatedRobot = await tx.robot.update({
        where: { id: robotId },
        data: {
          [attribute]: Math.floor(currentLevel) + 1,
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

      // If hullIntegrity or shieldCapacity was upgraded, recalculate maxHP/maxShield
      if (attribute === 'hullIntegrity' || attribute === 'shieldCapacity') {
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

    res.json({
      robot: result.robot,
      currency: result.user.currency,
      message: 'Attribute upgraded successfully',
    });
  } catch (error) {
    console.error('Robot upgrade error:', error);
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
    const discount = repairBayLevel * 5; // 5% per level

    // Get all user's robots (we'll filter by HP damage)
    const allRobots = await prisma.robot.findMany({
      where: { userId },
    });

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

export default router;
