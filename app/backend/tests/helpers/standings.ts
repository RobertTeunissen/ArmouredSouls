/**
 * Standings fixtures.
 *
 * `standings` is the single source of truth for tier, league instance and LP — Spec
 * #40 moved all three off `Robot` and `TeamBattle`. A fixture that creates robots or
 * teams without a standing row therefore creates entities that are in no competition
 * at all: `getInstancesForTier`, `runMatchmakingForTier`, `getEligibleTeams`,
 * `rebalanceLeagues` and the tag team orchestrator all scope their work from
 * `standings`, find nothing, and do nothing.
 *
 * That is what "Expected 331, Received 0" and "Expected 2, Received 0" mean throughout
 * the Heavy_Tier: not a broken service, a fixture that predates Spec #40.
 *
 * Use these helpers rather than writing `prisma.standing.create` inline, so the shape
 * of a correct fixture lives in one place.
 *
 * @module tests/helpers/standings
 */

import prisma from '../../src/lib/prisma';
import type { StandingsMode } from '../../generated/prisma';

export interface StandingFixtureOptions {
  /** Competitive tier. Defaults to 'bronze'. */
  tier?: string;
  /**
   * League instance. Defaults to `${tier}_1`.
   *
   * Pass this explicitly when a test asserts on instance distribution — that is the
   * whole subject of `leagueInstanceService` and the rebalancing suites.
   */
  leagueInstanceId?: string;
  leaguePoints?: number;
  /**
   * Cycles the entity has spent in its current tier. Defaults to 0.
   *
   * Promotion and demotion both gate on this: `leagueEngine` only considers entities
   * with `cyclesInTier >= minCyclesForRebalancing` (5 for the LP leagues, 10 for the
   * Placement_Modes). A fixture that leaves it at the default produces a tier in which
   * nobody is eligible, so `rebalanceLeagues` promotes and demotes nobody and a test
   * asserting a promotion count reads 0.
   */
  cyclesInTier?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  /**
   * Matches played, populated only for the Placement_Modes (`koth`, `grand_melee`).
   *
   * Also the source `streamingRevenueService` reads a robot's KotH match count from, since
   * `robots.totalBattles` covers every mode EXCEPT KotH.
   */
  totalMatches?: number;
}

function standingData(
  entityType: 'robot' | 'team',
  entityId: number,
  mode: StandingsMode,
  options: StandingFixtureOptions,
) {
  const tier = options.tier ?? 'bronze';
  return {
    entityType,
    entityId,
    mode,
    tier,
    leagueInstanceId: options.leagueInstanceId ?? `${tier}_1`,
    leaguePoints: options.leaguePoints ?? 0,
    cyclesInTier: options.cyclesInTier ?? 0,
    ...(options.totalMatches !== undefined ? { totalMatches: options.totalMatches } : {}),
    wins: options.wins ?? 0,
    losses: options.losses ?? 0,
    draws: options.draws ?? 0,
  };
}

/** Enter one robot into a mode's competition. */
export async function enterRobotStanding(
  robotId: number,
  mode: StandingsMode,
  options: StandingFixtureOptions = {},
): Promise<void> {
  await prisma.standing.create({ data: standingData('robot', robotId, mode, options) });
}

/** Enter one team into a mode's competition (`league_2v2`, `league_3v3`, `tag_team`). */
export async function enterTeamStanding(
  teamId: number,
  mode: StandingsMode,
  options: StandingFixtureOptions = {},
): Promise<void> {
  await prisma.standing.create({ data: standingData('team', teamId, mode, options) });
}

/**
 * Enter many robots into one mode and instance in a single insert.
 *
 * The bulk form exists because the rebalancing suites place hundreds of robots and a
 * per-robot round trip dominates their runtime.
 */
export async function enterRobotStandings(
  robotIds: readonly number[],
  mode: StandingsMode,
  options: StandingFixtureOptions = {},
): Promise<void> {
  if (robotIds.length === 0) return;
  await prisma.standing.createMany({
    data: robotIds.map((id) => standingData('robot', id, mode, options)),
  });
}
