/**
 * Trigger Evaluator
 * Evaluates whether a specific achievement's trigger condition is met.
 * Contains the main evaluateTrigger switch and the cached-data check helpers;
 * the check* DB queries live in `triggerQueries`.
 */

import prisma from '../../lib/prisma';
import type { AchievementDefinition } from '../../config/achievements';
import type { AchievementEvent } from './achievementTypes';
import {
  isOneVsOne,
  countRobotOutcomes,
  checkLosingStreakBroken,
  checkRevengeWin,
  checkHigherTierOpponent,
  checkSameChassis,
  getStarterWeaponWins,
  checkDemotionRepromotion,
  getAttributeUpgradeSpend,
  getMerchandisingIncome,
  hasDippedBelow,
  getRepairSpend,
  countLoadoutTypesWithWin,
  hasRobotOnEveryEvent,
  hasBattleStreamingRevenue,
  hasPreviousSeason,
} from './historyTriggers';
import {
  checkWeaponCount,
  checkWeaponsSoldCount,
  checkWeaponsSoldCredits,
  checkWeaponsRefinedCount,
  checkWeaponsRefinedCreditsSpent,
  checkOwnsLegendaryWeapon,
  checkOwnsLegendaryStarterWeapon,
  checkOwnsMaxDpsWeapon,
  checkRobotCount,
  checkFacilityCount,
  checkWeaponType,
  checkRobotEquippedWeaponType,
  checkAllModesWin,
  checkTuningAllocated,
  checkTuningFull,
  checkEffectiveStat,
  checkYieldsForcedCumulative,
  checkLifetimeEarnings,
  checkStreamingRevenue,
  checkSurvivalStreak,
} from './triggerQueries';

// ─── Cached-Data Helpers (no DB queries) ────────────────────────────

/** Check a robot stat from the pre-fetched cached robot (no DB query). */
function checkRobotStatCached(
  cachedRobot: Record<string, unknown> | null,
  field: string,
  threshold?: number,
): boolean {
  if (!cachedRobot || threshold === undefined) return false;
  return Number(cachedRobot[field] ?? 0) >= threshold;
}

/** Check a user stat from the pre-fetched cached user (no DB query). */
function checkUserStatCached(
  cachedUser: Record<string, unknown> | null,
  field: string,
  threshold?: number,
): boolean {
  if (!cachedUser || threshold === undefined) return false;
  return Number(cachedUser[field] ?? 0) >= threshold;
}

