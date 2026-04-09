import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { validateRequest } from '../middleware/schemaValidator';

const router = express.Router();

// Get all available weapons
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    const weapons = await prisma.weapon.findMany({
      orderBy: { cost: 'asc' },
    });

    res.json(weapons);
});

export default router;
