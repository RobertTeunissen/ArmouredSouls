/**
 * Extra sections of the public stable page (stable page revamp):
 * per-robot standings in every tiered mode, the stable's latest results and
 * its best Hall of Records placements.
 *
 * Everything here is public competitive data: tiers, LP and records are
 * already shown on league standings, battle pages and the season archive.
 */

import prisma from '../../lib/prisma';
import {
  TEAM_STANDINGS_MODES,
  TIERED_STANDINGS_MODES,
  isPlacementMode,
  isPlayedStanding,
  tierRank,
  type TieredStandingsMode,
} from '../../shared/utils/automatonStandingsTier';
import type { PublicRobotStanding, RecentResult, ResultOutcome, StableAccolade } from '../../shared/types';

export const RECENT_RESULTS_LIMIT = 5;
const TOP_ACCOLADES_LIMIT = 5;

/** Participant rows read per wanted battle; a 3v3 battle has 3 of the stable's robots. */
const PARTICIPANTS_PER_BATTLE_SCAN = 6;

const HEAD_TO_HEAD_ROBOT_MODES = ['league_1v1', 'tournament_1v1'];

interface StandingRow {
  entityId: number;
  leagueInstanceId: string;
  mode: string;
  tier: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number | null;
}

function toPublicStanding(row: StandingRow, team: { id: number; name: string } | null): PublicRobotStanding {
  return {
    mode: row.mode as TieredStandingsMode,
    tier: row.tier,
    leaguePoints: row.leaguePoints,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    totalMatches: isPlacementMode(row.mode) ? row.totalMatches ?? 0 : null,
    teamName: team?.name ?? null,
    teamId: team?.id ?? null,
    leagueInstanceId: row.leagueInstanceId,
  };
}

/** Higher tier wins; equal tiers go to the higher LP. */
function better(a: PublicRobotStanding, b: PublicRobotStanding): PublicRobotStanding {
  const byTier = tierRank(a.tier) - tierRank(b.tier);
  if (byTier !== 0) return byTier > 0 ? a : b;
  return a.leaguePoints >= b.leaguePoints ? a : b;
}

/**
 * Played tiered standings per robot, in `TIERED_STANDINGS_MODES` order.
 * Team modes come from the robot's teams; a robot in two teams of the same
 * mode shows the better one. Unplayed rows (the Bronze row a subscription
 * creates before any match) are left out.
 */
export async function getRobotStandings(robotIds: readonly number[]): Promise<Map<number, PublicRobotStanding[]>> {
  const result = new Map<number, PublicRobotStanding[]>();
  if (robotIds.length === 0) return result;

  const select = {
    entityId: true, mode: true, tier: true, leaguePoints: true, leagueInstanceId: true,
    wins: true, losses: true, draws: true, totalMatches: true,
  } as const;

  const [robotRows, memberships] = await Promise.all([
    prisma.standing.findMany({
      where: { entityType: 'robot', entityId: { in: [...robotIds] }, mode: { in: [...TIERED_STANDINGS_MODES] } },
      select,
    }),
    prisma.teamBattleMember.findMany({
      where: { robotId: { in: [...robotIds] } },
      select: { robotId: true, teamId: true, team: { select: { teamName: true } } },
    }),
  ]);

  const teamIds = [...new Set(memberships.map((m) => m.teamId))];
  const teamRows = teamIds.length > 0
    ? await prisma.standing.findMany({
        where: { entityType: 'team', entityId: { in: teamIds }, mode: { in: [...TEAM_STANDINGS_MODES] } },
        select,
      })
    : [];

  const byRobot = new Map<number, Map<string, PublicRobotStanding>>();
  const add = (robotId: number, standing: PublicRobotStanding): void => {
    const modes = byRobot.get(robotId) ?? new Map<string, PublicRobotStanding>();
    const existing = modes.get(standing.mode);
    modes.set(standing.mode, existing ? better(existing, standing) : standing);
    byRobot.set(robotId, modes);
  };

  for (const row of robotRows) {
    if (isPlayedStanding(row)) add(row.entityId, toPublicStanding(row, null));
  }
  const teamRowsById = new Map<number, StandingRow[]>();
  for (const row of teamRows) {
    if (!isPlayedStanding(row)) continue;
    teamRowsById.set(row.entityId, [...(teamRowsById.get(row.entityId) ?? []), row]);
  }
  for (const member of memberships) {
    for (const row of teamRowsById.get(member.teamId) ?? []) {
      add(member.robotId, toPublicStanding(row, { id: member.teamId, name: member.team.teamName }));
    }
  }

  for (const robotId of robotIds) {
    const modes = byRobot.get(robotId);
    result.set(robotId, TIERED_STANDINGS_MODES.flatMap((mode) => {
      const standing = modes?.get(mode);
      return standing ? [standing] : [];
    }));
  }
  return result;
}

