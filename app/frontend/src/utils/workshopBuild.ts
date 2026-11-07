/**
 * Pure logic for the Workshop's Build table (#504): one row per attribute
 * combining the upgrade plan (permanent levels, credits), the tuning
 * allocation (free, per season) and the value in battle.
 *
 * Costs use the same shared formula the purchase charges. Tuning maxes use
 * the backend rule (`getPerAttributeMax`): level + tuning ≤ academy cap + 5,
 * evaluated against the *planned* level so the table shows what an upgrade
 * does to tuning room before it is committed.
 */
import { getCapForLevel } from '@shared/utils/academyCaps';
import { calculateBaseCost, calculateDiscountedUpgradeCost } from '@shared/utils/upgradeCosts';
import { calculateCombatEffectiveStat, getLoadoutBonus, getStanceModifier } from '@shared/utils/robotStats';
import { applyRefinementsToWeapon, type RefinementRow, type WeaponLike } from '@shared/utils/weaponRefinement';
import type { RobotAttributeKey } from '../types/robot';

export type AcademyType =
  | 'combat_training_academy'
  | 'defense_training_academy'
  | 'mobility_training_academy'
  | 'ai_training_academy';

export type AcademyLevels = Record<AcademyType, number>;

export interface AttributeDef {
  key: RobotAttributeKey;
  label: string;
  icon: string;
}

export interface AttributeCategory {
  id: string;
  label: string;
  icon: string;
  academy: AcademyType;
  academyLabel: string;
  attributes: readonly AttributeDef[];
}

/** The 23 attributes by category. Team Coordination is capped by the AI academy. */
export const ATTRIBUTE_CATEGORIES: readonly AttributeCategory[] = [
  {
    id: 'combat', label: 'Combat Systems', icon: '💥', academy: 'combat_training_academy', academyLabel: 'Combat Academy',
    attributes: [
      { key: 'combatPower', label: 'Combat Power', icon: '💥' },
      { key: 'targetingSystems', label: 'Targeting Systems', icon: '🎯' },
      { key: 'criticalSystems', label: 'Critical Systems', icon: '💢' },
      { key: 'penetration', label: 'Penetration', icon: '🔪' },
      { key: 'weaponControl', label: 'Weapon Control', icon: '🎮' },
      { key: 'attackSpeed', label: 'Attack Speed', icon: '⚡' },
    ],
  },
  {
    id: 'defense', label: 'Defensive Systems', icon: '🛡️', academy: 'defense_training_academy', academyLabel: 'Defense Academy',
    attributes: [
      { key: 'armorPlating', label: 'Armor Plating', icon: '🛡️' },
      { key: 'shieldCapacity', label: 'Shield Capacity', icon: '✨' },
      { key: 'evasionThrusters', label: 'Evasion Thrusters', icon: '💨' },
      { key: 'damageDampeners', label: 'Damage Dampeners', icon: '🔇' },
      { key: 'counterProtocols', label: 'Counter Protocols', icon: '↩️' },
    ],
  },
  {
    id: 'chassis', label: 'Chassis & Mobility', icon: '⚙️', academy: 'mobility_training_academy', academyLabel: 'Mobility Academy',
    attributes: [
      { key: 'hullIntegrity', label: 'Hull Integrity', icon: '🏗️' },
      { key: 'servoMotors', label: 'Servo Motors', icon: '⚙️' },
      { key: 'gyroStabilizers', label: 'Gyro Stabilizers', icon: '🔄' },
      { key: 'hydraulicSystems', label: 'Hydraulic Systems', icon: '💧' },
      { key: 'powerCore', label: 'Power Core', icon: '🔋' },
    ],
  },
  {
    id: 'ai', label: 'AI Processing', icon: '🧮', academy: 'ai_training_academy', academyLabel: 'AI Academy',
    attributes: [
      { key: 'combatAlgorithms', label: 'Combat Algorithms', icon: '🧮' },
      { key: 'threatAnalysis', label: 'Threat Analysis', icon: '🔍' },
      { key: 'adaptiveAI', label: 'Adaptive AI', icon: '🤖' },
      { key: 'logicCores', label: 'Logic Cores', icon: '💻' },
    ],
  },
  {
    id: 'team', label: 'Team Coordination', icon: '🔗', academy: 'ai_training_academy', academyLabel: 'AI Academy',
    attributes: [
      { key: 'syncProtocols', label: 'Sync Protocols', icon: '🔗' },
      { key: 'supportSystems', label: 'Support Systems', icon: '🆘' },
      { key: 'formationTactics', label: 'Formation Tactics', icon: '📐' },
    ],
  },
];

