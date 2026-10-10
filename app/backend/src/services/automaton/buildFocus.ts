/**
 * Build_Focus mathematics (Spec #55, R4.2–R4.5, design §8.4, task 3.2).
 *
 * Pure functions over an injected group-weight table. The approved presets
 * (`review/STRATEGIES.md` §3, task 4.1) are `BUILD_FOCUS_PRESETS` and
 * `BUILD_FOCUS_WEIGHTS`; the mathematics never depends on their values.
 *
 * - Attribute target: `max(1, ceil(w × L))` for a milestone L, 50 for `Max`.
 * - Priority order: groups by weight descending, ties Combat → Defense →
 *   Mobility → AI/Team.
 * - Increment selection: step k = every robot's k-th priority group; within a
 *   step the lowest attribute first (ties: lower slot, then the attribute
 *   order of `ATTRIBUTE_TO_ACADEMY`); an increment at the academy cap plans the
 *   group's next academy level instead; a gated academy level caps the group
 *   for this evaluation and the step carries on.
 * - Tuning split: pool × w / Σw per group, even within a group, clipped at the
 *   per-attribute maximum, surplus redistributed in group order, rounded to
 *   2 decimals by largest remainder.
 */
import { ATTRIBUTE_TO_ACADEMY } from '../robot/robotUpgradeService';
import { getCapForLevel } from '../../shared/utils/academyCaps';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../shared/utils/robotAttributes';
import type { AttributeGroup, BuildFocusKey } from '../../types/automaton';
import type { FacilityType } from './stableFacts';

export type GroupWeights = Readonly<Record<AttributeGroup, number>>;
export type BuildFocusWeightTable = Readonly<Record<BuildFocusKey, GroupWeights>>;

/** Group order used for ties: Combat, Defense, Mobility, AI/Team. */
export const ATTRIBUTE_GROUPS: readonly AttributeGroup[] = ['combat', 'defense', 'mobility', 'ai'];

/** Academy of each Attribute_Group. */
export const GROUP_ACADEMY: Readonly<Record<AttributeGroup, FacilityType>> = {
  combat: 'combat_training_academy',
  defense: 'defense_training_academy',
  mobility: 'mobility_training_academy',
  ai: 'ai_training_academy',
};

// ── Approved presets (review/STRATEGIES.md §3, R4.1) ─────────────────

export interface BuildFocusPreset {
  key: BuildFocusKey;
  displayName: string;
  weights: GroupWeights;
  /** Admin-only description (`PLAYER_FACING_TEXT.md` §2: not shown to players). */
  description: string;
}

/** The six Build_Focus presets, in the order of the approved table. */
export const BUILD_FOCUS_PRESETS: readonly BuildFocusPreset[] = [
  {
    key: 'bruiser',
    displayName: 'Bruiser',
    weights: { combat: 1.0, defense: 0.8, mobility: 0.7, ai: 0.4 },
    description: 'A heavy hitter that wades in and trades blows. Built to deal damage first and survive the return fire second.',
  },
  {
    key: 'deadeye',
    displayName: 'Deadeye',
    weights: { combat: 1.0, defense: 0.4, mobility: 0.5, ai: 0.8 },
    description: 'Precision over everything: targeting, crits and penetration, backed by sharp combat AI. Fragile if caught.',
  },
  {
    key: 'warden',
    displayName: 'Warden',
    weights: { combat: 0.6, defense: 1.0, mobility: 0.6, ai: 0.5 },
    description: 'A shield wall. Soaks punishment, counters attackers and wins the long fight.',
  },
  {
    key: 'sprinter',
    displayName: 'Sprinter',
    weights: { combat: 0.7, defense: 0.5, mobility: 1.0, ai: 0.5 },
    description: 'Fast, evasive and relentless. Hard to pin down, strikes often.',
  },
  {
    key: 'tactician',
    displayName: 'Tactician',
    weights: { combat: 0.6, defense: 0.6, mobility: 0.5, ai: 1.0 },
    description: 'Reads the battlefield and coordinates the team. Strongest next to allies.',
  },
  {
    key: 'versatile',
    displayName: 'Versatile',
    weights: { combat: 1.0, defense: 1.0, mobility: 1.0, ai: 1.0 },
    description: 'No weak spots and no spikes. Every system upgraded evenly.',
  },
];

