import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { getIdempotencyKey, idempotencyHeadersSchema } from '../utils/idempotency';
import { upgradeFacility } from '../services/economy/facilityUpgradeService';
import { achievementService } from '../services/achievement';
import { getFacilityOverview } from '../services/economy/facilityOverviewService';
import type { UnlockedAchievement } from '../shared/types';

const router = express.Router();

// --- Zod schemas for facility routes ---

const upgradeBodySchema = z.object({
  facilityType: z.string().min(1).max(50),
});

// Get all facility types and user's current levels
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    res.json(await getFacilityOverview(req.user!.userId));
});

// Upgrade a facility
router.post('/upgrade', authenticateToken, ...validated({ body: upgradeBodySchema, headers: idempotencyHeadersSchema }, async (req: AuthRequest, res: Response, { body }) => {
    const userId = req.user!.userId;
    const { facilityType } = body;
    const requestKey = getIdempotencyKey(req.headers);

    // Spec #55 task 2.1: the purchase itself lives in facilityUpgradeService.
    const result = await upgradeFacility(userId, facilityType, requestKey);

    if (result.replayed) {
      res.json({ ...result.response, achievementUnlocks: [], replayed: true });
      return;
    }

    res.json({
      facility: result.facility,
      currency: result.currency,
      message: result.message,
      achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
        try {
          return await achievementService.checkAndAward(userId, null, {
            type: 'facility_upgraded',
            data: { facilityType, newLevel: result.newLevel },
          });
        } catch { return []; }
      })(),
    });
}));

export default router;
