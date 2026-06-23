/**
 * Achievement Catalog
 * Handles getPlayerAchievements and computeProgress — the read-path
 * that builds the full achievement catalog with progress and rarity.
 */

import prisma from '../../lib/prisma';
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
} from '../../config/achievements';
import type {
  AchievementsResponse,
  AchievementWithProgress,
  AchievementRarityCache,
} from './achievementTypes';

// ─── Progress Computation ───────────────────────────────────────────

/**
 * Compute progress for a single numeric achievement.
 * Returns { current, target, label, bestRobotName? } or null.
 */
export function computeProgress(
  achievement: AchievementDefinition,
  user: { prestige: number; currency: number; totalPracticeBattles: number; championshipTitles: number; championshipTitles2v2: number; championshipTitles3v3: number },
  robots: Array<{
    id: number; name: string; wins: number; losses: number; kills: number;
    elo: number; fame: number; totalBattles: number; kothWins: number;
    totalTagTeamWins: number; totalLeague2v2Wins: number; totalLeague3v3Wins: number;
    currentWinStreak: number; currentLoseStreak: number;
    offensiveWins: number; defensiveWins: number; balancedWins: number;
    dualWieldWins: number;
  }>,
  weaponCount: number,
  robotCount: number,
  facilityCounts: Array<{ level: number }>,
  tuningByRobot: Map<number, number>,
  lifetimeEarnings: number,
  streamingRevenue: number,
  weaponsSoldCount: number,
  weaponsSoldCredits: number,
  weaponsRefinedCount: number,
  weaponsRefinedCreditsSpent: number,
): AchievementWithProgress['progress'] {
  const target = achievement.triggerThreshold!;
  const label = achievement.progressLabel ?? '';

  const bestRobotFor = (
    field: 'wins' | 'losses' | 'kills' | 'elo' | 'fame' | 'totalBattles' |
      'kothWins' | 'totalTagTeamWins' | 'totalLeague2v2Wins' | 'totalLeague3v3Wins' |
      'currentWinStreak' | 'currentLoseStreak' |
      'offensiveWins' | 'defensiveWins' | 'balancedWins' | 'dualWieldWins',
  ): { current: number; bestRobotName?: string } => {
    if (robots.length === 0) return { current: 0 };
    let best = robots[0];
    for (const robot of robots) {
      if (robot[field] > best[field]) best = robot;
    }
    return { current: best[field], bestRobotName: best.name };
  };

  switch (achievement.triggerType) {
    case 'wins': { const r = bestRobotFor('wins'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'losses': { const r = bestRobotFor('losses'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'battles': { const r = bestRobotFor('totalBattles'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'kills': { const r = bestRobotFor('kills'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'elo': { const r = bestRobotFor('elo'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'fame': { const r = bestRobotFor('fame'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'win_streak': { const r = bestRobotFor('currentWinStreak'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'lose_streak': { const r = bestRobotFor('currentLoseStreak'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'koth_wins': { const r = bestRobotFor('kothWins'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'tag_team_wins': { const r = bestRobotFor('totalTagTeamWins'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'league_2v2_wins': { const r = bestRobotFor('totalLeague2v2Wins'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }
    case 'league_3v3_wins': { const r = bestRobotFor('totalLeague3v3Wins'); return { current: r.current, target, label, bestRobotName: r.bestRobotName }; }

    case 'prestige': return { current: user.prestige, target, label };
    case 'currency': return { current: user.currency, target, label };
    case 'lifetime_earnings': return { current: lifetimeEarnings, target, label };
    case 'streaming_revenue': return { current: streamingRevenue, target, label };
    case 'practice_battles': return { current: user.totalPracticeBattles, target, label };
    case 'tournament_wins': return { current: user.championshipTitles, target, label };
    case 'tournament_2v2_wins': return { current: user.championshipTitles2v2, target, label };
    case 'tournament_3v3_wins': return { current: user.championshipTitles3v3, target, label };

    case 'weapon_count': return { current: weaponCount, target, label };
    case 'weapons_sold_count': return { current: weaponsSoldCount, target, label };
    case 'weapons_sold_credits': return { current: weaponsSoldCredits, target, label };
    case 'weapons_refined_count': return { current: weaponsRefinedCount, target, label };
    case 'weapons_refined_credits_spent': return { current: weaponsRefinedCreditsSpent, target, label };
    case 'robot_count': return { current: robotCount, target, label };
    case 'facility_count': {
      const minLevel = Number(achievement.triggerMeta?.minLevel ?? 1);
      const count = facilityCounts.filter((f) => f.level >= minLevel).length;
      return { current: count, target, label };
    }
    case 'tuning_full': {
      let maxTuning = 0;
      for (const total of tuningByRobot.values()) {
        if (total > maxTuning) maxTuning = total;
      }
      return { current: Math.floor(maxTuning), target, label };
    }
    case 'loadout_wins': {
      const r = bestRobotFor('dualWieldWins');
      return { current: r.current, target, label, bestRobotName: r.bestRobotName };
    }
    case 'stance_wins': {
      const stance = String(achievement.triggerMeta?.stance ?? 'balanced');
      const fieldMap: Record<string, 'offensiveWins' | 'defensiveWins' | 'balancedWins'> = {
        offensive: 'offensiveWins', defensive: 'defensiveWins', balanced: 'balancedWins',
      };
      const field = fieldMap[stance];
      if (!field) return { current: 0, target, label };
      const r = bestRobotFor(field);
      return { current: r.current, target, label, bestRobotName: r.bestRobotName };
    }
    case 'survival_streak': return null;
    case 'yield_forced': return null;
    default: return null;
  }
}

// ─── Player Achievement Catalog ─────────────────────────────────────

/**
 * Get full achievement catalog with player's progress, unlock status, and rarity.
 * Batches all DB reads upfront to avoid per-achievement queries.
 */
export async function getPlayerAchievements(
  userId: number,
  rarityCache: AchievementRarityCache,
): Promise<AchievementsResponse> {
  // (a) Load user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      prestige: true,
      currency: true,
      hasCompletedOnboarding: true,
      totalPracticeBattles: true,
      championshipTitles: true,
      championshipTitles2v2: true,
      championshipTitles3v3: true,
      pinnedAchievements: true,
    },
  });

  if (!user) {
    return {
      achievements: [],
      summary: { total: 0, unlocked: 0, byTier: {} },
      rarity: { counts: {}, totalActivePlayers: 0 },
    };
  }

  const pinnedIds = new Set<string>(
    Array.isArray(user.pinnedAchievements) ? (user.pinnedAchievements as string[]) : [],
  );

  // (b) Load robots
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true, name: true, wins: true, losses: true, kills: true,
      elo: true, fame: true, totalBattles: true,
      offensiveWins: true, defensiveWins: true, balancedWins: true, dualWieldWins: true,
    },
  });

  const robotIds = robots.map((r) => r.id);
  const robotCount = robots.length;

  // Load standings data for per-mode counters (koth wins, tag team wins, league wins, streaks)
  const allStandings = await prisma.standing.findMany({
    where: {
      entityType: 'robot',
      entityId: { in: robotIds },
    },
    select: {
      entityId: true, mode: true, wins: true,
      currentWinStreak: true, currentLoseStreak: true, bestWinStreak: true,
    },
  });

  // Build per-robot standings maps
  const standingsByRobot = new Map<number, typeof allStandings>();
  for (const s of allStandings) {
    const arr = standingsByRobot.get(s.entityId) ?? [];
    arr.push(s);
    standingsByRobot.set(s.entityId, arr);
  }

  // Merge robot base data with standings-derived per-mode counters
  const robotsWithStandings = robots.map(r => {
    const standings = standingsByRobot.get(r.id) ?? [];
    const kothStanding = standings.find(s => s.mode === 'koth');
    const tagTeamStanding = standings.find(s => s.mode === 'tag_team');
    const league2v2Standing = standings.find(s => s.mode === 'league_2v2');
    const league3v3Standing = standings.find(s => s.mode === 'league_3v3');
    const league1v1Standing = standings.find(s => s.mode === 'league_1v1');

    return {
      ...r,
      kothWins: kothStanding?.wins ?? 0,
      totalTagTeamWins: tagTeamStanding?.wins ?? 0,
      totalLeague2v2Wins: league2v2Standing?.wins ?? 0,
      totalLeague3v3Wins: league3v3Standing?.wins ?? 0,
      currentWinStreak: league1v1Standing?.currentWinStreak ?? 0,
      currentLoseStreak: league1v1Standing?.currentLoseStreak ?? 0,
    };
  });

  // (c) Run ALL remaining queries in parallel
  const [
    unlocks, weaponCount, facilityCounts, tuningAllocations,
    earningsResult, streamingResult,
    weaponsSoldCount, weaponsSoldCreditsResult,
    weaponsRefinedCount, weaponsRefinedCreditsSpentResult,
  ] = await Promise.all([
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, robotId: true, unlockedAt: true, robot: { select: { name: true } } },
    }),
    prisma.weaponInventory.count({ where: { userId } }),
    prisma.facility.findMany({ where: { userId }, select: { level: true } }),
    robotIds.length > 0
      ? prisma.tuningAllocation.findMany({
          where: { robotId: { in: robotIds } },
          select: {
            robotId: true,
            combatPower: true, targetingSystems: true, criticalSystems: true, penetration: true,
            weaponControl: true, attackSpeed: true, armorPlating: true, shieldCapacity: true,
            evasionThrusters: true, damageDampeners: true, counterProtocols: true, hullIntegrity: true,
            servoMotors: true, gyroStabilizers: true, hydraulicSystems: true, powerCore: true,
            combatAlgorithms: true, threatAnalysis: true, adaptiveAI: true, logicCores: true,
            syncProtocols: true, supportSystems: true, formationTactics: true,
          },
        })
      : Promise.resolve([]),
    robotIds.length > 0
      ? prisma.battleParticipant.aggregate({ where: { robotId: { in: robotIds } }, _sum: { credits: true } })
      : Promise.resolve({ _sum: { credits: null } }),
    robotIds.length > 0
      ? prisma.battleParticipant.aggregate({ where: { robotId: { in: robotIds } }, _sum: { streamingRevenue: true } })
      : Promise.resolve({ _sum: { streamingRevenue: null } }),
    prisma.auditLog.count({ where: { userId, eventType: 'weapon_sale' } }),
    prisma.$queryRaw<{ total: bigint | null }[]>`
      SELECT COALESCE(SUM((payload->>'salePrice')::int), 0) as total
      FROM audit_logs
      WHERE user_id = ${userId} AND event_type = 'weapon_sale'
    `,
    prisma.auditLog.count({ where: { userId, eventType: 'weapon_refinement' } }),
    prisma.weaponRefinement.aggregate({ _sum: { costPaid: true }, where: { weaponInventory: { userId } } }),
  ]);

  const unlockMap = new Map(
    unlocks.map((u) => [u.achievementId, { robotId: u.robotId, robotName: u.robot?.name ?? null, unlockedAt: u.unlockedAt.toISOString() }]),
  );

  const lifetimeEarnings = earningsResult._sum.credits ?? 0;
  const streamingRevenue = streamingResult._sum.streamingRevenue ?? 0;
  const weaponsSoldCredits = Number(weaponsSoldCreditsResult[0]?.total ?? 0);
  const weaponsRefinedCreditsSpent = Number(weaponsRefinedCreditsSpentResult._sum.costPaid ?? 0);

  // (d) Compute max tuning points per robot
  const tuningByRobot = new Map<number, number>();
  for (const alloc of tuningAllocations) {
    const total =
      Number(alloc.combatPower) + Number(alloc.targetingSystems) +
      Number(alloc.criticalSystems) + Number(alloc.penetration) +
      Number(alloc.weaponControl) + Number(alloc.attackSpeed) +
      Number(alloc.armorPlating) + Number(alloc.shieldCapacity) +
      Number(alloc.evasionThrusters) + Number(alloc.damageDampeners) +
      Number(alloc.counterProtocols) + Number(alloc.hullIntegrity) +
      Number(alloc.servoMotors) + Number(alloc.gyroStabilizers) +
      Number(alloc.hydraulicSystems) + Number(alloc.powerCore) +
      Number(alloc.combatAlgorithms) + Number(alloc.threatAnalysis) +
      Number(alloc.adaptiveAI) + Number(alloc.logicCores) +
      Number(alloc.syncProtocols) + Number(alloc.supportSystems) +
      Number(alloc.formationTactics);
    tuningByRobot.set(alloc.robotId, total);
  }

  // (e) Build achievement list
  const achievements: AchievementWithProgress[] = [];

  for (const achievement of ACHIEVEMENTS) {
    const isUnlocked = unlockMap.has(achievement.id);
    const unlock = unlockMap.get(achievement.id);

    if (achievement.hidden && !isUnlocked) {
      achievements.push({
        id: achievement.id, name: '???', description: '???',
        category: achievement.category, tier: achievement.tier,
        rewardCredits: achievement.rewardCredits, rewardPrestige: achievement.rewardPrestige,
        badgeIconFile: achievement.badgeIconFile, hidden: true, unlocked: false,
        unlockedAt: null, robotId: null, robotName: null, progress: null,
        isPinned: pinnedIds.has(achievement.id),
      });
      continue;
    }

    let progress: AchievementWithProgress['progress'] = null;
    if (achievement.progressType === 'numeric' && achievement.triggerThreshold !== undefined) {
      progress = computeProgress(
        achievement, user, robotsWithStandings, weaponCount, robotCount, facilityCounts,
        tuningByRobot, lifetimeEarnings, streamingRevenue,
        weaponsSoldCount, weaponsSoldCredits, weaponsRefinedCount, weaponsRefinedCreditsSpent,
      );
    }

    achievements.push({
      id: achievement.id, name: achievement.name, description: achievement.description,
      category: achievement.category, tier: achievement.tier,
      rewardCredits: achievement.rewardCredits, rewardPrestige: achievement.rewardPrestige,
      badgeIconFile: achievement.badgeIconFile, hidden: achievement.hidden,
      unlocked: isUnlocked, unlockedAt: unlock?.unlockedAt ?? null,
      robotId: unlock?.robotId ?? null, robotName: unlock?.robotName ?? null,
      progress, isPinned: pinnedIds.has(achievement.id),
    });
  }

  // (f) Build summary
  const unlockedCount = unlockMap.size;
  const nonHiddenCount = ACHIEVEMENTS.filter((a) => !a.hidden).length;
  const earnedHiddenCount = ACHIEVEMENTS.filter((a) => a.hidden && unlockMap.has(a.id)).length;
  const totalCount = nonHiddenCount + earnedHiddenCount;

  const byTier: Record<string, { total: number; unlocked: number }> = {};
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.hidden && !unlockMap.has(achievement.id)) continue;
    if (!byTier[achievement.tier]) byTier[achievement.tier] = { total: 0, unlocked: 0 };
    byTier[achievement.tier].total += 1;
    if (unlockMap.has(achievement.id)) byTier[achievement.tier].unlocked += 1;
  }

  // (g) Build rarity response
  const rarityCounts: Record<string, number> = {};
  for (const [achievementId, count] of rarityCache.counts) {
    rarityCounts[achievementId] = count;
  }

  return {
    achievements,
    summary: { total: totalCount, unlocked: unlockedCount, byTier },
    rarity: { counts: rarityCounts, totalActivePlayers: rarityCache.totalActivePlayers },
  };
}
