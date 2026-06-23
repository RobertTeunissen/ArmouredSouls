/**
 * Trigger Evaluator
 * Evaluates whether a specific achievement's trigger condition is met.
 * Contains the main evaluateTrigger switch and all check* DB helpers.
 */

import prisma from '../../lib/prisma';
import { calculateEffectiveStatsWithStance } from '../../utils/robotCalculations';
import type { AchievementDefinition } from '../../config/achievements';
import { STARTER_WEAPON_NAMES } from '../../config/starterWeapons';
import type { AchievementEvent } from './achievementTypes';

// ─── Cached-Data Helpers (no DB queries) ────────────────────────────

/** Check a robot stat from the pre-fetched cached robot (no DB query). */
export function checkRobotStatCached(
  cachedRobot: Record<string, unknown> | null,
  field: string,
  threshold?: number,
): boolean {
  if (!cachedRobot || threshold === undefined) return false;
  return Number(cachedRobot[field] ?? 0) >= threshold;
}

/** Check a user stat from the pre-fetched cached user (no DB query). */
export function checkUserStatCached(
  cachedUser: Record<string, unknown> | null,
  field: string,
  threshold?: number,
): boolean {
  if (!cachedUser || threshold === undefined) return false;
  return Number(cachedUser[field] ?? 0) >= threshold;
}

/** Check loadout wins from cached robot (no DB query). */
export function checkLoadoutWinsCached(
  cachedRobot: Record<string, unknown>,
  loadoutType: string,
  threshold?: number,
): boolean {
  if (threshold === undefined) return false;
  if (loadoutType === 'dual_wield') {
    return Number(cachedRobot.dualWieldWins ?? 0) >= threshold;
  }
  return false;
}

/** Check stance wins from cached robot (no DB query). */
export function checkStanceWinsCached(
  cachedRobot: Record<string, unknown>,
  stance: string,
  threshold?: number,
): boolean {
  if (threshold === undefined) return false;
  switch (stance) {
    case 'offensive':
      return Number(cachedRobot.offensiveWins ?? 0) >= threshold;
    case 'defensive':
      return Number(cachedRobot.defensiveWins ?? 0) >= threshold;
    case 'balanced':
      return Number(cachedRobot.balancedWins ?? 0) >= threshold;
    default:
      return false;
  }
}

// ─── DB Query Helpers ───────────────────────────────────────────────

export async function checkRobotStat(
  robotId: number | null,
  field: string,
  threshold?: number,
): Promise<boolean> {
  if (!robotId || threshold === undefined) return false;
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { [field]: true },
  });
  if (!robot) return false;
  return Number(robot[field as keyof typeof robot]) >= threshold;
}

export async function checkUserStat(
  userId: number,
  field: string,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { [field]: true },
  });
  if (!user) return false;
  return Number(user[field as keyof typeof user]) >= threshold;
}

export async function checkWeaponCount(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const count = await prisma.weaponInventory.count({ where: { userId } });
  return count >= threshold;
}

export async function checkWeaponsSoldCount(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const count = await prisma.auditLog.count({
    where: { userId, eventType: 'weapon_sale' },
  });
  return count >= threshold;
}

