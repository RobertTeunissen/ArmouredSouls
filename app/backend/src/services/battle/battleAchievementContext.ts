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