/** Group weights per preset: the weight table the registry and Goals use. */
export const BUILD_FOCUS_WEIGHTS: BuildFocusWeightTable = Object.fromEntries(
  BUILD_FOCUS_PRESETS.map((preset) => [preset.key, preset.weights]),
) as Record<BuildFocusKey, GroupWeights>;

/** Attribute level ceiling and the `Max` target. */
export const ATTRIBUTE_MAX_LEVEL = 50;
/** Highest academy level. */
const ACADEMY_MAX_LEVEL = 10;

const ACADEMY_TO_GROUP: Readonly<Record<string, AttributeGroup>> = Object.fromEntries(
  ATTRIBUTE_GROUPS.map((group) => [GROUP_ACADEMY[group], group]),
);

/** Attributes in `ATTRIBUTE_TO_ACADEMY` order (the tie-break order). */
const ATTRIBUTE_ORDER: readonly RobotAttribute[] = ROBOT_ATTRIBUTES.filter((a) => a in ATTRIBUTE_TO_ACADEMY);
const ATTRIBUTE_ORDER_INDEX: ReadonlyMap<RobotAttribute, number> = new Map(ATTRIBUTE_ORDER.map((a, i) => [a, i]));

/** Attribute_Group of an attribute. */
export function groupOfAttribute(attribute: RobotAttribute): AttributeGroup {
  return ACADEMY_TO_GROUP[ATTRIBUTE_TO_ACADEMY[attribute]];
}

/** The attributes of a group, in tie-break order. */
export function attributesOfGroup(group: AttributeGroup): RobotAttribute[] {
  return ATTRIBUTE_ORDER.filter((a) => groupOfAttribute(a) === group);
}

/** Groups by weight descending, ties Combat → Defense → Mobility → AI/Team. */
export function priorityOrder(weights: GroupWeights): AttributeGroup[] {
  return [...ATTRIBUTE_GROUPS].sort((a, b) =>
    weights[b] - weights[a] || ATTRIBUTE_GROUPS.indexOf(a) - ATTRIBUTE_GROUPS.indexOf(b));
}

/**
 * Target of an attribute of weight `weight` for milestone `milestone`:
 * `max(1, ceil(weight × milestone))`, or 50 for `Max`. Computed on weights in
 * hundredths so 0.7 × 10 is 7, not 8 through floating-point error.
 */
export function attributeTarget(weight: number, milestone: number, isMax: boolean): number {
  if (isMax) return ATTRIBUTE_MAX_LEVEL;
  const hundredths = Math.round(weight * 100);
  return Math.min(ATTRIBUTE_MAX_LEVEL, Math.max(1, Math.ceil((hundredths * milestone) / 100)));
}

/** Target per group for one robot. */
export function groupTargets(weights: GroupWeights, milestone: number, isMax: boolean): Record<AttributeGroup, number> {
  return {
    combat: attributeTarget(weights.combat, milestone, isMax),
    defense: attributeTarget(weights.defense, milestone, isMax),
    mobility: attributeTarget(weights.mobility, milestone, isMax),
    ai: attributeTarget(weights.ai, milestone, isMax),
  };
}

/** Smallest academy level whose cap reaches `target` (R4.4). */
export function academyLevelForTarget(target: number): number {
  for (let level = 0; level <= ACADEMY_MAX_LEVEL; level++) {
    if (getCapForLevel(level) >= target) return level;
  }
  return ACADEMY_MAX_LEVEL;
}

// ── Increment selection ──────────────────────────────────────────────

export interface AttributePlanRobot {
  slotIndex: number;
  /** Current base values; whole levels are `Math.floor(value)`. */
  attributes: Readonly<Record<RobotAttribute, number>>;
  weights: GroupWeights;
}

export type AcademyQuote =
  | { kind: 'available'; cost: number }
  | { kind: 'unavailable'; detail: Record<string, number | string> };

