import express, { Request, Response } from 'express';
import logger from '../config/logger';
import { validateRequest } from '../middleware/schemaValidator';
import {
  fetchCombatRecords,
  fetchUpsetRecords,
  fetchCareerRecords,
  fetchEconomicRecords,
  fetchPrestigeRecords,
  fetchKothRecords,
} from './records-queries';

const router = express.Router();

/**
 * GET /api/records
 * Get all Hall of Records statistics
 */
router.get('/', validateRequest({}), async (req: Request, res: Response) => {
  try {
    const [combat, upsets, career, economic, prestige, kothRecords] = await Promise.all([
      fetchCombatRecords(),
      fetchUpsetRecords(),
      fetchCareerRecords(),
      fetchEconomicRecords(),
      fetchPrestigeRecords(),
      fetchKothRecords(),
    ]);

    res.json({
      combat,
      upsets,
      career,
      economic,
      prestige,
      koth: kothRecords ?? { mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [], longestWinStreak: [], mostZoneTime: [], bestPlacement: [], zoneDominator: [] },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Records] Error fetching records:', error);
    res.status(500).json({
      error: 'Failed to retrieve hall of records',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