export const ALL_ATTRIBUTES: readonly AttributeDef[] = ATTRIBUTE_CATEGORIES.flatMap((c) => c.attributes);

/** Points of tuning allowed above the academy cap (backend overclock window). */
export const TUNING_OVERCLOCK = 5;

export interface PlannedUpgrade {
  currentLevel: number;
  plannedLevel: number;
  cost: number;
  baseCost: number;
}

export type UpgradePlan = Partial<Record<RobotAttributeKey, PlannedUpgrade>>;
export type TuningMap = Partial<Record<RobotAttributeKey, number>>;
export type AttributeValues = Record<RobotAttributeKey, number>;

export interface CostContext {
  trainingLevel: number;
  rosterCapacity: number;
}

export function categoryCap(category: AttributeCategory, academyLevels: AcademyLevels): number {
  return getCapForLevel(academyLevels[category.academy] ?? 0);
}

export function capFor(key: RobotAttributeKey, academyLevels: AcademyLevels): number {
  const category = ATTRIBUTE_CATEGORIES.find((c) => c.attributes.some((a) => a.key === key));
  return category ? categoryCap(category, academyLevels) : getCapForLevel(0);
}

/** Integer level an attribute is bought at (attributes can carry decimals). */
export function levelOf(values: AttributeValues, key: RobotAttributeKey): number {
  return Math.floor(Number(values[key]));
}

/** Credits and undiscounted credits to raise one attribute from `from` to `to`. */
export function upgradeCost(from: number, to: number, ctx: CostContext): { cost: number; baseCost: number } {
  let cost = 0;
  let baseCost = 0;
  for (let level = from; level < to; level++) {
    cost += calculateDiscountedUpgradeCost(level, ctx.trainingLevel, ctx.rosterCapacity);
    baseCost += calculateBaseCost(level);
  }
  return { cost, baseCost };
}

function entry(currentLevel: number, plannedLevel: number, ctx: CostContext): PlannedUpgrade {
  return { currentLevel, plannedLevel, ...upgradeCost(currentLevel, plannedLevel, ctx) };
}

export function plannedLevelOf(plan: UpgradePlan, values: AttributeValues, key: RobotAttributeKey): number {
  return plan[key]?.plannedLevel ?? levelOf(values, key);
}

/** Plan with `key` set to `plannedLevel` (clamped to [current, cap]); dropped when back at current. */
export function setPlannedLevel(
  plan: UpgradePlan, values: AttributeValues, key: RobotAttributeKey,
  plannedLevel: number, academyLevels: AcademyLevels, ctx: CostContext,
): UpgradePlan {
  const current = levelOf(values, key);
  const target = Math.max(current, Math.min(capFor(key, academyLevels), plannedLevel));
  const next = { ...plan };
  if (target === current) delete next[key];
  else next[key] = entry(current, target, ctx);
  return next;
}

export function planTotal(plan: UpgradePlan): number {
  return Object.values(plan).reduce((sum, p) => sum + (p?.cost ?? 0), 0);
}

/**
 * Raise every attribute toward its cap one level at a time, round-robin, while
 * the budget allows (the same order the old planner used, so "Max" spreads
 * credits evenly instead of maxing the first attribute).
 */
