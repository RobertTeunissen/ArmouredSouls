/**
 * Achievement Service — Centralized singleton for evaluating and awarding achievements.
 *
 * Single entry point: `checkAndAward(userId, robotId, event)` maps event types
 * to a subset of achievements to evaluate, reads existing unlocks, evaluates
 * conditions, inserts new UserAchievement records, awards credits and prestige,
 * and returns newly unlocked achievements.
 *
 * Achievement failures MUST NOT block game flows — the entire checkAndAward
 * method is wrapped in try-catch and returns an empty array on failure.
 *
 * @module services/achievement/achievementService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { calculateEffectiveStatsWithStance } from '../../utils/robotCalculations';
import {
  ACHIEVEMENTS,
  getAchievementById,
  getAchievementsByTriggerType,
  type AchievementDefinition,
  type AchievementTier,
  type AchievementTriggerType,
} from '../../config/achievements';
import { AchievementError, AchievementErrorCode } from '../../errors/achievementErrors';
import { eventLogger } from '../common/eventLogger';
import { getCurrentCycle } from '../analytics/cycleAnalyticsService';

// ─── Event Types ─────────────────────────────────────────────────────

export type AchievementEventType =
  | 'battle_complete'
  | 'league_promotion'
  | 'weapon_purchased'
  | 'weapon_equipped'
  | 'attribute_upgraded'
  | 'facility_upgraded'
  | 'robot_created'
  | 'tuning_allocated'
  | 'stance_changed'
  | 'onboarding_complete'
  | 'practice_battle'
  | 'tournament_complete'
  | 'daily_finances';

export interface AchievementEvent {
  type: AchievementEventType;
  data: Record<string, unknown>;
}

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  rewardCredits: number;
  rewardPrestige: number;
  badgeIconFile: string;
  robotId: number | null;
  robotName: string | null;
}

// ─── Response Types (for later tasks) ────────────────────────────────

export interface AchievementWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  rewardCredits: number;
  rewardPrestige: number;
  badgeIconFile: string;
  hidden: boolean;
  unlocked: boolean;
  unlockedAt: string | null;
  robotId: number | null;
  robotName: string | null;
  progress: {
    current: number;
    target: number;
    label: string;
    bestRobotName?: string;
  } | null;
  isPinned: boolean;
}

export interface AchievementsResponse {
  achievements: AchievementWithProgress[];
  summary: {
    total: number;
    unlocked: number;
    byTier: Record<string, { total: number; unlocked: number }>;
  };
  rarity: {
    counts: Record<string, number>;
    totalActivePlayers: number;
  };
}

export interface PinnedAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
}

export interface StableAchievementData {
  pinned: PinnedAchievement[];
  totalUnlocked: number;
  totalAvailable: number;
}

export interface AchievementRarityCache {
  counts: Map<string, number>;
  totalActivePlayers: number;
  refreshedAt: Date;
}

// ─── Event → Trigger Type Mapping ────────────────────────────────────

/**
 * Maps each event type to the set of trigger types that should be evaluated.
 * This avoids checking all achievements on every event.
 */
const EVENT_TRIGGER_MAP: Record<AchievementEventType, AchievementTriggerType[]> = {
  battle_complete: [
    'wins', 'losses', 'battles', 'kills', 'elo',
    'perfect_victory', 'low_hp_win', 'elo_upset',
    'win_streak', 'yield_forced', 'yield_comeback',
    'zero_yield_win', 'no_tuning_win', 'glass_cannon',
    'low_hp_survival', 'battle_duration',
    'loadout_wins', 'stance_wins',
    'koth_wins', 'tag_team_wins', 'tag_in_win', 'solo_carry',
    'survival_streak', 'lose_streak', 'all_modes_win',
    'prestige', 'fame', 'streaming_revenue',
    'lifetime_earnings', 'currency',
  ],
  league_promotion: ['league_promotion'],
  weapon_purchased: ['weapon_count', 'weapon_type'],
  weapon_equipped: ['weapon_type', 'effective_stat'],
  attribute_upgraded: ['attribute_upgraded', 'effective_stat'],
  facility_upgraded: ['facility_count'],
  robot_created: ['robot_count'],
  tuning_allocated: ['tuning_allocated', 'tuning_full', 'effective_stat'],
  stance_changed: ['effective_stat'],
  onboarding_complete: ['onboarding'],
  practice_battle: ['practice_battles'],
  tournament_complete: ['tournament_wins'],
  daily_finances: ['bankrupt'],
};


// ─── Service Interface ───────────────────────────────────────────────

export interface IAchievementService {
  checkAndAward(
    userId: number,
    robotId: number | null,
    event: AchievementEvent,
  ): Promise<UnlockedAchievement[]>;

  getPlayerAchievements(userId: number): Promise<AchievementsResponse>;
  getRecentUnlocks(userId: number, limit?: number, since?: Date): Promise<(UnlockedAchievement & { unlockedAt: string })[]>;
  updatePinnedAchievements(userId: number, achievementIds: string[]): Promise<void>;
  getStableAchievements(userId: number): Promise<StableAchievementData>;
  refreshRarityCache(): Promise<void>;
}

