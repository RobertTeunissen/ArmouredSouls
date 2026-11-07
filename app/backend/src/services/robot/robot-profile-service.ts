/**
 * Public robot profile (`GET /api/robots/:id/profile`, robot pages revamp #504).
 *
 * What an opponent sees when scouting: per-mode standings with the rank in
 * the league instance, recent form, the achievements this robot earned and
 * its Hall of Records placements. No attributes, tuning or configuration:
 * those stay owner-only, and builds are scouted from battle reports.
 */

import prisma from '../../lib/prisma';
import { getAchievementById } from '../../config/achievements';
import { achievementService } from '../achievement';
import {
  getRecentResults,
  getRobotStandings,
  type PublicRobotStanding,
  type RecentResult,
} from '../common/stable-view-sections';

/** Battles in the profile's form strip. */
export const PROFILE_FORM_LIMIT = 10;

const ACHIEVEMENT_TIER_ORDER: readonly string[] = ['easy', 'medium', 'hard', 'very_hard', 'secret'];

export interface ProfileStanding extends PublicRobotStanding {
  /** 1-based position by LP in the league instance; equal LP shares a rank. */
  rank: number;
  /** Competitors in the league instance (same entity type and mode). */
  instanceSize: number;
}

export interface ProfileAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
  /** Human stables holding it (rarity cache); null until the cache has loaded. */
  holders: number | null;
}

export interface ProfileAccolade {
  seasonNumber: number;
  category: string;
  rank: number;
  value: number;
  valueLabel: string;
  mode: string | null;
}

export interface RobotProfile {
  standings: ProfileStanding[];
  form: RecentResult[];
  achievements: ProfileAchievement[];
  accolades: ProfileAccolade[];
}

/** Rank and size of the instance each standing sits in. */
async function withRanks(standings: readonly PublicRobotStanding[]): Promise<ProfileStanding[]> {
  return Promise.all(standings.map(async (s) => {
    const entityType = s.teamId === null ? 'robot' : 'team';
    const scope = { mode: s.mode, leagueInstanceId: s.leagueInstanceId, entityType };
    const [ahead, instanceSize] = await Promise.all([
      prisma.standing.count({ where: { ...scope, leaguePoints: { gt: s.leaguePoints } } }),
      prisma.standing.count({ where: scope }),
    ]);
    return { ...s, rank: ahead + 1, instanceSize };
  }));
}

/**
 * Achievements unlocked by this robot (robot-scoped unlocks), rarest first.
 * Hidden achievements are left out so a profile never spoils a secret.
 */
async function robotAchievements(robotId: number): Promise<ProfileAchievement[]> {
  const unlocks = await prisma.userAchievement.findMany({
    where: { robotId },
    select: { achievementId: true, unlockedAt: true },
  });
  const counts = achievementService.getRarityData().counts;
  const rarityKnown = counts.size > 0;
  return unlocks
    .flatMap((u) => {
      const definition = getAchievementById(u.achievementId);
      if (!definition || definition.hidden) return [];
      return [{
        id: definition.id,
        name: definition.name,
        tier: definition.tier,
        badgeIconFile: definition.badgeIconFile,
        unlockedAt: u.unlockedAt.toISOString(),
        holders: rarityKnown ? counts.get(definition.id) ?? 0 : null,
      }];
    })
    .sort((a, b) =>
      (a.holders ?? 0) - (b.holders ?? 0)
      || ACHIEVEMENT_TIER_ORDER.indexOf(b.tier) - ACHIEVEMENT_TIER_ORDER.indexOf(a.tier)
      || b.unlockedAt.localeCompare(a.unlockedAt));
}

/**
 * Hall of Records placements of this robot. Accolades store the subject by
 * name (the archive outlives the robot row), so this matches the owner's
 * robot accolades by the robot's current name; a renamed robot loses the
 * link to placements earned under its old name.
 */
async function robotAccolades(userId: number, robotName: string): Promise<ProfileAccolade[]> {
  return prisma.seasonAccolade.findMany({
    where: { userId, subjectType: 'robot', subjectName: robotName, category: { not: 'tournamentChampion' } },
    orderBy: [{ rank: 'asc' }, { seasonNumber: 'desc' }],
    take: 5,
    select: { seasonNumber: true, category: true, rank: true, value: true, valueLabel: true, mode: true },
  });
}

/** The public profile of a robot, or null when it does not exist. */
export async function getRobotProfile(robotId: number): Promise<RobotProfile | null> {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true, userId: true },
  });
  if (!robot) return null;

  const [standingsByRobot, form, achievements, accolades] = await Promise.all([
    getRobotStandings([robot.id]),
    getRecentResults([robot], PROFILE_FORM_LIMIT),
    robotAchievements(robot.id),
    robotAccolades(robot.userId, robot.name),
  ]);

  return {
    standings: await withRanks(standingsByRobot.get(robot.id) ?? []),
    form,
    achievements,
    accolades,
  };
}
