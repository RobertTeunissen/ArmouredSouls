/**
 * The Hall of Records payload (`GET /api/records`) and its cache.
 *
 * Building it runs ~30 queries, six of them sequential scans of
 * `battle_participants` (~1M rows on ACC); a cold build took 9–10 s there
 * (`request_metrics`, Nov 2026). Records only move when battles are fought, so
 * the payload is served from a `RefreshingCache`: a visitor never waits for a
 * rebuild once the cache is warm, and the server warms it at start-up.
 *
 * There are two payloads, one per "Stables" filter (#595): every stable, and
 * players only (each entry with its place among every stable). Each has its
 * own cache, so a rebuild of one never holds up the other.
 */
import logger from '../../config/logger';
import { RefreshingCache } from '../../lib/refreshingCache';
import type { StableFilter } from '../standings/playerStables';
import { loadPlayerSets, type PlayerSets } from './recordScope';
import {
  fetchCombatRecords,
  fetchUpsetRecords,
  fetchCareerRecords,
  fetchEconomicRecords,
  fetchPrestigeRecords,
} from './recordsQueryService';
import {
  fetchKothRecords,
  fetchTeamBattleRecords,
  fetchTournamentChampions,
  fetchGrandMeleeRecords,
  fetchWinStreakRecords,
} from './modeRecordsQueries';

/** How old the payload may get before a request triggers a background rebuild. */
export const HALL_OF_RECORDS_TTL_MS = 5 * 60 * 1000;

export type HallOfRecordsPayload = Record<string, unknown>;

/**
 * Build one payload from the database: every stable's top 10 per record, or,
 * with `stables: 'players'`, the players' top 10 with their places.
 */
export async function buildHallOfRecords(stables: StableFilter = 'all'): Promise<HallOfRecordsPayload> {
  const startedAt = Date.now();
  const players: PlayerSets | undefined = stables === 'players' ? await loadPlayerSets() : undefined;
  const [combat, upsets, career, economic, prestige, kothRecords, teamBattleRecords, tournamentChampions, grandMeleeRecords, winStreaks] = await Promise.all([
    fetchCombatRecords(players),
    fetchUpsetRecords(players),
    fetchCareerRecords(players),
    fetchEconomicRecords(players),
    fetchPrestigeRecords(players),
    fetchKothRecords(players),
    fetchTeamBattleRecords(players),
    fetchTournamentChampions(players),
    fetchGrandMeleeRecords(players),
    fetchWinStreakRecords(players),
  ]);

  const result: HallOfRecordsPayload = {
    stables,
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

  logger.info(`[HallOfRecords] Built (${stables}) in ${Date.now() - startedAt}ms`);
  return result;
}

function payloadCache(stables: StableFilter): RefreshingCache<HallOfRecordsPayload> {
  return new RefreshingCache<HallOfRecordsPayload>(
    HALL_OF_RECORDS_TTL_MS,
    () => buildHallOfRecords(stables),
    (error) => logger.error(`[HallOfRecords] Background rebuild (${stables}) failed; serving the previous payload`, { error }),
  );
}

const caches: Record<StableFilter, RefreshingCache<HallOfRecordsPayload>> = {
  all: payloadCache('all'),
  players: payloadCache('players'),
};

/** The cached payload for one filter; rebuilt in the background once older than the TTL. */
export function getHallOfRecords(stables: StableFilter = 'all'): Promise<HallOfRecordsPayload> {
  return caches[stables].get();
}

/**
 * Build both payloads ahead of the first visitor (server start-up), one after
 * the other so the two builds do not compete for the database. Never throws.
 */
export async function warmHallOfRecords(): Promise<void> {
  for (const stables of ['all', 'players'] as const) {
    try {
      await caches[stables].refresh();
    } catch (error) {
      logger.error(`[HallOfRecords] Warm-up (${stables}) failed; the first request will build it`, { error });
    }
  }
}

/**
 * Forget both cached payloads, including builds in flight. The season rollover
 * calls this once it has purged the old season, so the Hall never serves the
 * previous season's records (and links to deleted robots and battles) under
 * the new season's heading; the next visitor waits for a fresh build.
 */
export function invalidateHallOfRecords(): void {
  caches.all.invalidate();
  caches.players.invalidate();
}
