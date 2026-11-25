/**
 * Pure helpers for building the battle context that `checkAndAwardAchievements`
 * evaluates.
 *
 * Every battle mode must describe the battle that was actually fought. Team,
 * tag team, team tournament, KotH and Grand Melee orchestrators used to pass
 * placeholders (yield threshold 0, no tuning, 0% HP), which satisfied the
 * matching triggers: any win in those modes unlocked S8 "No Retreat, No
 * Surrender" and C17 "There Is No Spoon", and team/tag wins also unlocked C10
 * "It's Just a Flesh Wound" and C19 "Peace Through Tyranny".
 *
 * Kept separate from `battlePostCombat` so suites that mock that module still
 * run these helpers for real.
 */

/**
 * Whether a robot fought with tuning points allocated.
 * Feeds the `no_tuning_win` trigger (C17).
 */
export function hasAllocatedTuning(bonuses: Partial<Record<string, number>> | undefined): boolean {
  return Object.values(bonuses ?? {}).some((value) => value !== undefined && value > 0);
}

/**
 * HP left as a percentage of max HP, or 0 when max HP is unknown.
 * Feeds `perfect_victory`, `low_hp_win`, `low_hp_survival` and `glass_cannon`.
 */
export function hpPercentOf(hp: number, maxHP: number): number {
  return maxHP > 0 ? (hp / maxHP) * 100 : 0;
}

/**
 * Lowest HP the robot reached during the fight, as a percentage of max HP.
 *
 * Feeds `low_hp_survival` (C19 "Peace Through Tyranny": "<5% HP at any point").
 * Combat events carry a per-robot HP map keyed by robot name (names are unique),
 * so the minimum is read from them. Never above the final HP. Events without a
 * map are skipped, so a battle without HP data reports its final HP.
 */
export function lowestHpPercent(
  events: ReadonlyArray<unknown> | undefined,
  robotName: string,
  maxHP: number,
  finalHP: number,
): number {
  let lowest = finalHP;
  for (const event of events ?? []) {
    if (typeof event !== 'object' || event === null) continue;
    const robotHP = (event as { robotHP?: unknown }).robotHP;
    if (typeof robotHP !== 'object' || robotHP === null) continue;
    const hp = (robotHP as Record<string, unknown>)[robotName];
    if (typeof hp === 'number' && Number.isFinite(hp) && hp < lowest) lowest = hp;
  }
  return hpPercentOf(Math.max(0, lowest), maxHP);
}

/**
 * Whether `robotId` has the strictly lowest pre-battle ELO in the field.
 * A tie doesn't count: at season start every robot is rated the same.
 */
export function isLowestElo(robotId: number, field: ReadonlyArray<{ id: number; elo: number }>): boolean {
  const subject = field.find((robot) => robot.id === robotId);
  if (!subject || field.length < 2) return false;
  return field.every((robot) => robot.id === robotId || robot.elo > subject.elo);
}

/**
 * Names of robots that yielded during the fight.
 *
 * The shared simulation loop emits a `yield` event naming the yielding robot
 * as `defender` (time-limit `yield` events carry no defender and are ignored).
 * KotH and Grand Melee use that loop too, so this is how placement modes tell a
 * yield (left the fight with HP) apart from a destruction.
 */
export function yieldedRobotNames(events: ReadonlyArray<unknown> | undefined): Set<string> {
  const names = new Set<string>();
  for (const event of events ?? []) {
    if (typeof event !== 'object' || event === null) continue;
    const { type, defender } = event as { type?: unknown; defender?: unknown };
    if (type === 'yield' && typeof defender === 'string' && defender.length > 0) names.add(defender);
  }
  return names;
}

/**
 * KotH: the robot that was left alone on the field when the last-standing
 * phase began (`last_standing` event `kpiData.survivorId`), or null when the
 * match never reached that phase or nobody survived it.
 */
export function lastStandingSurvivorId(events: ReadonlyArray<unknown> | undefined): number | null {
  for (const event of events ?? []) {
    if (typeof event !== 'object' || event === null) continue;
    const { type, kpiData } = event as { type?: unknown; kpiData?: { survivorId?: unknown } };
    if (type === 'last_standing' && typeof kpiData?.survivorId === 'number') return kpiData.survivorId;
  }
  return null;
}

