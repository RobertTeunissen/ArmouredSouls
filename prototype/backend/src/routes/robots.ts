import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getRosterLimit } from '../config/facilities';

const router = express.Router();
const prisma = new PrismaClient();

const ROBOT_CREATION_COST = 500000;
const MAX_ATTRIBUTE_LEVEL = 50;

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
        weaponInventory: {
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
        weaponInventory: {
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

    if (name.length < 1 || name.length > 100) {
      return res.status(400).json({ error: 'Robot name must be between 1 and 100 characters' });
    }

    // Get user's current currency and facilities
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        facilities: {
          where: { facilityType: 'roster_expansion' },
        },
        robots: true, // Get current robots to check count
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check roster expansion limit
    const rosterExpansionLevel = user.facilities[0]?.level || 0;
    const maxRobots = getRosterLimit(rosterExpansionLevel);
    const currentRobotCount = user.robots.length;

    if (currentRobotCount >= maxRobots) {
      return res.status(400).json({ 
        error: `Roster limit reached. You have ${currentRobotCount} robot(s) and can have a maximum of ${maxRobots}. Upgrade your Roster Expansion facility to create more robots.` 
      });
    }

    // Check if user has enough currency
    if (user.currency < ROBOT_CREATION_COST) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Create robot in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct currency
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - ROBOT_CREATION_COST },
      });

      // Create robot with all attributes at level 1 (defaults in schema)
      const robot = await tx.robot.create({
        data: {
          userId,
          name,
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

// Equip weapons to a robot (from user's weapon inventory)
router.put('/:id/weapon', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const robotId = parseInt(req.params.id);
    const { mainWeaponId, offhandWeaponId, loadoutType } = req.body;

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

    // Validate loadout type if provided
    const validLoadoutTypes = ['single', 'weapon+shield', 'two-handed', 'dual-wield'];
    if (loadoutType && !validLoadoutTypes.includes(loadoutType)) {
      return res.status(400).json({ error: 'Invalid loadout type' });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (loadoutType !== undefined) {
      updateData.loadoutType = loadoutType;
    }

    // Handle main weapon
    if (mainWeaponId !== undefined) {
      if (mainWeaponId === null) {
        updateData.mainWeaponId = null;
      } else {
        const mainWeaponIdNum = parseInt(mainWeaponId);
        if (isNaN(mainWeaponIdNum)) {
          return res.status(400).json({ error: 'Invalid main weapon ID' });
        }

        // Validate weapon belongs to user
        const weaponInv = await prisma.weaponInventory.findFirst({
          where: {
            id: mainWeaponIdNum,
            userId,
          },
        });

        if (!weaponInv) {
          return res.status(404).json({ error: 'Main weapon not found in your inventory' });
        }

        updateData.mainWeaponId = mainWeaponIdNum;
      }
    }

    // Handle offhand weapon
    if (offhandWeaponId !== undefined) {
      if (offhandWeaponId === null) {
        updateData.offhandWeaponId = null;
      } else {
        const offhandWeaponIdNum = parseInt(offhandWeaponId);
        if (isNaN(offhandWeaponIdNum)) {
          return res.status(400).json({ error: 'Invalid offhand weapon ID' });
        }

        // Validate weapon belongs to user
        const weaponInv = await prisma.weaponInventory.findFirst({
          where: {
            id: offhandWeaponIdNum,
            userId,
          },
        });

        if (!weaponInv) {
          return res.status(404).json({ error: 'Offhand weapon not found in your inventory' });
        }

        updateData.offhandWeaponId = offhandWeaponIdNum;
      }
    }

    // Update robot
    const updatedRobot = await prisma.robot.update({
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

    res.json({
      robot: updatedRobot,
      message: 'Weapon loadout updated successfully',
    });
  } catch (error) {
    console.error('Robot weapon equip error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
