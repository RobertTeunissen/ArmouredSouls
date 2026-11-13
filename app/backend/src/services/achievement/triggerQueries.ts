/**
 * Achievement trigger DB queries: the check* helpers the trigger evaluator
 * calls for conditions that need a database read (weapons, robots,
 * facilities, tuning, effective stats, audit counters, streaks).
 *
 * @module services/achievement/triggerQueries
 */

import prisma from '../../lib/prisma';
import { calculateEffectiveStatsWithStance } from '../../utils/robotCalculations';
import { STARTER_WEAPON_NAMES } from '../../config/starterWeapons';
import { resolveTeamModeWins, type TeamModeWins } from './teamModeWins';
import { getAllModesBattleCount } from '../robot/all-modes-battle-count';
import {
  auditCounterSinceSql,
  buildAuditCounterWhere,
  getAchievementCounterStart,
} from './achievementCounterWindow';

// ─── DB Query Helpers ───────────────────────────────────────────────

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
  const since = await getAchievementCounterStart(userId);
  const count = await prisma.auditLog.count({
    where: buildAuditCounterWhere(userId, 'weapon_sale', since),
  });
  return count >= threshold;
}

export async function checkWeaponsSoldCredits(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const since = await getAchievementCounterStart(userId);
  const result = await prisma.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(SUM((payload->>'salePrice')::int), 0) as total
    FROM audit_logs
    WHERE user_id = ${userId} AND event_type = 'weapon_sale' ${auditCounterSinceSql(since)}
  `;
  const total = Number(result[0]?.total ?? 0);
  return total >= threshold;
}

export async function checkWeaponsRefinedCount(
  userId: number,
  threshold?: number,
): Promise<boolean> {
  if (threshold === undefined) return false;
  const since = await getAchievementCounterStart(userId);
  const count = await prisma.auditLog.count({
    where: buildAuditCounterWhere(userId, 'weapon_refinement', since),
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

/**
 * Whether the robot has a weapon of `weaponType` in its main or offhand slot.
 * Owning one in storage doesn't count (issue #601).
 */
export async function checkRobotEquippedWeaponType(
  userId: number,
  robotId: number,
  weaponType: string,
): Promise<boolean> {
  const count = await prisma.robot.count({
    where: {
      id: robotId,
      userId,
      OR: [
        { mainWeapon: { weapon: { weaponType } } },
        { offhandWeapon: { weapon: { weaponType } } },
      ],
    },
  });
  return count > 0;
}

export async function checkAllModesWin(userId: number): Promise<boolean> {
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true, wins: true, grandMeleeWins: true },
  });

  const robotIds = robots.map(r => r.id);
  const standings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: robotIds } },
    select: { entityId: true, mode: true, wins: true },
  });

  // Spec #51: the three team modes were read from this robot-scoped list, which
  // is the same defect Spec #46 R8 Cause A fixed in `achievementService.ts` and
  // left standing here. `tag_team`, `league_2v2` and `league_3v3` only ever write
  // `entityType: 'team'` rows keyed by `TeamBattle.id`, so `hasTagTeamWin` was
  // always false and C18 "Autobots, Roll Out!" was unreachable for every player.
  // Resolved through the shared resolver so the two call sites cannot drift.
  const teamWins = [...(await resolveTeamModeWins(robotIds)).values()];
  const anyTeamWin = (mode: keyof TeamModeWins): boolean => teamWins.some(w => w[mode] > 0);

  const hasLeagueWin = robots.some(r => r.wins > 0) ||
    anyTeamWin('league_2v2') || anyTeamWin('league_3v3');
  const hasKothWin = standings.some(s => s.mode === 'koth' && s.wins > 0);
  const hasTagTeamWin = anyTeamWin('tag_team');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { championshipTitles1v1: true, championshipTitles2v2: true, championshipTitles3v3: true },
  });
  const totalChampionships = (user?.championshipTitles1v1 ?? 0) + (user?.championshipTitles2v2 ?? 0) + (user?.championshipTitles3v3 ?? 0);
  const hasTournamentWin = totalChampionships >= 1;

  // Season 2: Grand Melee joined the required modes.
  const hasGrandMeleeWin = robots.some(r => r.grandMeleeWins > 0);

  return hasLeagueWin && hasKothWin && hasTagTeamWin && hasTournamentWin && hasGrandMeleeWin;
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

  // 1v1 only: there the yielding robot was the winner's single opponent, and
  // `winner_id` is a robot. KotH and Grand Melee record yields too (Season 2),
  // but the placement winner didn't force them; team modes store a team id in
  // `winner_id`, which could collide with a robot id.
  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count
     FROM battle_participants bp
     JOIN battles b ON bp.battle_id = b.id
     WHERE bp.yielded = true
       AND bp.robot_id != ALL($1::int[])
       AND b.winner_id = ANY($1::int[])
       AND b.battle_type IN ('league_1v1', 'tournament_1v1')`,
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
    select: { id: true, totalBattles: true },
  });
  if (!robot) return false;
  // Season 2 (D7): battles in every mode. `battle_participants.destroyed` covers
  // KotH and Grand Melee too, so both sides of the subtraction count the same modes.
  const [allModesBattles, destroyedCount] = await Promise.all([
    getAllModesBattleCount(robot),
    // A yield is a battle survived: only 0-HP destructions count against it.
    prisma.battleParticipant.count({ where: { robotId, destroyed: true, finalHP: { lte: 0 } } }),
  ]);
  return (allModesBattles - destroyedCount) >= threshold;
}