// ─── Achievement Service Implementation ──────────────────────────────

class AchievementService implements IAchievementService {
  private rarityCache: AchievementRarityCache = {
    counts: new Map(),
    totalActivePlayers: 0,
    refreshedAt: new Date(0),
  };

  // ─── Core Entry Point ────────────────────────────────────────────

  /**
   * Evaluate and award achievements after a game event.
   *
   * Maps event.type to a subset of trigger types, reads the user's existing
   * unlocks, evaluates each candidate achievement, inserts new records, and
   * awards credits + prestige for each newly unlocked achievement.
   *
   * Wrapped in try-catch — achievement failures MUST NOT block game flows.
   * Returns an empty array on any error.
   */
  async checkAndAward(
    userId: number,
    robotId: number | null,
    event: AchievementEvent,
  ): Promise<UnlockedAchievement[]> {
    try {
      const triggerTypes = EVENT_TRIGGER_MAP[event.type];
      if (!triggerTypes || triggerTypes.length === 0) {
        return [];
      }

      // Gather candidate achievements for this event's trigger types
      const candidates: AchievementDefinition[] = [];
      for (const triggerType of triggerTypes) {
        candidates.push(...getAchievementsByTriggerType(triggerType));
      }

      if (candidates.length === 0) {
        return [];
      }

      // Read existing unlocks for this user (single query)
      const existingUnlocks = await prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true },
      });
      const unlockedIds = new Set(existingUnlocks.map((u) => u.achievementId));

      // Filter out already-unlocked achievements
      const unevaluated = candidates.filter((a) => !unlockedIds.has(a.id));
      if (unevaluated.length === 0) {
        return [];
      }

      // Evaluate each candidate
      const newlyUnlocked: UnlockedAchievement[] = [];

      for (const achievement of unevaluated) {
        const conditionMet = await this.evaluateTrigger(
          achievement,
          userId,
          robotId,
          event,
        );

        if (conditionMet) {
          const effectiveRobotId = achievement.scope === 'robot' ? robotId : null;

          try {
            // Insert UserAchievement record
            await prisma.userAchievement.create({
              data: {
                userId,
                achievementId: achievement.id,
                robotId: effectiveRobotId,
              },
            });

            // Award credits and prestige via direct increment
            await prisma.user.update({
              where: { id: userId },
              data: {
                currency: { increment: achievement.rewardCredits },
                prestige: { increment: achievement.rewardPrestige },
              },
            });

            // Log audit event for cycle summary reconciliation
            try {
              const { cycleNumber } = await getCurrentCycle();
              if (cycleNumber > 0) {
                await eventLogger.logAchievementUnlock(
                  cycleNumber,
                  userId,
                  achievement.id,
                  achievement.rewardCredits,
                  achievement.rewardPrestige,
                  effectiveRobotId ?? undefined,
                );
              }
            } catch (auditError) {
              logger.error(`Failed to log achievement audit event for ${achievement.id} user ${userId}: ${auditError}`);
            }

            // Fetch robot name for the response if robot-scoped
            let robotName: string | null = null;
            if (effectiveRobotId) {
              const robot = await prisma.robot.findUnique({
                where: { id: effectiveRobotId },
                select: { name: true },
              });
              robotName = robot?.name ?? null;
            }

            newlyUnlocked.push({
              id: achievement.id,
              name: achievement.name,
              description: achievement.description,
              tier: achievement.tier,
              rewardCredits: achievement.rewardCredits,
              rewardPrestige: achievement.rewardPrestige,
              badgeIconFile: achievement.badgeIconFile,
              robotId: effectiveRobotId,
              robotName,
            });
          } catch (insertError: unknown) {
            // Handle unique constraint violation gracefully (idempotent)
            const err = insertError as { code?: string };
            if (err.code === 'P2002') {
              // Already unlocked — race condition, skip silently
              continue;
            }
            logger.error(`Failed to award achievement ${achievement.id} to user ${userId}: ${insertError}`);
          }
        }
      }

      return newlyUnlocked;
    } catch (error) {
      logger.error(`Achievement evaluation failed for user ${userId}, event ${event.type}: ${error}`);
      return [];
    }
  }


  // ─── Trigger Evaluation ──────────────────────────────────────────

  /**
   * Evaluate whether a specific achievement's trigger condition is met.
   *
   * For battle-related triggers, event.data provides per-battle context.
   * For cumulative triggers, DB queries provide current stats.
   */
  private async evaluateTrigger(
    achievement: AchievementDefinition,
    userId: number,
    robotId: number | null,
    event: AchievementEvent,
  ): Promise<boolean> {
    const { triggerType, triggerThreshold, triggerMeta } = achievement;
    const data = event.data;

    switch (triggerType) {
      // ── Cumulative Robot Stats (from DB) ───────────────────────
      case 'wins':
        return this.checkRobotStat(robotId, 'wins', triggerThreshold);

      case 'losses':
        return this.checkRobotStat(robotId, 'losses', triggerThreshold);

      case 'battles':
        return this.checkRobotStat(robotId, 'totalBattles', triggerThreshold);

      case 'kills':
        return this.checkRobotStat(robotId, 'kills', triggerThreshold);

      case 'elo':
        return this.checkRobotStat(robotId, 'elo', triggerThreshold);

      case 'fame':
        return this.checkRobotStat(robotId, 'fame', triggerThreshold);

      case 'win_streak':
        return this.checkRobotStat(robotId, 'currentWinStreak', triggerThreshold);

      case 'lose_streak':
        return this.checkRobotStat(robotId, 'currentLoseStreak', triggerThreshold);

      case 'koth_wins':
        return this.checkRobotStat(robotId, 'kothWins', triggerThreshold);

      case 'tag_team_wins':
        return this.checkRobotStat(robotId, 'totalTagTeamWins', triggerThreshold);

      // ── Cumulative User Stats (from DB) ────────────────────────
      case 'prestige':
        return this.checkUserStat(userId, 'prestige', triggerThreshold);

      case 'currency':
        return this.checkUserStat(userId, 'currency', triggerThreshold);

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
          ['league', 'tournament'].includes(battleType)
        );
      }

      case 'yield_forced':
        // For C14 (threshold 1, boolean): opponent yielded in this battle
        // For S13 (threshold 10, cumulative): need to query DB
        if (triggerThreshold && triggerThreshold > 1) {
          return this.checkYieldsForcedCumulative(userId, triggerThreshold);
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
        // L15: reserve robot tagged in and team won
        // S11: specifically the reserve robot (triggerMeta.role === 'reserve')
        return Boolean(data.won) && Boolean(data.taggedIn);

      case 'solo_carry':
        return Boolean(data.won) && Boolean(data.soloCarry);

      // ── Loadout/Stance Win Counters (from DB) ─────────────────
      case 'loadout_wins': {
        if (!robotId) return false;
        const loadoutType = String(triggerMeta?.loadoutType ?? 'dual_wield');
        return this.checkLoadoutWins(robotId, loadoutType, triggerThreshold);
      }

      case 'stance_wins': {
        if (!robotId) return false;
        const stance = String(triggerMeta?.stance ?? 'balanced');
        return this.checkStanceWins(robotId, stance, triggerThreshold);
      }

      // ── All Modes Win (DB query) ──────────────────────────────
      case 'all_modes_win':
        return this.checkAllModesWin(userId);

      // ── League Promotion ──────────────────────────────────────
      case 'league_promotion': {
        if (!robotId) return false;
        const targetLeague = String(triggerMeta?.league ?? '');
        const robot = await prisma.robot.findUnique({
          where: { id: robotId },
          select: { currentLeague: true },
        });
        return robot?.currentLeague === targetLeague;
      }

      // ── Weapon Type ───────────────────────────────────────────
      case 'weapon_type': {
        const targetType = String(triggerMeta?.weaponType ?? '');
        // Check from event data if available, otherwise query DB
        if (data.weaponType) {
          return String(data.weaponType) === targetType;
        }
        return this.checkWeaponType(userId, targetType);
      }

      // ── Count-Based User Triggers (DB queries) ────────────────
      case 'weapon_count':
        return this.checkWeaponCount(userId, triggerThreshold);

      case 'robot_count':
        return this.checkRobotCount(userId, triggerThreshold);

      case 'facility_count': {
        const minLevel = Number(triggerMeta?.minLevel ?? 1);
        return this.checkFacilityCount(userId, triggerThreshold, minLevel);
      }

      // ── One-Time Triggers ─────────────────────────────────────
      case 'onboarding': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { hasCompletedOnboarding: true },
        });
        return user?.hasCompletedOnboarding === true;
      }

      case 'practice_battles': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { totalPracticeBattles: true },
        });
        return (user?.totalPracticeBattles ?? 0) >= (triggerThreshold ?? 0);
      }

      case 'tournament_wins': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { championshipTitles: true },
        });
        return (user?.championshipTitles ?? 0) >= (triggerThreshold ?? 0);
      }

      // ── Tuning Triggers ───────────────────────────────────────
      case 'tuning_allocated':
        return this.checkTuningAllocated(userId);

      case 'tuning_full':
        return this.checkTuningFull(userId, triggerThreshold);

      // ── Effective Stat ────────────────────────────────────────
      case 'effective_stat':
        return this.checkEffectiveStat(userId, triggerThreshold);

      // ── Attribute Upgraded ────────────────────────────────────
      case 'attribute_upgraded':
        // This is a boolean trigger — if the event fired, the condition is met
        return true;

      // ── Financial Triggers (DB aggregates) ────────────────────
      case 'bankrupt': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { currency: true },
        });
        return (user?.currency ?? 0) < 0;
      }

      case 'lifetime_earnings':
        return this.checkLifetimeEarnings(userId, triggerThreshold);

      case 'streaming_revenue':
        return this.checkStreamingRevenue(userId, triggerThreshold);

      case 'survival_streak':
        return this.checkSurvivalStreak(robotId, triggerThreshold);

      default:
        return false;
    }
  }


  // ─── DB Query Helpers ────────────────────────────────────────────

  private async checkRobotStat(
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

  private async checkUserStat(
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

  private async checkWeaponCount(
    userId: number,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;
    const count = await prisma.weaponInventory.count({
      where: { userId },
    });
    return count >= threshold;
  }

  private async checkRobotCount(
    userId: number,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;
    const count = await prisma.robot.count({
      where: {
        userId,
        name: { not: 'Bye Robot' },
      },
    });
    return count >= threshold;
  }

  private async checkFacilityCount(
    userId: number,
    threshold?: number,
    minLevel: number = 1,
  ): Promise<boolean> {
    if (threshold === undefined) return false;
    const count = await prisma.facility.count({
      where: {
        userId,
        level: { gte: minLevel },
      },
    });
    return count >= threshold;
  }

  private async checkWeaponType(
    userId: number,
    weaponType: string,
  ): Promise<boolean> {
    const count = await prisma.weaponInventory.count({
      where: {
        userId,
        weapon: { weaponType },
      },
    });
    return count > 0;
  }

  private async checkLoadoutWins(
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
    // Currently only dual_wield loadout wins are tracked
    if (loadoutType === 'dual_wield') {
      return robot.dualWieldWins >= threshold;
    }
    return false;
  }

  private async checkStanceWins(
    robotId: number,
    stance: string,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
      select: {
        offensiveWins: true,
        defensiveWins: true,
        balancedWins: true,
      },
    });
    if (!robot) return false;

    switch (stance) {
      case 'offensive':
        return robot.offensiveWins >= threshold;
      case 'defensive':
        return robot.defensiveWins >= threshold;
      case 'balanced':
        return robot.balancedWins >= threshold;
      default:
        return false;
    }
  }

  private async checkAllModesWin(userId: number): Promise<boolean> {
    // Check if user has wins in league, koth, tag_team, and tournament
    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
      select: {
        wins: true,
        kothWins: true,
        totalTagTeamWins: true,
      },
    });

    const hasLeagueWin = robots.some((r) => r.wins > 0);
    const hasKothWin = robots.some((r) => r.kothWins > 0);
    const hasTagTeamWin = robots.some((r) => r.totalTagTeamWins > 0);

    // Check tournament wins via user's championship titles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { championshipTitles: true },
    });
    const hasTournamentWin = (user?.championshipTitles ?? 0) > 0;

    return hasLeagueWin && hasKothWin && hasTagTeamWin && hasTournamentWin;
  }

  private async checkTuningAllocated(userId: number): Promise<boolean> {
    // Check if any of the user's robots have tuning allocations
    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
      select: { id: true },
    });
    const robotIds = robots.map((r) => r.id);
    if (robotIds.length === 0) return false;

    const count = await prisma.tuningAllocation.count({
      where: { robotId: { in: robotIds } },
    });
    return count > 0;
  }

  private async checkTuningFull(
    userId: number,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;

    // Find all tuning allocations for user's robots
    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
      select: { id: true },
    });
    const robotIds = robots.map((r) => r.id);
    if (robotIds.length === 0) return false;

    const allocations = await prisma.tuningAllocation.findMany({
      where: { robotId: { in: robotIds } },
    });

    // Check if any robot has total tuning points >= threshold
    for (const alloc of allocations) {
      const total =
        Number(alloc.combatPower) +
        Number(alloc.targetingSystems) +
        Number(alloc.criticalSystems) +
        Number(alloc.penetration) +
        Number(alloc.weaponControl) +
        Number(alloc.attackSpeed) +
        Number(alloc.armorPlating) +
        Number(alloc.shieldCapacity) +
        Number(alloc.evasionThrusters) +
        Number(alloc.damageDampeners) +
        Number(alloc.counterProtocols) +
        Number(alloc.hullIntegrity) +
        Number(alloc.servoMotors) +
        Number(alloc.gyroStabilizers) +
        Number(alloc.hydraulicSystems) +
        Number(alloc.powerCore) +
        Number(alloc.combatAlgorithms) +
        Number(alloc.threatAnalysis) +
        Number(alloc.adaptiveAI) +
        Number(alloc.logicCores) +
        Number(alloc.syncProtocols) +
        Number(alloc.supportSystems) +
        Number(alloc.formationTactics);

      if (total >= threshold) return true;
    }
    return false;
  }

  private async checkEffectiveStat(
    userId: number,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;

    // Load all user's robots with weapons for effective stat calculation
    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
        tuningAllocation: true,
      },
    });

    for (const robot of robots) {
      // Build tuning bonuses map from tuning allocation
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

        // Check if any effective stat meets the threshold
        for (const value of Object.values(effectiveStats)) {
          if (Number(value) >= threshold) return true;
        }
      } catch {
        // If calculation fails for a robot, skip it
        continue;
      }
    }
    return false;
  }

  private async checkYieldsForcedCumulative(
    userId: number,
    threshold: number,
  ): Promise<boolean> {
    // Count opponents who yielded in battles the user's robots won
    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
      select: { id: true },
    });
    const robotIds = robots.map((r) => r.id);
    if (robotIds.length === 0) return false;

    // Count battle participants who yielded in battles won by user's robots
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

  private async checkLifetimeEarnings(
    userId: number,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;

    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
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

  private async checkStreamingRevenue(
    userId: number,
    threshold?: number,
  ): Promise<boolean> {
    if (threshold === undefined) return false;

    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
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

  private async checkSurvivalStreak(
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
      where: {
        robotId,
        destroyed: true,
      },
    });

    return (robot.totalBattles - destroyedCount) >= threshold;
  }


  // ─── Player Achievement Catalog ───────────────────────────────────

  /**
   * Get full achievement catalog with player's progress, unlock status, and rarity.
   *
   * Computes progress at read time from existing User and Robot model fields.
   * Batches all DB reads upfront to avoid per-achievement queries.
   */
  async getPlayerAchievements(userId: number): Promise<AchievementsResponse> {
    // ── Batch all DB reads upfront (parallelized) ───────────────────

    // (a) Load user data — needed first to check existence and get robotIds
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        prestige: true,
        currency: true,
        hasCompletedOnboarding: true,
        totalPracticeBattles: true,
        championshipTitles: true,
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

    // Parse pinned achievements from JSON field
    const pinnedIds = new Set<string>(
      Array.isArray(user.pinnedAchievements)
        ? (user.pinnedAchievements as string[])
        : [],
    );

    // (b) Load robots first (needed for robotIds in subsequent queries)
    const robots = await prisma.robot.findMany({
      where: { userId, name: { not: 'Bye Robot' } },
      select: {
        id: true,
        name: true,
        wins: true,
        losses: true,
        kills: true,
        elo: true,
        fame: true,
        totalBattles: true,
        kothWins: true,
        totalTagTeamWins: true,
        currentWinStreak: true,
        currentLoseStreak: true,
        offensiveWins: true,
        defensiveWins: true,
        balancedWins: true,
        dualWieldWins: true,
      },
    });

    const robotIds = robots.map((r) => r.id);
    const robotCount = robots.length;

    // (c) Run ALL remaining queries in parallel — no dependencies between them
    const [
      unlocks,
      weaponCount,
      facilityCounts,
      tuningAllocations,
      earningsResult,
      streamingResult,
    ] = await Promise.all([
      // Achievement unlocks
      prisma.userAchievement.findMany({
        where: { userId },
        select: {
          achievementId: true,
          robotId: true,
          unlockedAt: true,
          robot: { select: { name: true } },
        },
      }),
      // Weapon count
      prisma.weaponInventory.count({ where: { userId } }),
      // Facility levels
      prisma.facility.findMany({
        where: { userId },
        select: { level: true },
      }),
      // Tuning allocations
      robotIds.length > 0
        ? prisma.tuningAllocation.findMany({
            where: { robotId: { in: robotIds } },
            select: {
              robotId: true,
              combatPower: true,
              targetingSystems: true,
              criticalSystems: true,
              penetration: true,
              weaponControl: true,
              attackSpeed: true,
              armorPlating: true,
              shieldCapacity: true,
              evasionThrusters: true,
              damageDampeners: true,
              counterProtocols: true,
              hullIntegrity: true,
              servoMotors: true,
              gyroStabilizers: true,
              hydraulicSystems: true,
              powerCore: true,
              combatAlgorithms: true,
              threatAnalysis: true,
              adaptiveAI: true,
              logicCores: true,
              syncProtocols: true,
              supportSystems: true,
              formationTactics: true,
            },
          })
        : Promise.resolve([]),
      // Lifetime earnings aggregate
      robotIds.length > 0
        ? prisma.battleParticipant.aggregate({
            where: { robotId: { in: robotIds } },
            _sum: { credits: true },
          })
        : Promise.resolve({ _sum: { credits: null } }),
      // Streaming revenue aggregate
      robotIds.length > 0
        ? prisma.battleParticipant.aggregate({
            where: { robotId: { in: robotIds } },
            _sum: { streamingRevenue: true },
          })
        : Promise.resolve({ _sum: { streamingRevenue: null } }),
    ]);

    const unlockMap = new Map(
      unlocks.map((u) => [
        u.achievementId,
        {
          robotId: u.robotId,
          robotName: u.robot?.name ?? null,
          unlockedAt: u.unlockedAt.toISOString(),
        },
      ]),
    );

    const lifetimeEarnings = earningsResult._sum.credits ?? 0;
    const streamingRevenue = streamingResult._sum.streamingRevenue ?? 0;

    // (d) Get the rarity cache data
    const rarityData = this.getRarityData();

    // ── Compute max tuning points per robot ─────────────────────────

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

    // ── Build achievement list ──────────────────────────────────────

    const achievements: AchievementWithProgress[] = [];

    for (const achievement of ACHIEVEMENTS) {
      const isUnlocked = unlockMap.has(achievement.id);
      const unlock = unlockMap.get(achievement.id);

      // Secret achievements that are NOT unlocked: return hidden data
      if (achievement.hidden && !isUnlocked) {
        achievements.push({
          id: achievement.id,
          name: '???',
          description: '???',
          category: achievement.category,
          tier: achievement.tier,
          rewardCredits: achievement.rewardCredits,
          rewardPrestige: achievement.rewardPrestige,
          badgeIconFile: achievement.badgeIconFile,
          hidden: true,
          unlocked: false,
          unlockedAt: null,
          robotId: null,
          robotName: null,
          progress: null,
          isPinned: pinnedIds.has(achievement.id),
        });
        continue;
      }

      // Compute progress for numeric achievements
      let progress: AchievementWithProgress['progress'] = null;

      if (achievement.progressType === 'numeric' && achievement.triggerThreshold !== undefined) {
        const progressResult = this.computeProgress(
          achievement,
          user,
          robots,
          weaponCount,
          robotCount,
          facilityCounts,
          tuningByRobot,
          lifetimeEarnings,
          streamingRevenue,
        );
        progress = progressResult;
      }

      achievements.push({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        rewardCredits: achievement.rewardCredits,
        rewardPrestige: achievement.rewardPrestige,
        badgeIconFile: achievement.badgeIconFile,
        hidden: achievement.hidden,
        unlocked: isUnlocked,
        unlockedAt: unlock?.unlockedAt ?? null,
        robotId: unlock?.robotId ?? null,
        robotName: unlock?.robotName ?? null,
        progress,
        isPinned: pinnedIds.has(achievement.id),
      });
    }

    // ── Build summary ───────────────────────────────────────────────

    // total = non-hidden achievements + hidden achievements the user has earned
    const unlockedCount = unlockMap.size;
    const nonHiddenCount = ACHIEVEMENTS.filter((a) => !a.hidden).length;
    const earnedHiddenCount = ACHIEVEMENTS.filter(
      (a) => a.hidden && unlockMap.has(a.id),
    ).length;
    const totalCount = nonHiddenCount + earnedHiddenCount;

    const byTier: Record<string, { total: number; unlocked: number }> = {};
    for (const achievement of ACHIEVEMENTS) {
      // Skip hidden achievements the user hasn't earned for the total count
      if (achievement.hidden && !unlockMap.has(achievement.id)) continue;

      if (!byTier[achievement.tier]) {
        byTier[achievement.tier] = { total: 0, unlocked: 0 };
      }
      byTier[achievement.tier].total += 1;
      if (unlockMap.has(achievement.id)) {
        byTier[achievement.tier].unlocked += 1;
      }
    }

    // ── Build rarity response ───────────────────────────────────────

    const rarityCounts: Record<string, number> = {};
    for (const [achievementId, count] of rarityData.counts) {
      rarityCounts[achievementId] = count;
    }

    return {
      achievements,
      summary: {
        total: totalCount,
        unlocked: unlockedCount,
        byTier,
      },
      rarity: {
        counts: rarityCounts,
        totalActivePlayers: rarityData.totalActivePlayers,
      },
    };
  }

  /**
   * Compute progress for a single numeric achievement.
   * Returns { current, target, label, bestRobotName? } or null.
   */
  private computeProgress(
    achievement: AchievementDefinition,
    user: { prestige: number; currency: number; totalPracticeBattles: number; championshipTitles: number },
    robots: Array<{
      id: number; name: string; wins: number; losses: number; kills: number;
      elo: number; fame: number; totalBattles: number; kothWins: number;
      totalTagTeamWins: number; currentWinStreak: number; currentLoseStreak: number;
      offensiveWins: number; defensiveWins: number; balancedWins: number;
      dualWieldWins: number;
    }>,
    weaponCount: number,
    robotCount: number,
    facilityCounts: Array<{ level: number }>,
    tuningByRobot: Map<number, number>,
    lifetimeEarnings: number,
    streamingRevenue: number,
  ): AchievementWithProgress['progress'] {
    const target = achievement.triggerThreshold!;
    const label = achievement.progressLabel ?? '';

    // Helper to find best robot for a given field
    const bestRobotFor = (
      field: 'wins' | 'losses' | 'kills' | 'elo' | 'fame' | 'totalBattles' |
        'kothWins' | 'totalTagTeamWins' | 'currentWinStreak' | 'currentLoseStreak' |
        'offensiveWins' | 'defensiveWins' | 'balancedWins' | 'dualWieldWins',
    ): { current: number; bestRobotName?: string } => {
      if (robots.length === 0) return { current: 0 };
      let best = robots[0];
      for (const robot of robots) {
        if (robot[field] > best[field]) {
          best = robot;
        }
      }
      return { current: best[field], bestRobotName: best.name };
    };

    switch (achievement.triggerType) {
      // ── Robot-scope cumulative stats ───────────────────────────
      case 'wins': {
        const result = bestRobotFor('wins');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'losses': {
        const result = bestRobotFor('losses');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'battles': {
        const result = bestRobotFor('totalBattles');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'kills': {
        const result = bestRobotFor('kills');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'elo': {
        const result = bestRobotFor('elo');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'fame': {
        const result = bestRobotFor('fame');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'win_streak': {
        const result = bestRobotFor('currentWinStreak');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'lose_streak': {
        const result = bestRobotFor('currentLoseStreak');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'koth_wins': {
        const result = bestRobotFor('kothWins');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }
      case 'tag_team_wins': {
        const result = bestRobotFor('totalTagTeamWins');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }

      // ── User-scope stats ──────────────────────────────────────
      case 'prestige':
        return { current: user.prestige, target, label };
      case 'currency':
        return { current: user.currency, target, label };
      case 'lifetime_earnings':
        return { current: lifetimeEarnings, target, label };
      case 'streaming_revenue':
        return { current: streamingRevenue, target, label };
      case 'practice_battles':
        return { current: user.totalPracticeBattles, target, label };
      case 'tournament_wins':
        return { current: user.championshipTitles, target, label };

      // ── Count-based stats ─────────────────────────────────────
      case 'weapon_count':
        return { current: weaponCount, target, label };
      case 'robot_count':
        return { current: robotCount, target, label };
      case 'facility_count': {
        const minLevel = Number(achievement.triggerMeta?.minLevel ?? 1);
        const count = facilityCounts.filter((f) => f.level >= minLevel).length;
        return { current: count, target, label };
      }

      // ── Tuning ────────────────────────────────────────────────
      case 'tuning_full': {
        let maxTuning = 0;
        for (const total of tuningByRobot.values()) {
          if (total > maxTuning) maxTuning = total;
        }
        return { current: Math.floor(maxTuning), target, label };
      }

      // ── Loadout wins (robot-scope) ────────────────────────────
      case 'loadout_wins': {
        const result = bestRobotFor('dualWieldWins');
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }

      // ── Stance wins (robot-scope) ─────────────────────────────
      case 'stance_wins': {
        const stance = String(achievement.triggerMeta?.stance ?? 'balanced');
        const fieldMap: Record<string, 'offensiveWins' | 'defensiveWins' | 'balancedWins'> = {
          offensive: 'offensiveWins',
          defensive: 'defensiveWins',
          balanced: 'balancedWins',
        };
        const field = fieldMap[stance];
        if (!field) return { current: 0, target, label };
        const result = bestRobotFor(field);
        return { current: result.current, target, label, bestRobotName: result.bestRobotName };
      }

      // ── Survival streak (robot-scope) — can't compute without
      //    per-robot destroyed count, so return 0 for now.
      //    The actual check happens in evaluateTrigger at award time.
      case 'survival_streak': {
        // This is a secret achievement (S12) — progress is only shown if unlocked.
        // For unlocked achievements, progress doesn't matter as much.
        // For non-secret numeric achievements, we'd need a per-robot destroyed count query.
        return { current: 0, target, label };
      }

      // ── Yield forced (user-scope, S13) ────────────────────────
      case 'yield_forced': {
        // This requires a complex DB query — return 0 for progress display.
        // The actual check happens in evaluateTrigger at award time.
        return { current: 0, target, label };
      }

      default:
        return null;
    }
  }

  // ─── Recent Unlocks ──────────────────────────────────────────────

  /**
   * Get the most recently unlocked achievements for a user.
   *
   * Queries UserAchievement records ordered by unlockedAt DESC,
   * limited to `limit`. Looks up achievement definitions from config
   * and robot names from the relation.
   */
  async getRecentUnlocks(userId: number, limit: number = 10, since?: Date): Promise<(UnlockedAchievement & { unlockedAt: string })[]> {
    const where: { userId: number; unlockedAt?: { gt: Date } } = { userId };
    if (since) {
      where.unlockedAt = { gt: since };
    }

    const recentRecords = await prisma.userAchievement.findMany({
      where,
      orderBy: { unlockedAt: 'desc' },
      take: limit,
      select: {
        achievementId: true,
        robotId: true,
        unlockedAt: true,
        robot: { select: { name: true } },
      },
    });

    const results: (UnlockedAchievement & { unlockedAt: string })[] = [];

    for (const record of recentRecords) {
      const definition = getAchievementById(record.achievementId);
      if (!definition) continue;

      results.push({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        tier: definition.tier,
        rewardCredits: definition.rewardCredits,
        rewardPrestige: definition.rewardPrestige,
        badgeIconFile: definition.badgeIconFile,
        robotId: record.robotId,
        robotName: record.robot?.name ?? null,
        unlockedAt: record.unlockedAt.toISOString(),
      });
    }

    return results;
  }

  /**
   * Update the user's pinned achievement IDs (max 6).
   *
   * Validates that the array has at most 6 entries, each ID exists in the
   * achievement config, and each ID is unlocked by the user. Throws
   * AchievementError with the appropriate code on validation failure.
   */
  async updatePinnedAchievements(userId: number, achievementIds: string[]): Promise<void> {
    // Validate max 6
    if (achievementIds.length > 6) {
      throw new AchievementError(
        AchievementErrorCode.TOO_MANY_PINNED,
        'Cannot pin more than 6 achievements',
        400,
        { count: achievementIds.length, max: 6 },
      );
    }

    // Validate each ID exists in config
    for (const id of achievementIds) {
      if (!getAchievementById(id)) {
        throw new AchievementError(
          AchievementErrorCode.INVALID_ACHIEVEMENT_ID,
          `Achievement ID "${id}" does not exist`,
          400,
          { achievementId: id },
        );
      }
    }

    // Validate each ID is unlocked by the user
    const unlocks = await prisma.userAchievement.findMany({
      where: { userId, achievementId: { in: achievementIds } },
      select: { achievementId: true },
    });
    const unlockedIds = new Set(unlocks.map((u) => u.achievementId));

    for (const id of achievementIds) {
      if (!unlockedIds.has(id)) {
        throw new AchievementError(
          AchievementErrorCode.ACHIEVEMENT_NOT_UNLOCKED,
          `Achievement "${id}" is not unlocked`,
          400,
          { achievementId: id },
        );
      }
    }

    // Update the user's pinnedAchievements JSON field
    await prisma.user.update({
      where: { id: userId },
      data: { pinnedAchievements: achievementIds },
    });
  }

  /**
   * Get achievement data for the stable page (pinned badges + summary).
   *
   * Returns the user's pinned achievement details (id, name, tier,
   * badgeIconFile, unlockedAt) and a summary with totalUnlocked and
   * totalAvailable. totalAvailable counts non-hidden achievements plus
   * any hidden achievements the user has earned.
   */
  async getStableAchievements(userId: number): Promise<StableAchievementData> {
    // Load user's pinned achievement IDs
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pinnedAchievements: true },
    });

    if (!user) {
      return { pinned: [], totalUnlocked: 0, totalAvailable: ACHIEVEMENTS.filter((a) => !a.hidden).length };
    }

    const pinnedIds = Array.isArray(user.pinnedAchievements)
      ? (user.pinnedAchievements as string[])
      : [];

    // Load pinned achievement unlock records
    const pinnedUnlocks = pinnedIds.length > 0
      ? await prisma.userAchievement.findMany({
          where: { userId, achievementId: { in: pinnedIds } },
          select: { achievementId: true, unlockedAt: true },
        })
      : [];

    const unlockMap = new Map(
      pinnedUnlocks.map((u) => [u.achievementId, u.unlockedAt.toISOString()]),
    );

    // Build pinned achievement details
    const pinned: PinnedAchievement[] = [];
    for (const id of pinnedIds) {
      const definition = getAchievementById(id);
      const unlockedAt = unlockMap.get(id);
      if (definition && unlockedAt) {
        pinned.push({
          id: definition.id,
          name: definition.name,
          tier: definition.tier,
          badgeIconFile: definition.badgeIconFile,
          unlockedAt,
        });
      }
    }

    // Count total unlocked and available
    const totalUnlocked = await prisma.userAchievement.count({ where: { userId } });
    const earnedHiddenCount = await prisma.userAchievement.count({
      where: {
        userId,
        achievementId: { in: ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id) },
      },
    });
    const nonHiddenCount = ACHIEVEMENTS.filter((a) => !a.hidden).length;
    const totalAvailable = nonHiddenCount + earnedHiddenCount;

    return { pinned, totalUnlocked, totalAvailable };
  }

  /**
   * Refresh the in-memory rarity cache from the database.
   *
   * Queries earner counts per achievement and total active players,
   * then updates the in-memory cache. On failure, keeps the existing
   * cache (graceful degradation).
   */
  async refreshRarityCache(): Promise<void> {
    try {
      // Count earners per achievement, excluding bot/test accounts
      const achievementCounts = await prisma.userAchievement.groupBy({
        by: ['achievementId'],
        _count: { achievementId: true },
        where: {
          user: {
            username: {
              not: { startsWith: 'auto_' },
            },
            AND: {
              username: {
                not: { startsWith: 'test_user_' },
              },
            },
          },
        },
      });

      const counts = new Map<string, number>();
      for (const row of achievementCounts) {
        counts.set(row.achievementId, row._count.achievementId);
      }

      // Count total active players, excluding bot/test accounts
      const activePlayerResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(DISTINCT r.user_id) as count
         FROM robots r
         JOIN users u ON u.id = r.user_id
         WHERE r.total_battles > 0
           AND r.name != 'Bye Robot'
           AND u.username NOT LIKE 'auto\\_%'
           AND u.username NOT LIKE 'test\\_user\\_%'`
      );
      const totalActivePlayers = Number(activePlayerResult[0]?.count ?? 0);

      this.rarityCache = {
        counts,
        totalActivePlayers,
        refreshedAt: new Date(),
      };

      logger.info(`Achievement rarity cache refreshed: ${counts.size} achievements, ${totalActivePlayers} active players`);
    } catch (error) {
      logger.error(`Failed to refresh achievement rarity cache: ${error}`);
      // Keep the existing cache on failure (graceful degradation)
    }
  }

  /**
   * Get the current rarity cache data.
   */
  getRarityData(): AchievementRarityCache {
    return this.rarityCache;
  }
}

// ─── Rarity Label Helper ─────────────────────────────────────────────

/**
 * Get the rarity label and color for a given percentage of players who earned an achievement.
 */
export function getRarityLabel(percentage: number): { label: string; color: string } {
  if (percentage > 75) return { label: 'Common', color: 'text-secondary' };
  if (percentage > 25) return { label: 'Uncommon', color: 'text-success' };
  if (percentage > 10) return { label: 'Rare', color: 'text-primary' };
  if (percentage > 1) return { label: 'Epic', color: 'text-warning' };
  return { label: 'Legendary', color: 'text-error' };
}

// ─── Singleton Export ────────────────────────────────────────────────

export const achievementService = new AchievementService();
