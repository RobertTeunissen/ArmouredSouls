import express, { Request, Response } from 'express';
import { validateRequest } from '../middleware/schemaValidator';
import { TimedCache } from '../lib/timedCache';
import {
  fetchCombatRecords,
  fetchUpsetRecords,
  fetchCareerRecords,
  fetchEconomicRecords,
  fetchPrestigeRecords,
  fetchKothRecords,
  fetchTeamBattleRecords,
} from './records-queries';

const router = express.Router();

// Cache records for 5 minutes — data only changes after a cycle runs
const recordsCache = new TimedCache<Record<string, unknown>>(5 * 60 * 1000);

/**
 * GET /api/records
 * Get all Hall of Records statistics
 */
router.get('/', validateRequest({}), async (req: Request, res: Response) => {
  const cached = recordsCache.get();
  if (cached) {
    res.json(cached);
    return;
  }

  const [combat, upsets, career, economic, prestige, kothRecords, teamBattleRecords] = await Promise.all([
    fetchCombatRecords(),
    fetchUpsetRecords(),
    fetchCareerRecords(),
    fetchEconomicRecords(),
    fetchPrestigeRecords(),
    fetchKothRecords(),
    fetchTeamBattleRecords(),
  ]);

  const result = {
    combat,
    upsets,
    career,
    economic,
    prestige,
    koth: kothRecords ?? { mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [], longestWinStreak: [], mostZoneTime: [], bestPlacement: [], zoneDominator: [] },
    teamBattle: teamBattleRecords,
    timestamp: new Date().toISOString(),
  };

  recordsCache.set(result);
  res.json(result);
});

export default router;
