/**
 * Read models behind the player team routes (`routes/teamBattles.ts`): the
 * stable's teams with standings and lock state, a team-mode tier's instances,
 * and a robot's team league history. Moved out of the route file; the response
 * shapes are unchanged.
 */
import prisma from '../../lib/prisma';
import type { StandingsMode } from '../../../generated/prisma';
import { MAX_TEAMS_PER_INSTANCE } from './teamBattleAdapter';
import { getEntityHistory } from '../league/leagueHistoryService';

const TEAM_MEMBER_ROBOT_SELECT = {
  id: true,
  name: true,
  elo: true,
  currentHP: true,
  maxHP: true,
  currentShield: true,
  maxShield: true,
  loadoutType: true,
  mainWeaponId: true,
  offhandWeaponId: true,
  subscriptions: { select: { eventType: true, status: true } },
} as const;

/**
 * The stable's teams (optionally only 2v2 or 3v3) with members in slot order,
 * `isLockedForBattle` when a scheduled match includes the team, and LP / tier /
 * record from `standings` (null tier and LP while the team is Unranked).
 */
export async function listStableTeams(userId: number, teamSize?: number) {
  const teams = await prisma.teamBattle.findMany({
    where: { stableId: userId, ...(teamSize === 2 || teamSize === 3 ? { teamSize } : {}) },
    include: {
      members: {
        include: { robot: { select: TEAM_MEMBER_ROBOT_SELECT } },
        orderBy: { slotIndex: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) return [];

  // One grouped count instead of one count per team.
  const [scheduled, teamStandings] = await Promise.all([
    prisma.scheduledMatchParticipant.groupBy({
      by: ['participantId'],
      where: { participantType: 'team', participantId: { in: teamIds }, scheduledMatch: { status: 'scheduled' } },
      _count: { _all: true },
    }),
    prisma.standing.findMany({
      where: { entityType: 'team', entityId: { in: teamIds } },
      select: { entityId: true, mode: true, leaguePoints: true, wins: true, losses: true, draws: true, tier: true, leagueInstanceId: true, cyclesInTier: true },
    }),
  ]);
  const lockedTeamIds = new Set(scheduled.filter((row) => row._count._all > 0).map((row) => row.participantId));

  const standingsByTeam = new Map<number, Map<string, typeof teamStandings[number]>>();
  for (const s of teamStandings) {
    if (!standingsByTeam.has(s.entityId)) standingsByTeam.set(s.entityId, new Map());
    standingsByTeam.get(s.entityId)!.set(s.mode, s);
  }

  return teams.map((team) => {
    const teamStandingsMap = standingsByTeam.get(team.id);
    const leagueStanding = teamStandingsMap?.get(team.teamSize === 2 ? 'league_2v2' : 'league_3v3');
    const tagTeamStanding = teamStandingsMap?.get('tag_team');

    // A team has no row in a mode until it is complete and every member is
    // subscribed; tier, instance and LP are then null (shown as Unranked).
    return {
      ...team,
      isLockedForBattle: lockedTeamIds.has(team.id),
      // Override legacy columns with standings data (source of truth, Spec #40)
      teamLp: leagueStanding?.leaguePoints ?? null,
      teamLeague: leagueStanding?.tier ?? null,
      teamLeagueId: leagueStanding?.leagueInstanceId ?? null,
      cyclesInLeague: leagueStanding?.cyclesInTier ?? 0,
      totalLeagueWins: leagueStanding?.wins ?? 0,
      totalLeagueLosses: leagueStanding?.losses ?? 0,
      totalLeagueDraws: leagueStanding?.draws ?? 0,
      tagTeamLp: tagTeamStanding?.leaguePoints ?? null,
      tagTeamLeague: tagTeamStanding?.tier ?? null,
      tagTeamLeagueId: tagTeamStanding?.leagueInstanceId ?? null,
      cyclesInTagTeamLeague: tagTeamStanding?.cyclesInTier ?? 0,
      totalTagTeamWins: tagTeamStanding?.wins ?? 0,
      totalTagTeamLosses: tagTeamStanding?.losses ?? 0,
      totalTagTeamDraws: tagTeamStanding?.draws ?? 0,
    };
  });
}

/** Instances of one team-mode tier with their population, in instance-number order. */
export async function listTeamInstances(mode: StandingsMode, tier: string) {
  const instances = await prisma.standing.groupBy({
    by: ['leagueInstanceId'],
    where: { mode, tier },
    _count: true,
  });
  const instanceNumber = (id: string): number => parseInt(id.split('_')[1] ?? '1', 10);
  return instances
    .sort((a, b) => instanceNumber(a.leagueInstanceId) - instanceNumber(b.leagueInstanceId))
    .map((inst) => ({
      leagueId: inst.leagueInstanceId,
      leagueTier: tier,
      currentTeams: inst._count,
      maxTeams: MAX_TEAMS_PER_INSTANCE,
    }));
}

type EntityHistory = Awaited<ReturnType<typeof getEntityHistory>>;

export interface RobotTeamLeagueHistory {
  teamId: number;
  teamSize: number;
  teamName: string;
  // null when the team has no standing in the mode yet (Unranked)
  currentLeague: string | null;
  currentLeagueId: string | null;
  currentLp: number | null;
  history: EntityHistory;
  tagTeamHistory: EntityHistory;
  tagTeamCurrentLeague: string | null;
  tagTeamCurrentLp: number | null;
}

/**
 * League history of every team the robot belongs to: the 2v2/3v3 league
 * history and current standing, plus Tag Team history and standing for 2v2 teams.
 */
export async function getRobotTeamLeagueHistory(robotId: number): Promise<RobotTeamLeagueHistory[]> {
  const memberships = await prisma.teamBattleMember.findMany({
    where: { robotId },
    include: { team: { select: { id: true, teamSize: true, teamName: true } } },
  });

  return Promise.all(memberships.map(async ({ team }): Promise<RobotTeamLeagueHistory> => {
    const leagueMode: StandingsMode = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
    const isDuo = team.teamSize === 2;
    const [history, standing, tagTeamHistory, tagTeamStanding] = await Promise.all([
      getEntityHistory('team_battle', team.id),
      prisma.standing.findFirst({ where: { entityType: 'team', entityId: team.id, mode: leagueMode } }),
      isDuo ? getEntityHistory('tag_team', team.id) : Promise.resolve([] as EntityHistory),
      isDuo ? prisma.standing.findFirst({ where: { entityType: 'team', entityId: team.id, mode: 'tag_team' } }) : Promise.resolve(null),
    ]);
    return {
      teamId: team.id,
      teamSize: team.teamSize,
      teamName: team.teamName,
      currentLeague: standing?.tier ?? null,
      currentLeagueId: standing?.leagueInstanceId ?? null,
      currentLp: standing?.leaguePoints ?? null,
      history,
      tagTeamHistory,
      tagTeamCurrentLeague: tagTeamStanding?.tier ?? null,
      tagTeamCurrentLp: tagTeamStanding?.leaguePoints ?? null,
    };
  }));
}