export interface AttributePlanInput {
  /** Live robots, ordered by slot. */
  robots: readonly AttributePlanRobot[];
  milestone: number;
  isMax: boolean;
  /** Current academy level per group. */
  academyLevels: Readonly<Record<AttributeGroup, number>>;
  /** Price and gate of the academy level after `currentLevel`. */
  quoteAcademy(group: AttributeGroup, currentLevel: number): AcademyQuote;
  /** Price of raising one attribute from whole level `fromLevel` by one level. */
  incrementCost(fromLevel: number): number;
  balance: number;
}

export type AttributePlan =
  | { kind: 'satisfied' }
  | { kind: 'increments'; robotSlot: number; increments: Partial<Record<RobotAttribute, number>>; cost: number }
  | { kind: 'academy'; group: AttributeGroup; toLevel: number; cost: number }
  | { kind: 'saving'; cost: number; next: 'increment' | 'academy'; robotSlot?: number; attribute?: RobotAttribute; group?: AttributeGroup }
  | { kind: 'blocked'; group: AttributeGroup; detail: Record<string, number | string> };

interface Candidate {
  robotIndex: number;
  attribute: RobotAttribute;
  level: number;
  group: AttributeGroup;
}

/**
 * Plan the attributes Goal's next action (R4.3, R4.4). Walks the increments
 * in selection order while their cumulative cost stays within the balance and
 * returns the increments of the first picked robot as one batch (one
 * `executeUpgradeTransaction` call); the planner re-evaluates after it runs.
 * An academy level is planned on its own, when the next increment needs it.
 */
export function planAttributeStep(input: AttributePlanInput): AttributePlan {
  const levels = input.robots.map((robot) => {
    const copy = {} as Record<RobotAttribute, number>;
    for (const attribute of ATTRIBUTE_ORDER) copy[attribute] = Math.floor(robot.attributes[attribute]);
    return copy;
  });
  const targets = input.robots.map((robot) => groupTargets(robot.weights, input.milestone, input.isMax));
  const priorities = input.robots.map((robot) => priorityOrder(robot.weights));
  const gated = new Map<AttributeGroup, Record<string, number | string>>();

  let spent = 0;
  let batchRobot = -1;
  const batch: Partial<Record<RobotAttribute, number>> = {};
  const batchResult = (): AttributePlan => ({
    kind: 'increments',
    robotSlot: input.robots[batchRobot].slotIndex,
    increments: { ...batch },
    cost: Object.entries(batch).reduce((sum, [attribute, count]) => {
      const from = Math.floor(input.robots[batchRobot].attributes[attribute as RobotAttribute]);
      let total = sum;
      for (let level = from; level < from + (count ?? 0); level++) total += input.incrementCost(level);
      return total;
    }, 0),
  });

  for (let step = 0; step < ATTRIBUTE_GROUPS.length; step++) {
    for (;;) {
      let chosen: Candidate | null = null;
      for (let robotIndex = 0; robotIndex < input.robots.length; robotIndex++) {
        const group = priorities[robotIndex][step];
        const cap = getCapForLevel(input.academyLevels[group]);
        const effectiveTarget = gated.has(group) ? Math.min(targets[robotIndex][group], cap) : targets[robotIndex][group];
        for (const attribute of attributesOfGroup(group)) {
          const level = levels[robotIndex][attribute];
          if (level >= effectiveTarget) continue;
          const candidate: Candidate = { robotIndex, attribute, level, group };
          if (chosen === null || isBefore(candidate, chosen)) chosen = candidate;
        }
      }
      if (chosen === null) break;

      if (chosen.level >= getCapForLevel(input.academyLevels[chosen.group])) {
        const quote = input.quoteAcademy(chosen.group, input.academyLevels[chosen.group]);
        if (quote.kind === 'unavailable') {
          gated.set(chosen.group, quote.detail);
          continue;
        }
        if (batchRobot !== -1) return batchResult();
        const toLevel = input.academyLevels[chosen.group] + 1;
        if (quote.cost > input.balance) {
          return { kind: 'saving', cost: quote.cost, next: 'academy', group: chosen.group };
        }
        return { kind: 'academy', group: chosen.group, toLevel, cost: quote.cost };
      }

      const cost = input.incrementCost(chosen.level);
      if (spent + cost > input.balance) {
        if (batchRobot !== -1) return batchResult();
        return {
          kind: 'saving',
          cost,
          next: 'increment',
          robotSlot: input.robots[chosen.robotIndex].slotIndex,
          attribute: chosen.attribute,
        };
      }
      spent += cost;
      levels[chosen.robotIndex][chosen.attribute] += 1;
      if (batchRobot === -1) batchRobot = chosen.robotIndex;
      if (chosen.robotIndex === batchRobot) batch[chosen.attribute] = (batch[chosen.attribute] ?? 0) + 1;
    }
  }

  if (batchRobot !== -1) return batchResult();
  // Remaining work exists only behind gated academy levels.
  for (const group of ATTRIBUTE_GROUPS) {
    const detail = gated.get(group);
    if (detail === undefined) continue;
    const hasWork = input.robots.some((_robot, robotIndex) =>
      attributesOfGroup(group).some((a) => levels[robotIndex][a] < targets[robotIndex][group]));
    if (hasWork) return { kind: 'blocked', group, detail };
  }
  return { kind: 'satisfied' };
}

