/**
 * The Hall of Records payload (`GET /api/records`) and its cache.
 *
 * Building it runs ~30 queries, six of them sequential scans of
 * `battle_participants` (~1M rows on ACC); a cold build took 9–10 s there
 * (`request_metrics`, Nov 2026). Records only move when battles are fought, so
 * the payload is served from a `RefreshingCache`: a visitor never waits for a
 * rebuild once the cache is warm, and the server warms it at start-up.
 */
import logger from '../../config/logger';
import { RefreshingCache } from '../../lib/refreshingCache';
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
} from './recordsQueryService';

/** How old the payload may get before a request triggers a background rebuild. */
export const HALL_OF_RECORDS_TTL_MS = 5 * 60 * 1000;

export type HallOfRecordsPayload = Record<string, unknown>;

/** Build the full payload from the database. */
export async function buildHallOfRecords(): Promise<HallOfRecordsPayload> {
  const startedAt = Date.now();
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

  const result: HallOfRecordsPayload = {
    combat,
    upsets,
    career,
    economic,
    prestige,
    koth: kothRecords ?? { mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [], longestWinStreak: [], mostZoneTime: [], zoneDominator: [] },
    teamBattle: teamBattleRecords,
    grandMelee: grandMeleeRecords ?? { mostWins: [], mostKillsCareer: [] },
    winStreaks,
    timestamp: new Date().toISOString(),
  };

  // Include tournament champions sections only if data exists (R15.4)
  if (tournamentChampions.champions1v1.length > 0) result.tournamentChampions1v1 = tournamentChampions.champions1v1;
  if (tournamentChampions.champions2v2.length > 0) result.tournamentChampions2v2 = tournamentChampions.champions2v2;
  if (tournamentChampions.champions3v3.length > 0) result.tournamentChampions3v3 = tournamentChampions.champions3v3;

  logger.info(`[HallOfRecords] Built in ${Date.now() - startedAt}ms`);
  return result;
}

const cache = new RefreshingCache<HallOfRecordsPayload>(
  HALL_OF_RECORDS_TTL_MS,
  buildHallOfRecords,
  (error) => logger.error('[HallOfRecords] Background rebuild failed; serving the previous payload', { error }),
);

/** The cached payload; rebuilt in the background once older than the TTL. */
export function getHallOfRecords(): Promise<HallOfRecordsPayload> {
  return cache.get();
}

/** Build the payload ahead of the first visitor (server start-up). Never throws. */
export async function warmHallOfRecords(): Promise<void> {
  try {
    await cache.refresh();
  } catch (error) {
    logger.error('[HallOfRecords] Warm-up failed; the first request will build it', { error });
  }
}

/**
 * Forget the cached payload, including a build in flight. The season rollover
 * calls this once it has purged the old season, so the Hall never serves the
 * previous season's records (and links to deleted robots and battles) under
 * the new season's heading; the next visitor waits for a fresh build.
 */
export function invalidateHallOfRecords(): void {
  cache.invalidate();
}
