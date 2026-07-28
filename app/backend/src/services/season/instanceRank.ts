/**
 * Instance_Rank computation (Spec #45 R7.6).
 *
 * A Standing's 1-based position when all Standings sharing the same mode, tier,
 * and leagueInstanceId are ordered by leaguePoints descending, then wins
 * descending, then entityId ascending. The final key guarantees determinism
 * under full ties.
 *
 * Generated_Stable entities are counted in the ordering, so an archived rank
 * states an entity's true league position rather than its position among
 * player-owned entities only.
 *
 * @module services/season/instanceRank
 */

import prisma from '../../lib/prisma';

/**
 * Key used to look up a computed rank: `${entityType}:${entityId}:${mode}`.
 *
 * The mode is part of the key because an entity holds one Standing per mode and
 * each is ranked within its own (mode, tier, instance) group. Keying on the
 * entity alone would let one mode's rank overwrite another's.
 */
export type RankKey = string;

/** Build the rank lookup key for an entity in one mode. */
export function rankKey(entityType: string, entityId: number, mode: string): RankKey {
  return `${entityType}:${entityId}:${mode}`;
}

/** Build the grouping key used to collect an entity's standings across modes. */
export function entityKey(entityType: string, entityId: number): string {
  return `${entityType}:${entityId}`;
}

/** A standing row reduced to what ranking and archiving need. */
export interface RankableStanding {
  entityType: string;
  entityId: number;
  mode: string;
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  bestWinStreak: number;
}

/** Group identifier for a league instance. */
export function groupKey(mode: string, tier: string, leagueInstanceId: string): string {
  return `${mode}|${tier}|${leagueInstanceId}`;
}

/**
 * Order a group of standings by the canonical ranking keys.
 * Exported for property testing — it is the whole of the ordering contract.
 */
export function orderStandings<T extends RankableStanding>(group: T[]): T[] {
  return [...group].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.entityId - b.entityId;
  });
}

/**
 * Assign 1..N ranks within each (mode, tier, instance) group.
 * Returns a Map from group key to a Map from rank key to rank.
 */
export function computeRanks(standings: RankableStanding[]): Map<RankKey, number> {
  const groups = new Map<string, RankableStanding[]>();
  for (const s of standings) {
    const key = groupKey(s.mode, s.tier, s.leagueInstanceId);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(s);
    } else {
      groups.set(key, [s]);
    }
  }

  const ranks = new Map<RankKey, number>();
  for (const group of groups.values()) {
    const ordered = orderStandings(group);
    ordered.forEach((s, index) => {
      ranks.set(rankKey(s.entityType, s.entityId, s.mode), index + 1);
    });
  }
  return ranks;
}

/**
 * Load every standing and compute Instance_Rank for all of them in one pass.
 *
 * One query, grouped in memory — deliberately not one query per group, which
 * would be an N+1 against a table that holds a row per entity per mode.
 */
export async function loadStandingsWithRanks(): Promise<{
  standings: RankableStanding[];
  ranks: Map<RankKey, number>;
}> {
  const rows = await prisma.standing.findMany({
    select: {
      entityType: true,
      entityId: true,
      mode: true,
      tier: true,
      leagueInstanceId: true,
      leaguePoints: true,
      wins: true,
      losses: true,
      draws: true,
      bestWinStreak: true,
    },
  });

  const standings: RankableStanding[] = rows.map((r) => ({
    entityType: r.entityType,
    entityId: r.entityId,
    mode: String(r.mode),
    tier: r.tier,
    leagueInstanceId: r.leagueInstanceId,
    leaguePoints: r.leaguePoints,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    bestWinStreak: r.bestWinStreak,
  }));

  return { standings, ranks: computeRanks(standings) };
}
