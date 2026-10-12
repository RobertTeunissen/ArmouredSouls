/**
 * User Profile & Stats Service
 *
 * Handles profile retrieval and stable statistics aggregation.
 */

import prisma from '../../lib/prisma';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
import { StandingsMode } from '../../../generated/prisma';
import { getPrestigeRank } from '../../utils/prestigeUtils';
import { EventType } from '../common/eventLogger';
import type { StableMetric, RobotMetric } from '../../types/snapshotTypes';
import { getStableBattleOverlap } from './stable-battle-overlap';

const LEAGUE_HIERARCHY = [
  'bronze_4', 'bronze_3', 'bronze_2', 'bronze_1',
  'silver_4', 'silver_3', 'silver_2', 'silver_1',
  'gold_4', 'gold_3', 'gold_2', 'gold_1',
  'platinum_4', 'platinum_3', 'platinum_2', 'platinum_1',
  'diamond_4', 'diamond_3', 'diamond_2', 'diamond_1',
  'master', 'grandmaster', 'challenger',
];

export async function getUserProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      currency: true,
      prestige: true,
      createdAt: true,
      stableName: true,
      profileVisibility: true,
      notificationsBattle: true,
      notificationsLeague: true,
      themePreference: true,
      championshipTitles: true,
      championshipTitles1v1: true,
      championshipTitles2v2: true,
      championshipTitles3v3: true,
    },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  return {
    ...user,
    stableName: user.stableName || user.username,
  };
}

