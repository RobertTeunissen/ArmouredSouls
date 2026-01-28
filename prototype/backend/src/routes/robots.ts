import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

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
      // Initialize HP and Shield based on formulas: maxHP = hullIntegrity × 10, maxShield = shieldCapacity × 2
      const hullIntegrity = 1; // Default level
      const shieldCapacity = 1; // Default level
      const maxHP = hullIntegrity * 10;
      const maxShield = shieldCapacity * 2;
      
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific robot by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
    }

    const robot = await prisma.robot.findFirst({
      where: {
        id: robotId,
        userId, // Ensure user owns this robot
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
      return res.status(404).json({ error: 'Robot not found' });
    }

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

    // Get current level
    const currentLevel = robot[attribute as keyof typeof robot] as number;

    if (typeof currentLevel !== 'number' || currentLevel >= MAX_ATTRIBUTE_LEVEL) {
      return res.status(400).json({ error: 'Attribute is already at maximum level or invalid' });
    }

    // Calculate upgrade cost: (current_level + 1) × 1,000
    const baseCost = (currentLevel + 1) * 1000;

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

    // Check Training Academy cap for this attribute
    const academyType = attributeToAcademy[attribute];
    const academy = await prisma.facility.findFirst({
      where: {
        userId,
        facilityType: academyType,
      },
    });

    const academyLevel = academy?.level || 0;
    const attributeCap = 50 + (academyLevel * 5); // Base cap 50, +5 per academy level
    const newLevel = currentLevel + 1;

    if (newLevel > attributeCap) {
      return res.status(400).json({ 
        error: `Attribute cap reached. Upgrade ${academyType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} to increase cap. Current cap: ${attributeCap}` 
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

      // Upgrade attribute
      const updatedRobot = await tx.robot.update({
        where: { id: robotId },
        data: {
          [attribute]: currentLevel + 1,
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

// Equip a weapon to a robot (from user's weapon inventory)
router.put('/:id/weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { weaponInventoryId } = req.body;

    if (isNaN(robotId)) {
      return res.status(400).json({ error: 'Invalid robot ID' });
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

    // If weaponInventoryId is null, unequip weapon
    if (weaponInventoryId === null) {
      const updatedRobot = await prisma.robot.update({
        where: { id: robotId },
        data: { weaponInventoryId: null },
        include: {
          weaponInventory: {
            include: {
              weapon: true,
            },
          },
        },
      });

      return res.json({
        robot: updatedRobot,
        message: 'Weapon unequipped successfully',
      });
    }

    // Validate weapon inventory exists and belongs to user
    const weaponInvIdNum = parseInt(weaponInventoryId);
    if (isNaN(weaponInvIdNum)) {
      return res.status(400).json({ error: 'Invalid weapon inventory ID' });
    }

    const weaponInv = await prisma.weaponInventory.findFirst({
      where: {
        id: weaponInvIdNum,
        userId, // Ensure user owns this weapon
      },
      include: {
        weapon: true,
      },
    });

    if (!weaponInv) {
      return res.status(404).json({ error: 'Weapon not found in your inventory' });
    }

    // Equip weapon to robot
    const updatedRobot = await prisma.robot.update({
      where: { id: robotId },
      data: { weaponInventoryId: weaponInvIdNum },
      include: {
        weaponInventory: {
          include: {
            weapon: true,
          },
        },
      },
    });

    res.json({
      robot: updatedRobot,
      message: 'Weapon equipped successfully',
    });
  } catch (error) {
    console.error('Robot weapon equip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