export async function checkWeaponsSoldCredits(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const result = await prisma.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(SUM((payload->>'salePrice')::int), 0) as total
    FROM audit_logs
    WHERE user_id = ${userId} AND event_type = 'weapon_sale'
  `;
  const total = Number(result[0]?.total ?? 0);
  return total >= threshold;
}

export async function checkWeaponsRefinedCount(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const count = await prisma.auditLog.count({
    where: { userId, eventType: 'weapon_refinement' },
  });
  return count >= threshold;
}

export async function checkWeaponsRefinedCreditsSpent(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const result = await prisma.weaponRefinement.aggregate({
    _sum: { costPaid: true },
    where: { weaponInventory: { userId } },
  });
  const total = Number(result._sum.costPaid ?? 0);
  return total >= threshold;
}

export async function checkOwnsLegendaryWeapon(userId: number): Promise<boolean> {
  const candidates = await prisma.weaponInventory.findMany({
    where: { userId, refinements: { some: {} } },
    select: { _count: { select: { refinements: true } } },
  });
  return candidates.some((c) => c._count.refinements >= 5);
}

export async function checkOwnsLegendaryStarterWeapon(userId: number): Promise<boolean> {
  const candidates = await prisma.weaponInventory.findMany({
    where: {
      userId,
      weapon: { name: { in: [...STARTER_WEAPON_NAMES] } },
    },
    select: { _count: { select: { refinements: true } } },
  });
  return candidates.some((c) => c._count.refinements >= 5);
}

export async function checkOwnsMaxDpsWeapon(userId: number): Promise<boolean> {
  const candidates = await prisma.weaponInventory.findMany({
    where: { userId, refinements: { some: {} } },
    select: { refinements: { select: { tier: true } } },
  });
  for (const inv of candidates) {
    let sharpen = 0;
    let forge = 0;
    for (const r of inv.refinements) {
      if (r.tier === 'sharpen') sharpen++;
      else if (r.tier === 'forge') forge++;
    }
    if (sharpen >= 2 && forge >= 2) return true;
  }
  return false;
}

export async function checkRobotCount(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const count = await prisma.robot.count({
    where: { userId },
  });
  return count >= threshold;
}

export async function checkFacilityCount(
  userId: number,
  threshold?: number,
  minLevel: number = 1,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const count = await prisma.facility.count({
    where: { userId, level: { gte: minLevel } },
  });
  return count >= threshold;
}

export async function checkWeaponType(
  userId: number,
  weaponType: string,
): Promise<boolean> {
  const count = await prisma.weaponInventory.count({
    where: { userId, weapon: { weaponType } },
  });
  return count > 0;
}

export async function checkLoadoutWins(
  robotId: number,
  loadoutType: string,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { dualWieldWins: true },
  });
  if (!robot) return false;
  if (loadoutType === 'dual_wield') {
    return robot.dualWieldWins >= threshold;
  }
  return false;
}

export async function checkStanceWins(
  robotId: number,
  stance: string,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { offensiveWins: true, defensiveWins: true, balancedWins: true },
  });
  if (!robot) return false;
  switch (stance) {
    case 'offensive': return robot.offensiveWins >= threshold;
    case 'defensive': return robot.defensiveWins >= threshold;
    case 'balanced': return robot.balancedWins >= threshold;
    default: return false;
  }
}

export async function checkAllModesWin(userId: number): Promise<boolean> {
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true, wins: true },
  });

  const robotIds = robots.map(r => r.id);
  const standings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: robotIds } },
    select: { entityId: true, mode: true, wins: true },
  });

  const hasLeagueWin = robots.some(r => r.wins > 0) ||
    standings.some(s => (s.mode === 'league_2v2' || s.mode === 'league_3v3') && s.wins > 0);
  const hasKothWin = standings.some(s => s.mode === 'koth' && s.wins > 0);
  const hasTagTeamWin = standings.some(s => s.mode === 'tag_team' && s.wins > 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { championshipTitles1v1: true, championshipTitles2v2: true, championshipTitles3v3: true },
  });
  const totalChampionships = (user?.championshipTitles1v1 ?? 0) + (user?.championshipTitles2v2 ?? 0) + (user?.championshipTitles3v3 ?? 0);
  const hasTournamentWin = totalChampionships >= 1;

  return hasLeagueWin && hasKothWin && hasTagTeamWin && hasTournamentWin;
}

export async function checkTuningAllocated(userId: number): Promise<boolean> {
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);
  if (robotIds.length === 0) return false;
  const count = await prisma.tuningAllocation.count({
    where: { robotId: { in: robotIds } },
  });
  return count > 0;
}

export async function checkTuningFull(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;

  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);
  if (robotIds.length === 0) return false;

  const allocations = await prisma.tuningAllocation.findMany({
    where: { robotId: { in: robotIds } },
  });

  for (const alloc of allocations) {
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
    if (total >= threshold) return true;
  }
  return false;
}

export async function checkEffectiveStat(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;

  const robots = await prisma.robot.findMany({
    where: { userId },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      tuningAllocation: true,
    },
  });

  for (const robot of robots) {
    const tuningBonuses: Record<string, number> = {};
    if (robot.tuningAllocation) {
      const alloc = robot.tuningAllocation;
      tuningBonuses.combatPower = Number(alloc.combatPower);
      tuningBonuses.targetingSystems = Number(alloc.targetingSystems);
      tuningBonuses.criticalSystems = Number(alloc.criticalSystems);
      tuningBonuses.penetration = Number(alloc.penetration);
      tuningBonuses.weaponControl = Number(alloc.weaponControl);
      tuningBonuses.attackSpeed = Number(alloc.attackSpeed);
      tuningBonuses.armorPlating = Number(alloc.armorPlating);
      tuningBonuses.shieldCapacity = Number(alloc.shieldCapacity);
      tuningBonuses.evasionThrusters = Number(alloc.evasionThrusters);
      tuningBonuses.damageDampeners = Number(alloc.damageDampeners);
      tuningBonuses.counterProtocols = Number(alloc.counterProtocols);
      tuningBonuses.hullIntegrity = Number(alloc.hullIntegrity);
      tuningBonuses.servoMotors = Number(alloc.servoMotors);
      tuningBonuses.gyroStabilizers = Number(alloc.gyroStabilizers);
      tuningBonuses.hydraulicSystems = Number(alloc.hydraulicSystems);
      tuningBonuses.powerCore = Number(alloc.powerCore);
      tuningBonuses.combatAlgorithms = Number(alloc.combatAlgorithms);
      tuningBonuses.threatAnalysis = Number(alloc.threatAnalysis);
      tuningBonuses.adaptiveAI = Number(alloc.adaptiveAI);
      tuningBonuses.logicCores = Number(alloc.logicCores);
      tuningBonuses.syncProtocols = Number(alloc.syncProtocols);
      tuningBonuses.supportSystems = Number(alloc.supportSystems);
      tuningBonuses.formationTactics = Number(alloc.formationTactics);
    }

    try {
      const effectiveStats = calculateEffectiveStatsWithStance(
        robot as unknown as Parameters<typeof calculateEffectiveStatsWithStance>[0],
        tuningBonuses,
      );
      for (const value of Object.values(effectiveStats)) {
        if (Number(value) >= threshold) return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function checkYieldsForcedCumulative(
  userId: number,
  threshold: number,
): Promise<boolean> {
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);
  if (robotIds.length === 0) return false;

  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count
     FROM battle_participants bp
     JOIN battles b ON bp.battle_id = b.id
     WHERE bp.yielded = true
       AND bp.robot_id != ALL($1::int[])
       AND b.winner_id = ANY($1::int[])`,
    robotIds,
  );
  return Number(result[0]?.count ?? 0) >= threshold;
}

