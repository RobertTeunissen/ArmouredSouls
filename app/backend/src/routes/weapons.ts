import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { validateRequest } from '../middleware/schemaValidator';
import { TimedCache } from '../lib/timedCache';

const router = express.Router();

// Cache weapons for 30 minutes — catalog only changes on deploy/seed
const weaponsCache = new TimedCache<unknown[]>(30 * 60 * 1000);

// Get all available weapons
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const cached = weaponsCache.get();
    if (cached) {
      res.set('Cache-Control', 'public, max-age=1800');
      res.json(cached);
      return;
    }

    const weapons = await prisma.weapon.findMany({
      orderBy: { cost: 'asc' },
    });

    weaponsCache.set(weapons);
    res.set('Cache-Control', 'public, max-age=1800');
    res.json(weapons);
});

export default router;
