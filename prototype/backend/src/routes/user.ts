import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        role: true,
        currency: true,
        prestige: true,
        stableName: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set stable name (first-time setup)
// TODO: Add rate limiting before production deployment
router.put('/stable-name', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { stableName } = req.body;

    if (!stableName || typeof stableName !== 'string') {
      return res.status(400).json({ error: 'Stable name is required' });
    }

    if (stableName.length < 1 || stableName.length > 100) {
      return res.status(400).json({ error: 'Stable name must be between 1 and 100 characters' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { stableName },
      select: {
        id: true,
        username: true,
        role: true,
        currency: true,
        prestige: true,
        stableName: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Stable name update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