export async function checkLifetimeEarnings(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);
  if (robotIds.length === 0) return false;

  const result = await prisma.battleParticipant.aggregate({
    where: { robotId: { in: robotIds } },
    _sum: { credits: true },
  });
  return (result._sum.credits ?? 0) >= threshold;
}

export async function checkStreamingRevenue(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);
  if (robotIds.length === 0) return false;

  const result = await prisma.battleParticipant.aggregate({
    where: { robotId: { in: robotIds } },
    _sum: { streamingRevenue: true },
  });
  return (result._sum.streamingRevenue ?? 0) >= threshold;
}

export async function checkSurvivalStreak(
  robotId: number | null,
  threshold?: number,
): Promise<boolean> {
  if (!robotId || threshold === undefined) return false;
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { totalBattles: true },
  });
  if (!robot) return false;
  const destroyedCount = await prisma.battleParticipant.count({
    where: { robotId, destroyed: true },
  });
  return (robot.totalBattles - destroyedCount) >= threshold;
}

// ─── Main Trigger Evaluation ────────────────────────────────────────

/**
 * Evaluate whether a specific achievement's trigger condition is met.
 * For battle-related triggers, event.data provides per-battle context.
 * For cumulative triggers, DB queries provide current stats.
 */
export async function evaluateTrigger(
  achievement: AchievementDefinition,
  userId: number,
  robotId: number | null,
  event: AchievementEvent,
  cachedRobot: Record<string, unknown> | null,
  cachedUser: Record<string, unknown> | null,
): Promise<boolean> {
  const { triggerType, triggerThreshold, triggerMeta } = achievement;
  const data = event.data;

  switch (triggerType) {
    // ── Cumulative Robot Stats (from cached robot) ─────────────
    case 'wins':
      return checkRobotStatCached(cachedRobot, 'wins', triggerThreshold);
    case 'losses':
      return checkRobotStatCached(cachedRobot, 'losses', triggerThreshold);
    case 'battles':
      return checkRobotStatCached(cachedRobot, 'totalBattles', triggerThreshold);
    case 'kills':
      return checkRobotStatCached(cachedRobot, 'kills', triggerThreshold);
    case 'elo':
      return checkRobotStatCached(cachedRobot, 'elo', triggerThreshold);
    case 'fame':
      return checkRobotStatCached(cachedRobot, 'fame', triggerThreshold);
    case 'win_streak':
      return checkRobotStatCached(cachedRobot, 'currentWinStreak', triggerThreshold);
    case 'lose_streak':
      return checkRobotStatCached(cachedRobot, 'currentLoseStreak', triggerThreshold);
    case 'koth_wins':
      return checkRobotStatCached(cachedRobot, 'kothWins', triggerThreshold);
    case 'tag_team_wins':
      return checkRobotStatCached(cachedRobot, 'totalTagTeamWins', triggerThreshold);
    case 'league_2v2_wins':
      return checkRobotStatCached(cachedRobot, 'totalLeague2v2Wins', triggerThreshold);
    case 'league_3v3_wins':
      return checkRobotStatCached(cachedRobot, 'totalLeague3v3Wins', triggerThreshold);

    // ── Cumulative User Stats (from cached user) ───────────────
    case 'prestige':
      return checkUserStatCached(cachedUser, 'prestige', triggerThreshold);
    case 'currency':
      return checkUserStatCached(cachedUser, 'currency', triggerThreshold);

    // ── Battle-Specific Boolean Triggers (from event.data) ─────
    case 'perfect_victory':
      return Boolean(data.won) && Number(data.finalHpPercent) === 100;

    case 'low_hp_win': {
      const maxHpPercent = Number(triggerMeta?.maxHpPercent ?? 10);
      return Boolean(data.won) && Number(data.finalHpPercent) < maxHpPercent;
    }

    case 'low_hp_survival': {
      const maxHpPercent = Number(triggerMeta?.maxHpPercent ?? 5);
      return Boolean(data.won) && Number(data.minHpPercent ?? data.finalHpPercent) < maxHpPercent;
    }

    case 'elo_upset': {
      const minEloDiff = Number(triggerMeta?.minEloDiff ?? 150);
      const battleType = String(data.battleType ?? '');
      return (
        Boolean(data.won) &&
        Number(data.eloDiff) >= minEloDiff &&
        ['league_1v1', 'tournament_1v1'].includes(battleType)
      );
    }

    case 'yield_forced':
      if (triggerThreshold && triggerThreshold > 1) {
        return checkYieldsForcedCumulative(userId, triggerThreshold);
      }
      return Boolean(data.won) && Boolean(data.opponentYielded);

    case 'yield_comeback':
      return Boolean(data.won) && Boolean(data.previousBattleLost);

    case 'zero_yield_win':
      return Boolean(data.won) && Number(data.yieldThreshold) === 0;

    case 'no_tuning_win':
      return Boolean(data.won) && data.hasTuning === false;

    case 'glass_cannon': {
      const minDamage = Number(triggerMeta?.minDamage ?? 500);
      const maxHp = Number(triggerMeta?.maxHpPercent ?? 5);
      return (
        Boolean(data.won) &&
        Number(data.damageDealt) >= minDamage &&
        Number(data.finalHpPercent) < maxHp
      );
    }

    case 'battle_duration': {
      const maxSeconds = Number(triggerMeta?.maxSeconds ?? 5);
      return Boolean(data.won) && Number(data.battleDurationSeconds) <= maxSeconds;
    }

    case 'tag_in_win':
      return Boolean(data.won) && Boolean(data.taggedIn);

    case 'solo_carry':
      return Boolean(data.won) && Boolean(data.soloCarry);

    // ── Loadout/Stance Win Counters (from cached robot) ────────
    case 'loadout_wins': {
      if (!cachedRobot) return false;
      const loadoutType = String(triggerMeta?.loadoutType ?? 'dual_wield');
      return checkLoadoutWinsCached(cachedRobot, loadoutType, triggerThreshold);
    }

    case 'stance_wins': {
      if (!cachedRobot) return false;
      const stance = String(triggerMeta?.stance ?? 'balanced');
      return checkStanceWinsCached(cachedRobot, stance, triggerThreshold);
    }

    // ── All Modes Win (DB query) ──────────────────────────────
    case 'all_modes_win':
      return checkAllModesWin(userId);

    // ── League Promotion ──────────────────────────────────────
    case 'league_promotion': {
      if (!cachedRobot) return false;
      const targetLeague = String(triggerMeta?.league ?? '');
      const currentLeague = String(cachedRobot.currentLeague ?? '');
      const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
      const currentIndex = tierOrder.indexOf(currentLeague);
      const targetIndex = tierOrder.indexOf(targetLeague);
      return currentIndex >= targetIndex && targetIndex >= 0;
    }

    // ── Weapon Type ───────────────────────────────────────────
    case 'weapon_type': {
      const targetType = String(triggerMeta?.weaponType ?? '');
      if (data.weaponType) {
        return String(data.weaponType) === targetType;
      }
      return checkWeaponType(userId, targetType);
    }

    // ── Count-Based User Triggers (DB queries) ────────────────
    case 'weapon_count':
      return checkWeaponCount(userId, triggerThreshold);
    case 'weapons_sold_count':
      return checkWeaponsSoldCount(userId, triggerThreshold);
    case 'weapons_sold_credits':
      return checkWeaponsSoldCredits(userId, triggerThreshold);
    case 'weapon_sold_at_max_workshop':
      return Number(data.workshopLevel) === 10;

    // ── Weapon Refinement Triggers (DB queries) ──────────────
    case 'weapons_refined_count':
      return checkWeaponsRefinedCount(userId, triggerThreshold);
    case 'weapons_refined_credits_spent':
      return checkWeaponsRefinedCreditsSpent(userId, triggerThreshold);
    case 'owns_legendary_weapon':
      return checkOwnsLegendaryWeapon(userId);
    case 'owns_legendary_starter_weapon':
      return checkOwnsLegendaryStarterWeapon(userId);
    case 'owns_max_dps_weapon':
      return checkOwnsMaxDpsWeapon(userId);

    case 'robot_count':
      return checkRobotCount(userId, triggerThreshold);
    case 'facility_count': {
      const minLevel = Number(triggerMeta?.minLevel ?? 1);
      return checkFacilityCount(userId, triggerThreshold, minLevel);
    }

    // ── One-Time Triggers (from cached user) ──────────────────
    case 'onboarding':
      return (cachedUser as Record<string, unknown>)?.hasCompletedOnboarding === true;
    case 'practice_battles':
      return (Number((cachedUser as Record<string, unknown>)?.totalPracticeBattles ?? 0)) >= (triggerThreshold ?? 0);
    case 'tournament_wins':
      return (Number((cachedUser as Record<string, unknown>)?.championshipTitles ?? 0)) >= (triggerThreshold ?? 0);
    case 'tournament_2v2_wins':
      return (Number((cachedUser as Record<string, unknown>)?.championshipTitles2v2 ?? 0)) >= (triggerThreshold ?? 0);
    case 'tournament_3v3_wins':
      return (Number((cachedUser as Record<string, unknown>)?.championshipTitles3v3 ?? 0)) >= (triggerThreshold ?? 0);

    // ── Tuning Triggers ───────────────────────────────────────
    case 'tuning_allocated':
      return checkTuningAllocated(userId);
    case 'tuning_full':
      return checkTuningFull(userId, triggerThreshold);

    // ── Effective Stat ────────────────────────────────────────
    case 'effective_stat':
      return checkEffectiveStat(userId, triggerThreshold);

    // ── Attribute Upgraded ────────────────────────────────────
    case 'attribute_upgraded':
      return true;

    // ── Financial Triggers (DB aggregates) ────────────────────
    case 'bankrupt':
      return (Number((cachedUser as Record<string, unknown>)?.currency ?? 0)) < 0;
    case 'lifetime_earnings':
      return checkLifetimeEarnings(userId, triggerThreshold);
    case 'streaming_revenue':
      return checkStreamingRevenue(userId, triggerThreshold);
    case 'survival_streak':
      return checkSurvivalStreak(robotId, triggerThreshold);

    default:
      return false;
  }
}
