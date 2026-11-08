/**
 * League standings pages (`/league-standings`): one tier, or one instance of
 * it, ranked by LP (entity id breaks ties, as in the planner), with each row's
 * zone and status taken from the executor's tier plan.
 *
 * Robot modes: league_1v1, koth, grand_melee (`GET /api/leagues/:tier/standings`).
 * Team modes: league_2v2, league_3v3, tag_team (`/api/team-battles/leagues/...`).
 */
import prisma from '../../lib/prisma';
import type { Prisma, StandingsMode, StableType } from '../../../generated/prisma';
import { getLeagueTierPreview } from './league-rebalancing-preview';
import { getLeagueRulesForMode } from './league-rules';
import { buildLeagueZoneMeta, type LeagueZoneMeta } from './league-zone-meta';
import { buildStandingStatuses, type StandingStatus } from './standing-status';

export const ROBOT_LEAGUE_MODES = ['league_1v1', 'koth', 'grand_melee'] as const;
export type RobotLeagueMode = typeof ROBOT_LEAGUE_MODES[number];
export const TEAM_LEAGUE_MODES = ['league_2v2', 'league_3v3', 'tag_team'] as const;
export type TeamLeagueMode = typeof TEAM_LEAGUE_MODES[number];

/** Subscription event that keeps an entity of this mode entered. */
const SUBSCRIPTION_EVENT: Record<RobotLeagueMode | TeamLeagueMode, string> = {
  league_1v1: 'league_1v1',
  koth: 'koth',
  grand_melee: 'grand_melee',
  league_2v2: 'league_2v2',
  league_3v3: 'league_3v3',
  tag_team: 'tag_team',
};

export interface StandingsPageQuery {
  tier: string;
  instance?: string;
  page: number;
  perPage: number;
}

export interface StandingsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PageRows<T> {
  rows: T[];
  pagination: StandingsPagination;
  zoneMeta: LeagueZoneMeta;
}

type ZoneLabel = 'promotion' | 'demotion' | null;

interface RowContext {
  rank: number;
  eligible: boolean;
  zone: ZoneLabel;
  status: StandingStatus | null;
}

