import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = express.Router();

// Get all available weapons
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const weapons = await prisma.weapon.findMany({
      orderBy: { cost: 'asc' },
    });

    res.json(weapons);
  } catch (error) {
    console.error('Weapons list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