export async function getStableStats(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prestige: true },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  const robots = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true,
      elo: true,
      totalBattles: true,
      wins: true,
      losses: true,
      draws: true,
      currentHP: true,
      maxHP: true,
      mainWeapon: true,
    },
  });

  const tagTeams = await prisma.teamBattle.findMany({
    where: { stableId: userId, teamSize: 2 },
    select: { id: true },
  });

  // Tag team tiers from standings (source of truth since Spec #40). Only the tier
  // is read: tag-team results are already inside each member's robot counters.
  const tagTeamStandings = tagTeams.length > 0 ? await prisma.standing.findMany({
    where: { entityType: 'team', entityId: { in: tagTeams.map(t => t.id) }, mode: StandingsMode.tag_team },
    select: { tier: true },
  }) : [];

  const cycleChanges = await computeCycleChanges(userId, robots);

  if (robots.length === 0) {
    return {
      totalBattles: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      highestELO: 0,
      highestLeague: null,
      highestTagTeamLeague: null,
      totalRobots: 0,
      prestige: user.prestige,
      prestigeRank: getPrestigeRank(user.prestige),
      cycleChanges,
    };
  }

  // Each battle counts once per stable. The robot counters count a team battle
  // once per member (tag team, 2v2/3v3 League and tournament, team byes), so
  // the surplus from sides the stable shared is subtracted. Per-robot counters
  // are unchanged, and byes still count as battles.
  const overlap = await getStableBattleOverlap(robots.map(r => r.id));

  const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0) - overlap.battles;
  const wins = robots.reduce((sum, r) => sum + r.wins, 0) - overlap.wins;
  const losses = robots.reduce((sum, r) => sum + r.losses, 0) - overlap.losses;
  const draws = robots.reduce((sum, r) => sum + r.draws, 0) - overlap.draws;
  const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
  const highestELO = Math.max(...robots.map(r => r.elo));

  // Read highest league from standings (source of truth)
  const robotStandings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: robots.map(r => r.id) }, mode: StandingsMode.league_1v1 },
    select: { tier: true },
  });
  const highestLeague = robotStandings.length > 0
    ? robotStandings
        .map(s => s.tier)
        .sort((a, b) => LEAGUE_HIERARCHY.indexOf(b) - LEAGUE_HIERARCHY.indexOf(a))[0]
    : null;

  const highestTagTeamLeague = tagTeamStandings.length > 0
    ? tagTeamStandings
        .map(t => t.tier)
        .sort((a, b) => LEAGUE_HIERARCHY.indexOf(b) - LEAGUE_HIERARCHY.indexOf(a))[0]
    : null;

  return {
    totalBattles,
    wins,
    losses,
    draws,
    winRate: Math.round(winRate * 10) / 10,
    highestELO,
    highestLeague,
    highestTagTeamLeague,
    totalRobots: robots.length,
    prestige: user.prestige,
    prestigeRank: getPrestigeRank(user.prestige),
    cycleChanges,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────

interface RobotSlim {
  id: number;
  elo: number;
}

/**
 * Battle modes whose result is a finishing position rather than a win or a loss.
 *
 * Both orchestrators pass `skipBattleCounters: true`, so these modes never touch
 * `robots.wins` / `robots.losses` (Spec #46 records the decision not to widen the
 * career counters, because a "win" is undefined for placements 2 through N).
 * They do still emit `battle_complete` audit events, where every non-winning
 * placement is recorded as a `'loss'` — so they must be excluded here to keep the
 * per-cycle delta consistent with the career record displayed beside it.
 *
 * Exported for Spec #48's Cycle_Progress_Summary service, which must exclude the
 * same modes from its win/loss/draw counts. Requirement 8 criterion 7 requires the
 * import rather than a second list, so the two can never disagree about which modes
 * are placement-based.
 */
export const PLACEMENT_MODE_BATTLE_TYPES = ['koth', 'grand_melee'];

/**
 * Count this cycle's wins and losses for a set of robots, covering the same
 * modes as the career win/loss counters.
 *
 * Each battle counts once per stable, like the career totals: a team battle
 * writes one audit row per member, so rows sharing a battle and a result are
 * counted once. Opposite results in one battle (two of the stable's teams
 * meeting) stay separate.
 */
async function countCareerCycleResults(
  cycleNumber: number,
  robotIds: number[],
): Promise<{ wins: number; losses: number }> {
  if (robotIds.length === 0) return { wins: 0, losses: 0 };

  const events = await prisma.auditLog.findMany({
    where: {
      cycleNumber,
      eventType: EventType.BATTLE_COMPLETE,
      robotId: { in: robotIds },
    },
    select: { payload: true, battleId: true },
  });

  let wins = 0;
  let losses = 0;
  const counted = new Set<string>();

  for (const event of events) {
    const payload = event.payload as unknown as { result?: string; battleType?: string };
    if (payload.battleType && PLACEMENT_MODE_BATTLE_TYPES.includes(payload.battleType)) continue;
    if (event.battleId != null) {
      const key = `${event.battleId}:${payload.result}`;
      if (counted.has(key)) continue;
      counted.add(key);
    }
    if (payload.result === 'win') wins++;
    else if (payload.result === 'loss') losses++;
  }

  return { wins, losses };
}

/**
 * Summarise what changed for this stable during the most recent cycle.
 *
 * Every figure here is a single cycle's activity, not a difference between two
 * cycles: the snapshot metrics are themselves already per-cycle aggregates (they
 * are built from audit events filtered by `cycleNumber`), so subtracting the
 * previous cycle's totals would compare two unrelated quantities.
 */
async function computeCycleChanges(userId: number, robots: RobotSlim[]) {
  const latestSnapshot = await prisma.cycleSnapshot.findFirst({
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true },
  });

  if (!latestSnapshot) return null;

  const snapshot = await prisma.cycleSnapshot.findUnique({
    where: { cycleNumber: latestSnapshot.cycleNumber },
    select: { stableMetrics: true, robotMetrics: true },
  });

  if (!snapshot) return null;

  const stableMetric = (snapshot.stableMetrics as unknown as StableMetric[]).find(
    (m: StableMetric) => m.userId === userId,
  );

  const robotIds = robots.map(r => r.id);

  const robotMetrics = (snapshot.robotMetrics as unknown as RobotMetric[]).filter(
    (m: RobotMetric) => robotIds.includes(m.robotId),
  );

  const { wins, losses } = await countCareerCycleResults(latestSnapshot.cycleNumber, robotIds);

  // ELO movement of whichever robot currently holds the stable's highest rating.
  const currentHighestElo = robots.length > 0 ? Math.max(...robots.map(r => r.elo)) : 0;
  const highestEloRobot = robots.find(r => r.elo === currentHighestElo);
  const highestEloChange = highestEloRobot
    ? robotMetrics.find((m: RobotMetric) => m.robotId === highestEloRobot.id)?.eloChange ?? 0
    : 0;

  return {
    prestige: stableMetric?.totalPrestigeEarned || 0,
    wins,
    losses,
    highestElo: highestEloChange,
  };
}