/** Loads one page of standings rows plus the tier plan, and the per-row context. */
async function loadStandingsPage(mode: StandingsMode, query: StandingsPageQuery) {
  const rules = getLeagueRulesForMode(mode);
  const where: Prisma.StandingWhereInput = {
    mode,
    tier: query.tier,
    ...(query.instance ? { leagueInstanceId: query.instance } : {}),
  };
  const [total, standingRows, preview] = await Promise.all([
    prisma.standing.count({ where }),
    prisma.standing.findMany({
      where,
      orderBy: [{ leaguePoints: 'desc' }, { entityId: 'asc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    getLeagueTierPreview(mode, query.tier, rules, query.instance),
  ]);
  const statuses = buildStandingStatuses(preview, rules);

  const contextFor = (entityId: number, cyclesInTier: number, index: number): RowContext => ({
    rank: (query.page - 1) * query.perPage + index + 1,
    eligible: cyclesInTier >= rules.minCyclesForRebalancing,
    zone: preview.effectivePromotionEntityIds.has(entityId)
      ? 'promotion'
      : preview.demotionEntityIds.has(entityId) ? 'demotion' : null,
    status: statuses.get(entityId) ?? null,
  });

  return {
    standingRows,
    contextFor,
    pagination: {
      page: query.page,
      pageSize: query.perPage,
      total,
      totalPages: Math.ceil(total / query.perPage),
    },
    zoneMeta: buildLeagueZoneMeta(preview, rules, query.tier, query.instance),
  };
}

export interface RobotStandingRow {
  rank: number;
  id: number;
  name: string;
  elo: number;
  leaguePoints: number;
  wins: number;
  draws: number;
  losses: number;
  totalBattles: number;
  currentHP: number;
  maxHP: number;
  fame: number;
  userId: number;
  cyclesInCurrentLeague: number;
  eligible: boolean;
  isSubscribed: boolean;
  user: { username: string; stableName: string | null; stableType: StableType };
  /** Moves at the next rebalance: 'promotion' / 'demotion' (kept for older clients; see `status`). */
  zone: ZoneLabel;
  status: StandingStatus | null;
}

export async function getRobotLeagueStandings(
  mode: RobotLeagueMode,
  query: StandingsPageQuery,
): Promise<PageRows<RobotStandingRow>> {
  const { standingRows, contextFor, pagination, zoneMeta } = await loadStandingsPage(mode, query);
  const robotIds = standingRows.map((s) => s.entityId);

  const [robots, activeSubscriptions] = await Promise.all([
    prisma.robot.findMany({
      where: { id: { in: robotIds } },
      select: {
        id: true, name: true, elo: true, currentHP: true, maxHP: true, fame: true,
        user: { select: { id: true, username: true, stableName: true, stableType: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { robotId: { in: robotIds }, eventType: SUBSCRIPTION_EVENT[mode], status: 'active' },
      select: { robotId: true },
    }),
  ]);
  const robotMap = new Map(robots.map((r) => [r.id, r]));
  const subscribed = new Set(activeSubscriptions.map((s) => s.robotId));

  const rows = standingRows.map((s, index): RobotStandingRow => {
    const robot = robotMap.get(s.entityId);
    const context = contextFor(s.entityId, s.cyclesInTier, index);
    return {
      rank: context.rank,
      id: s.entityId,
      name: robot?.name ?? `Robot #${s.entityId}`,
      elo: robot?.elo ?? 0,
      leaguePoints: s.leaguePoints,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      totalBattles: s.totalMatches ?? (s.wins + s.losses + s.draws),
      currentHP: robot?.currentHP ?? 0,
      maxHP: robot?.maxHP ?? 100,
      fame: robot?.fame ?? 0,
      userId: robot?.user?.id ?? 0,
      cyclesInCurrentLeague: s.cyclesInTier,
      eligible: context.eligible,
      isSubscribed: subscribed.has(s.entityId),
      user: {
        username: robot?.user?.username ?? 'Unknown',
        stableName: robot?.user?.stableName ?? null,
        // Spec #55 R1.7: drives the Automaton_Badge.
        stableType: robot?.user?.stableType ?? 'human',
      },
      zone: context.zone,
      status: context.status,
    };
  });

  return { rows, pagination, zoneMeta };
}

export interface TeamStandingMember {
  robotId: number;
  robotName: string;
  robotElo: number;
  slotIndex: number;
}

export interface TeamStandingRow {
  rank: number;
  teamId: number;
  teamName: string;
  stableId: number;
  stableName: string;
  stableType: StableType;
  leaguePoints: number;
  /** Sum of the members' robot ELO (what matchmaking uses). */
  combinedElo: number;
  tier: string;
  leagueInstanceId: string;
  wins: number;
  losses: number;
  draws: number;
  cyclesInTier: number;
  eligible: boolean;
  isSubscribed: boolean;
  zone: ZoneLabel;
  status: StandingStatus | null;
  members: TeamStandingMember[];
}

export async function getTeamLeagueStandings(
  mode: TeamLeagueMode,
  query: StandingsPageQuery,
): Promise<PageRows<TeamStandingRow>> {
  const { standingRows, contextFor, pagination, zoneMeta } = await loadStandingsPage(mode, query);
  const teamIds = standingRows.map((s) => s.entityId);

  const teams = await prisma.teamBattle.findMany({
    where: { id: { in: teamIds } },
    select: {
      id: true,
      teamName: true,
      stableId: true,
      stable: { select: { stableName: true, username: true, stableType: true } },
      members: {
        select: { slotIndex: true, robot: { select: { id: true, name: true, elo: true } } },
        orderBy: { slotIndex: 'asc' },
      },
    },
  });
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const memberIds = teams.flatMap((t) => t.members.map((m) => m.robot.id));
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { robotId: { in: memberIds }, eventType: SUBSCRIPTION_EVENT[mode], status: 'active' },
    select: { robotId: true },
  });
  const subscribed = new Set(activeSubscriptions.map((s) => s.robotId));

  const rows = standingRows.map((s, index): TeamStandingRow => {
    const team = teamMap.get(s.entityId);
    const context = contextFor(s.entityId, s.cyclesInTier, index);
    return {
      rank: context.rank,
      teamId: s.entityId,
      teamName: team?.teamName ?? `Team #${s.entityId}`,
      stableId: team?.stableId ?? 0,
      stableName: team?.stable?.stableName || team?.stable?.username || 'Unknown',
      // Spec #55 R1.7: drives the Automaton_Badge.
      stableType: team?.stable?.stableType ?? 'human',
      leaguePoints: s.leaguePoints,
      combinedElo: team ? team.members.reduce((sum, m) => sum + m.robot.elo, 0) : 0,
      tier: s.tier,
      leagueInstanceId: s.leagueInstanceId,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      cyclesInTier: s.cyclesInTier,
      eligible: context.eligible,
      isSubscribed: team ? team.members.every((m) => subscribed.has(m.robot.id)) : false,
      zone: context.zone,
      status: context.status,
      members: team?.members.map((m) => ({
        robotId: m.robot.id,
        robotName: m.robot.name,
        robotElo: m.robot.elo,
        slotIndex: m.slotIndex,
      })) ?? [],
    };
  });

  return { rows, pagination, zoneMeta };
}