/** Check loadout wins from cached robot (no DB query). */
function checkLoadoutWinsCached(
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
function checkStanceWinsCached(
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
      // Season 2 (D7): every mode, including KotH and Grand Melee.
      return checkRobotStatCached(cachedRobot, 'allModesBattles', triggerThreshold);
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

    // ── Grand Melee counters (Spec #46 R8 Cause C) ─────────────
    // `robots.grand_melee_wins` and `grand_melee_top3` already existed but were
    // never incremented and never read. Both are now written by
    // `updateRobotCombatStats()` and follow the `koth_wins` pattern here.
    case 'grand_melee_wins':
      return checkRobotStatCached(cachedRobot, 'grandMeleeWins', triggerThreshold);
    case 'grand_melee_top3':
      return checkRobotStatCached(cachedRobot, 'grandMeleeTop3', triggerThreshold);

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

    case 'grand_melee_win_high_hp': {
      // One-shot boolean: placement 1 in a Grand Melee with HP still above the
      // threshold. Keyed on `placement` rather than `won` because Grand Melee
      // resolves by placement — 20 robots enter and only placement 1 counts.
      const minHpPercent = Number(triggerMeta?.minHpPercent ?? 75);
      return (
        String(data.battleType ?? '') === 'grand_melee' &&
        Number(data.placement ?? 0) === 1 &&
        Number(data.finalHpPercent ?? 0) > minHpPercent
      );
    }

    case 'elo_upset': {
      // Spec #46 R8 Cause B: this compared `eloDiff`, which was the subject's own
      // ELO *change*. `ELO_K_FACTOR` is 32, so the value could never reach the
      // 150 threshold and "Never Tell Me the Odds" (C11) was unreachable. The
      // condition is an upset, so what matters is the Opponent_Elo_Gap — how far
      // above the winner the loser was rated before the battle.
      const minEloDiff = Number(triggerMeta?.minEloDiff ?? 150);
      const battleType = String(data.battleType ?? '');
      const opponentEloGap = Number(data.opponentEloBefore ?? 0) - Number(data.subjectEloBefore ?? 0);
      return (
        Boolean(data.won) &&
        opponentEloGap >= minEloDiff &&
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

    // S1–S3: the robot the event names must have one equipped right now.
    case 'weapon_type_equipped': {
      if (!robotId) return false;
      return checkRobotEquippedWeaponType(userId, robotId, String(triggerMeta?.weaponType ?? ''));
    }

    // ── Count-Based User Triggers (DB queries) ────────────────
    case 'weapon_count':
      return checkWeaponCount(userId, triggerThreshold);
    case 'weapons_sold_count':
      return checkWeaponsSoldCount(userId, triggerThreshold);
    case 'weapons_sold_credits':
      return checkWeaponsSoldCredits(userId, triggerThreshold);
    case 'weapon_sold_at_workshop_level':
      return Number(data.workshopLevel) >= Number(triggerMeta?.minWorkshopLevel ?? 10);

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
      return evaluateSeasonTwoTrigger(achievement, userId, robotId, data, cachedRobot, cachedUser);
  }
}

// ─── Season 2 triggers (ACHIEVEMENTS_SEASON_2_REVAMP.md §4) ─────────

/**
 * Battle-context and history triggers added for Season 2. Cheap context checks
 * run before any query, so a battle that can't qualify costs nothing.
 */
async function evaluateSeasonTwoTrigger(
  achievement: AchievementDefinition,
  userId: number,
  robotId: number | null,
  data: Record<string, unknown>,
  cachedRobot: Record<string, unknown> | null,
  cachedUser: Record<string, unknown> | null,
): Promise<boolean> {
  const { triggerType, triggerThreshold, triggerMeta } = achievement;
  const won = Boolean(data.won);
  const lost = !won && data.isDraw !== true;
  const battleType = String(data.battleType ?? '');
  const oneVsOne = isOneVsOne(battleType);
  const opponentRobotId = Number(data.opponentRobotId ?? 0);

  switch (triggerType) {
    // ── Battle context ─────────────────────────────────────────
    case 'reserve_rescue_win':
      return won && Boolean(data.taggedIn) && data.partnerDestroyed === true;

    case 'moral_victory':
      return oneVsOne && lost && Number(data.damageDealt) > Number(data.opponentDamageDealt);

    case 'close_loss': {
      const maxPercent = Number(triggerMeta?.maxOpponentHpPercent ?? 10);
      return oneVsOne && lost && data.opponentFinalHpPercent !== undefined &&
        Number(data.opponentFinalHpPercent) < maxPercent;
    }

    case 'draw':
      return data.isDraw === true;

    case 'long_battle_win':
      return oneVsOne && won && Number(data.battleDurationSeconds) >= Number(triggerMeta?.minSeconds ?? 100);

    case 'max_yield_win':
      return won && Number(data.yieldThreshold) >= Number(triggerMeta?.minYieldThreshold ?? 50);

    case 'tournament_match_win':
      return won && battleType.startsWith('tournament_');

    case 'tournament_semifinal': {
      const round = Number(data.tournamentRound ?? 0);
      const maxRounds = Number(data.tournamentMaxRounds ?? 0);
      return battleType.startsWith('tournament_') && maxRounds >= 2 && round >= maxRounds - 1;
    }

    case 'tournament_final_loss': {
      const round = Number(data.tournamentRound ?? 0);
      const maxRounds = Number(data.tournamentMaxRounds ?? 0);
      return battleType.startsWith('tournament_') && !won && maxRounds > 0 && round === maxRounds;
    }

    // Grand Melee reports a yield separately from a destruction; both are an
    // elimination.
    case 'grand_melee_first_out':
      return battleType === 'grand_melee' && (data.destroyed === true || data.yielded === true) &&
        Number(data.fieldSize ?? 0) > 1 && Number(data.placement ?? 0) === Number(data.fieldSize);

    case 'grand_melee_survived':
      return battleType === 'grand_melee' && data.destroyed === false && data.yielded !== true;

    case 'kills_in_battle': {
      const mode = triggerMeta?.battleType ? String(triggerMeta.battleType) : null;
      return (mode === null || battleType === mode) &&
        Number(data.killsThisBattle ?? 0) >= Number(triggerMeta?.minKills ?? 3);
    }

    case 'koth_last_standing':
      return battleType === 'koth' && data.lastStanding === true;

    case 'koth_uncontested':
      return battleType === 'koth' && Number(data.uncontestedSeconds ?? 0) >= Number(triggerMeta?.minSeconds ?? 30);

    case 'team_all_survived_win':
      return won && Number(data.teamSize ?? 0) === Number(triggerMeta?.teamSize ?? 3) && data.teamAllSurvived === true;

    case 'underdog_placement_win':
      return (battleType === 'koth' || battleType === 'grand_melee') &&
        Number(data.placement ?? 0) === 1 && data.isLowestEloInField === true;

    // ── Battle context + history ───────────────────────────────
    case 'times_yielded':
      if (!robotId || data.yielded !== true) return false;
      return (await countRobotOutcomes(robotId, 'yielded')) >= (triggerThreshold ?? Infinity);

    case 'times_destroyed':
      // Only a battle that destroyed this robot can move the count.
      if (!robotId || Number(data.finalHpPercent) !== 0) return false;
      return (await countRobotOutcomes(robotId, 'destroyed')) >= (triggerThreshold ?? Infinity);

    case 'losing_streak_broken':
      if (!robotId || !oneVsOne || !won) return false;
      return checkLosingStreakBroken(robotId, Number(triggerMeta?.minLosses ?? 5));

    case 'revenge_win':
      if (!robotId || !oneVsOne || !won || !opponentRobotId || !data.battleId) return false;
      return checkRevengeWin(robotId, opponentRobotId, Number(data.battleId));

    case 'higher_tier_win':
      if (!oneVsOne || !won || !opponentRobotId || !cachedRobot) return false;
      return checkHigherTierOpponent(String(cachedRobot.currentLeague ?? ''), opponentRobotId);

    case 'mirror_match_win':
      if (!oneVsOne || !won || !opponentRobotId || !cachedRobot) return false;
      return checkSameChassis(cachedRobot.frameId, opponentRobotId);

    case 'starter_weapon_wins':
      if (!robotId || !oneVsOne || !won) return false;
      return ((await getStarterWeaponWins([robotId])).get(robotId) ?? 0) >= (triggerThreshold ?? Infinity);

    case 'demotion_repromotion':
      if (!robotId) return false;
      return checkDemotionRepromotion(robotId);

    case 'all_loadout_wins':
      if (data.won === false) return false;
      return (await countLoadoutTypesWithWin(userId)) >= (triggerThreshold ?? 4);

    case 'battle_streaming_revenue':
      if (!robotId) return false;
      return hasBattleStreamingRevenue(robotId, triggerThreshold ?? Infinity);

    // ── Stable history ─────────────────────────────────────────
    case 'attribute_upgrade_spend':
      return (await getAttributeUpgradeSpend(userId)) >= (triggerThreshold ?? Infinity);

    case 'merchandising_income':
      return (await getMerchandisingIncome(userId)) >= (triggerThreshold ?? Infinity);

    case 'repair_spend':
      return (await getRepairSpend(userId)) >= (triggerThreshold ?? Infinity);

    case 'balance_recovery': {
      const high = Number(triggerMeta?.highBalance ?? 1_000_000);
      if (Number(cachedUser?.currency ?? 0) <= high) return false;
      return hasDippedBelow(userId, Number(triggerMeta?.lowBalance ?? 100_000));
    }

    case 'all_event_subscriptions':
      return hasRobotOnEveryEvent(userId);

    case 'previous_season_veteran':
      return hasPreviousSeason(userId);

    case 'achievement_count':
      return (await prisma.userAchievement.count({ where: { userId } })) >= (triggerThreshold ?? Infinity);

    // ── Event-only triggers: the event itself is the condition ──
    case 'robot_image_uploaded':
    case 'tournament_bye':
      return true;

    default:
      return false;
  }
}