function isBefore(a: Candidate, b: Candidate): boolean {
  if (a.level !== b.level) return a.level < b.level;
  if (a.robotIndex !== b.robotIndex) return a.robotIndex < b.robotIndex;
  return (ATTRIBUTE_ORDER_INDEX.get(a.attribute) ?? 0) < (ATTRIBUTE_ORDER_INDEX.get(b.attribute) ?? 0);
}

// ── Tuning split ─────────────────────────────────────────────────────

const EPSILON = 1e-9;

/**
 * Split a tuning pool over the attributes (R4.5). Returns every attribute
 * with a value rounded to 2 decimals; the total equals the pool unless every
 * attribute is clipped at its maximum.
 */
export function computeTuningSplit(
  weights: GroupWeights,
  poolSize: number,
  perAttributeMax: Readonly<Record<RobotAttribute, number>>,
): Record<RobotAttribute, number> {
  const weightSum = ATTRIBUTE_GROUPS.reduce((sum, group) => sum + weights[group], 0);
  const raw = {} as Record<RobotAttribute, number>;
  let surplus = 0;
  for (const group of ATTRIBUTE_GROUPS) {
    const attributes = attributesOfGroup(group);
    const share = weightSum > 0 ? (poolSize * weights[group]) / weightSum / attributes.length : 0;
    for (const attribute of attributes) {
      const max = perAttributeMax[attribute];
      raw[attribute] = Math.min(share, max);
      surplus += share - raw[attribute];
    }
  }

  for (const group of priorityOrder(weights)) {
    for (;;) {
      if (surplus <= EPSILON) break;
      const open = attributesOfGroup(group).filter((a) => perAttributeMax[a] - raw[a] > EPSILON);
      if (open.length === 0) break;
      const share = surplus / open.length;
      for (const attribute of open) {
        const added = Math.min(share, perAttributeMax[attribute] - raw[attribute]);
        raw[attribute] += added;
        surplus -= added;
      }
    }
  }

  return roundLargestRemainder(raw, perAttributeMax);
}

/** Round to hundredths keeping the total, extra hundredths to the largest remainders (ties: attribute order). */
function roundLargestRemainder(
  values: Record<RobotAttribute, number>,
  perAttributeMax: Readonly<Record<RobotAttribute, number>>,
): Record<RobotAttribute, number> {
  const total = Math.round(ATTRIBUTE_ORDER.reduce((sum, a) => sum + values[a], 0) * 100);
  const floors = ATTRIBUTE_ORDER.map((attribute) => {
    const scaled = values[attribute] * 100;
    const floor = Math.floor(scaled + EPSILON);
    return { attribute, floor, remainder: scaled - floor, maxH: Math.round(perAttributeMax[attribute] * 100) };
  });
  let left = total - floors.reduce((sum, f) => sum + f.floor, 0);
  const byRemainder = floors
    .map((f, index) => ({ ...f, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const entry of byRemainder) {
    if (left <= 0) break;
    if (floors[entry.index].floor + 1 > entry.maxH) continue;
    floors[entry.index].floor += 1;
    left--;
  }
  const result = {} as Record<RobotAttribute, number>;
  for (const f of floors) result[f.attribute] = f.floor / 100;
  return result;
}