interface RecentParticipantRow {
  battleId: number;
  robotId: number;
  team: number;
  placement: number | null;
  eloBefore?: number;
  eloAfter?: number;
  battle: {
    battleType: string;
    leagueType: string;
    winnerId: number | null;
    winningSide: number | null;
    tournamentId: number | null;
    tournamentRound: number | null;
    createdAt: Date;
  };
}

/**
 * Outcome for one participant, using the same rules as the stable W/L/D
 * totals: 1v1 modes by winning robot, team modes by winning side. A team
 * battle with a winner but no recorded side predates Spec #39 and reads as
 * no outcome rather than a guessed loss.
 */
export function participantOutcome(row: RecentParticipantRow): ResultOutcome | null {
  const { battle } = row;
  if (isPlacementMode(battle.battleType)) return null;
  if (battle.winnerId === null) return 'draw';
  if (HEAD_TO_HEAD_ROBOT_MODES.includes(battle.battleType)) {
    return battle.winnerId === row.robotId ? 'win' : 'loss';
  }
  if (battle.winningSide === null) return null;
  return battle.winningSide === row.team ? 'win' : 'loss';
}

/** The stable's latest battles, newest first, one entry per robot that fought. */
export async function getRecentResults(
  robots: ReadonlyArray<{ id: number; name: string }>,
  limit: number = RECENT_RESULTS_LIMIT,
): Promise<RecentResult[]> {
  if (robots.length === 0) return [];
  const names = new Map(robots.map((r) => [r.id, r.name]));

  const rows: RecentParticipantRow[] = await prisma.battleParticipant.findMany({
    where: { robotId: { in: robots.map((r) => r.id) } },
    orderBy: { battleId: 'desc' },
    take: limit * PARTICIPANTS_PER_BATTLE_SCAN,
    select: {
      battleId: true, robotId: true, team: true, placement: true, eloBefore: true, eloAfter: true,
      battle: {
        select: {
          battleType: true, leagueType: true, winnerId: true, winningSide: true,
          tournamentId: true, tournamentRound: true, createdAt: true,
        },
      },
    },
  });

  const results: RecentResult[] = [];
  for (const row of rows) {
    let result = results.find((r) => r.battleId === row.battleId);
    if (!result) {
      if (results.length === limit) break;
      result = {
        battleId: row.battleId,
        battleType: row.battle.battleType,
        tier: row.battle.tournamentId === null ? row.battle.leagueType : null,
        tournamentRound: row.battle.tournamentRound,
        createdAt: row.battle.createdAt.toISOString(),
        entries: [],
      };
      results.push(result);
    }
    result.entries.push({
      robotId: row.robotId,
      robotName: names.get(row.robotId) ?? '',
      outcome: participantOutcome(row),
      placement: isPlacementMode(row.battle.battleType) ? row.placement : null,
      eloChange: (row.eloAfter ?? 0) - (row.eloBefore ?? 0),
    });
  }
  for (const result of results) {
    result.entries.sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0));
  }
  return results;
}

/**
 * Best Hall of Records placements across completed seasons. Tournament wins
 * are titles, counted in the header, and their `rank` is a list position
 * rather than a placement, so they are left out.
 */
export async function getTopAccolades(userId: number): Promise<StableAccolade[]> {
  return prisma.seasonAccolade.findMany({
    where: { userId, category: { not: 'tournamentChampion' } },
    orderBy: [{ rank: 'asc' }, { seasonNumber: 'desc' }, { category: 'asc' }],
    take: TOP_ACCOLADES_LIMIT,
    select: {
      seasonNumber: true, category: true, rank: true, subjectName: true,
      value: true, valueLabel: true, mode: true,
    },
  });
}
