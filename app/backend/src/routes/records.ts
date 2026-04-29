import express, { Request, Response } from 'express';
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
});

export default router;
