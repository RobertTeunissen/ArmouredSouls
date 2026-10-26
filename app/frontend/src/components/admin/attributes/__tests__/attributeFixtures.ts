/**
 * Fixtures of the admin Attributes page tests.
 */
import {
  ANALYSIS_COLUMNS,
  ATTRIBUTE_GROUPS,
  type AnalysisColumn,
  type AttributeAnalysisCollecting,
  type AttributeAnalysisReady,
  type AttributeGroup,
  type EffectEstimate,
  type EffectsByColumn,
} from '../types';

const ATTRIBUTES: Array<[string, AttributeGroup]> = [
  ['combatPower', 'combat'], ['targetingSystems', 'combat'], ['criticalSystems', 'combat'], ['penetration', 'combat'],
  ['weaponControl', 'combat'], ['attackSpeed', 'combat'], ['armorPlating', 'defence'], ['shieldCapacity', 'defence'],
  ['evasionThrusters', 'defence'], ['damageDampeners', 'defence'], ['counterProtocols', 'defence'], ['hullIntegrity', 'chassis'],
  ['servoMotors', 'chassis'], ['gyroStabilizers', 'chassis'], ['hydraulicSystems', 'chassis'], ['powerCore', 'chassis'],
  ['combatAlgorithms', 'ai'], ['threatAnalysis', 'ai'], ['adaptiveAI', 'ai'], ['logicCores', 'ai'],
  ['syncProtocols', 'team'], ['supportSystems', 'team'], ['formationTactics', 'team'],
];

const est = (effect: number | null, se = 0.4, significant = effect !== null && Math.abs(effect) >= 2 * se): EffectEstimate => ({ effect, se: effect === null ? null : se, significant });

function byColumn(all: number | null, overrides: Partial<Record<AnalysisColumn, EffectEstimate>> = {}): EffectsByColumn {
  const out = {} as EffectsByColumn;
  for (const c of ANALYSIS_COLUMNS) out[c] = overrides[c] ?? (c === 'multi' ? est(null) : est(all));
  return out;
}

/** Combat power helps most, armor plating hurts most, the rest are small. */
const EFFECTS: Record<string, number> = {
  combatPower: 3.4,
  attackSpeed: 1.6,
  hullIntegrity: 1.1,
  armorPlating: -2.2,
  formationTactics: -1.3,
};

export function readyResponse(overrides: Partial<AttributeAnalysisReady> = {}): AttributeAnalysisReady {
  return {
    status: 'ready',
    recordingSince: '2026-10-27T08:00:00.000Z',
    window: { range: '7d', from: '2026-11-03T12:00:00.000Z', to: '2026-11-10T12:00:00.000Z', battlesInRange: 21_480, battlesUsed: 21_480, sampled: false },
    toggles: { tuning: true, weapons: true, refinements: true, loadout: true, stance: true },
    columns: [
      { column: 'all', battles: 21_480, comparisons: 96_310, enough: true, investmentEffect: est(4.1, 0.2), stanceEffects: { offensive: est(1.8, 0.3), defensive: est(-0.4, 0.3) } },
      { column: 'duel', battles: 12_020, comparisons: 12_020, enough: true, investmentEffect: est(4.6, 0.3), stanceEffects: { offensive: est(2.2, 0.4), defensive: est(-0.9, 0.4) } },
      { column: 'team', battles: 4_225, comparisons: 4_225, enough: true, investmentEffect: est(3.2, 0.5), stanceEffects: { offensive: est(0.6, 0.6), defensive: est(1.4, 0.6) } },
      { column: 'multi', battles: 210, comparisons: 240, enough: false, investmentEffect: est(null), stanceEffects: { offensive: est(null), defensive: est(null) } },
    ],
    attributes: ATTRIBUTES.map(([attribute, group]) => ({
      attribute,
      group,
      effects: byColumn(EFFECTS[attribute] ?? 0.2, attribute === 'armorPlating' ? { team: est(0.3) } : {}),
      avgShare: 1 / 23,
      playersAvgShare: attribute === 'combatPower' ? 0.081 : 0.04,
    })),
    groups: ATTRIBUTE_GROUPS.map((group) => ({ group, effects: byColumn(group === 'combat' ? 2.5 : group === 'defence' ? -1.4 : 0.1) })),
    groupPairs: ATTRIBUTE_GROUPS.flatMap((a, i) => ATTRIBUTE_GROUPS.slice(i + 1).map((b) => ({
      groups: [a, b] as [AttributeGroup, AttributeGroup],
      effects: byColumn(a === 'combat' && b === 'chassis' ? 0.9 : 0.05),
    }))),
    profiles: [
      { profile: 'balanced', groups: [], results: { all: { winRate: 0.49, comparisons: 8_120 }, duel: { winRate: 0.48, comparisons: 2_200 }, team: { winRate: 0.5, comparisons: 900 }, multi: { winRate: null, comparisons: 12 } }, shareAll: 0.61, sharePlayers: 0.22 },
      { profile: 'combat', groups: ['combat'], results: { all: { winRate: 0.58, comparisons: 3_400 }, duel: { winRate: 0.6, comparisons: 1_300 }, team: { winRate: 0.54, comparisons: 400 }, multi: { winRate: null, comparisons: 8 } }, shareAll: 0.12, sharePlayers: 0.41 },
      { profile: 'combat+chassis', groups: ['combat', 'chassis'], results: { all: { winRate: 0.43, comparisons: 640 }, duel: { winRate: null, comparisons: 30 }, team: { winRate: null, comparisons: 10 }, multi: { winRate: null, comparisons: 0 } }, shareAll: 0.03, sharePlayers: null },
    ],
    layerFit: {
      trainComparisons: 60_000,
      testComparisons: 19_200,
      rows: [
        { layer: 'base', logLoss: 0.61, accuracy: 0.662 },
        { layer: 'tuning', logLoss: 0.608, accuracy: 0.665 },
        { layer: 'weapons', logLoss: 0.58, accuracy: 0.69 },
        { layer: 'refinements', logLoss: 0.579, accuracy: 0.691 },
        { layer: 'loadout', logLoss: 0.575, accuracy: 0.695 },
        { layer: 'stance', logLoss: 0.574, accuracy: 0.694 },
      ],
    },
    skipped: { draws: 812, tiedPlacements: 0, forfeits: 95, missingBuilds: 0 },
    robots: { all: 61_200, human: 1_840 },
    generatedAt: '2026-11-10T12:00:00.000Z',
    computeMs: 4200,
    ...overrides,
  };
}

export function collectingResponse(overrides: Partial<AttributeAnalysisCollecting> = {}): AttributeAnalysisCollecting {
  return {
    status: 'collecting',
    recordingSince: '2026-10-27T08:00:00.000Z',
    availableFrom: '2026-11-03T08:00:00.000Z',
    battlesRecorded: 6_412,
    ...overrides,
  };
}
