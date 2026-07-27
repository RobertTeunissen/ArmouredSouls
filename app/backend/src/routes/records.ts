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
  fetchTournamentChampions,
  fetchGrandMeleeRecords,
  fetchWinStreakRecords,
} from '../services/records/recordsQueryService';

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

  const [combat, upsets, career, economic, prestige, kothRecords, teamBattleRecords, tournamentChampions, grandMeleeRecords, winStreaks] = await Promise.all([
    fetchCombatRecords(),
    fetchUpsetRecords(),
    fetchCareerRecords(),
    fetchEconomicRecords(),
    fetchPrestigeRecords(),
    fetchKothRecords(),
    fetchTeamBattleRecords(),
    fetchTournamentChampions(),
    fetchGrandMeleeRecords(),
    fetchWinStreakRecords(),
  ]);

  const result: Record<string, unknown> = {
    combat,
    upsets,
    career,
    economic,
    prestige,
    koth: kothRecords ?? { mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [], longestWinStreak: [], mostZoneTime: [], zoneDominator: [] },
    teamBattle: teamBattleRecords,
    grandMelee: grandMeleeRecords ?? { mostWins: [], highestLp: [], mostKillsCareer: [] },
    winStreaks,
    timestamp: new Date().toISOString(),
  };

  // Include tournament champions sections only if data exists (R15.4)
  if (tournamentChampions.champions1v1.length > 0) {
    result.tournamentChampions1v1 = tournamentChampions.champions1v1;
  }
  if (tournamentChampions.champions2v2.length > 0) {
    result.tournamentChampions2v2 = tournamentChampions.champions2v2;
  }
  if (tournamentChampions.champions3v3.length > 0) {
    result.tournamentChampions3v3 = tournamentChampions.champions3v3;
  }

  recordsCache.set(result);
  res.json(result);
});

export default router;