export function maxAllPlan(
  values: AttributeValues, academyLevels: AcademyLevels, budget: number, ctx: CostContext,
  keys: readonly RobotAttributeKey[] = ALL_ATTRIBUTES.map((a) => a.key),
): UpgradePlan {
  const states = keys.map((key) => ({ key, current: levelOf(values, key), planned: levelOf(values, key), cap: capFor(key, academyLevels) }));
  let remaining = budget;
  let progress = true;
  while (progress) {
    progress = false;
    for (const s of states) {
      if (s.planned >= s.cap) continue;
      const levelCost = calculateDiscountedUpgradeCost(s.planned, ctx.trainingLevel, ctx.rosterCapacity);
      if (levelCost > remaining) continue;
      remaining -= levelCost;
      s.planned += 1;
      progress = true;
    }
  }
  const plan: UpgradePlan = {};
  for (const s of states) {
    if (s.planned > s.current) plan[s.key] = entry(s.current, s.planned, ctx);
  }
  return plan;
}

/** Max tuning for an attribute at a given level: cap + 5 − level, never negative (2 decimals). */
export function tuningMaxAt(cap: number, level: number): number {
  return Math.round(Math.max(0, cap + TUNING_OVERCLOCK - level) * 100) / 100;
}

export function tuningTotal(tuning: TuningMap): number {
  return Object.values(tuning).reduce((sum, v) => sum + (v ?? 0), 0);
}

/**
 * Tuning that no longer fits after the planned upgrades, per attribute. The
 * backend scales an allocation down when an upgrade shrinks its room, so the
 * table warns before saving.
 */
export function tuningOverflow(
  tuning: TuningMap, plan: UpgradePlan, academyLevels: AcademyLevels,
): Partial<Record<RobotAttributeKey, number>> {
  const out: Partial<Record<RobotAttributeKey, number>> = {};
  for (const { key } of ALL_ATTRIBUTES) {
    const planned = plan[key]?.plannedLevel;
    if (planned === undefined) continue;
    const max = tuningMaxAt(capFor(key, academyLevels), planned);
    const allocated = tuning[key] ?? 0;
    if (allocated > max) out[key] = Math.round((allocated - max) * 100) / 100;
  }
  return out;
}

export function tuningChanged(a: TuningMap, b: TuningMap): boolean {
  return ALL_ATTRIBUTES.some(({ key }) => (a[key] ?? 0) !== (b[key] ?? 0));
}

/** Weapon attribute bonuses of both equipped weapons, refinements included, keyed `${attr}Bonus`. */
export function weaponBonuses(
  weapons: ReadonlyArray<{ weapon?: unknown; refinements?: ReadonlyArray<RefinementRow> } | null | undefined>,
): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const item of weapons) {
    if (!item?.weapon) continue;
    const refinements: RefinementRow[] = (item.refinements ?? []).map((r) => ({ tier: r.tier, magnitude: r.magnitude, targetAttribute: r.targetAttribute }));
    const effective = applyRefinementsToWeapon(item.weapon as WeaponLike, refinements);
    for (const [field, value] of Object.entries(effective.effectiveAttributeBonuses)) {
      bonuses[field] = (bonuses[field] ?? 0) + value;
    }
  }
  return bonuses;
}

export interface InBattleBreakdown {
  baseAndTuning: number;
  weapon: number;
  loadout: number;
  stance: number;
  total: number;
}

/**
 * The attribute as it fights: the shared combat formula
 * round2((base + tuning + weapons) × (1 + loadout)), then the stance
 * multiplier, as the old Stats tab showed it.
 */
export function inBattle(
  base: number, tuning: number, bonuses: Record<string, number>,
  key: RobotAttributeKey, loadoutType: string, stance: string,
): InBattleBreakdown {
  const weapon = bonuses[`${key}Bonus`] ?? 0;
  const loadout = getLoadoutBonus(loadoutType, key);
  const stanceMod = getStanceModifier(stance, key);
  const combat = calculateCombatEffectiveStat(base, weapon, loadout, tuning);
  return { baseAndTuning: base + tuning, weapon, loadout, stance: stanceMod, total: Math.round(combat * (1 + stanceMod) * 100) / 100 };
}

/** "+15%", "−10%", or "—" for none. */
export function formatPercent(value: number): string {
  if (value === 0) return '—';
  const pct = Math.round(value * 100);
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

/** Up to two decimals, trailing zeros dropped. */
export function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}