/** Facts about one robot's battle that the achievement triggers evaluate. */
export interface BattleAchievementData {
  won: boolean;
  destroyed: boolean;
  finalHpPercent: number;
  /**
   * The subject robot's own ELO change for this battle.
   *
   * Spec #46 R8 Cause B: this was named `eloDiff`, which the `'elo_upset'`
   * trigger read as though it were the gap to the opponent. `ELO_K_FACTOR` is
   * 32, so the value could never clear the 150 threshold and C11 was
   * unreachable. Renamed so the two cannot be confused again; upset triggers
   * read `subjectEloBefore` and `opponentEloBefore` instead.
   */
  eloChange: number;
  /** Subject's rating before the battle — the upset comparison baseline. */
  subjectEloBefore?: number;
  /** Opponent's rating before the battle. Opponent_Elo_Gap is the difference. */
  opponentEloBefore?: number;
  /** Finishing position in placement-resolved modes (Grand Melee, KotH). */
  placement?: number;
  opponentElo: number;
  yielded: boolean;
  opponentYielded: boolean;
  previousBattleLost: boolean;
  damageDealt: number;
  opponentDamageDealt: number;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  hasTuning: boolean;
  hasMainWeapon: boolean;
  battleType: string;
  battleDurationSeconds: number;
  taggedIn?: boolean;
  soloCarry?: boolean;
  /** Lowest HP % the robot reached during the fight (C19). Falls back to finalHpPercent. */
  minHpPercent?: number;
  // ── Season 2 achievement context (optional: only modes where it is known) ──
  /** The persisted battle, for triggers that compare with earlier battles. */
  battleId?: number;
  isDraw?: boolean;
  /** 1v1 modes: the opponent robot. */
  opponentRobotId?: number;
  /** 1v1 modes: the opponent's HP left, as % of its max HP. */
  opponentFinalHpPercent?: number;
  /** Placement modes: robots this robot destroyed in this battle. */
  killsThisBattle?: number;
  /** Placement modes: number of robots that fought. */
  fieldSize?: number;
  /** KotH: won as the last robot standing. */
  lastStanding?: boolean;
  /** KotH: seconds this robot held the zone uncontested. */
  uncontestedSeconds?: number;
  /** Placement modes: this robot had the lowest pre-battle ELO in the field. */
  isLowestEloInField?: boolean;
  /** Team modes: robots per side, and whether all of this robot's team survived. */
  teamSize?: number;
  teamAllSurvived?: boolean;
  /** Tag team reserve: the active partner was destroyed before the tag-in. */
  partnerDestroyed?: boolean;
  /** Tournaments: round of this match and the bracket's final round. */
  tournamentRound?: number;
  tournamentMaxRounds?: number;
}

/** One side of a 1v1 battle, as the achievement context needs it. */
export interface DuelAchievementSide {
  robot: {
    id: number;
    name: string;
    elo: number;
    maxHP: number;
    loadoutType: string | null;
    stance: string | null;
    yieldThreshold: number;
    mainWeaponId: number | null;
  };
  participant: {
    destroyed: boolean;
    finalHP: number;
    eloBefore: number;
    eloAfter: number;
    yielded: boolean;
    damageDealt: number;
  };
  won: boolean;
  previousBattleLost: boolean;
  tuning: Partial<Record<string, number>> | undefined;
  /** Max HP on the combat scale, when `robot.maxHP` is not (resumed finalization). */
  combatMaxHP?: number;
  /** Loadout the battle was fought with, when it differs from `robot.loadoutType`. */
  battleLoadoutType?: string;
}

/** Battle-level facts shared by both sides of a 1v1 battle. */
export interface DuelAchievementBattle {
  battleType: string;
  battleId: number;
  durationSeconds: number;
  isDraw: boolean;
  /** Combat events, for the lowest HP reached (C19). Omitted: C19 falls back to final HP. */
  events?: ReadonlyArray<unknown>;
  tournamentRound?: number;
  tournamentMaxRounds?: number;
}

/**
 * Achievement context for `self` in a 1v1 battle against `opponent`
 * (league 1v1 and solo tournament matches, fresh or resumed).
 */
export function duelAchievementData(
  self: DuelAchievementSide,
  opponent: DuelAchievementSide,
  battle: DuelAchievementBattle,
): BattleAchievementData {
  const selfMaxHP = self.combatMaxHP ?? self.robot.maxHP;
  const opponentMaxHP = opponent.combatMaxHP ?? opponent.robot.maxHP;
  return {
    won: self.won,
    destroyed: opponent.participant.destroyed,
    finalHpPercent: hpPercentOf(self.participant.finalHP, selfMaxHP),
    eloChange: self.participant.eloAfter - self.participant.eloBefore,
    // Spec #46 R8 Cause B: upsets compare pre-battle ratings, not the
    // subject's ELO change, which ELO_K_FACTOR bounds at 32.
    subjectEloBefore: self.participant.eloBefore,
    opponentEloBefore: opponent.participant.eloBefore,
    opponentElo: opponent.robot.elo,
    yielded: self.participant.yielded,
    opponentYielded: opponent.participant.yielded,
    previousBattleLost: self.previousBattleLost,
    damageDealt: self.participant.damageDealt,
    opponentDamageDealt: opponent.participant.damageDealt,
    loadoutType: self.battleLoadoutType ?? (self.robot.loadoutType || 'single'),
    stance: self.robot.stance || 'balanced',
    yieldThreshold: self.robot.yieldThreshold,
    hasTuning: hasAllocatedTuning(self.tuning),
    hasMainWeapon: self.robot.mainWeaponId !== null,
    battleType: battle.battleType,
    battleDurationSeconds: battle.durationSeconds,
    battleId: battle.battleId,
    isDraw: battle.isDraw,
    opponentRobotId: opponent.robot.id,
    opponentFinalHpPercent: hpPercentOf(opponent.participant.finalHP, opponentMaxHP),
    ...(battle.events !== undefined
      ? { minHpPercent: lowestHpPercent(battle.events, self.robot.name, selfMaxHP, self.participant.finalHP) }
      : {}),
    ...(battle.tournamentRound !== undefined ? { tournamentRound: battle.tournamentRound } : {}),
    ...(battle.tournamentMaxRounds !== undefined ? { tournamentMaxRounds: battle.tournamentMaxRounds } : {}),
  };
}
